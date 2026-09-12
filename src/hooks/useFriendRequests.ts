import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FriendRequestWithProfile {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message: string | null;
  message_read: boolean;
  source: string;
  created_at: string;
  sender: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  receiver: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface SendFriendRequestParams {
  receiver_id: string;
  message?: string;
  source?: "code" | "search" | "profile" | "mutual" | "message";
}

export function useFriendRequestsReceived() {
  return useQuery({
    queryKey: ["friend-requests-received"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friend_requests")
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey(id, username, full_name, avatar_url),
          receiver:profiles!friend_requests_receiver_id_fkey(id, username, full_name, avatar_url)
        `)
        .eq("receiver_id", (await supabase.auth.getUser()).data.user?.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });
}

export function useFriendRequestsSent() {
  return useQuery({
    queryKey: ["friend-requests-sent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friend_requests")
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey(id, username, full_name, avatar_url),
          receiver:profiles!friend_requests_receiver_id_fkey(id, username, full_name, avatar_url)
        `)
        .eq("sender_id", (await supabase.auth.getUser()).data.user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: SendFriendRequestParams) => {
      const { data, error } = await (supabase as any).rpc("send_friend_request", params);
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao enviar solicitação");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests-sent"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests-received"] });
      toast({ title: "Solicitação enviada!", description: data?.message });
    },
    onError: (err: Error) => {
      const msg = err.message === "USER_BLOCKED" ? "Não é possível enviar solicitação para este usuário" :
                  err.message === "ALREADY_FRIENDS" ? "Vocês já são amigos" :
                  err.message === "REQUEST_PENDING" ? "Solicitação já enviada" :
                  err.message === "CANNOT_ADD_SELF" ? "Não pode adicionar a si mesmo" :
                  err.message;
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (request_id: string) => {
      const { data, error } = await (supabase as any).rpc("accept_friend_request", { p_request_id: request_id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao aceitar");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests-received"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests-sent"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Agora são amigos! 🎉" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao aceitar", description: err.message, variant: "destructive" });
    },
  });
}

export function useRejectFriendRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (request_id: string) => {
      const { data, error } = await (supabase as any).rpc("reject_friend_request", { p_request_id: request_id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao recusar");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friend-requests-received"] });
      toast({ title: "Solicitação recusada" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao recusar", description: err.message, variant: "destructive" });
    },
  });
}

export function useMarkFriendRequestRead() {
  return useMutation({
    mutationFn: async (request_id: string) => {
      const { error } = await supabase
        .from("friend_requests")
        .update({ message_read: true } as any)
        .eq("id", request_id);
      if (error) throw error;
    },
  });
}