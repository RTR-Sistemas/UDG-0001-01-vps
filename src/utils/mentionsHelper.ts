/**
 * =============================================================================
 * File: src/utils/mentionsHelper.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


/**
 * Extrai usernames mencionados no formato @username.
 * - aceita letras/números/._-
 * - não pega emails
 * - limita tamanho (2..32)
 */
export const extractMentions = (text: string): string[] => {
  if (!text) return [];
  const rx = /(?:^|\s)@([\p{L}\p{N}._-]{2,32})/gu;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
};

/**
 * Salva (recalcula) menções de um conteúdo.
 * - dedup
 * - ignora auto-menções
 * - remove menções antigas do mesmo autor para esse content
 * - dispara push de menção para cada registro inserido
 */
export const saveMentions = async (
  contentId: string,
  contentType: "post" | "message" | "comment" | "community_post",
  content: string,
  actorUserId: string
) => {
  const usernames = extractMentions(content);
  if (!usernames.length) return;

  // Remove menções anteriores (para ficar consistente em edições)
  try {
    await supabase
      .from("mentions")
      .delete()
      .eq("content_id", contentId)
      .eq("content_type", contentType)
      .eq("user_id", actorUserId);
  } catch {
    // se RLS impedir delete, seguimos com insert e dedup server-side
  }

  // Buscar IDs (case-sensitive pode falhar, então fazemos fallback ilike por item)
  const found = new Map<string, { id: string; username: string }>();
  const { data: exact } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username", usernames);
  (exact || []).forEach((u: any) => found.set(u.username, { id: u.id, username: u.username }));

  for (const uname of usernames) {
    if (found.has(uname)) continue;
    const { data: one } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", uname)
      .maybeSingle();
    if (one?.id) found.set(one.username, { id: one.id, username: one.username });
  }

  const targets = Array.from(found.values())
    .filter((u) => u.id && u.id !== actorUserId);
  if (!targets.length) return;

  const rows = targets.map((u) => ({
    user_id: actorUserId,
    mentioned_user_id: u.id,
    content_type: contentType,
    content_id: contentId,
    is_read: false,
  }));

  const { data: inserted, error } = await supabase
    .from("mentions")
    .insert(rows)
    .select("id, mentioned_user_id");

  if (error) throw error;

  // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente
  // ao detectar o INSERT na tabela mentions. Não chamar sendPushEvent aqui.
};
