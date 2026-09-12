/**
 * =============================================================================
 * File: netlify/functions/attention-call-viewed.js
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { corsHeaders, createAdminClient, requireUser } from './_shared.js';

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


/**
 * Marca um attention_call como visualizado (viewed_at).
 * Importante: usamos SUPABASE_SERVICE_ROLE_KEY, então validamos o usuário via JWT.
 */
export async function handler(event) {
  const headers = { ...corsHeaders('POST, OPTIONS') };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const supabaseAdmin = createAdminClient();
    const auth = await requireUser(event, supabaseAdmin);
    if (!auth.ok) return { statusCode: auth.statusCode, headers, body: JSON.stringify(auth.body) };

    const body = JSON.parse(event.body || '{}');
    const attentionCallId = body.attentionCallId;
    if (!attentionCallId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'attentionCallId ausente' }) };

    const { data: call, error: callErr } = await supabaseAdmin
      .from('attention_calls')
      .select('id, receiver_id, viewed_at')
      .eq('id', attentionCallId)
      .maybeSingle();

    if (callErr) throw callErr;
    if (!call) return { statusCode: 404, headers, body: JSON.stringify({ error: 'attention_call não encontrado' }) };
    if (call.receiver_id !== auth.user.id) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Apenas o destinatário pode marcar como visto' }) };
    }

    if (!call.viewed_at) {
      const { error: updErr } = await supabaseAdmin
        .from('attention_calls')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', attentionCallId);
      if (updErr) throw updErr;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('[attention-call-viewed]', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
}
