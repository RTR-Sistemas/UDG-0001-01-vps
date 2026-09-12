-- Fix my_entitlements: agregado aninhado (42803) -> derived table
CREATE OR REPLACE FUNCTION public.my_entitlements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_coins bigint := 0;
  v_diamonds bigint := 0;
  v_credits int := 0;
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(balance, 0) INTO v_coins FROM public.user_coins WHERE user_id = v_uid;
  SELECT COALESCE(balance, 0) INTO v_diamonds FROM public.user_diamonds WHERE user_id = v_uid;
  SELECT COALESCE(credits_ia, 0) INTO v_credits FROM public.credit_balances WHERE user_id = v_uid;
  v_coins := COALESCE(v_coins, 0);
  v_diamonds := COALESCE(v_diamonds, 0);
  v_credits := COALESCE(v_credits, 0);

  v_out := jsonb_build_object(
    'coins', v_coins,
    'diamonds', v_diamonds,
    'credits_ia', v_credits,
    'subscription', (
      SELECT jsonb_build_object(
        'plan', plan,
        'status', status,
        'expires_at', expires_at
      ) FROM public.user_subscriptions
      WHERE user_id = v_uid AND status = 'active' AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1
    ),
    'grants', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', slug, 'expires_at', expires_at)), '[]'::jsonb)
      FROM public.feature_grants
      WHERE user_id = v_uid AND (expires_at IS NULL OR expires_at > now())
    ),
    'today_usage', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', t.slug, 'count', t.cnt)), '[]'::jsonb)
      FROM (
        SELECT slug, count(*) AS cnt
        FROM public.consumption_ledger
        WHERE user_id = v_uid AND source = 'usage' AND usage_date = current_date
        GROUP BY slug
      ) t
    )
  );
  RETURN v_out;
END;
$$;

-- Fix buy_coins: gateway mercadopago agora aceito
ALTER TABLE public.coin_purchase_orders DROP CONSTRAINT IF EXISTS coin_purchase_orders_payment_gateway_check;
ALTER TABLE public.coin_purchase_orders ADD CONSTRAINT coin_purchase_orders_payment_gateway_check
  CHECK (payment_gateway IN ('stripe', 'apple', 'google', 'mercadopago'));