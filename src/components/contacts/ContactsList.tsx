/**
 * =============================================================================
 * File: src/components/contacts/ContactsList.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Contact = { id: string; username: string; avatar_url: string | null };

export default function ContactsList({ onStartChat }: { onStartChat: (userId: string) => void }) {
  const [userId, setUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

  const contactsQuery = useQuery({
    queryKey: ["contacts", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [] as Contact[];
      const { data: a1, error: e1 } = await supabase.from("friendships").select("friend_id").eq("user_id", userId);
      if (e1) throw e1;
      const { data: a2, error: e2 } = await supabase.from("friendships").select("user_id").eq("friend_id", userId);
      if (e2) throw e2;
      const ids = [
        ...((a1 ?? []).map((x: any) => x.friend_id)),
        ...((a2 ?? []).map((x: any) => x.user_id)),
      ].filter(Boolean);
      if (ids.length === 0) return [] as Contact[];
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
      if (pErr) throw pErr;
      return (profiles ?? []) as Contact[];
    },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {contactsQuery.isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando contatos...</div>}
      {Array.isArray(contactsQuery.data) && contactsQuery.data.length > 0 ? (
        contactsQuery.data.map((c: any) => (
          <button key={c.id} onClick={() => onStartChat(c.id)} className="w-full text-left px-4 py-3 border-b hover:bg-accent">
            <div className="text-sm font-medium">@{c.username}</div>
          </button>
        ))
      ) : (
        !contactsQuery.isLoading && <div className="p-4 text-sm text-muted-foreground">Sua lista de contatos está vazia.</div>
      )}
    </div>
  );
}
