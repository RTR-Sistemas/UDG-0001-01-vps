/**
 * =============================================================================
 * File: src/components/dialogs/CreatePrivateRoom.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Props = { onCreated?: (conversationId: string) => void };

export default function CreatePrivateRoom({ onCreated }: Props) {
  const [open, setOpen] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openModal = () => setOpen(true);
  const closeModal = () => { setOpen(false); setUsername(""); setError(null); };

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Faça login.");

      const { data: profiles, error: pErr } = await supabase
        .from("profiles").select("id, username").eq("username", username.trim()).limit(1);
      if (pErr) throw pErr;
      const target = profiles?.[0];
      if (!target) throw new Error("Usuário não encontrado.");
      if (target.id === user.id) throw new Error("Você não pode criar sala consigo mesmo.");

      const { data: rpcData, error: rpcErr } = await supabase
        .rpc("get_or_create_private_conversation", { p_other_id: target.id });
      if (!rpcErr && rpcData) { onCreated?.(rpcData); closeModal(); return; }

      const { data: conv, error: cErr } = await supabase
        .from("conversations").insert({ is_group: false, name: null }).select("id").single();
      if (cErr) throw cErr;
      const convId = (conv as any).id as string;
      const { error: cp1 } = await supabase.from("conversation_participants").insert({ conversation_id: convId, user_id: user.id });
      if (cp1) throw cp1;
      const { error: cp2 } = await supabase.from("conversation_participants").insert({ conversation_id: convId, user_id: target.id });
      if (cp2) throw cp2;
      onCreated?.(convId); closeModal();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setBusy(false); }
  };

  return (
    <>
      <button className="rounded-xl border px-3 py-2 hover:bg-accent text-sm" onClick={openModal} type="button">
        Criar sala particular
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-4">
            <div className="text-base font-medium mb-2">Criar sala particular</div>
            <label className="block text-sm mb-1">@username</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm mb-2 bg-background" placeholder="ex.: admin" value={username} onChange={(e) => setUsername(e.target.value)} />
            {error && <div className="text-sm text-destructive mb-2">{error}</div>}
            <div className="flex justify-end gap-2">
              <button className="rounded-lg border px-3 py-2" onClick={closeModal} type="button">Cancelar</button>
              <button className="rounded-lg border px-3 py-2 bg-primary text-primary-foreground disabled:opacity-50" onClick={create} disabled={busy || !username.trim()} type="button">
                {busy ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
