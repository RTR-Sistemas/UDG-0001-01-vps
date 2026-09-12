/**
 * =============================================================================
 * File: src/pages/Wallet.tsx
 * Purpose: Carteira do usuário — saldo de moedas e diamantes, compra de
 *          moedas, solicitação de saque e histórico.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import {
  formatCoins,
  formatDiamonds,
  formatCurrencyBRL,
} from "@/lib/battleUtils";
import {
  fetchMyGiftHistory,
  fetchMyWithdrawals,
} from "@/services/walletService";
import { fetchStoreConfig, type Pack } from "@/services/monetization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BackButton from "@/components/BackButton";
import { Coins, Gem, ShoppingCart, Banknote, Loader2, Wallet as WalletIcon } from "lucide-react";

export default function Wallet() {
  const { user } = useAuth();
  const { balances, loading, refreshing, purchaseCoins, requestWithdrawal, refresh } =
    useWallet();
  const { toast } = useToast();

  const [packs, setPacks] = useState<Pack[]>([]);
  const [buying, setBuying] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [method, setMethod] = useState<"pix" | "paypal" | "bank_transfer">("pix");
  const [withdrawing, setWithdrawing] = useState(false);
  interface GiftHistoryItem {
  id: string;
  sender_id: string;
  receiver_id: string;
  quantity: number;
  coins_spent: number;
  diamonds_earned: number;
  gifts_catalog?: { name?: string; emoji?: string } | null;
}

interface WithdrawalHistoryItem {
  id: string;
  diamond_amount: number;
  payout_amount: number;
  status: string;
}

  const [giftHistory, setGiftHistory] = useState<GiftHistoryItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalHistoryItem[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchMyGiftHistory(user.id, 10).then(setGiftHistory).catch(() => undefined);
    fetchMyWithdrawals(user.id).then(setWithdrawals).catch(() => undefined);
    fetchStoreConfig()
      .then((cfg) => setPacks(cfg?.packs ?? []))
      .catch(() => undefined);
  }, [user]);

  const handleBuy = async (coins: number) => {
    setBuying(true);
    try {
      const result = await purchaseCoins({
        amountCoins: coins,
        currency: "BRL",
        gateway: "mercadopago",
      });
      toast({
        title: result.mock ? "🧪 Compra simulada concluída (modo demo)" : "✅ Compra confirmada!",
        description: `${coins} moedas adicionadas à sua conta.`,
      });
      refresh();
    } catch (err) {
      toast({
        title: "Falha na compra",
        description: (err as Error)?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBuying(false);
    }
  };

  const payoutPreview = withdrawAmount
    ? Number(withdrawAmount) * 0.05 * 0.95
    : 0;

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount || "0", 10);
    if (!amount || amount < 200) {
      toast({
        title: "Saque mínimo de 200 diamantes",
        variant: "destructive",
      });
      return;
    }
    setWithdrawing(true);
    try {
      const result = await requestWithdrawal({
        diamondAmount: amount,
        method,
        details: { platform: "undoinG" },
      });
      toast({
        title: "Saque solicitado!",
        description: `Valor estimado: ${formatCurrencyBRL(result.payout_amount)} · em processamento.`,
      });
      setWithdrawOpen(false);
      setWithdrawAmount("");
      refresh();
      const wList = await fetchMyWithdrawals(user?.id ?? "");
      setWithdrawals(wList);
    } catch (err) {
      toast({
        title: "Falha ao solicitar saque",
        description: (err as Error)?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-y-auto pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <header className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <WalletIcon className="h-6 w-6 text-primary" />
            Carteira
          </h1>
          {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </header>

        {loading ? (
          <p className="text-muted-foreground text-sm animate-pulse text-center py-10">
            Carregando carteira...
          </p>
        ) : (
          <>
            {/* Saldo */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Coins className="h-4 w-4" /> Moedas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black tabular-nums" data-testid="wallet-coins">
                    {formatCoins(balances.coins)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Comprado: {formatCoins(balances.totalPurchased)} · Gasto:{" "}
                    {formatCoins(balances.totalSpent)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-violet-500/30 bg-violet-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-violet-500">
                    <Gem className="h-4 w-4" /> Diamantes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black tabular-nums" data-testid="wallet-diamonds">
                    {formatDiamonds(balances.diamonds)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ganhos: {formatDiamonds(balances.totalEarned)} · Em saque:{" "}
                    {formatDiamonds(balances.pendingWithdrawal)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Comprar moedas */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Comprar moedas
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(packs.length ? packs : [{ coins: 100, price: 4.9, slug: "iniciante", bonus: 0 }]).map((pack) => (
                  <button
                    key={pack.slug ?? pack.coins}
                    onClick={() => handleBuy(pack.coins)}
                    disabled={buying}
                    className="rounded-2xl border border-border/40 bg-card/70 p-4 text-left transition-all hover:border-amber-500/50 hover:bg-card active:scale-95 disabled:opacity-50"
                    data-testid={`buy-${pack.coins}`}
                  >
                    <p className="text-lg font-black flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-amber-500" />
                      {formatCoins(pack.coins)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrencyBRL(pack.price)} · PIX/Mercado Pago
                      {pack.bonus > 0 ? ` · +${pack.bonus}% bônus` : ""}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* Sacar diamantes */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Sacar diamantes
              </h2>
              <Card className="bg-card/60">
                <CardContent className="pt-6 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Saldo disponível:{" "}
                    <span className="font-bold text-foreground">
                      {formatDiamonds(balances.diamonds)} diamantes
                    </span>
                    {" "}· mínimo 200 · taxa de 5% · 1 diamante ≈ R$ 0,05
                  </p>
                  {!withdrawOpen ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setWithdrawOpen(true)}
                      data-testid="open-withdrawal"
                    >
                      Solicitar saque
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        type="number"
                        placeholder="Quantidade de diamantes"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        data-testid="withdraw-amount"
                      />
                      <div className="flex gap-2">
                        {(["pix", "paypal", "bank_transfer"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setMethod(m)}
                            className={(
                              "flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold transition-colors " +
                              (method === m
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/40 bg-card/60 text-muted-foreground")
                            )}
                          >
                            {m === "pix" ? "PIX" : m === "paypal" ? "PayPal" : "Transferência"}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Valor estimado de saque:{" "}
                        <span className="font-bold text-foreground">
                          {formatCurrencyBRL(payoutPreview)}
                        </span>
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={handleWithdraw} disabled={withdrawing} className="flex-1" data-testid="confirm-withdrawal">
                          {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Confirmar saque
                        </Button>
                        <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {withdrawals.length > 0 && (
                <div className="space-y-1.5">
                  {withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-xl border border-border/30 bg-card/40 p-3 text-sm"
                    >
                      <span>
                        <span className="font-bold">{w.diamond_amount} 💎</span> →{" "}
                        {formatCurrencyBRL(w.payout_amount)}
                      </span>
                      <span
                        className={
                          "text-xs font-bold " +
                          (w.status === "pending"
                            ? "text-amber-500"
                            : w.status === "completed"
                              ? "text-emerald-500"
                              : "text-red-500")
                        }
                      >
                        {w.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Histórico de presentes */}
            {giftHistory.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Últimos presentes
                </h2>
                {giftHistory.map((g) => {
                  const gift = g.gifts_catalog;
                  const sent = g.sender_id === user?.id;
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-xl border border-border/30 bg-card/40 p-3 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span>{gift?.emoji ?? "🎁"}</span>
                        <span>
                          {sent ? "Você enviou" : "Você recebeu"} · {gift?.name ?? "presente"}
                        </span>
                        <span className="text-xs text-muted-foreground">x{g.quantity}</span>
                      </span>
                      <span className="text-xs font-bold">
                        {sent ? (
                          <span className="text-red-500">-{formatCoins(g.coins_spent)}</span>
                        ) : (
                          <span className="text-violet-500">+{formatDiamonds(g.diamonds_earned)} 💎</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}