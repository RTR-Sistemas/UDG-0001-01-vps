/**
 * =============================================================================
 * monetization.ts
 * Camada de acesso às RPCs de monetização (catálogo, saldos, gating).
 * Tudo passa por SECURITY DEFINER no Postgres — nenhuma regra de negócio aqui.
 * =============================================================================
 */
import { supabase } from "@/integrations/supabase/client";
import { MONETIZACAO_ATIVA, exigirMonetizacaoAtiva } from "@/config/monetizacao";

/**
 * Catálogo vazio devolvido enquanto a loja está desligada.
 * Nenhuma chamada de rede acontece — a função retorna antes.
 */
const CATALOGO_VAZIO: StoreConfig = {
  packs: [],
  plans: [],
  mock_payments: false,
  min_withdrawal_diamonds: 0,
  diamond_to_currency_rate: 0,
};

export interface FeatureInfo {
  slug: string;
  nome: string;
  descricao: string | null;
  tipo: "once" | "consumable" | "daily_weekly";
  price_coins: number;
  credit_cost: number;
  premium_tier: "premium" | "ultimate" | null;
  enabled: boolean;
}

export interface Pack {
  slug: string;
  price: number;
  coins: number;
  bonus: number;
}

export interface Plan {
  slug: string;
  name: string;
  monthly: number;
  yearly: number;
  coins_monthly: number;
  credits_monthly: number;
}

export interface StoreConfig {
  packs: Pack[];
  plans: Plan[];
  mock_payments: boolean;
  min_withdrawal_diamonds: number;
  diamond_to_currency_rate: number;
}

export interface SubscriptionInfo {
  plan: "premium" | "ultimate";
  status: string;
  expires_at: string | null;
}

export interface Entitlements {
  coins: number;
  diamonds: number;
  credits_ia: number;
  subscription: SubscriptionInfo | null;
  grants: { slug: string; expires_at: string | null }[];
  today_usage: { slug: string; count: number }[];
}

export type FeatureCheck =
  | {
      ok: true;
      slug: string;
      price_coins?: number;
      credit_cost?: number;
      tipo?: string;
      granted?: boolean;
      reason?: never;
      need?: number;
      have?: number;
      tier?: string;
    }
  | {
      ok: false;
      reason:
        | "not_authenticated"
        | "feature_not_found"
        | "requires_premium"
        | "insufficient_coins"
        | "insufficient_credits"
        | "daily_limit_reached";
      need?: number;
      have?: number;
      used?: number;
      budget?: number;
      tier?: string;
      price_coins?: number;
      credit_cost?: number;
      tipo?: string;
      granted?: boolean;
    };

export async function fetchStoreConfig(): Promise<StoreConfig> {
  if (!MONETIZACAO_ATIVA) return CATALOGO_VAZIO;
  const { data, error } = await supabase.rpc("store_config");
  if (error) throw error;
  return data as unknown as StoreConfig;
}

export async function fetchFeaturePrices(): Promise<FeatureInfo[]> {
  if (!MONETIZACAO_ATIVA) return [];
  const { data, error } = await supabase.rpc("feature_prices");
  if (error) throw error;
  return (data || []) as unknown as FeatureInfo[];
}

export async function fetchEntitlements(): Promise<Entitlements | null> {
  if (!MONETIZACAO_ATIVA) return null;
  const { data, error } = await supabase.rpc("my_entitlements");
  if (error) throw error;
  return (data || null) as unknown as Entitlements | null;
}

export async function checkFeature(slug: string): Promise<FeatureCheck> {
  // Loja desligada → recurso LIBERADO. Bloquear aqui deixaria o usuário preso
  // num paywall sem nenhuma forma de comprar a saída.
  if (!MONETIZACAO_ATIVA) return { ok: true, slug, granted: true };
  const { data, error } = await supabase.rpc("check_feature", { p_slug: slug });
  if (error) throw error;
  return data as FeatureCheck;
}

export async function consumeFeature(
  slug: string,
  requestId?: string
): Promise<FeatureCheck> {
  if (!MONETIZACAO_ATIVA) return { ok: true, slug, granted: true };
  const { data, error } = await supabase.rpc("consume_feature", {
    p_slug: slug,
    p_request_id: requestId ?? undefined,
  });
  if (error) throw error;
  return data as FeatureCheck;
}

export async function buyCoins(packSlug: string): Promise<{
  order_id: string;
  amount_coins: number;
  price: number;
  mock: boolean;
}> {
  exigirMonetizacaoAtiva("Compra de moedas");
  const { data, error } = await supabase.rpc("buy_coins", {
    p_pack_slug: packSlug,
  });
  if (error) throw error;
  return data as {
    order_id: string;
    amount_coins: number;
    price: number;
    mock: boolean;
  };
}

export async function mockConfirmOrder(orderId: string): Promise<void> {
  exigirMonetizacaoAtiva("Confirmação de pedido");
  const { error } = await supabase.rpc("mock_confirm_coin_purchase", {
    p_order_id: orderId,
  });
  if (error) throw error;
}

export async function activateSubscription(
  plan: "premium" | "ultimate",
  months = 1
): Promise<{ ok: boolean; coins_credited: number; credits_credited: number }> {
  exigirMonetizacaoAtiva("Assinatura");
  const { data, error } = await supabase.rpc("activate_subscription", {
    p_plan: plan,
    p_months: months,
  });
  if (error) throw error;
  return data as { ok: boolean; coins_credited: number; credits_credited: number };
}

/** Rótulo amigável por reason (para mensagens de paywall). */
export function featureReasonMessage(check: FeatureCheck): string {
  if (check.ok) return "";
  switch (check.reason) {
    case "not_authenticated":
      return "Faça login para usar este recurso.";
    case "feature_not_found":
      return "Recurso indisponível.";
    case "requires_premium":
      return check.tier === "ultimate"
        ? "Este recurso exige o plano UDG Ultimate."
        : "Este recurso exige o plano UDG Premium.";
    case "insufficient_coins":
      return `Faltam ${(check.need ?? 0) - (check.have ?? 0)} moedas. Compre moedas na Loja.`;
    case "insufficient_credits":
      return `Faltam ${(check.need ?? 0) - (check.have ?? 0)} créditos de IA. Compre na Loja.`;
    case "daily_limit_reached":
      return "Limite diário atingido para este recurso. Volte amanhã ou assine Premium.";
    default:
      return "Recurso indisponível.";
  }
}

export function balanceLabel(ent: Entitlements | null): string {
  if (!ent) return "🪙 –";
  return `🪙 ${ent.coins} · 💎 ${ent.diamonds} · ⚡ ${ent.credits_ia}`;
}