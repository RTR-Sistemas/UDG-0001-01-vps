/**
 * =============================================================================
 * StoreModal.tsx
 * Loja UndoinG: Moedas (pacotes PIX/cartão + modo mock) e Assinaturas
 * (Premium / Ultimate). Lê tudo via RPC store_config + saldos via RPC.
 * =============================================================================
 */
import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Coins, Zap, Crown } from "lucide-react";
import {
  fetchStoreConfig,
  fetchEntitlements,
  buyCoins,
  mockConfirmOrder,
  activateSubscription,
  balanceLabel,
  type StoreConfig,
  type Entitlements,
  type Pack,
  type Plan,
} from "@/services/monetization";

interface StoreModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialTab?: "coins" | "plans";
}

export function StoreModal({ children, open, onOpenChange, initialTab = "coins" }: StoreModalProps) {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<StoreConfig | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>(initialTab);
  const [buying, setBuying] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<{ order_id: string; amount_coins: number; price: number; mock: boolean } | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([fetchStoreConfig(), fetchEntitlements()]);
      setCfg(c);
      setEnt(e);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível carregar a Loja",
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBuy = async (pack: Pack) => {
    setBuying(pack.slug);
    setOrderInfo(null);
    try {
      const info = await buyCoins(pack.slug);
      setOrderInfo(info);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível criar o pedido",
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setBuying(null);
    }
  };

  const handleMockConfirm = async () => {
    if (!orderInfo) return;
    try {
      await mockConfirmOrder(orderInfo.order_id);
      toast({ title: "Pagamento confirmado!", description: `${orderInfo.amount_coins} moedas adicionadas à sua conta.` });
      setOrderInfo(null);
      await refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Falha na confirmação",
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  };

  const handleActivate = async (plan: Plan) => {
    setActivating(plan.slug);
    try {
      const res = await activateSubscription(plan.slug as "premium" | "ultimate", 1);
      toast({
        title: `Plano ${plan.name} ativado!`,
        description: `${res.coins_credited} moedas e ${res.credits_credited} créditos de IA adicionados.`,
      });
      await refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível ativar",
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setActivating(null);
    }
  };

  const isPremium = ent?.subscription?.status === "active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            Loja UndoinG
          </DialogTitle>
          <DialogDescription>
            {loading ? "Carregando…" : (
              <span className="text-sm font-semibold text-muted-foreground">{balanceLabel(ent)}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="coins" className="flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" /> Moedas
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-1">
              <Crown className="h-3.5 w-3.5" /> Premium
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coins" className="space-y-3 pt-3">
            {!cfg?.packs?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum pacote disponível.</p>
            ) : (
              cfg.packs.map((pack) => (
                <Card key={pack.slug}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold">
                        {pack.coins.toLocaleString("pt-BR")} moedas
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pack.bonus > 0 ? `${pack.bonus}% bônus` : "sem bônus"} · R$ {pack.price.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleBuy(pack)}
                      disabled={buying === pack.slug}
                    >
                      {buying === pack.slug && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      Comprar
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}

            {orderInfo && (
              <Card className="border-yellow-400/60 bg-yellow-400/5">
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm font-semibold">
                    Pedido #{orderInfo.order_id.slice(0, 8)} · {orderInfo.amount_coins} moedas · R$ {orderInfo.price.toFixed(2)}
                  </p>
                  {orderInfo.mock ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Modo demonstração ativo (mock_payments = enabled). Confirme para simular o pagamento.
                      </p>
                      <Button size="sm" className="w-full" onClick={handleMockConfirm}>
                        Confirmar pagamento (demo)
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Aguardando pagamento via PIX… Enviamos o QR Code para o fluxo de checkout (gateway).
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="plans" className="space-y-3 pt-3">
            {isPremium && (
              <Badge className="w-full justify-center py-1.5" variant="default">
                <Crown className="h-3.5 w-3.5 mr-1" />
                Plano {ent?.subscription?.plan} ativo até{" "}
                {ent?.subscription?.expires_at
                  ? new Date(ent.subscription.expires_at).toLocaleDateString("pt-BR")
                  : "indeterminado"}
              </Badge>
            )}
            {!cfg?.plans?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum plano disponível.</p>
            ) : (
              cfg.plans.map((plan) => (
                <Card key={plan.slug}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {plan.name}{" "}
                        {plan.slug === "ultimate" && <Badge variant="secondary">Máximo</Badge>}
                      </p>
                      <p className="text-sm font-bold text-primary">
                        R$ {plan.monthly.toFixed(2)}/mês
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {plan.coins_monthly.toLocaleString("pt-BR")} moedas/mês ·{" "}
                      {plan.credits_monthly.toLocaleString("pt-BR")} créditos IA/mês · recursos ilimitados
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      variant={plan.slug === "ultimate" ? "default" : "outline"}
                      onClick={() => handleActivate(plan)}
                      disabled={activating === plan.slug}
                    >
                      {activating === plan.slug && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      {cfg?.mock_payments ? "Ativar (demo)" : "Assinar"}
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
            {cfg?.mock_payments && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Zap className="h-3 w-3" />
                Modo demonstração: assinaturas ativadas sem cobrança.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}