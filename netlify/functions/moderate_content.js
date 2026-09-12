/**
 * =============================================================================
 * moderate_content.js
 * Moderação de textos (heurística + opcional HuggingFace) e imagens (NSFW via
 * HuggingFace quando HUGGINGFACE_TOKEN presente). Loga tudo em
 * content_moderation_log para auditoria de admin.
 *
 * Body: { action: 'moderate_text' | 'moderate_image', text?, imageUrl?,
 *         userId?, postId? }
 * =============================================================================
 */
import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

const NSFW_MODEL = 'Falconsai/nsfw_image_detection';

/* ---------------------------------------------------------------------------
   CORRIGIDO EM 06/09/2026 — duas falhas nesta função:

   1. Ela aceitava QUALQUER URL em `imageUrl` e ia buscar o conteúdo com o
      `fetch` do servidor. Isso é SSRF: dava para pedir a ela que lesse
      endereços internos do VPS (http://127.0.0.1:8000, metadados da nuvem,
      o painel do Supabase) e o resultado voltava nos rótulos da resposta.
      Agora só domínios de mídia conhecidos são aceitos.

   2. Ela era pública e confiava no `userId` que o cliente mandava. Qualquer
      pessoa com `curl` podia gastar a cota da Hugging Face e escrever linhas
      falsas na tabela de auditoria em nome de outro usuário. Agora exige o
      token do Supabase e usa o id que vem do token — nunca o do corpo.
   --------------------------------------------------------------------------- */
const ALLOWED_MEDIA_HOSTS = [
  'res.cloudinary.com',
  'cloudinary.com',
  'supabase.co',
  'supabase.in',
  'udgservidor.online',
  'undoing.com.br',
];

function isAllowedMediaUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  // Bloqueia endereços internos mesmo que alguém aponte um domínio para eles.
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  return ALLOWED_MEDIA_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

const BANNED_PATTERN = /(se mata|mata se|suicid|vai morr|te odeio|vou te mat|estup|pedofil|chupa pau|vai toma no cu|fdp\b|filho da puta|arrombad|vagabund|mal nazist|incentiv[eo] d[ea] morte)/i;

function severityOf(score) {
  if (score >= 0.85) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}

async function moderateImage(supabase, imageUrl, userId, postId) {
  const defaultAllowed = { allowed: true, action: 'allowed', severity: 'low', labels: {}, reason: null };
  const token = process.env.HF_API_TOKEN || process.env.HUGGINGFACE_TOKEN;
  if (!token) {
    // sem IA disponível: pendente de revisão (não bloqueia o fluxo)
    return { ...defaultAllowed, action: 'pending_review', severity: 'medium', reason: 'No AI available', labels: { pending: 1 } };
  }
  try {
    // redirect 'manual': um redirecionamento poderia levar a allowlist para um
    // endereço interno. Se o host quiser redirecionar, a moderação falha e o
    // conteúdo vai para revisão humana — que é o lado seguro do erro.
    const imgRes = await fetch(imageUrl, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) throw new Error(`img_fetch_${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (buffer.length > 6 * 1024 * 1024) {
      return { ...defaultAllowed, action: 'pending_review', severity: 'medium', reason: 'Image too large', labels: { too_large: 1 } };
    }
    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${NSFW_MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: buffer,
      signal: AbortSignal.timeout(20000),
    });
    if (!hfRes.ok) {
      return { ...defaultAllowed, action: 'pending_review', severity: 'medium', reason: `hf_${hfRes.status}`, labels: { unavailable: 1 } };
    }
    const output = await hfRes.json();
    const labels = Array.isArray(output) ? output.reduce((acc, item) => {
      if (item && item.label) acc[item.label] = Number(item.score ?? 0);
      return acc;
    }, {}) : {};
    const nsfwScore = Math.max(labels['nsfw'] ?? 0, labels['porn'] ?? 0);
    const blocked = nsfwScore >= 0.6;
    return {
      allowed: !blocked,
      action: blocked ? 'blocked' : 'allowed',
      severity: severityOf(nsfwScore),
      labels,
      reason: blocked ? 'Conteúdo impróprio detectado' : null,
    };
  } catch (err) {
    console.error('[moderate_content] image erro:', err?.message);
    return { ...defaultAllowed, action: 'pending_review', severity: 'medium', reason: 'Moderation Error', labels: { error: 1 } };
  }
}

async function logModeration(supabase, entry) {
  try {
    await supabase.from('content_moderation_log').insert(entry);
  } catch (err) {
    console.error('[moderate_content] log erro:', err?.message);
  }
}

export async function handler(event) {
  const headers = corsHeaders('POST, OPTIONS');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const action = body.action || 'moderate_text';
  const supabase = createAdminClient();

  // Identidade obrigatória: sem token, nada de moderação.
  const auth = await requireUser(event, supabase);
  if (!auth.ok) {
    return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };
  }
  const authenticatedUserId = auth.user.id;

  try {
    if (action === 'moderate_image') {
      const imageUrl = String(body.imageUrl || '');
      if (!isAllowedMediaUrl(imageUrl)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'imageUrl_nao_permitida' }) };
      }
      const result = await moderateImage(supabase, imageUrl, authenticatedUserId, body.postId);
      await logModeration(supabase, {
        user_id: authenticatedUserId,
        post_id: body.postId || null,
        content_type: 'image',
        media_url: imageUrl,
        flagged_labels: result.labels,
        severity: result.severity,
        action_taken: result.action,
        auto_blocked: result.action === 'blocked',
        is_published: result.allowed,
      });
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // moderate_text
    const text = String(body.text || '');
    const hit = BANNED_PATTERN.test(text);
    const result = hit
      ? { allowed: false, action: 'blocked', severity: 'high', labels: { hate: 0.9 }, reason: 'Linguagem proibida detectada' }
      : { allowed: true, action: 'allowed', severity: 'low', labels: {}, reason: null };
    await logModeration(supabase, {
      user_id: authenticatedUserId,
      post_id: body.postId || null,
      content_type: 'text',
      text_content: text.slice(0, 5000),
      flagged_labels: result.labels,
      severity: result.severity,
      action_taken: result.action,
      auto_blocked: result.action === 'blocked',
      is_published: result.allowed,
    });
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('[moderate_content] erro:', err?.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err?.message || 'moderation_error' }) };
  }
}