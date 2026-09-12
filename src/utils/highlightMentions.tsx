/**
 * =============================================================================
 * File: src/utils/highlightMentions.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserLink } from '@/components/UserLink';

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


function MentionUsername({ username }: { username: string }) {
  const { data } = useQuery({
    queryKey: ['mention-profile', username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', username)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; username: string } | null;
    },
  });
  if (!data) return <>@{username}</>;
  return <UserLink userId={data.id} username={data.username} className="text-primary font-semibold hover:underline" />;
}

export function highlightMentions(text: string) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const regex = /(@[\p{L}\p{N}._-]{2,32})/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const start = m.index;
    const end = regex.lastIndex;
    if (start > last) parts.push(text.slice(last, start));
    const handle = m[1];
    const username = handle.slice(1);
    parts.push(<span className="text-primary font-semibold"><MentionUsername key={start} username={username} /></span>);
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
