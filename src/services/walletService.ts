/**
 * =============================================================================
 * File: src/services/walletService.ts
 * Purpose: Serviços da Carteira do usuário (moedas e diamantes): consultas,
 *          compra de moedas e solicitação de saque via Edge Functions.
 * =============================================================================
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { MONETIZACAO_ATIVA, exigirMonetizacaoAtiva } from "@/config/monetizacao";

// -----------------------------------------------------------------------------
// SECTION: Tipos
// -----------------------------------------------------------------------------

export interface WalletBalances {
  coins: number;
  totalPurchased: number;
  totalSpent: number;
  diamonds: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingWithdrawal: number;
}

export const EMPTY_WALLET: WalletBalances = {
  coins: 0,
  totalPurchased: 0,
  totalSpent: 0,
  diamonds: 0,
  totalEarned: 0,
  totalWithdrawn: 0,
  pendingWithdrawal: 0,
};

// -----------------------------------------------------------------------------
// SECTION: Consultas
// -----------------------------------------------------------------------------

export async function fetchWalletBalances(): Promise<WalletBalances> {
  // Carteira desligada: devolve saldo zerado SEM tocar no banco. Duas RPCs a
  // menos em cada carregamento do app, e nenhuma informação de saldo trafegando.
  if (!MONETIZACAO_ATIVA) return EMPTY_WALLET;

  const [coinsRes, diamondsRes] = await Promise.all([
    supabase.rpc("get_user_coins", {}),
    supabase.rpc("get_user_diamonds", {}),
  ]);
  if (coinsRes.error) throw coinsRes.error;
  if (diamondsRes.error) throw diamondsRes.error;

  const c = coinsRes.data as {
    user_id?: string;
    balance?: number;
    total_purchased?: number;
    total_spent?: number;
  } | null;
  const d = diamondsRes.data as {
    user_id?: string;
    balance?: number;
    total_earned?: number;
    total_withdrawn?: number;
    pending_withdrawal?: number;
  } | null;

  return {
    coins: Number(c?.balance ?? 0),
    totalPurchased: Number(c?.total_purchased ?? 0),
    totalSpent: Number(c?.total_spent ?? 0),
    diamonds: Number(d?.balance ?? 0),
    totalEarned: Number(d?.total_earned ?? 0),
    totalWithdrawn: Number(d?.total_withdrawn ?? 0),
    pendingWithdrawal: Number(d?.pending_withdrawal ?? 0),
  };
}

export interface PurchaseOptions {
  amountCoins: number;
  currency?: "BRL" | "USD";
  gateway?: "stripe" | "apple" | "google" | "mercadopago";
  price?: number;
}

export interface PurchaseResult {
  order_id: string;
  status: "paid" | "pending" | "failed";
  balance: number;
  mock: boolean;
}

// -----------------------------------------------------------------------------
// SECTION: Ações (Edge Functions)
// -----------------------------------------------------------------------------

export async function purchaseCoins(options: PurchaseOptions): Promise<PurchaseResult> {
  // Barreira na origem: nem a Edge Function nem o fallback mock são alcançados.
  exigirMonetizacaoAtiva("Compra de moedas");

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("not_authenticated");

  // 1) Tenta o gateway real (Edge Function de produção)
  // IMPORTANTE: um erro de NEGÓCIO (a função respondeu, mas recusou a compra)
  // precisa ser propagado. Antes ele era lançado dentro do try e capturado pelo
  // próprio catch abaixo, caindo no fluxo mock — ou seja, uma compra recusada
  // acabava creditando moedas pelo caminho de desenvolvimento.
  let businessError: string | null = null;
  try {
    const res = await fetch("/api/purchase-coins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(options),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      return body as PurchaseResult;
    }
    // A função respondeu recusando: guarda o motivo para lançar fora do try.
    if (body?.error) businessError = String(body.error);
    // caso contrário, cai no fluxo mock
  } catch (err) {
    // rede/gateway indisponível (dev local) — segue para mock
    console.warn("[walletService] gateway indisponível, usando mock:", err);
  }
  if (businessError) throw new Error(businessError);

  // 2) Fallback dev/demo via RPCs (requer mock_payments=enabled no banco)
  const { data: orderId, error: orderError } = await supabase.rpc(
    "create_coin_purchase_order",
    {
      p_amount_coins: options.amountCoins,
      p_price: options.price ?? 0,
      p_currency: options.currency ?? "BRL",
      p_gateway: options.gateway ?? "stripe",
    }
  );
  if (orderError) throw orderError;

  const { error: confirmError } = await supabase.rpc("mock_confirm_coin_purchase", {
    p_order_id: orderId as string,
  });
  if (confirmError) throw confirmError;

  const coins = await fetchWalletBalances();
  return {
    order_id: orderId as string,
    status: "paid",
    balance: coins.coins,
    mock: true,
  };
}

export interface WithdrawalOptions {
  diamondAmount: number;
  method?: "pix" | "paypal" | "bank_transfer";
  details?: Record<string, unknown>;
}

export interface WithdrawalResult {
  request_id: string;
  status: "pending";
  payout_amount: number;
  conversion_rate: number;
}

export async function requestWithdrawal(
  options: WithdrawalOptions
): Promise<WithdrawalResult> {
  exigirMonetizacaoAtiva("Solicitação de saque");

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("not_authenticated");

  // 1) Tenta o gateway real (Edge Function de produção)
  // Mesmo cuidado da compra: recusa da função (saldo insuficiente, mínimo não
  // atingido, etc.) precisa parar aqui, e não cair no RPC direto de dev.
  let businessError: string | null = null;
  try {
    const res = await fetch("/api/withdraw-diamonds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(options),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return body as WithdrawalResult;
    if (body?.error) businessError = String(body.error);
  } catch (err) {
    console.warn("[walletService] gateway indisponível, usando RPC direto:", err);
  }
  if (businessError) throw new Error(businessError);

  // 2) Fallback dev: RPC direto (process_withdrawal valida saldo e mínimo)
  const { data: requestId, error } = await supabase.rpc("process_withdrawal", {
    p_diamond_amount: options.diamondAmount,
    p_method: options.method ?? "pix",
    p_details: (options.details ?? null) as unknown as Json,
  });
  if (error) throw error;

  return {
    request_id: requestId as string,
    status: "pending",
    payout_amount: Number(options.diamondAmount) * 0.05 * 0.95,
    conversion_rate: 0.05,
  };
}

// -----------------------------------------------------------------------------
// SECTION: Histórico
// -----------------------------------------------------------------------------

export async function fetchMyGiftHistory(userId: string, limit = 20) {
  if (!MONETIZACAO_ATIVA) return [];
  const { data, error } = await supabase
    .from("gift_transactions")
    .select("*, gifts_catalog(name, emoji)")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyWithdrawals(userId: string) {
  if (!MONETIZACAO_ATIVA) return [];
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}