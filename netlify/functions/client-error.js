/**
 * =============================================================================
 * client-error.js — recebe os erros de front-end e grava para você ver depois.
 * Criado em 06/09/2026.
 *
 * Antes disso não havia como saber que a produção quebrou: o único monitor era
 * o usuário mandar um print. Esta função é o mínimo para enxergar o sistema.
 *
 * Regras que ela segue:
 *   • Aceita chamada anônima (o erro pode acontecer antes do login), mas se
 *     vier token válido, registra também de quem foi — ajuda a reproduzir.
 *   • Nunca grava conteúdo de mensagem ou dado pessoal: só tipo, texto do erro,
 *     pilha, rota e navegador.
 *   • Limita o tamanho de cada campo, para um erro em laço não encher o banco.
 *   • Falha em silêncio (responde 204 mesmo em erro interno): um problema no
 *     coletor de erros nunca pode virar um segundo problema para o usuário.
 *
 * Tabela: crie com supabase/checks/criar_tabela_client_errors.sql
 * =============================================================================
 */
import { corsHeaders, createAdminClient, getBearerToken } from './_shared.js';

const LIMITES = { mensagem: 500, pilha: 4000, rota: 200, userAgent: 300, buildId: 100 };

const corta = (valor, max) => (valor == null ? null : String(valor).slice(0, max));

export async function handler(event) {
  const headers = corsHeaders('POST, OPTIONS');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const registro = {
      tipo: corta(body.tipo || 'erro', 20),
      mensagem: corta(body.mensagem, LIMITES.mensagem),
      pilha: corta(body.pilha, LIMITES.pilha),
      rota: corta(body.rota, LIMITES.rota),
      build_id: corta(body.buildId, LIMITES.buildId),
      user_agent: corta(body.userAgent || event.headers?.['user-agent'], LIMITES.userAgent),
      user_id: null,
    };

    if (!registro.mensagem) {
      return { statusCode: 204, headers, body: '' };
    }

    const supabase = createAdminClient();

    // Identificar o usuário é opcional: melhora o diagnóstico, mas um erro
    // anônimo (antes do login) também precisa ser registrado.
    const token = getBearerToken(event);
    if (token) {
      try {
        const { data } = await supabase.auth.getUser(token);
        if (data?.user?.id) registro.user_id = data.user.id;
      } catch {
        /* token inválido: registra como anônimo */
      }
    }

    await supabase.from('client_errors').insert(registro);
    return { statusCode: 204, headers, body: '' };
  } catch (err) {
    console.error('[client-error] falha ao registrar:', err?.message);
    // 204 de propósito: o cliente não deve tentar de novo nem mostrar erro.
    return { statusCode: 204, headers, body: '' };
  }
}
