/**
 * =============================================================================
 * File: src/components/battle/GiftTray.tsx
 * Purpose: Bandeja de presentes — catálogo, seletor de quantidade e envio
 *          durante batalha ao vivo.
 * =============================================================================
 */

import React, { useCallback, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useGiftCatalog } from "@/hooks/useGiftCatalog";
import { animateGift, formatCoins, playBattleSound } from "@/lib/battleUtils";
import {
  sendGift,
  sendGiftErrorMessage,
  type GiftCatalogItem,
} from "@/services/battleService";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

interface GiftTrayProps {
  receiverId: string;
  battleId: string;
}

export function GiftTray({ receiverId, battleId }: GiftTrayProps) {
  const { catalog, loading } = useGiftCatalog();
  const { balances, refresh } = useWallet();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);
  const [combo, setCombo] = useState(0);
  const lastSendRef = React.useRef<number>(0);

  const quantities = useMemo(() => [1, 5, 10, 25], []);

  const cycleQuantity = useCallback(() => {
    setQuantity((prev) => {
      const idx = quantities.indexOf(prev);
      return quantities[(idx + 1) % quantities.length];
    });
  }, [quantities]);

  const handleSend = async (gift: GiftCatalogItem) => {
    if (sending) return;
    setSending(true);
    try {
      const tx = await sendGift(receiverId, gift.id, quantity, battleId);
      animateGift(gift.emoji, gift.name);
      playBattleSound("gift");

      const now = Date.now();
      setCombo((prev) => (now - lastSendRef.current < 3500 ? prev + 1 : 1));
      lastSendRef.current = now;

      await refresh();

      if (tx) {
        toast({
          title: `${gift.emoji ?? ""} Presente enviado para ${gift.name}`,
          description: `-${formatCoins(tx.coins_spent)} moedas · ${quantity}x`,
        });
      }
    } catch (err) {
      toast({
        title: "Falha ao enviar presente",
        description: sendGiftErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">
        Carregando presentes...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Presentes
        </span>
        <button
          onClick={cycleQuantity}
          className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 transition-colors hover:bg-primary/20"
          aria-label="Alterar quantidade de presentes"
        >
          Enviar {quantity}x
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/80 px-3 py-2 text-sm">
        <Coins className="h-4 w-4 text-amber-500" />
        <span className="font-bold">{formatCoins(balances.coins)}</span>
        <span className="text-muted-foreground">moedas</span>
        {combo >= 5 ? (
          <span className="ml-auto rounded-full bg-primary/15 text-primary font-bold text-xs px-2 py-0.5 animate-pulse">
            Combo x{combo} 🔥
          </span>
        ) : combo >= 2 ? (
          <span className="ml-auto text-xs font-bold text-muted-foreground">x{combo}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {catalog.map((gift) => (
          <button
            key={gift.id}
            onClick={() => handleSend(gift)}
            disabled={sending}
            className={cn(
              "group relative flex flex-col items-center gap-1 rounded-2xl border border-border/40 bg-card/70 p-2",
              "transition-all hover:border-primary/50 hover:bg-card active:scale-95 disabled:opacity-60"
            )}
            aria-label={`Enviar presente ${gift.name}`}
            title={`${gift.name} · ${formatCoins(gift.coin_cost)} moedas`}
          >
            <span className="text-3xl leading-none drop-shadow-sm">
              {gift.emoji ?? "🎁"}
            </span>
            <span className="text-[10px] font-semibold truncate w-full text-center">
              {gift.name}
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
              <Coins className="h-2.5 w-2.5" />
              {formatCoins(gift.coin_cost)}
            </span>
            {gift.is_animated && (
              <span className="absolute -top-1 -right-1 text-[10px]">✨</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}