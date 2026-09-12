/**
 * =============================================================================
 * File: src/components/dialogs/AddContactByCode.tsx
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


type Props = { onAdded?: (friendId: string) => void };

export default function AddContactByCode({ onAdded }: Props) {
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const openModal = () => setOpen(true);
  const closeModal = () => { setOpen(false); setCode(""); setBusy(false); setError(null); setOk(null); };

  const add = async () => {
    setBusy(true); setError(null); setOk(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Faça login.");

      const { data: profiles, error: pErr } = await supabase
        .from("profiles").select("id, username").eq("friend_code", code.trim()).limit(1);
      if (pErr) throw pErr;
      const target = profiles?.[0];
      if (!target) throw new Error("Código inválido.");
      if (target.id === user.id) throw new Error("Esse código é o seu.");

      const { data: fA } = await supabase.from("friendships").select("id").eq("user_id", user.id).eq("friend_id", target.id);
      const { data: fB } = await supabase.from("friendships").select("id").eq("user_id", target.id).eq("friend_id", user.id);
      if ((fA?.length ?? 0) > 0 || (fB?.length ?? 0) > 0) { setOk("Esse contato já está na sua lista."); onAdded?.(target.id); return; }

      const { data: reqExists } = await supabase
        .from("friend_requests").select("id,status")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${user.id})`).limit(1);
      if (reqExists && reqExists.length > 0) { setOk("Já existe uma solicitação pendente entre vocês."); return; }

      const { data: fr, error: insErr } = await supabase
        .from("friend_requests")
        .insert({ sender_id: user.id, receiver_id: target.id, status: "pending" })
        .select('id')
        .single();
      if (insErr) throw insErr;

      // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente ao INSERT em friend_requests.

      setOk(`Convite enviado para @${target.username}.`);
      onAdded?.(target.id);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setBusy(false); }
  };

  return (
    <>
      <button className="rounded-xl border px-3 py-2 hover:bg-accent text-sm" onClick={openModal} type="button">
        Adicionar contato por código UDG
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-4">
            <div className="text-base font-medium mb-2">Adicionar contato (UDG)</div>
            <label className="block text-sm mb-1">Código UDG do amigo</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm mb-2 bg-background" placeholder="ex.: UDG-XXXX-YYYY" value={code} onChange={(e) => setCode(e.target.value)} />
            {error && <div className="text-sm text-destructive mb-2">{error}</div>}
            {ok && <div className="text-sm text-green-600 mb-2">{ok}</div>}
            <div className="flex justify-end gap-2">
              <button className="rounded-lg border px-3 py-2" onClick={closeModal} type="button">Fechar</button>
              <button className="rounded-lg border px-3 py-2 bg-primary text-primary-foreground disabled:opacity-50" onClick={add} disabled={busy || !code.trim()} type="button">
                {busy ? "Enviando..." : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
