/**
 * =============================================================================
 * File: src/components/chat/SaveModeToggle.tsx
 * Purpose: Interruptor global de "Salvar Conversa" para um chat bilateral.
 *
 * Fluxo:
 * 1. Usuário A liga o toggle → envia pedido ao usuário B
 * 2. Usuário B aceita → modo salvar ativado para AMBOS
 *    → mensagens novas ficam salvas permanentemente
 * 3. Quando desligado por qualquer usuário:
 *    → o registro de conversation_save_mode é DELETADO IMEDIATAMENTE
 *    → mensagens já salvas (saved_messages com status=approved) PERMANECEM
 *    → novas mensagens voltam ao comportamento temporário padrão
 * 
 * Alterado em: 2026-06-13
 * Alterações:
 *  - Suporte à prop mode="banner" para exibição integrada na área de texto.
 *  - Envio de evento "save_mode_rejected" por broadcast em caso de recusa.
 *  - Notificação toast para o solicitante quando o pedido for negado.
 *  - Retorno expandido do hook useSaveModeStatus (status, requesterId, ownerId, etc.).
 * =============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  BookmarkCheck,
  Loader2,
  Shield,
  Check,
  X,
  Bookmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SaveMode = {
  id: string;
  conversation_id: string;
  requester_id: string;
  owner_id: string;
  status: "pending" | "approved" | "rejected";
  started_at: string | null;
  deactivated_at: string | null;
};

interface SaveModeToggleProps {
  conversationId: string;
  currentUserId: string;
  peerId: string;
  className?: string;
  mode?: "toggle" | "banner";
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SaveModeToggle({
  conversationId,
  currentUserId,
  peerId,
  className,
  mode = "toggle",
}: SaveModeToggleProps) {
  const { toast } = useToast();

  const [saveMode, setSaveMode] = useState<SaveMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [responding, setResponding] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const channelName = `save-mode-${conversationId}`;

  // ── Carrega estado atual do banco ─────────────────────────────────────────

  const loadSaveMode = useCallback(async () => {
    const { data, error } = await supabase
      .from("conversation_save_mode")
      .select("*")
      .eq("conversation_id", conversationId)
      .in("status", ["pending", "approved"])
      .is("deactivated_at", null)
      .maybeSingle();

    if (error) {
      console.error("[SaveModeToggle] erro ao carregar save mode:", error);
      return;
    }

    setSaveMode(data as SaveMode | null);
  }, [conversationId]);

  useEffect(() => {
    loadSaveMode();
  }, [loadSaveMode]);

  // ── Realtime broadcast ────────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase.channel(channelName);
    channel
      .on("broadcast", { event: "save_mode_update" }, () => loadSaveMode())
      .on("broadcast", { event: "save_mode_rejected" }, () => {
        toast({
          title: "Solicitação recusada",
          description: "O outro usuário recusou o pedido para salvar esta conversa.",
          variant: "destructive"
        });
        loadSaveMode();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [channelName, loadSaveMode, toast]);

  // ── Broadcast helper ──────────────────────────────────────────────────────

  const broadcastUpdate = useCallback(() => {
    supabase.channel(channelName).send({
      type: "broadcast",
      event: "save_mode_update",
      payload: { conversationId },
    });
  }, [channelName, conversationId]);

  // ── LIGAR ─────────────────────────────────────────────────────────────────

  const handleActivate = useCallback(async () => {
    if (loading || saveMode) return;
    setLoading(true);
    try {
      // 1. Verificamos se já existe um registro ativo/pendente no banco para evitar conflito 409
      const { data: existing, error: checkError } = await supabase
        .from("conversation_save_mode")
        .select("*")
        .eq("conversation_id", conversationId)
        .in("status", ["pending", "approved"])
        .is("deactivated_at", null)
        .maybeSingle();

      if (checkError) {
        console.error("[SaveModeToggle] erro ao checar existente:", checkError);
      }

      if (existing) {
        console.log("[SaveModeToggle] Registro ativo encontrado no banco:", existing);
        setSaveMode(existing as SaveMode);
        broadcastUpdate();
        toast({
          title: "Modo já ativo",
          description: existing.status === "approved"
            ? "O modo salvar já está ativo nesta conversa."
            : "Já existe um pedido de salvamento pendente.",
        });
        setLoading(false);
        return;
      }

      // 2. Se não existir, fazemos o insert normalmente
      const { data, error } = await supabase
        .from("conversation_save_mode")
        .insert({
          conversation_id: conversationId,
          requester_id: currentUserId,
          owner_id: peerId,
          status: "pending",
          started_at: null,
          deactivated_at: null,
        })
        .select()
        .single();

      if (error) throw error;
      setSaveMode(data as SaveMode);
      broadcastUpdate();
      toast({ title: "📬 Pedido enviado", description: "Aguardando autorização do outro usuário." });
    } catch (err: any) {
      console.error("[SaveModeToggle] erro ao ativar:", err);
      toast({ title: "Erro ao ativar modo salvar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [loading, saveMode, conversationId, currentUserId, peerId, broadcastUpdate, toast]);

  // ── DESLIGAR — Soft deactivation ────────────────────────────────────────

  const handleDeactivate = useCallback(async () => {
    if (!saveMode || deactivating) return;
    setDeactivating(true);
    try {
      // Query the latest message to set deactivated_at boundary
      const { data: latestMsg } = await supabase
        .from("messages")
        .select("created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const deactivatedAt = latestMsg?.created_at || "now";

      const { error } = await supabase
        .from("conversation_save_mode")
        .update({
          deactivated_at: deactivatedAt,
          status: "rejected",
        })
        .eq("id", saveMode.id);

      if (error) throw error;

      setSaveMode(null);
      broadcastUpdate();

      toast({
        title: "🔓 Modo salvar desativado",
        description: "Mensagens salvas anteriormente permanecem. Novas mensagens voltam ao modo temporário.",
      });
    } catch {
      toast({ title: "Erro ao desligar", variant: "destructive" });
    } finally {
      setDeactivating(false);
    }
  }, [saveMode, deactivating, conversationId, broadcastUpdate, toast]);

  // ── RESPONDER (dono aceita/recusa) ────────────────────────────────────────

  const handleOwnerResponse = useCallback(async (accept: boolean) => {
    if (!saveMode || responding) return;
    setResponding(true);
    try {
      if (accept) {
        // Query the latest message to set started_at boundary (add 1 second to avoid saving it)
        const { data: latestMsg } = await supabase
          .from("messages")
          .select("created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let startedAt = "now";
        if (latestMsg?.created_at) {
          const date = new Date(latestMsg.created_at);
          date.setSeconds(date.getSeconds() + 1);
          startedAt = date.toISOString();
        }

        const { data, error } = await supabase
          .from("conversation_save_mode")
          .update({
            status: "approved",
            started_at: startedAt,
            deactivated_at: null,
          })
          .eq("id", saveMode.id)
          .select()
          .single();

        if (error) throw error;

        setSaveMode(data as SaveMode);
        broadcastUpdate();
        toast({ title: "✅ Modo salvar ativado", description: "Novas mensagens estão sendo salvas para ambos." });
      } else {
        // Recusa — hard delete imediato
        const { error } = await supabase
          .from("conversation_save_mode")
          .delete()
          .eq("id", saveMode.id);

        if (error) throw error;

        setSaveMode(null);
        // Notifica o outro usuário via canal realtime de rejeição
        void supabase.channel(channelName).send({
          type: "broadcast",
          event: "save_mode_rejected",
          payload: { conversationId },
        });
        toast({ title: "❌ Pedido recusado", description: "Mensagens continuarão sendo apagadas normalmente." });
      }
    } catch {
      toast({ title: "Erro ao responder", variant: "destructive" });
    } finally {
      setResponding(false);
    }
  }, [saveMode, responding, conversationId, broadcastUpdate, toast]);

  // ─── Derivados ───────────────────────────────────────────────────────────

  const isRequester = saveMode?.requester_id === currentUserId;
  const isOwner = saveMode?.owner_id === currentUserId;
  const isApproved = saveMode?.status === "approved";
  const isPending = saveMode?.status === "pending";

  if (mode === "banner") {
    if (isPending && isOwner) {
      return (
        <div className={cn("animate-in slide-in-from-top-2 fade-in duration-300", className)}>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-400/30 backdrop-blur-md shadow-md">
            <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 leading-tight">Salvar conversa?</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">O outro usuário quer salvar esta conversa.</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                className="h-7 w-7 flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
                onClick={() => handleOwnerResponse(true)}
                disabled={responding}
                title="Aceitar"
              >
                {responding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </button>
              <button
                className="h-7 w-7 flex items-center justify-center bg-rose-500/15 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
                onClick={() => handleOwnerResponse(false)}
                disabled={responding}
                title="Recusar"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // ─── BANNER: dono recebe pedido ───────────────────────────────────────────

  if (isPending && isOwner) {
    return (
      <div className={cn("animate-in slide-in-from-top-2 fade-in duration-300", className)}>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-400/30 backdrop-blur-md shadow-md">
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Shield className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 leading-tight">Salvar conversa?</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">O outro usuário quer salvar esta conversa.</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              className="h-7 w-7 flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
              onClick={() => handleOwnerResponse(true)}
              disabled={responding}
              title="Aceitar"
            >
              {responding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center bg-rose-500/15 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
              onClick={() => handleOwnerResponse(false)}
              disabled={responding}
              title="Recusar"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Pendente (requester aguarda) ─────────────────────────────────────────

  if (isPending && isRequester) {
    return (
      <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-400/25 text-[10px] text-amber-600 dark:text-amber-400 font-medium", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Aguardando autorização...</span>
      </div>
    );
  }

  // ─── ATIVO ────────────────────────────────────────────────────────────────

  if (isApproved) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25", className)}>
        <BookmarkCheck className="h-3.5 w-3.5 text-emerald-500" />
        <div className="flex flex-col items-start justify-center">
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-none">Salvar ativado</span>
          <span className="text-[8px] text-muted-foreground leading-none mt-0.5">Mensagens permanentes</span>
        </div>
        <div className="flex items-center ml-1" title="Desligar modo salvar">
          <Switch
            checked={true}
            onCheckedChange={(checked) => {
              if (!checked) handleDeactivate();
            }}
            disabled={deactivating}
            className="data-[state=checked]:bg-emerald-500 h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
          />
        </div>
      </div>
    );
  }

  // ─── DEFAULT: desligado ───────────────────────────────────────────────────

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-transparent hover:border-primary/20 transition-all", className)}>
      <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex flex-col items-start justify-center">
        <span className="text-[10px] font-medium text-muted-foreground leading-none">Salvar conversa</span>
      </div>
      <div className="flex items-center ml-1 relative">
        {loading && <Loader2 className="h-3 w-3 animate-spin absolute -left-4 text-muted-foreground" />}
        <Switch
          checked={false}
          onCheckedChange={(checked) => {
            if (checked) handleActivate();
          }}
          disabled={loading}
          className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
        />
      </div>
    </div>
  );
}

// ─── Hook: expõe status do modo salvar ───────────────────────────────────────

export function useSaveModeStatus(conversationId: string | null) {
  const [data, setData] = useState<{ 
    isActive: boolean; 
    startedAt: string | null;
    status: "pending" | "approved" | "rejected" | null;
    requesterId: string | null;
    ownerId: string | null;
    id: string | null;
  }>({
    isActive: false,
    startedAt: null,
    status: null,
    requesterId: null,
    ownerId: null,
    id: null,
  });

  useEffect(() => {
    if (!conversationId) {
      setData({ isActive: false, startedAt: null, status: null, requesterId: null, ownerId: null, id: null });
      return;
    }

    let mounted = true;

    const load = async () => {
      const { data: dbData, error } = await supabase
        .from("conversation_save_mode")
        .select("id, status, started_at, requester_id, owner_id")
        .eq("conversation_id", conversationId)
        .in("status", ["pending", "approved"])
        .is("deactivated_at", null)
        .maybeSingle();

      if (error) {
        console.error("[useSaveModeStatus] erro ao carregar:", error);
        return;
      }

      if (!mounted) return;

      setData({
        isActive: dbData?.status === "approved",
        startedAt: dbData?.started_at || null,
        status: (dbData?.status as any) || null,
        requesterId: dbData?.requester_id || null,
        ownerId: dbData?.owner_id || null,
        id: dbData?.id || null,
      });
    };

    load();

    const channel = supabase
      .channel(`save-mode-${conversationId}`)
      .on("broadcast", { event: "save_mode_update" }, load)
      .on("broadcast", { event: "save_mode_rejected" }, load)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return data;
}
