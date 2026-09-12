/**
 * =============================================================================
 * File: netlify/functions/send-message.js
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


function safeArray(x) {
  return Array.isArray(x) ? x : undefined;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders('POST, OPTIONS'), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders('POST, OPTIONS'),
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const admin = createAdminClient();

    const auth = await requireUser(event, admin);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify(auth.body) };
    }

    const userId = auth.user.id;

    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return { statusCode: 400, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'JSON inválido' }) };
    }

    const conversationId = payload.conversationId;
    const content = typeof payload.content === 'string' ? payload.content : null;
    const media_urls = safeArray(payload.media_urls);

    if (!conversationId) return { statusCode: 400, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'conversationId ausente' }) };
    if ((!content || !content.trim()) && (!media_urls || media_urls.length === 0)) {
      return { statusCode: 400, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'Mensagem vazia' }) };
    }

    // Ensure sender is a participant
    const { data: isPart, error: partErr } = await admin
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (partErr) {
      console.log('send-message partErr', partErr);
      return { statusCode: 500, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'Falha ao validar participante' }) };
    }
    if (!isPart) {
      return { statusCode: 403, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'Sem permissão' }) };
    }

    const insertPayload = {
      conversation_id: conversationId,
      user_id: userId,
      content: content && content.trim() ? content.trim() : null,
      media_urls: media_urls && media_urls.length ? media_urls : null,
    };

    const { data: msg, error: mErr } = await admin.from('messages').insert(insertPayload).select('*').single();
    if (mErr) {
      console.log('send-message mErr', mErr);
      return { statusCode: 500, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'Falha ao enviar mensagem' }) };
    }

    return { statusCode: 200, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ message: msg }) };
  } catch (e) {
    console.log('send-message fatal', e);
    return { statusCode: 500, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'Internal error' }) };
  }
};
