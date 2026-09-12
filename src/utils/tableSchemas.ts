/**
 * =============================================================================
 * File: src/utils/tableSchemas.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


// Mapeamentos simples por tabela (pode ser expandido conforme necessidade)
export const tablePrimaryKeys: Record<string, string> = {
  profiles: 'id',
  posts: 'id',
  comments: 'id',
  likes: 'id',
  post_votes: 'id',
  communities: 'id',
  community_members: 'id',
  community_posts: 'id',
  conversations: 'id',
  conversation_participants: 'id',
  messages: 'id',
  followers: 'id',
  friend_requests: 'id',
  friendships: 'id',
  mentions: 'id',
  last_viewed: 'id',
}
