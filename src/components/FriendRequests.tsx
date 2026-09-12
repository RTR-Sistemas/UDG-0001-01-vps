/**
 * =============================================================================
 * File: src/components/FriendRequests.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export default function FriendRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["friend-requests"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: friendRequests } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!friendRequests || friendRequests.length === 0) return [];

      const senderIds = friendRequests.map(req => req.sender_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", senderIds);

      const requestsWithProfiles = friendRequests.map(req => ({
        ...req,
        sender: profiles?.find(p => p.id === req.sender_id)
      }));

      return requestsWithProfiles as FriendRequest[];
    },
  });

  const acceptRequest = useMutation({
    mutationFn: async (request: FriendRequest) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create bidirectional friendship
      const { error: friendshipError } = await supabase.from("friendships").insert({ user_id: user.id, friend_id: request.sender_id });

      if (friendshipError) {
        console.error("Error creating friendship:", friendshipError);
        throw friendshipError;
      }

      // Update request status
      const { error: updateError } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", request.id);

      if (updateError) {
        console.error("Error updating request:", updateError);
        throw updateError;
      }

      return request;
    },
    onSuccess: (request) => {
      toast({
        title: "Solicitação aceita!",
        description: `Agora você é amigo de ${request.sender?.username}`,
      });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (error: any) => {
      console.error("Error accepting request:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao aceitar solicitação",
        variant: "destructive",
      });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);
    },
    onSuccess: () => {
      toast({
        title: "Solicitação recusada",
      });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao recusar solicitação",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Carregando solicitações...</p>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="bg-muted/50 rounded-full p-4 mb-3">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhuma solicitação pendente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-lg font-semibold mb-4">Solicitações Pendentes</h3>
      {requests.map((request) => (
        <Card key={request.id} className="p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={request.sender?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {request.sender?.username[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {request.sender?.username || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground">
                Quer ser seu amigo
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 border-green-600 hover:bg-green-50"
                onClick={() => acceptRequest.mutate(request)}
                disabled={acceptRequest.isPending}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50"
                onClick={() => rejectRequest.mutate(request.id)}
                disabled={rejectRequest.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
