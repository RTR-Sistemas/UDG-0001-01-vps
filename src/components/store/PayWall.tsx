/**
 * =============================================================================
 * PayWall.tsx
 * Gate reutilizável: renderiza o conteúdo quando a feature está liberada;
 * caso contrário exibe um placeholder com o preço e botão "Desbloquear",
 * abrindo a Loja quando não há saldo. O consumo em si fica com o chamador
 * (que faz por exemplo aplicar o efeito no post), via useEntitlement().consume().
 *
 * Uso:
 *   <PayWall slug="boost_destaque" label="Boost de visibilidade">
 *     {children liberados}
 *   </PayWall>
 * =============================================================================
 */
import { useState } from "react";
import { Lock, Coins, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntitlement } from "@/hooks/useEntitlement";
import { featureReasonMessage, type FeatureInfo } from "@/services/monetization";
import { StoreModal } from "@/components/store/StoreModal";

interface PayWallProps {
  slug: string;
  /** Mostrar o custo (moedas/créditos) como badge. */
  showPrice?: boolean;
  /** Permite consumir por aqui (sem ação externa). */
  consumable?: boolean;
  onConsumed?: () => void;
  onBlocked?: (reason: string) => void;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PayWall({
  slug,
  showPrice = true,
  consumable = false,
  onConsumed,
  onBlocked,
  children,
  fallback,
}: PayWallProps) {
  const { available, status, loading, consume, entitlements } = useEntitlement(slug);
  const [storeOpen, setStoreOpen] = useState(false);
  const [consuming, setConsuming] = useState(false);

  if (loading) return null;

  if (available) {
    if (consumable) {
      return (
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            setConsuming(true);
            try {
              await consume();
              onConsumed?.();
            } catch {
              /* erro de consumo tratado pelo chamador */
            } finally {
              setConsuming(false);
            }
          }}
          disabled={consuming}
        >
          {status && status.ok && showPrice && status.price_coins ? (
            <>
              <Coins className="h-3.5 w-3.5 mr-1" />
              {status.price_coins}
            </>
          ) : null}
          Usar
        </Button>
      );
    }
    return <>{children}</>;
  }

  // Bloqueado: mostra placeholder + ação
  const reason = status ? featureReasonMessage(status) : "Recurso indisponível.";
  onBlocked?.(reason);

  const cost =
    status && !status.ok
      ? status.reason === "requires_premium"
        ? "Premium"
        : status.credit_cost && status.credit_cost > 0
          ? `${status.credit_cost}⚡`
          : `${status.price_coins ?? 0}🪙`
      : "";

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[2px] opacity-40">
        {fallback ?? children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40 backdrop-blur-[1px]">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="h-4 w-4" />
          Recurso bloqueado
          {showPrice && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs">
              {cost}
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => setStoreOpen(true)}>
          Desbloquear
        </Button>
      </div>
      <StoreModal open={storeOpen} onOpenChange={setStoreOpen} />
    </div>
  );
}

/** Badge de custo para exibir ao lado de botões de features. */
export function FeatureCostBadge({ feature }: { feature?: FeatureInfo | null }) {
  if (!feature) return null;
  if (feature.premium_tier) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-primary">
        <Crown className="h-3 w-3" /> {feature.premium_tier === "ultimate" ? "Ultimate" : "Premium"}
      </span>
    );
  }
  if (feature.credit_cost > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Zap className="h-3 w-3" /> {feature.credit_cost} créditos
      </span>
    );
  }
  if (feature.price_coins > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Coins className="h-3 w-3" /> {feature.price_coins} moedas
      </span>
    );
  }
  return null;
}