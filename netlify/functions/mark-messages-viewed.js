/**
 * =============================================================================
 * File: netlify/functions/mark-messages-viewed.js
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
 * Marca mensagens como visualizadas (viewed_at) usando Service Role.
 * Fallback para cenários em que RLS não permite UPDATE direto no client.
 *
 * Body:
 * {
 *   conversation_id: string (uuid),
 *   normal_ids?: string[],
 *   temp_ids?: string[],
 *   viewed_at?: string (ISO)
 * }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders('POST, OPTIONS'), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const supabaseAdmin = createAdminClient();
    const auth = await requireUser(event, supabaseAdmin);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify(auth.body) };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const conversationId = body.conversation_id;
    const normalIds = Array.isArray(body.normal_ids) ? body.normal_ids : [];
    const tempIds = Array.isArray(body.temp_ids) ? body.temp_ids : [];
    const viewedAt = typeof body.viewed_at === 'string' ? body.viewed_at : new Date().toISOString();

    if (!conversationId) {
      return { statusCode: 400, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'conversation_id ausente' }) };
    }

    // Verifica se o usuário é participante
    const { data: membership, error: memErr } = await supabaseAdmin
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', auth.user.id)
      .limit(1);
    if (memErr) {
      return { statusCode: 500, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: memErr.message }) };
    }
    if (!membership || membership.length === 0) {
      return { statusCode: 403, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'Sem permissão' }) };
    }

    let updated = 0;

    if (normalIds.length) {
      const { error } = await supabaseAdmin
        .from('messages')
        .update({ viewed_at: viewedAt })
        .eq('conversation_id', conversationId)
        .neq('user_id', auth.user.id)
        .in('id', normalIds);
      if (!error) updated += normalIds.length;
    }

    if (tempIds.length) {
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      const { error } = await supabaseAdmin
        .from('messages')
        .update({ viewed_at: viewedAt, expires_at: expiresAt })
        .eq('conversation_id', conversationId)
        .neq('user_id', auth.user.id)
        .in('id', tempIds);
      if (!error) updated += tempIds.length;
    }

    return {
      statusCode: 200,
      headers: corsHeaders('POST, OPTIONS'),
      body: JSON.stringify({ ok: true, updated }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders('POST, OPTIONS'),
      body: JSON.stringify({ error: e?.message || 'Erro interno' }),
    };
  }
};
