import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DeleteMessageParams {
  conversationId: string;
  messageIds: string[];
  scope?: "me" | "everyone";
}

export function useDeleteMessages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: DeleteMessageParams) => {
      const { data, error } = await (supabase as any).rpc("delete_conversation_messages", {
        p_conversation_id: params.conversationId,
        p_scope: params.scope || "me",
        p_message_ids: params.messageIds,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao excluir mensagens");
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (variables.scope === "everyone") {
        toast({ title: "Apagado para todos", description: `${data.deleted_count} mensagem(ns) removida(s)` });
      } else {
        toast({ title: "Apagado para você", description: `${data.deleted_count} mensagem(ns) removida(s)` });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao apagar", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteEntireConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { conversationId: string; scope?: "me" | "everyone" }) => {
      const { data, error } = await (supabase as any).rpc("delete_entire_conversation", {
        p_conversation_id: params.conversationId,
        p_scope: params.scope || "me",
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao excluir conversa");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast({ title: "Conversa excluída", description: `${data.deleted_count} mensagens removidas` });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });
}

// Hook para verificar se usuário pode excluir mensagem (autor ou admin)
export function useCanDeleteMessage(messageUserId: string, currentUserId: string | null) {
  return currentUserId === messageUserId; // Apenas autor pode excluir (para "para todos")
}

// Hook para verificar se é mensagem do usuário atual
export function useIsOwnMessage(messageUserId: string, currentUserId: string | null) {
  return currentUserId === messageUserId;
}