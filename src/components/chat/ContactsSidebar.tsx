/**
 * =============================================================================
 * File: src/components/chat/ContactsSidebar.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus } from "lucide-react";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type ProfileMini = { username?: string | null; avatar_url?: string | null };
type Conversation = {
  id: string;
  name: string | null;
  created_at: string;
  conversation_participants?: { user_id: string; profiles?: ProfileMini | null }[];
};

export function ContactsSidebar({
  userId,
  conversations,
  search,
  setSearch,
  selectedId,
  onSelect,
  onOpenCreateRoom,
}: {
  userId?: string;
  conversations: Conversation[];
  search: string;
  setSearch: (s: string) => void;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onOpenCreateRoom: () => void;
}) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = conversations || [];
    if (!q) return list;
    return list.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [conversations, search]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex gap-2">
        <Input
          placeholder="Buscar contato ou sala..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={onOpenCreateRoom} title="Criar sala privada">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto divide-y">
        {filtered.map((c) => {
          const other = (c.conversation_participants || []).find((p) => p.user_id !== userId);
          const title = c.name || other?.profiles?.username || "Conversa";
          return (
            <button
              key={c.id}
              className={cn("w-full p-3 flex items-center gap-3 text-left hover:bg-muted/60", selectedId === c.id && "bg-muted")}
              onClick={() => onSelect(c.id)}
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={other?.profiles?.avatar_url || undefined} />
                <AvatarFallback>{(title?.[0] || "U").toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="truncate">
                <div className="font-medium leading-tight truncate">{title}</div>
                <div className="text-xs text-muted-foreground">Criada em {new Date(c.created_at).toLocaleString()}</div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Nenhum contato/sala encontrado.</div>
        )}
      </div>
    </div>
  );
}