-- =============================================================================
-- UndoinG - FASE 1 MONETIZAÇÃO
-- Tabelas + Catálogo + RPCs de gating (aprovado em PLANO_MONETIZACAO.md)
-- Base existente reutilizada: user_coins, coin_purchase_orders,
--   create_coin_purchase_order, confirm_coin_purchase, mock_confirm_coin_purchase,
--   debit_coins, platform_config, get_platform_config
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) TABELAS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.features_catalog (
  slug         text PRIMARY KEY,
  nome         text NOT NULL,
  descricao    text,
  tipo         text NOT NULL DEFAULT 'consumable'
               CHECK (tipo IN ('once','consumable','daily_weekly')),
  price_coins  integer NOT NULL DEFAULT 0,
  credit_cost  integer NOT NULL DEFAULT 0,
  premium_tier text CHECK (premium_tier IN ('premium','ultimate')),
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id),
  plan       text NOT NULL CHECK (plan IN ('premium','ultimate')),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feature_grants (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles(id),
  slug               text NOT NULL REFERENCES public.features_catalog(slug),
  granted_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz,
  quantity_remaining integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, slug)
);

CREATE TABLE IF NOT EXISTS public.consumption_ledger (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id),
  slug         text NOT NULL,
  delta        integer NOT NULL,
  balance_after integer,
  source       text NOT NULL DEFAULT 'usage' CHECK (source IN ('usage','purchase','subscription','refund','admin')),
  request_id   uuid,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS consumption_ledger_usage_day_uq
  ON public.consumption_ledger (user_id, slug, (created_at::date))
  WHERE source = 'usage';

CREATE TABLE IF NOT EXISTS public.credit_balances (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id),
  credits_ia integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.features_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS features_catalog_public_read ON public.features_catalog;
CREATE POLICY features_catalog_public_read ON public.features_catalog FOR SELECT USING (true);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_subscriptions_own ON public.user_subscriptions;
CREATE POLICY user_subscriptions_own ON public.user_subscriptions FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.feature_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feature_grants_own ON public.feature_grants;
CREATE POLICY feature_grants_own ON public.feature_grants FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.consumption_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consumption_ledger_own ON public.consumption_ledger;
CREATE POLICY consumption_ledger_own ON public.consumption_ledger FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_balances_own ON public.credit_balances;
CREATE POLICY credit_balances_own ON public.credit_balances FOR SELECT USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) CATÁLOGO DE FEATURES (aprovado no plano, seção 3)
-- ---------------------------------------------------------------------------
INSERT INTO public.features_catalog (slug, nome, descricao, tipo, price_coins, credit_cost, premium_tier) VALUES
  -- Arena / Feed
  ('post_extra_dia',     'Post extra no dia',        'Publicar 1 post adicional fora da cota gratuita', 'daily_weekly', 5, 0, NULL),
  ('boost_destaque',     'Boost de visibilidade',    'Post em destaque no topo por 2h',                 'consumable',   15, 0, NULL),
  ('revelar_quem_votou', 'Revelar votantes',          'Ver quem votou no seu post',                      'consumable',   10, 0, NULL),
  ('feed_sem_anuncios',  'Feed sem anúncios',         'Remover anúncios do feed (fase 4)',               'daily_weekly', 0, 0, 'premium'),
  ('votos_ilimitados',   'Votação ilimitada',         '+20 votos extras no dia',                         'daily_weekly', 0, 3, NULL),
  -- Debates
  ('debate_extra',       'Debate simultâneo extra',   'Ativar 2º/3º debate ao mesmo tempo',              'consumable',   25, 0, NULL),
  ('tribuna',            'Tribuna',                   'Palco + entrada destacada + pin do tema',         'consumable',   50, 0, NULL),
  ('gravar_debate',      'Gravar debate',             'Baixar gravação do debate',                       'consumable',   10, 0, NULL),
  ('torneio_debate',     'Torneio de debates',        'Inscrição em torneio com prêmio em diamantes',   'consumable',   30, 0, NULL),
  -- Mensagens
  ('save_mode',          'Modo salvar conversa',      'Resgatar mensagens efêmeras da conversa',         'consumable',   20, 0, NULL),
  ('conversas_ilimitadas','Conversas ilimitadas',     'Abrir mais conversas simultâneas',                'daily_weekly', 0, 2, NULL),
  ('traducao_extra',     'Tradução instantânea extra','Mais 10 traduções além da cota gratuita',         'consumable',   0, 1, NULL),
  ('msg_destaque',       'Mensagem em destaque',      'Link direto para a mensagem',                     'consumable',   3, 0, NULL),
  ('desfazer_envio',     'Desfazer envio',            'Desfazer envio por 30s (permanente)',             'once',         5, 0, NULL),
  -- Chamadas
  ('minuto_call',        'Minuto de chamada extra',   '1 minuto adicional de chamada',                   'consumable',   1, 0, NULL),
  ('call_premium',       'Call Premium',              'Gravação + fundos de vídeo',                      'consumable',   15, 0, NULL),
  -- Stories / Mood
  ('stories_extra',      'Stories premium',           'Stories com reações e expiração 48h',             'daily_weekly', 8, 0, NULL),
  ('repost_story',       'Repost de story',           'Compartilhar story de outra pessoa',              'consumable',   3, 0, NULL),
  ('analise_humor',      'Análise de humor avançada', 'Relatório semanal do seu humor',                   'consumable',   0, 2, NULL),
  -- Perfil & expressão
  ('moldura_perfil',     'Moldura de perfil',         'Moldura exclusiva da coleção',                     'once',         20, 0, NULL),
  ('tema_perfil',        'Tema de perfil',            'Tema visual exclusivo (dark neon, rosa...)',      'once',         30, 0, NULL),
  ('nome_neon',          'Nome neon',                 'Nome colorido/neon permanente',                    'once',         30, 0, NULL),
  ('selo_verificado',    'Selo verificado',           'Selo azul por 30 dias',                           'once',         100, 0, NULL),
  ('emblema_animado',    'Emblema animado',           'Emblema de conquista animado',                     'once',         40, 0, NULL),
  -- Família / Relacionamento
  ('anel_relacionamento','Anel de relacionamento',    'Anel visível no perfil (coleção)',                'once',         60, 0, NULL),
  ('selo_familia',       'Selo de família',           'Árvore genealógica premium',                      'once',         40, 0, NULL),
  ('turbo_pedido',       'Turbinar pedido',           'Aparecer em destaque na lista do destinatário',   'consumable',   10, 0, NULL),
  ('status_namorando',   'Status namorando',          'Status público + data do casal',                  'once',         25, 0, NULL),
  -- Atenção / Push
  ('modo_heroi',         'Modo Herói',                'Alerta máximo + sem limite de silêncio (24h)',    'daily_weekly', 20, 0, NULL),
  ('push_ilimitado',     'Push ilimitado',            'Notificações push sem limite no dia',             'daily_weekly', 0, 1, NULL),
  ('push_emoji',         'Push com emoji',            'Notificação com emoji animado',                   'consumable',   5, 0, NULL),
  -- Zane AI
  ('zane_extra_50',      'Zane +50 mensagens',        'Pacote extra de mensagens do Zane',               'consumable',   0, 5, NULL),
  ('zane_modo',          'Modo do Zane',              'Zane romântico / melhor amigo / coach',           'daily_weekly', 0, 2, NULL),
  ('zane_premium',       'Zane Premium',              'Memória longa + voz (mês)',                       'daily_weekly', 0, 10, NULL),
  -- Áudio IA
  ('dublagem_audio',     'Dublagem de voz',           'Dublar 1 áudio (clone de voz)',                   'consumable',   0, 5, NULL),
  ('voz_chamada',        'Voz em chamada',            'Tradução de voz em tempo real na chamada',        'consumable',   0, 10, NULL),
  ('pacote_dublador',    'Pacote dublador',           '10 áudios dublados (permanente)',                 'once',         40, 0, NULL),
  -- Segurança / Privacidade
  ('modo_invisivel',     'Modo invisível',            'Perfil oculto no radar (mês)',                    'daily_weekly', 0, 2, NULL),
  ('historico_visitas',  'Histórico de visitas',      'Ver quem visitou seu perfil (mês)',               'daily_weekly', 0, 1, NULL),
  ('quem_me_descurtiu',  'Quem me descurtiu',         'Notificação de quem removeu o like',              'consumable',   8, 0, NULL)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo,
  price_coins = EXCLUDED.price_coins,
  credit_cost = EXCLUDED.credit_cost,
  premium_tier = EXCLUDED.premium_tier,
  enabled = true;

-- ---------------------------------------------------------------------------
-- 4) CONFIG DA LOJA (platform_config)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_config (key, value) VALUES
  ('store_packs', '[{"slug":"iniciante","price":4.9,"coins":100,"bonus":0},{"slug":"popular","price":9.9,"coins":250,"bonus":10},{"slug":"gamer","price":19.9,"coins":550,"bonus":20},{"slug":"vip","price":49.9,"coins":1500,"bonus":30},{"slug":"lendario","price":99.9,"coins":3500,"bonus":50}]'),
  ('store_plans', '[{"slug":"premium","name":"UDG Premium","monthly":19.9,"yearly":189,"coins_monthly":500,"credits_monthly":500},{"slug":"ultimate","name":"UDG Ultimate","monthly":49.9,"yearly":0,"coins_monthly":1500,"credits_monthly":1500}]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ---------------------------------------------------------------------------
-- 5) RPCs DE LOJA E GATING
-- ---------------------------------------------------------------------------

-- Catálogo público de preços (permite anon ver a loja)
CREATE OR REPLACE FUNCTION public.feature_prices()
RETURNS SETOF public.features_catalog
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.features_catalog WHERE enabled ORDER BY tipo, price_coins;
$$;

-- Config pública da loja (packs, planos, mock, taxas)
CREATE OR REPLACE FUNCTION public.store_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_packs jsonb := COALESCE(
    NULLIF(public.get_platform_config('store_packs'), '')::jsonb, '[]'::jsonb);
  v_plans jsonb := COALESCE(
    NULLIF(public.get_platform_config('store_plans'), '')::jsonb, '[]'::jsonb);
  v_mock bool := COALESCE(public.get_platform_config('mock_payments'), 'disabled') = 'enabled';
  v_min bigint := COALESCE(NULLIF(public.get_platform_config('min_withdrawal_diamonds'), '')::bigint, 1000);
  v_rate decimal := COALESCE(NULLIF(public.get_platform_config('diamond_to_currency_rate'), '')::decimal, 0.05);
BEGIN
  RETURN jsonb_build_object(
    'packs', v_packs,
    'plans', v_plans,
    'mock_payments', v_mock,
    'min_withdrawal_diamonds', v_min,
    'diamond_to_currency_rate', v_rate
  );
END;
$$;

-- Direitos do usuário (saldo, assinatura, grants, uso de hoje)
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
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'slug', slug,
        'count', count(*)
      )), '[]'::jsonb)
      FROM public.consumption_ledger
      WHERE user_id = v_uid AND source = 'usage' AND created_at::date = current_date
      GROUP BY slug
    )
  );
  RETURN v_out;
END;
$$;

-- Verifica disponibilidade SEM debitar
CREATE OR REPLACE FUNCTION public.check_feature(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_feat public.features_catalog%rowtype;
  v_balance bigint := 0;
  v_credits int := 0;
  v_used int := 0;
  v_sub text := NULL;
  v_granted bool := false;
  v_budget int := 1;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_feat FROM public.features_catalog WHERE slug = p_slug;
  IF NOT FOUND OR NOT v_feat.enabled THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'feature_not_found');
  END IF;

  -- Assinatura
  SELECT plan INTO v_sub FROM public.user_subscriptions
  WHERE user_id = v_uid AND status = 'active' AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  IF v_feat.premium_tier IS NOT NULL THEN
    IF v_sub IS NULL OR (v_feat.premium_tier = 'ultimate' AND v_sub <> 'ultimate') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'requires_premium', 'tier', v_feat.premium_tier);
    END IF;
  END IF;

  -- Once: já possui grant?
  IF v_feat.tipo = 'once' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.feature_grants
      WHERE user_id = v_uid AND slug = v_feat.slug
        AND (expires_at IS NULL OR expires_at > now())
    ) INTO v_granted;
    IF v_granted THEN
      RETURN jsonb_build_object('ok', true, 'slug', v_feat.slug, 'granted', true, 'price_coins', v_feat.price_coins, 'credit_cost', v_feat.credit_cost);
    END IF;
  END IF;

  -- Uso diário
  IF v_feat.tipo = 'daily_weekly' THEN
    v_budget := COALESCE(
      NULLIF(public.get_platform_config('budget_' || v_feat.slug), '')::int, 1);
    SELECT count(*) INTO v_used FROM public.consumption_ledger
    WHERE user_id = v_uid AND slug = v_feat.slug AND source = 'usage' AND created_at::date = current_date;
    IF v_used >= v_budget THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'daily_limit_reached', 'used', v_used, 'budget', v_budget);
    END IF;
  END IF;

  -- Saldo
  IF v_feat.price_coins > 0 THEN
    SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_coins WHERE user_id = v_uid;
    IF v_balance < v_feat.price_coins THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_coins', 'need', v_feat.price_coins, 'have', v_balance);
    END IF;
  ELSIF v_feat.credit_cost > 0 THEN
    SELECT COALESCE(credits_ia, 0) INTO v_credits FROM public.credit_balances WHERE user_id = v_uid;
    IF v_credits < v_feat.credit_cost THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'need', v_feat.credit_cost, 'have', v_credits);
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'slug', v_feat.slug, 'price_coins', v_feat.price_coins, 'credit_cost', v_feat.credit_cost, 'tipo', v_feat.tipo);
END;
$$;

-- Consome / aplica feature (idempotente por request_id)
CREATE OR REPLACE FUNCTION public.consume_feature(
  p_slug text,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_feat public.features_catalog%rowtype;
  v_check jsonb;
  v_request uuid := COALESCE(p_request_id, gen_random_uuid());
  v_used int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Idempotência
  IF EXISTS (SELECT 1 FROM public.consumption_ledger WHERE request_id = v_request AND source = 'usage') THEN
    RETURN jsonb_build_object('ok', true, 'slug', p_slug, 'duplicate', true);
  END IF;

  v_check := public.check_feature(p_slug);
  IF NOT (v_check->>'ok')::boolean THEN
    RAISE EXCEPTION '%', v_check->>'reason';
  END IF;

  SELECT * INTO v_feat FROM public.features_catalog WHERE slug = p_slug;

  -- Débito
  IF v_feat.price_coins > 0 THEN
    PERFORM public.debit_coins(v_uid, v_feat.price_coins);
  ELSIF v_feat.credit_cost > 0 THEN
    UPDATE public.credit_balances
    SET credits_ia = credits_ia - v_feat.credit_cost, updated_at = now()
    WHERE user_id = v_uid AND credits_ia >= v_feat.credit_cost;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_credits'; END IF;
  END IF;

  -- Aplicação por tipo
  IF v_feat.tipo = 'once' THEN
    INSERT INTO public.feature_grants (user_id, slug, quantity_remaining)
    VALUES (v_uid, v_feat.slug, 1)
    ON CONFLICT (user_id, slug) DO NOTHING;
  ELSIF v_feat.tipo = 'daily_weekly' THEN
    SELECT count(*) INTO v_used FROM public.consumption_ledger
    WHERE user_id = v_uid AND slug = v_feat.slug AND source = 'usage' AND created_at::date = current_date;
    IF v_used > 0 THEN
      RAISE EXCEPTION 'daily_limit_reached';
    END IF;
  END IF;

  INSERT INTO public.consumption_ledger
    (user_id, slug, delta, source, request_id, metadata)
  VALUES (v_uid, v_feat.slug, -1, 'usage', v_request,
          jsonb_build_object('price_coins', v_feat.price_coins, 'credit_cost', v_feat.credit_cost, 'tipo', v_feat.tipo));

  RETURN jsonb_build_object('ok', true, 'slug', v_feat.slug, 'tipo', v_feat.tipo);
END;
$$;

-- Compra pacote de moedas (cria order de pagamento)
CREATE OR REPLACE FUNCTION public.buy_coins(p_pack_slug text, p_gateway text DEFAULT 'mercadopago')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_packs jsonb;
  v_pack jsonb;
  v_amount int;
  v_price decimal;
  v_order uuid;
BEGIN
  v_packs := COALESCE(
    NULLIF(public.get_platform_config('store_packs'), '')::jsonb, '[]'::jsonb);
  SELECT p INTO v_pack FROM jsonb_array_elements(v_packs) p
  WHERE p->>'slug' = p_pack_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'pack_not_found'; END IF;

  v_amount := (v_pack->>'coins')::int;
  v_price := (v_pack->>'price')::decimal;

  v_order := public.create_coin_purchase_order(v_amount, v_price, 'BRL', p_gateway);

  RETURN jsonb_build_object(
    'order_id', v_order,
    'amount_coins', v_amount,
    'price', v_price,
    'mock', COALESCE(public.get_platform_config('mock_payments'), 'disabled') = 'enabled'
  );
END;
$$;

-- Ativa assinatura (modo mock ou admin); testável sem gateway
CREATE OR REPLACE FUNCTION public.activate_subscription(p_plan text, p_months int DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plans jsonb;
  v_plan jsonb;
  v_coins_monthly int := 0;
  v_credits_monthly int := 0;
  v_mock bool := COALESCE(public.get_platform_config('mock_payments'), 'disabled') = 'enabled';
  v_is_admin bool;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT COALESCE(is_admin, false) INTO v_is_admin FROM public.profiles WHERE id = v_uid;
  IF NOT v_mock AND NOT v_is_admin THEN
    RAISE EXCEPTION 'subscription_gateway_required';
  END IF;
  IF p_plan NOT IN ('premium','ultimate') THEN RAISE EXCEPTION 'invalid_plan'; END IF;

  v_plans := COALESCE(
    NULLIF(public.get_platform_config('store_plans'), '')::jsonb, '[]'::jsonb);
  SELECT p INTO v_plan FROM jsonb_array_elements(v_plans) p WHERE p->>'slug' = p_plan;
  IF FOUND THEN
    v_coins_monthly := COALESCE((v_plan->>'coins_monthly')::int, 0);
    v_credits_monthly := COALESCE((v_plan->>'credits_monthly')::int, 0);
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan, status, started_at, expires_at)
  VALUES (v_uid, p_plan, 'active', now(), now() + (p_months * interval '1 month'))
  ON CONFLICT (user_id) DO UPDATE
  SET plan = EXCLUDED.plan,
      status = 'active',
      expires_at = CASE
        WHEN public.user_subscriptions.status = 'active'
             AND public.user_subscriptions.expires_at > now()
        THEN public.user_subscriptions.expires_at + (p_months * interval '1 month')
        ELSE now() + (p_months * interval '1 month')
      END,
      updated_at = now();

  IF v_coins_monthly > 0 THEN
    INSERT INTO public.user_coins (user_id, balance, total_purchased)
    VALUES (v_uid, v_coins_monthly, v_coins_monthly)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_coins.balance + EXCLUDED.balance,
          total_purchased = public.user_coins.total_purchased + EXCLUDED.total_purchased,
          updated_at = now();
  END IF;

  IF v_credits_monthly > 0 THEN
    INSERT INTO public.credit_balances (user_id, credits_ia)
    VALUES (v_uid, v_credits_monthly)
    ON CONFLICT (user_id) DO UPDATE
      SET credits_ia = public.credit_balances.credits_ia + EXCLUDED.credits_ia,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object('ok', true, 'plan', p_plan,
    'coins_credited', v_coins_monthly, 'credits_credited', v_credits_monthly);
END;
$$;

-- Usa créditos IA (wrapper de consume_feature para features de crédito)
CREATE OR REPLACE FUNCTION public.use_ia_credit(p_slug text, p_request_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok bool;
BEGIN
  SELECT (public.consume_feature(p_slug, p_request_id)->>'ok')::boolean INTO v_ok;
  RETURN jsonb_build_object('ok', v_ok, 'slug', p_slug);
END;
$$;

-- Admin: ajusta preço/estado de feature sem deploy
CREATE OR REPLACE FUNCTION public.admin_set_feature(
  p_slug text,
  p_price_coins int DEFAULT NULL,
  p_credit_cost int DEFAULT NULL,
  p_enabled boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.features_catalog SET
    price_coins = COALESCE(p_price_coins, price_coins),
    credit_cost = COALESCE(p_credit_cost, credit_cost),
    enabled = COALESCE(p_enabled, enabled)
  WHERE slug = p_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'feature_not_found'; END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) GRANTS
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.feature_prices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feature_prices() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.store_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_config() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.my_entitlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_entitlements() TO authenticated;
REVOKE ALL ON FUNCTION public.check_feature(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_feature(text) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_feature(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_feature(text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buy_coins(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_coins(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.activate_subscription(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_subscription(text, int) TO authenticated;
REVOKE ALL ON FUNCTION public.use_ia_credit(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_ia_credit(text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_feature(text, int, int, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_feature(text, int, int, boolean) TO authenticated;