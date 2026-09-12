/**
 * =============================================================================
 * File: src/components/FriendsList.tsx
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
import { Button } from "@/components/ui/button";
import { MessageCircle, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  friend_code: string;
}

export default function FriendsList({ onStartChat }: { onStartChat: (friendId: string) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("friendships")
        .select(`
          friend_id,
          profiles:friend_id (
            id,
            username,
            avatar_url,
            friend_code
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error loading friends:", error);
        return [];
      }

      return data?.map((f: any) => f.profiles).filter(Boolean) || [];
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Remove both directions
      await supabase
        .from("friendships")
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
    },
    onSuccess: () => {
      toast({
        title: "Amigo removido",
        description: "O amigo foi removido da sua lista",
      });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Carregando amigos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {friends.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum amigo adicionado ainda</p>
          <p className="text-sm text-muted-foreground mt-2">
            Compartilhe seu código ou adicione amigos pelo código deles
          </p>
        </Card>
      ) : (
        friends.map((friend) => (
          <Card key={friend.id} className="p-4 flex items-center gap-3">
            <Avatar>
              <AvatarImage src={friend.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {friend.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{friend.username}</p>
              <p className="text-xs text-muted-foreground font-mono">{friend.friend_code}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onStartChat(friend.id)}>
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => removeFriendMutation.mutate(friend.id)}
                disabled={removeFriendMutation.isPending}
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
