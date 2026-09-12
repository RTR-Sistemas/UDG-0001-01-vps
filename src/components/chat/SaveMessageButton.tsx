/**
 * =============================================================================
 * File: src/components/chat/SaveMessageButton.tsx
 * Purpose: Feature "Salvar Mensagem" bilateral em tempo real
 *
 * Fluxo:
 * 1. Botão aparece abaixo de mensagem recebida (requester)
 * 2. Clique → insere em saved_messages com status=pending
 * 3. Dono da msg vê banner em tempo real
 * 4. Dono aceita → status=approved → salvo permanentemente (sem expiração)
 * 5. Dono recusa → registro deletado imediatamente
 * =============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Bookmark, BookmarkCheck, X, Check, Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { playSaveRequestSound, playSaveApprovedSound, playSaveRejectedSound } from "@/hooks/usePlatformSounds";

interface SaveMessageButtonProps {
  messageId: string;
  conversationId: string;
  requesterId: string;     // usuário que quer salvar
  ownerId: string;         // usuário que enviou a mensagem
  messageContent?: string | null;
  mediaUrls?: string[] | null;
  isOwn: boolean;
  className?: string;
}

interface SaveRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  requester_id: string;
  owner_id: string;
}

export function SaveMessageButton({
  messageId,
  conversationId,
  requesterId,
  ownerId,
  messageContent,
  mediaUrls,
  isOwn,
  className,
}: SaveMessageButtonProps) {
  const { toast } = useToast();
  const [saveRequest, setSaveRequest] = useState<SaveRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [responding, setResponding] = useState(false);

  // Ref para evitar problema de closure stale no broadcast listener
  const saveRequestRef = useRef<SaveRequest | null>(null);
  useEffect(() => { saveRequestRef.current = saveRequest; }, [saveRequest]);

  // ═══════════════════════════════════════════════════════
  // Busca estado do banco
  // ═══════════════════════════════════════════════════════
  const fetchState = useCallback(async () => {
    const { data } = await supabase
      .from("saved_messages")
      .select("id, status, requester_id, owner_id")
      .eq("original_message_id", messageId)
      .maybeSingle();

    const prev = saveRequestRef.current;

    if (data) {
      // Detecta transição de pending → approved para notificar
      if (prev?.status === "pending" && data.status === "approved") {
        setIsSaved(true);
        playSaveApprovedSound();
        toast({ title: "✅ Mensagem salva!", description: "A mensagem foi salva permanentemente." });
      } else if (prev?.status === "pending" && data.status === "rejected") {
        playSaveRejectedSound();
        toast({ title: "❌ Salvamento recusado", description: "O usuário não autorizou.", variant: "destructive" });
      }

      // Nova solicitação chegou para o dono
      if (!prev && data.status === "pending" && isOwn) {
        playSaveRequestSound();
        toast({ title: "📌 Pedido de salvamento", description: "Alguém quer salvar esta mensagem." });
      }

      setSaveRequest(data as SaveRequest);
      if (data.status === "approved") setIsSaved(true);
    } else {
      setSaveRequest(null);
      // Se foi rejeitado (registro deletado), limpa o estado
    }
  }, [messageId, isOwn, toast]);

  // ═══════════════════════════════════════════════════════
  // Mount: carrega estado + subscrição realtime
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    let mounted = true;
    const channelName = `chat-ui-${conversationId}`;

    fetchState();

    const channel = supabase.channel(channelName);
    channel
      .on("broadcast", { event: "save_request_update" }, (payload) => {
        if (!mounted) return;
        const evtMsgId = (payload as any).payload?.messageId;
        if (evtMsgId === messageId) {
          fetchState();
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [messageId, conversationId, fetchState]);

  // ═══════════════════════════════════════════════════════
  // Broadcast helper
  // ═══════════════════════════════════════════════════════
  const broadcastUpdate = useCallback(() => {
    supabase.channel(`chat-ui-${conversationId}`).send({
      type: "broadcast",
      event: "save_request_update",
      payload: { messageId },
    });
  }, [conversationId, messageId]);

  // ═══════════════════════════════════════════════════════
  // Requester: solicita salvamento
  // ═══════════════════════════════════════════════════════
  const handleSaveRequest = useCallback(async () => {
    if (loading || isSaved || saveRequest) return;
    setLoading(true);

    try {
      // expires_at muito longo — quando aprovado será NULL (permanente)
      // Quando pendente, expira em 2 minutos se não respondido
      const pendingExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      const initialStatus = isOwn ? "approved" : "pending";

      const { data, error } = await supabase
        .from("saved_messages")
        .insert({
          original_message_id: messageId,
          conversation_id: conversationId,
          requester_id: requesterId,
          owner_id: ownerId,
          content: messageContent,
          media_urls: mediaUrls,
          status: initialStatus,
          // Se for o próprio dono salvando, salva permanentemente (100 anos)
          expires_at: isOwn
            ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
            : pendingExpiresAt,
          saved_at: isOwn ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      setSaveRequest(data as SaveRequest);
      broadcastUpdate();

      if (isOwn) {
        setIsSaved(true);
        toast({ title: "✅ Mensagem salva!", description: "Sua mensagem foi salva permanentemente." });
      } else {
        toast({ title: "📬 Solicitação enviada!", description: "Aguardando autorização do usuário." });
      }
    } catch {
      toast({ title: "Erro ao solicitar salvamento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [loading, isSaved, saveRequest, messageId, conversationId, requesterId, ownerId, messageContent, mediaUrls, isOwn, toast, broadcastUpdate]);

  // ═══════════════════════════════════════════════════════
  // Owner: responde ao pedido (aceitar / negar)
  // ═══════════════════════════════════════════════════════
  const handleOwnerResponse = useCallback(async (accept: boolean) => {
    if (!saveRequest || responding) return;
    setResponding(true);

    try {
      if (accept) {
        // Aceitar → atualiza para approved com expires_at permanente (100 anos)
        const { error } = await supabase
          .from("saved_messages")
          .update({
            status: "approved",
            saved_at: new Date().toISOString(),
            // Salvo permanentemente
            expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", saveRequest.id);

        if (error) throw error;

        setSaveRequest((prev) => prev ? { ...prev, status: "approved" } : null);
        setIsSaved(true);
        broadcastUpdate();

        toast({ title: "✅ Mensagem salva!", description: "A mensagem foi salva permanentemente para ambos." });
      } else {
        // Recusar → deleta o registro imediatamente
        const { error } = await supabase
          .from("saved_messages")
          .delete()
          .eq("id", saveRequest.id);

        if (error) throw error;

        setSaveRequest(null);
        broadcastUpdate();

        toast({ title: "❌ Recusado", description: "A mensagem não foi salva." });
      }
    } catch {
      toast({ title: "Erro ao responder", variant: "destructive" });
    } finally {
      setResponding(false);
    }
  }, [saveRequest, responding, broadcastUpdate, toast]);

  // ═══════════════════════════════════════════════════════
  // RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════

  // Banner para o DONO da mensagem quando alguém quer salvar
  if (isOwn && saveRequest?.status === "pending") {
    return (
      <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-500/8 dark:bg-amber-500/12 border border-amber-400/30 backdrop-blur-md shadow-lg max-w-[300px]">
          <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4 text-amber-500 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 leading-tight">
              Salvar mensagem?
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              O outro usuário quer guardar esta mensagem.
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              className="h-8 w-8 flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
              onClick={() => handleOwnerResponse(true)}
              disabled={responding}
              title="Permitir"
            >
              {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button
              className="h-8 w-8 flex items-center justify-center bg-rose-500/15 hover:bg-rose-500 text-rose-500 dark:text-rose-400 hover:text-white rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
              onClick={() => handleOwnerResponse(false)}
              disabled={responding}
              title="Negar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mensagem já salva — badge permanente
  if (isSaved || saveRequest?.status === "approved") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-full",
        "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
        className
      )}>
        <BookmarkCheck className="h-3 w-3 text-emerald-500" />
        <span>Mensagem salva</span>
      </div>
    );
  }

  // Aguardando resposta do dono (para o requester)
  if (saveRequest?.status === "pending" && !isOwn) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 text-[10px] font-medium rounded-full",
        "bg-amber-500/8 text-amber-600 dark:text-amber-400 border border-amber-400/25",
        className
      )}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Aguardando autorização...</span>
      </div>
    );
  }

  // Não exibe nada se foi rejeitado
  if (saveRequest?.status === "rejected") return null;

  // Botão padrão para solicitar salvamento
  return (
    <div className={cn("mt-1.5", className)}>
      <button
        onClick={handleSaveRequest}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-full",
          "transition-all duration-200 group",
          "bg-muted/40 hover:bg-primary/10 text-muted-foreground hover:text-primary",
          "border border-transparent hover:border-primary/20",
          loading && "opacity-60 cursor-not-allowed"
        )}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Bookmark className="h-3 w-3 transition-transform group-hover:scale-110" />
        )}
        <span>Salvar Mensagem</span>
      </button>
    </div>
  );
}

// =========================================================
// Componente para exibir mensagens salvas do usuário
// =========================================================
interface SavedMessageItemProps {
  savedMsg: {
    id: string;
    content?: string | null;
    media_urls?: string[] | null;
    saved_at: string;
    requester_id: string;
    owner_id: string;
  };
  currentUserId: string;
  onDelete?: (id: string) => void;
}

export function SavedMessageItem({ savedMsg, onDelete }: SavedMessageItemProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from("saved_messages").delete().eq("id", savedMsg.id);
      onDelete?.(savedMsg.id);
      toast({ title: "Mensagem removida das salvas" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group relative p-3.5 rounded-xl border bg-card hover:bg-accent/30 transition-all duration-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {savedMsg.content && (
            <p className="text-sm text-foreground break-words line-clamp-3 font-normal leading-relaxed">
              {savedMsg.content}
            </p>
          )}
          {savedMsg.media_urls && savedMsg.media_urls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {savedMsg.media_urls.map((url, i) => (
                <img key={i} src={url} alt="mídia salva" className="h-16 w-16 object-cover rounded-lg border bg-muted" />
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1.5 font-medium">
            <BookmarkCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Salvo em {new Date(savedMsg.saved_at).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}</span>
          </p>
        </div>
        <button
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 rounded-lg flex items-center justify-center"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
