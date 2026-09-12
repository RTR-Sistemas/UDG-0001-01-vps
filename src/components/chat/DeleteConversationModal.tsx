/**
 * =============================================================================
 * File: src/components/chat/DeleteConversationModal.tsx
 * Purpose: Modal para excluir conversa inteira ou mensagens selecionadas.
 * 
 * Alterado em: 2026-06-13
 * Alterações:
 *  - Adicionado suporte a prop initialMode para inicializar o modal diretamente na
 *    tela desejada (ex: confirmação de exclusão total).
 * =============================================================================
 */

import { useState, useCallback } from "react";
import {
  Trash2,
  X,
  CheckSquare,
  Square,
  Loader2,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MessagePreview {
  id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string;
  user_id: string;
}

interface DeleteConversationModalProps {
  conversationId: string;
  currentUserId: string;
  messages: MessagePreview[];
  onClose: () => void;
  onDeleted: (deletedIds: string[] | "all") => void;
  initialMode?: "choose" | "all" | "select";
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function DeleteConversationModal({
  conversationId,
  currentUserId,
  messages,
  onClose,
  onDeleted,
  initialMode = "choose",
}: DeleteConversationModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"choose" | "all" | "select">(initialMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  // ── Toggle seleção ────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => setSelectedIds(new Set(messages.map((m) => m.id)));
  const clearAll = () => setSelectedIds(new Set());

  // ── Excluir toda a conversa ───────────────────────────────────────────────

  const handleDeleteAll = useCallback(async () => {
    if (!confirmAll) { setConfirmAll(true); return; }
    setLoading(true);
    try {
      const ids = messages.map((m) => m.id);
      if (ids.length === 0) {
        toast({ title: "Nada para excluir" });
        onDeleted("all");
        onClose();
        return;
      }

      // Usa RPC (security definer) — contorna RLS de UPDATE em messages
      const { data, error } = await (supabase as any).rpc("delete_conversation_messages", {
        p_conversation_id: conversationId,
        p_scope: "me",
        p_message_ids: ids,
      });

      if (error) {
        // Fallback: UPDATE direto (caso RPC não exista)
        const now = new Date().toISOString();
        const { error: updErr } = await supabase
          .from("messages")
          .update({ deleted_at: now, content: null, media_urls: null })
          .in("id", ids);
        if (updErr) throw updErr;
      }

      toast({ title: "✅ Conversa excluída", description: "Todas as mensagens foram apagadas." });
      onDeleted("all");
      onClose();
    } catch {
      toast({ title: "Erro ao excluir", description: "Verifique sua conexão e tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [confirmAll, messages, toast, onDeleted, onClose, conversationId]);

  // ── Excluir mensagens selecionadas ────────────────────────────────────────

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const ids = Array.from(selectedIds);

      // Usa RPC (security definer) — contorna RLS de UPDATE em messages
      const { error } = await (supabase as any).rpc("delete_conversation_messages", {
        p_conversation_id: conversationId,
        p_scope: "me",
        p_message_ids: ids,
      });

      if (error) {
        const now = new Date().toISOString();
        const { error: updErr } = await supabase
          .from("messages")
          .update({ deleted_at: now, content: null, media_urls: null })
          .in("id", ids);
        if (updErr) throw updErr;
      }

      toast({
        title: `✅ ${ids.length} mensagem(ns) excluída(s)`,
        description: "As mensagens selecionadas foram apagadas.",
      });
      onDeleted(ids);
      onClose();
    } catch {
      toast({ title: "Erro ao excluir", description: "Verifique sua conexão e tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedIds, toast, onDeleted, onClose, conversationId]);

  // ── Helper: formata preview da mensagem ──────────────────────────────────

  const msgPreview = (msg: MessagePreview) => {
    if (msg.content) {
      if (msg.content === "__sticker__" || msg.content === "__temp_sticker__") return "🧩 Figurinha";
      if (msg.content.startsWith("__sticker_emoji__")) return msg.content.replace("__sticker_emoji__", "");
      if (msg.content === "__location_request__") return "📍 Solicitação de localização";
      if (msg.content.startsWith("__location__")) return "📍 Localização";
      return msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content;
    }
    if (msg.media_urls && msg.media_urls.length > 0) return "📷 Mídia";
    return "Mensagem";
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[200] animate-in fade-in duration-200 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-popover border border-border shadow-2xl rounded-2xl w-full max-w-md flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-sm">
              {mode === "choose" && "Excluir mensagens"}
              {mode === "all" && "Excluir conversa"}
              {mode === "select" && `Selecionar mensagens (${selectedIds.size})`}
            </span>
          </div>
          <button
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── TELA 1: Escolher modo ─────────────────────────────────────── */}
        {mode === "choose" && (
          <div className="p-4 space-y-3 flex-1">
            <p className="text-sm text-muted-foreground mb-4">
              O que você deseja fazer com esta conversa?
            </p>

            <button
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-destructive/40 hover:bg-destructive/5 transition-all text-left group"
              onClick={() => setMode("all")}
            >
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 group-hover:bg-destructive/20 transition-colors">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold">Excluir conversa inteira</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Apaga todas as {messages.length} mensagens
                </p>
              </div>
            </button>

            <button
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
              onClick={() => setMode("select")}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <CheckSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Selecionar mensagens</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escolha quais mensagens apagar
                </p>
              </div>
            </button>

            <Button variant="ghost" className="w-full mt-2" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        )}

        {/* ── TELA 2: Confirmar excluir tudo ───────────────────────────── */}
        {mode === "all" && (
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-base">Excluir toda a conversa?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Esta ação apagará <strong>{messages.length} mensagens</strong> permanentemente.
                  Isso não pode ser desfeito.
                </p>
              </div>
            </div>

            {confirmAll && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium animate-in slide-in-from-top-2 duration-200">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Clique em "Excluir tudo" novamente para confirmar</span>
              </div>
            )}

            <div className="flex gap-2 mt-auto">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setMode("choose"); setConfirmAll(false); }}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteAll}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Excluindo...</>
                ) : (
                  <><Trash2 className="h-4 w-4 mr-2" />{confirmAll ? "Confirmar exclusão" : "Excluir tudo"}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── TELA 3: Seleção de mensagens ─────────────────────────────── */}
        {mode === "select" && (
          <>
            {/* Barra de ações da seleção */}
            <div className="px-4 py-2 border-b flex items-center justify-between gap-2 flex-shrink-0 bg-muted/10">
              <div className="flex gap-2">
                <button
                  className="text-[11px] text-primary font-medium hover:underline"
                  onClick={selectAll}
                >
                  Todos
                </button>
                <span className="text-muted-foreground text-[11px]">•</span>
                <button
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={clearAll}
                >
                  Nenhum
                </button>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {selectedIds.size}/{messages.length} selecionadas
              </span>
            </div>

            {/* Lista de mensagens */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 opacity-20 mb-2" />
                  <p className="text-sm">Nenhuma mensagem</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedIds.has(msg.id);
                  const isOwn = msg.user_id === currentUserId;
                  return (
                    <button
                      key={msg.id}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150",
                        isSelected
                          ? "bg-destructive/8 dark:bg-destructive/12"
                          : "hover:bg-accent/40"
                      )}
                      onClick={() => toggleSelect(msg.id)}
                    >
                      <div className={cn(
                        "h-5 w-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
                        isSelected ? "text-destructive" : "text-muted-foreground/40"
                      )}>
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn(
                            "text-[10px] font-semibold",
                            isOwn ? "text-primary" : "text-muted-foreground"
                          )}>
                            {isOwn ? "Você" : "Outro"}
                          </span>
                          <span className="text-[9px] text-muted-foreground/60">{fmt(msg.created_at)}</span>
                        </div>
                        <p className="text-xs text-foreground/80 truncate leading-relaxed">
                          {msgPreview(msg)}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer com ações */}
            <div className="px-4 py-3 border-t flex gap-2 flex-shrink-0 bg-background">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setMode("choose"); setSelectedIds(new Set()); }}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteSelected}
                disabled={loading || selectedIds.size === 0}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Excluindo...</>
                ) : (
                  <><Trash2 className="h-4 w-4 mr-2" />Excluir {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}</>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
