/**
 * =============================================================================
 * File: netlify/functions/list-conversations.js
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


export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders('GET, OPTIONS'), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders('GET, OPTIONS'),
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const admin = createAdminClient();

    const auth = await requireUser(event, admin);
    if (!auth.ok) {
      return { statusCode: auth.statusCode, headers: corsHeaders('GET, OPTIONS'), body: JSON.stringify(auth.body) };
    }
    const userId = auth.user.id;

    // Conversation IDs the user participates in
    const { data: parts, error: pErr } = await admin
      .from('conversation_participants')
      .select('conversation_id, joined_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (pErr) {
      console.log('list-conversations pErr', pErr);
      return { statusCode: 500, headers: corsHeaders('GET, OPTIONS'), body: JSON.stringify({ error: 'Falha ao carregar conversas' }) };
    }

    const ids = (parts || []).map((r) => r.conversation_id).filter(Boolean);
    if (ids.length === 0) {
      return { statusCode: 200, headers: corsHeaders('GET, OPTIONS'), body: JSON.stringify({ conversations: [] }) };
    }

    // Load conversations + participants profiles + latest message
    const { data: conversations, error: cErr } = await admin
      .from('conversations')
      .select(
        '*, conversation_participants!inner(user_id, joined_at, profiles(username, full_name, avatar_url, last_seen)), messages(id, content, created_at, media_urls, user_id, deleted_at, viewed_at)'
      )
      .in('id', ids)
      .order('created_at', { foreignTable: 'messages', ascending: false })
      .limit(1, { foreignTable: 'messages' })
      .order('created_at', { ascending: false });

    if (cErr) {
      console.log('list-conversations cErr', cErr);
      return { statusCode: 500, headers: corsHeaders('GET, OPTIONS'), body: JSON.stringify({ error: 'Falha ao carregar detalhes das conversas' }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders('GET, OPTIONS'),
      body: JSON.stringify({ conversations: conversations || [] }),
    };
  } catch (e) {
    console.log('list-conversations fatal', e);
    return {
      statusCode: 500,
      headers: corsHeaders('GET, OPTIONS'),
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};
