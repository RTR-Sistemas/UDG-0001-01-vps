/**
 * =============================================================================
 * File: src/components/battle/BattleInviteModal.tsx
 * Purpose: Modal global de convite de batalha — aparece para o convidado
 *          quando um usuário o desafia (Realtime).
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Swords, X, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBattle } from "@/contexts/BattleContext";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { formatCoins, playBattleSound } from "@/lib/battleUtils";
import { acceptBattle, declineBattle } from "@/services/battleService";

export function BattleInviteModal() {
  const { invite, openBattle, dismissInvite } = useBattle();
  const { balances } = useWallet();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [host, setHost] = useState<{ username?: string; avatar_url?: string } | null>(null);

  // Busca dados do host ao receber o convite
  useEffect(() => {
    if (!invite || !invite.host_id) {
      setHost(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("profiles")
          .select("username, avatar_url, full_name")
          .eq("id", invite.host_id)
          .maybeSingle();
        if (active) setHost(data ?? null);
      } catch {
        // ignora falha ao buscar dados do host
      }
    })();
    return () => {
      active = false;
    };
  }, [invite]);

  useEffect(() => {
    if (invite) playBattleSound("invite");
  }, [invite?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!invite) return null;

  const handleAccept = async () => {
    setProcessing(true);
    try {
      const battleId = await acceptBattle(invite.id);
      toast({ title: "⚔️ Batalha iniciada!", description: "Boa sorte!" });
      dismissInvite();
      openBattle(battleId);
    } catch (err) {
      toast({
        title: "Não foi possível entrar",
        description: (err as Error)?.message ?? "Erro inesperado",
        variant: "destructive",
      });
      dismissInvite();
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    setProcessing(true);
    try {
      await declineBattle(invite.id);
    } catch {
      // se já não estiver como convite, apenas fecha
    } finally {
      dismissInvite();
      setProcessing(false);
    }
  };

  return (
    <Dialog open={!!invite} onOpenChange={(open) => !open && dismissInvite()}>
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Swords className="h-6 w-6 text-primary" />
            Desafio de Batalha!
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-4">
                <Avatar className="h-12 w-12 ring-2 ring-primary/40">
                  <AvatarImage src={host?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {host?.username?.[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-bold truncate">@{host?.username ?? "carregando..."}</p>
                  <p className="text-xs text-muted-foreground">
                    Quer batalhar ao vivo com você · {invite.duration_seconds}s
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Duração: {Math.round(invite.duration_seconds / 60)} min
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Seu saldo atual:{" "}
                  <span className="font-bold text-foreground">{formatCoins(balances.coins)} moedas</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Seus diamantes:{" "}
                  <span className="font-bold text-foreground">{formatCoins(balances.diamonds)}</span>
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex-1 gap-2"
                >
                  <Check className="h-4 w-4" />
                  Aceitar
                </Button>
                <Button
                  onClick={handleDecline}
                  disabled={processing}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  <X className="h-4 w-4" />
                  Recusar
                </Button>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}