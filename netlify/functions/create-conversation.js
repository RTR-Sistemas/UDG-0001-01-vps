/**
 * =============================================================================
 * File: netlify/functions/create-conversation.js
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
 * Create (or reuse) a 1:1 conversation between the authenticated user and friendId.
 * Uses SERVICE ROLE key so it does not depend on RLS.
 */
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

    const friendId = payload.friendId;
    if (!friendId) {
      return { statusCode: 400, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'friendId ausente' }) };
    }
    if (friendId === userId) {
      return { statusCode: 400, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'friendId não pode ser o próprio usuário' }) };
    }

    // Try to reuse an existing 1:1 conversation that contains BOTH participants.
    const { data: existingRows, error: existingErr } = await admin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('user_id', [userId, friendId]);

    if (!existingErr && Array.isArray(existingRows) && existingRows.length) {
      const counts = new Map();
      for (const r of existingRows) {
        if (!r?.conversation_id) continue;
        counts.set(r.conversation_id, (counts.get(r.conversation_id) || 0) + 1);
      }
      const matchId = [...counts.entries()].find(([, c]) => c >= 2)?.[0];
      if (matchId) {
        const { data: conv } = await admin.from('conversations').select('*').eq('id', matchId).single();
        if (conv && conv.is_group === false) {
          return {
            statusCode: 200,
            headers: corsHeaders('POST, OPTIONS'),
            body: JSON.stringify({ conversation: conv, reused: true }),
          };
        }
      }
    }

    // Friendly name (optional)
    const { data: friendProfile } = await admin
      .from('profiles')
      .select('username, full_name')
      .eq('id', friendId)
      .single();
    const friendlyName = friendProfile?.full_name || friendProfile?.username || null;

    // Create conversation
    const { data: conversation, error: convErr } = await admin
      .from('conversations')
      .insert({ is_group: false, name: friendlyName })
      .select('*')
      .single();

    if (convErr || !conversation?.id) {
      console.log('create-conversation convErr', convErr);
      return { statusCode: 500, headers: corsHeaders('POST, OPTIONS'), body: JSON.stringify({ error: 'Falha ao criar conversa' }) };
    }

    // Insert participants (ignore duplicates)
    const { error: partErr } = await admin
      .from('conversation_participants')
      .insert(
        [
          { conversation_id: conversation.id, user_id: userId },
          { conversation_id: conversation.id, user_id: friendId },
        ],
        { defaultToNull: true }
      );

    if (partErr) {
      console.log('create-conversation partErr', partErr);
      // Try to clean up the conversation if participants insert fails
      await admin.from('conversations').delete().eq('id', conversation.id);
      return {
        statusCode: 500,
        headers: corsHeaders('POST, OPTIONS'),
        body: JSON.stringify({ error: 'Falha ao criar participantes' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders('POST, OPTIONS'),
      body: JSON.stringify({ conversation, reused: false }),
    };
  } catch (e) {
    console.log('create-conversation fatal', e);
    return {
      statusCode: 500,
      headers: corsHeaders('POST, OPTIONS'),
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};
