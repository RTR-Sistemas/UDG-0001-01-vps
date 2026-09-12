/**
 * =============================================================================
 * File: src/components/MentionText.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserLink } from "@/components/UserLink";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type MentionTextProps = {
  text: string;
  className?: string;
  onHashtagClick?: (tag: string) => void;
};

/**
 * Renderiza @username com destaque (azul) e link para o perfil.
 * Aceita letras/números/._- (2..32).
 */
export const MentionText: React.FC<MentionTextProps> = ({ text, className }) => {
  const usernames = React.useMemo(() => {
    if (!text) return [] as string[];
    const rx = /(?:^|\s)@([\p{L}\p{N}._-]{2,32})/gu;
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) set.add(m[1]);
    return Array.from(set);
  }, [text]);

  const { data: users } = useQuery({
    queryKey: ["mention-users", usernames.join(",")],
    enabled: usernames.length > 0,
    queryFn: async () => {
      // fetch em lote (case-sensitive). Em geral username é único e consistente.
      const { data } = await supabase
        .from("profiles")
        .select("id, username")
        .in("username", usernames);
      return (data || []) as { id: string; username: string }[];
    },
  });

  if (!text) return null;
  if (usernames.length === 0) return <span className={className}>{text}</span>;

  const map = new Map<string, string>();
  (users || []).forEach((u) => map.set(u.username, u.id));

  const parts: React.ReactNode[] = [];
  const rxAll = /@([\p{L}\p{N}._-]{2,32})/gu;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = rxAll.exec(text)) !== null) {
    const start = m.index;
    const uname = m[1];
    const end = rxAll.lastIndex;
    if (start > last) parts.push(<span key={`t_${last}`}>{text.slice(last, start)}</span>);

    const id = map.get(uname);
    const chipClass =
      "inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold " +
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:underline";

    parts.push(
      id ? (
        <UserLink key={`m_${start}`} userId={id} username={uname} className={chipClass} />
      ) : (
        <span key={`m_${start}`} className={chipClass}>@{uname}</span>
      )
    );

    last = end;
  }
  if (last < text.length) parts.push(<span key={`t_${last}`}>{text.slice(last)}</span>);

  return <span className={cn("whitespace-pre-wrap", className)}>{parts}</span>;
};
