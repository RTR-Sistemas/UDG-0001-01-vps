/**
 * =============================================================================
 * File: src/components/AddFriend.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export default function AddFriend({ userCode }: { userCode?: string }) {
  const [friendCode, setFriendCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleAddFriend = async () => {
    if (!friendCode || friendCode.length !== 7) {
      toast({
        title: "Código inválido",
        description: "Digite os 7 números do código UDG",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const fullCode = `UDG-${friendCode}`;

      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Find user by friend code
      const { data: friendProfile, error: findError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("friend_code", fullCode)
        .maybeSingle();

      if (findError) {
        console.error("Error finding friend:", findError);
        toast({
          title: "Erro",
          description: "Erro ao buscar usuário",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!friendProfile) {
        toast({
          title: "Usuário não encontrado",
          description: "Código inválido",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (user.id === friendProfile.id) {
        toast({
          title: "Erro",
          description: "Você não pode enviar solicitação para si mesmo",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if already friends (bidirectional)
      const { data: existingFriendship, error: friendshipCheckError } = await supabase
        .from("friendships")
        .select("id")
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendProfile.id}),and(user_id.eq.${friendProfile.id},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (friendshipCheckError) {
        console.error("Error checking friendship:", friendshipCheckError);
      }

      if (existingFriendship) {
        toast({
          title: "Já são amigos",
          description: `Você já é amigo de ${friendProfile.username}`,
        });
        setLoading(false);
        return;
      }

      // Check if request already exists (bidirectional)
      const { data: existingRequest, error: requestCheckError } = await supabase
        .from("friend_requests")
        .select("id, status")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendProfile.id}),and(sender_id.eq.${friendProfile.id},receiver_id.eq.${user.id})`)
        .maybeSingle();

      if (requestCheckError) {
        console.error("Error checking friend request:", requestCheckError);
      }

      if (existingRequest && existingRequest.status === "pending") {
        toast({
          title: "Solicitação já enviada",
          description: "Aguarde a resposta do usuário",
        });
        setLoading(false);
        return;
      }

      // Create friend request (return id for push)
      const { data: fr, error: requestError } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: user.id,
          receiver_id: friendProfile.id,
          status: 'pending'
        })
        .select('id')
        .single();

      if (requestError) {
        console.error("Error creating friend request:", requestError);
        toast({
          title: "Erro ao enviar solicitação",
          description: requestError.message || "Tente novamente",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Solicitação enviada!",
        description: `Solicitação enviada para ${friendProfile.username}`,
      });

      // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente ao INSERT em friend_requests.

      setFriendCode("");
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao enviar solicitação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (userCode) {
      navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Código copiado!",
        description: "Compartilhe com seus amigos",
      });
    }
  };

  return (
    <Card className="p-6 space-y-6">
      {userCode && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Seu Código</label>
          <div className="flex gap-2">
            <Input value={userCode} readOnly className="font-mono text-lg" />
            <Button onClick={copyCode} variant="outline" size="icon">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Adicionar Amigo</label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-muted-foreground font-mono">UDG-</span>
            <Input
              placeholder="0000000"
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value.replace(/\D/g, "").slice(0, 7))}
              maxLength={7}
              className="font-mono"
            />
          </div>
          <Button onClick={handleAddFriend} disabled={loading || friendCode.length !== 7}>
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>
    </Card>
  );
}
