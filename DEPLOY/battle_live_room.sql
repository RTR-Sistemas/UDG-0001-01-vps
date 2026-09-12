-- =============================================================================
-- BATTLE LIVE ROOM (sala de batalha ao vivo style TikTok)
-- 1) battle_chat      — chat ao vivo da batalha (real time, RLS autenticado)
-- 2) battle_viewers   — presença de espectadores + contador ao vivo
-- 3) surrender_battle — desistência de participante (vencedor = adversário)
-- 4) Presentes da batalha visíveis p/ espectadores (animação p/ todos)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) battles.live_viewers
-- -----------------------------------------------------------------------------
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS live_viewers int NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 1) CHAT DA BATALHA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battle_chat (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_battle_chat_battle ON public.battle_chat (battle_id, created_at desc);
ALTER TABLE public.battle_chat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "battle_chat_select" ON public.battle_chat;
CREATE POLICY "battle_chat_select" ON public.battle_chat
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "battle_chat_insert" ON public.battle_chat;
CREATE POLICY "battle_chat_insert" ON public.battle_chat
  FOR INSERT WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_chat;

-- -----------------------------------------------------------------------------
-- 2) ESPECTADORES (presença no tempo real)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.battle_viewers (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_battle_viewers_seen ON public.battle_viewers (last_seen_at);
ALTER TABLE public.battle_viewers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "battle_viewers_select" ON public.battle_viewers;
CREATE POLICY "battle_viewers_select" ON public.battle_viewers
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "battle_viewers_insert" ON public.battle_viewers;
CREATE POLICY "battle_viewers_insert" ON public.battle_viewers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "battle_viewers_update" ON public.battle_viewers;
CREATE POLICY "battle_viewers_update" ON public.battle_viewers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "battle_viewers_delete" ON public.battle_viewers;
CREATE POLICY "battle_viewers_delete" ON public.battle_viewers
  FOR DELETE USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_viewers;

-- sincroniza battles.live_viewers
CREATE OR REPLACE FUNCTION public.sync_battle_viewer_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_battle uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_battle := OLD.battle_id;
  ELSE
    v_battle := NEW.battle_id;
  END IF;
  UPDATE public.battles
     SET live_viewers = (
       SELECT count(*) FROM public.battle_viewers v WHERE v.battle_id = v_battle
     )
   WHERE id = v_battle;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_battle_viewers_ai ON public.battle_viewers;
CREATE TRIGGER trg_battle_viewers_ai
  AFTER INSERT ON public.battle_viewers
  FOR EACH ROW EXECUTE FUNCTION public.sync_battle_viewer_count();

DROP TRIGGER IF EXISTS trg_battle_viewers_ad ON public.battle_viewers;
CREATE TRIGGER trg_battle_viewers_ad
  AFTER DELETE ON public.battle_viewers
  FOR EACH ROW EXECUTE FUNCTION public.sync_battle_viewer_count();

-- RPCs de presença
CREATE OR REPLACE FUNCTION public.join_battle_as_viewer(p_battle_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT status INTO v_status FROM public.battles WHERE id = p_battle_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'battle_not_found'; END IF;
  IF v_status <> 'live' THEN RAISE EXCEPTION 'battle_not_live'; END IF;

  INSERT INTO public.battle_viewers (battle_id, user_id, last_seen_at)
  VALUES (p_battle_id, v_me, now())
  ON CONFLICT (battle_id, user_id)
  DO UPDATE SET last_seen_at = now();

  RETURN (SELECT live_viewers FROM public.battles WHERE id = p_battle_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_battle_as_viewer(p_battle_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.battle_viewers
   WHERE battle_id = p_battle_id AND user_id = v_me;
  RETURN (SELECT live_viewers FROM public.battles WHERE id = p_battle_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_battle_viewer(p_battle_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.battle_viewers
     SET last_seen_at = now()
   WHERE battle_id = p_battle_id AND user_id = v_me;
  RETURN (SELECT live_viewers FROM public.battles WHERE id = p_battle_id);
END;
$function$;

-- limpeza de espectadores órfãos (chamado pelo cron de mensagens agendadas)
CREATE OR REPLACE FUNCTION public.cleanup_stale_battle_viewers()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted int;
BEGIN
  WITH stale AS (
    DELETE FROM public.battle_viewers
     WHERE last_seen_at < now() - interval '90 seconds'
     RETURNING 1
  ) SELECT count(*) INTO v_deleted FROM stale;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_battle_as_viewer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_battle_as_viewer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_battle_viewer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_stale_battle_viewers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_battle_as_viewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_battle_as_viewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_battle_viewer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_battle_viewers() TO service_role;

-- -----------------------------------------------------------------------------
-- 3) RENDIÇÃO (surrender) — compartilha a apuração de prêmio com end_battle
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_battle_prize(p_battle_id uuid, p_winner uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fee_total bigint;
  v_share numeric := COALESCE(
    NULLIF(public.get_platform_config('battle_prize_fee_share'), '')::numeric, 0.35);
  v_prize int;
BEGIN
  IF p_winner IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(SUM(platform_fee), 0) INTO v_fee_total
    FROM public.gift_transactions
   WHERE battle_id = p_battle_id AND platform_fee > 0;

  v_prize := floor(v_fee_total * v_share);
  IF v_prize > 0 THEN
    INSERT INTO public.battle_prizes (battle_id, winner_id, prize_diamonds, fee_total)
    VALUES (p_battle_id, p_winner, v_prize, v_fee_total);
    PERFORM public.credit_diamonds(p_winner, v_prize);
  END IF;
  RETURN v_prize;
END;
$function$;

CREATE OR REPLACE FUNCTION public.surrender_battle(p_battle_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_battle public.battles%rowtype;
  v_winner uuid;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'battle_not_found'; END IF;
  IF auth.uid() NOT IN (v_battle.host_id, v_battle.guest_id) THEN
    RAISE EXCEPTION 'not_a_participant';
  END IF;
  IF v_battle.status <> 'live' THEN RAISE EXCEPTION 'battle_not_live'; END IF;

  v_winner := CASE WHEN auth.uid() = v_battle.host_id THEN v_battle.guest_id
                   ELSE v_battle.host_id END;

  UPDATE public.battles
     SET status = 'ended',
         actual_end = now(),
         winner_id = v_winner
   WHERE id = p_battle_id;

  PERFORM public.finalize_battle_prize(p_battle_id, v_winner);

  RETURN v_winner;
END;
$function$;

REVOKE ALL ON FUNCTION public.surrender_battle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.surrender_battle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_battle_prize(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_battle_prize(uuid, uuid) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 4) Presentes da batalha visíveis para espectadores (animação p/ todos)
-- -----------------------------------------------------------------------------
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "battle_gift_select_all" ON public.gift_transactions;
CREATE POLICY "battle_gift_select_all" ON public.gift_transactions
  FOR SELECT USING (auth.role() = 'authenticated' AND battle_id IS NOT NULL);