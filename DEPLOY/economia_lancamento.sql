-- =============================================================================
-- economia_lancamento.sql — UndoinG, pacote de lançamento
-- 1) Conversa privada 1:1 (get_or_create_private_conversation)
-- 2) Prêmio de batalha para o vencedor (proporcional às taxas da batalha)
-- 3) Programa de indicação (referral) com recompensa proporcional à receita
-- 4) Ajuste de taxas (config-driven) e hardening de grants
-- Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CONVERSA PRIVADA 1:1
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_private_conversation(p_other_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_other_id IS NULL THEN RAISE EXCEPTION 'other_required'; END IF;
  IF p_other_id = v_me THEN RAISE EXCEPTION 'cannot_converse_self'; END IF;

  -- procura conversa 1:1 existente entre os dois
  SELECT c.id INTO v_conv
  FROM public.conversations c
  WHERE c.is_group = false
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = v_me
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = p_other_id
    )
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;

  -- cria nova conversa 1:1
  INSERT INTO public.conversations (is_group, is_temporary, max_participants)
  VALUES (false, false, 2)
  RETURNING id INTO v_conv;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv, v_me), (v_conv, p_other_id);

  RETURN v_conv;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. PRÊMIO DE BATALHA (vencedor recebe parte das taxas arrecadadas)
--    Regra fechada: prêmio = floor(soma platform_fee da batalha × share)
--    O prêmio sai da parte da PLATAFORMA (fee), nunca do saldo do usuário.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battle_prizes (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  winner_id uuid not null references public.profiles(id) on delete cascade,
  prize_diamonds int not null check (prize_diamonds > 0),
  fee_total int not null default 0,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_battle_prizes_battle ON public.battle_prizes (battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_prizes_winner ON public.battle_prizes (winner_id);
ALTER TABLE public.battle_prizes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "battle_prizes_select" ON public.battle_prizes;
CREATE POLICY "battle_prizes_select" ON public.battle_prizes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.end_battle(p_battle_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.battles%rowtype;
  v_winner uuid;
  v_fee_total bigint;
  v_share numeric := COALESCE(
    NULLIF(public.get_platform_config('battle_prize_fee_share'), '')::numeric, 0.35);
  v_prize int;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'battle_not_found'; END IF;
  IF auth.uid() NOT IN (v_battle.host_id, v_battle.guest_id) THEN
    RAISE EXCEPTION 'not_a_participant';
  END IF;
  IF v_battle.status <> 'live' THEN RAISE EXCEPTION 'battle_not_live'; END IF;

  IF v_battle.host_score > v_battle.guest_score THEN
    v_winner := v_battle.host_id;
  ELSIF v_battle.guest_score > v_battle.host_score THEN
    v_winner := v_battle.guest_id;
  ELSE
    v_winner := NULL;
  END IF;

  UPDATE public.battles
     SET status = 'ended',
         actual_end = now(),
         winner_id = v_winner
   WHERE id = p_battle_id;

  -- premiação: proporcional às fees que a própria batalha gerou
  IF v_winner IS NOT NULL THEN
    SELECT COALESCE(SUM(platform_fee), 0) INTO v_fee_total
    FROM public.gift_transactions
    WHERE battle_id = p_battle_id AND platform_fee > 0;

    v_prize := floor(v_fee_total * v_share);
    IF v_prize > 0 THEN
      INSERT INTO public.battle_prizes (battle_id, winner_id, prize_diamonds, fee_total)
      VALUES (p_battle_id, v_winner, v_prize, v_fee_total);
      PERFORM public.credit_diamonds(v_winner, v_prize);
    END IF;
  END IF;

  RETURN v_winner;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. PROGRAMA DE INDICAÇÃO
--    Referrer ganha moedas quando o indicado GERA RECEITA (compra moedas ou
--    assina). Recompensa = floor(valor_em_reais × coins_per_reais × ratio).
--    Tudo nasce da receita real — proporcional por construção.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('coin_purchase', 'subscription')),
  amount_reais numeric(10,2) not null default 0,
  coins_credited int not null default 0,
  created_at timestamptz not null default now(),
  UNIQUE (referrer_id, invitee_id, source)
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON public.referral_rewards (referrer_id);
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_rewards_select_own" ON public.referral_rewards;
CREATE POLICY "referral_rewards_select_own" ON public.referral_rewards
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = invitee_id);

-- Aplica código de convite ao usuário logado (chamado após o signup)
CREATE OR REPLACE FUNCTION public.apply_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_ref uuid;
  v_out jsonb;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_code IS NULL OR trim(p_code) = '' THEN RETURN NULL; END IF;

  SELECT id INTO v_ref
  FROM public.profiles
  WHERE upper(friend_code) = upper(trim(p_code))
  LIMIT 1;

  IF v_ref IS NULL THEN RAISE EXCEPTION 'code_not_found'; END IF;
  IF v_ref = v_me THEN RAISE EXCEPTION 'cannot_use_own_code'; END IF;

  UPDATE public.profiles
     SET referred_by = v_ref
   WHERE id = v_me AND referred_by IS NULL;

  SELECT jsonb_build_object('referred_by', referred_by) INTO v_out
  FROM public.profiles WHERE id = v_me;
  RETURN v_out;
END;
$$;

-- Credita recompensa (chamada por triggers de receita confirmada)
CREATE OR REPLACE FUNCTION public.credit_referral(p_invitee_id uuid, p_amount_reais numeric, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref uuid;
  v_ratio numeric := COALESCE(
    NULLIF(public.get_platform_config('referral_ratio'), '')::numeric, 0.10);
  v_cpr numeric := COALESCE(
    NULLIF(public.get_platform_config('coins_per_reais'), '')::numeric, 20);
  v_coins int;
BEGIN
  IF p_invitee_id IS NULL OR p_amount_reais IS NULL OR p_amount_reais <= 0 THEN
    RETURN;
  END IF;

  SELECT referred_by INTO v_ref FROM public.profiles WHERE id = p_invitee_id;
  IF v_ref IS NULL THEN RETURN; END IF;

  v_coins := floor(p_amount_reais * v_cpr * v_ratio);
  IF v_coins <= 0 THEN RETURN; END IF;

  INSERT INTO public.referral_rewards (referrer_id, invitee_id, source, amount_reais, coins_credited)
  VALUES (v_ref, p_invitee_id, p_source, p_amount_reais, v_coins)
  ON CONFLICT (referrer_id, invitee_id, source) DO NOTHING
  RETURNING coins_credited INTO v_coins;

  IF FOUND THEN
    INSERT INTO public.user_coins (user_id, balance, total_purchased)
    VALUES (v_ref, v_coins, 0)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + excluded.balance,
          total_purchased = public.user_coins.total_purchased + excluded.total_purchased,
          updated_at = now();
  END IF;
END;
$$;

-- Trigger: compra de moedas confirmada (paid) → recompensa ao indicador
CREATE OR REPLACE FUNCTION public.trg_referral_coin_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.credit_referral(NEW.user_id, NEW.price::numeric, 'coin_purchase');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_coin_purchase ON public.coin_purchase_orders;
CREATE TRIGGER trg_referral_coin_purchase
  AFTER UPDATE OF status ON public.coin_purchase_orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status = 'pending')
  EXECUTE FUNCTION public.trg_referral_coin_purchase();

-- Trigger: assinatura ativada → recompensa ao indicador (mensalidade)
CREATE OR REPLACE FUNCTION public.trg_referral_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plans jsonb;
  v_price numeric := 0;
BEGIN
  v_plans := public.get_platform_config('store_plans');
  IF v_plans IS NOT NULL AND v_plans <> '' THEN
    SELECT COALESCE((COALESCE((elem.value -> 'monthly'), '0')::numeric), 0)
      INTO v_price
      FROM jsonb_array_elements(v_plans::jsonb) elem
     WHERE elem.value ->> 'slug' = NEW.plan;
  END IF;
  PERFORM public.credit_referral(NEW.user_id, v_price, 'subscription');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_subscription ON public.user_subscriptions;
CREATE TRIGGER trg_referral_subscription
  AFTER INSERT ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_referral_subscription();

-- -----------------------------------------------------------------------------
-- 4. TAXAS AJUSTADAS (config-driven, defaults fechados)
--    gift_fee 30%: pagante gasta R$ X com presente → destinatário leva
--    70% do valor em 💎; os 30% são o prêmio potencial + margem da plataforma.
-- -----------------------------------------------------------------------------
INSERT INTO public.platform_config (key, value) VALUES
  ('gift_fee', '0.30'),
  ('min_withdrawal_diamonds', '200'),
  ('battle_prize_fee_share', '0.35'),
  ('referral_ratio', '0.10'),
  ('coins_per_reais', '20')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- -----------------------------------------------------------------------------
-- 5. HARDENING (grants mínimos)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.confirm_coin_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_coin_purchase(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_set_feature(text, int, int, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_feature(text, int, int, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.credit_diamonds(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_referral(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.debit_coins(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_coins(uuid, bigint) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_or_create_private_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_invite_code(text) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_gift_transactions_battle ON public.gift_transactions (battle_id);