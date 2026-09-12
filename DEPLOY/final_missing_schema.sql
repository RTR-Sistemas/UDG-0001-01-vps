-- =============================================================================
-- UndoinG - Schema complementar reconstruído a partir de:
--   types.ts (gerado do Supabase cloud) + call sites em src/ e netlify/functions
-- Tabelas faltantes (16) + RLS + RPCs faltantes (12)
-- =============================================================================

-- =============================================================================
-- 1) TABELAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.account_security_keys (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id),
  security_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.age_verification_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id),
  provider   text,
  session_id text,
  status     text,
  result     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS age_verification_log_user_id_idx ON public.age_verification_log(user_id);

CREATE TABLE IF NOT EXISTS public.attention_calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES public.profiles(id),
  receiver_id uuid NOT NULL REFERENCES public.profiles(id),
  message     text,
  viewed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attention_calls_receiver_idx ON public.attention_calls(receiver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.attention_silence_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id),
  sender_id     uuid NOT NULL REFERENCES public.profiles(id),
  silenced_until timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attention_silence_user_sender_idx ON public.attention_silence_settings(user_id, sender_id);

CREATE TABLE IF NOT EXISTS public.calls (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id          uuid NOT NULL REFERENCES public.profiles(id),
  receiver_id        uuid NOT NULL REFERENCES public.profiles(id),
  type               text NOT NULL DEFAULT 'video',
  status             text NOT NULL DEFAULT 'ringing',
  agora_channel_name text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calls_receiver_idx ON public.calls(receiver_id, status);

CREATE TABLE IF NOT EXISTS public.conversation_save_mode (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  owner_id       uuid NOT NULL REFERENCES public.profiles(id),
  requester_id   uuid NOT NULL REFERENCES public.profiles(id),
  status         text NOT NULL DEFAULT 'pending',
  started_at     timestamptz,
  deactivated_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deleted_messages_archive (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_message_id uuid NOT NULL,
  conversation_id   uuid NOT NULL REFERENCES public.conversations(id),
  sender_id         uuid NOT NULL REFERENCES public.profiles(id),
  deleted_by        uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_by_admin uuid REFERENCES public.profiles(id),
  content           text,
  media_urls        text[],
  original_created_at timestamptz NOT NULL,
  deleted_at        timestamptz NOT NULL DEFAULT now(),
  deletion_context  text,
  admin_notes       text,
  reviewed_at       timestamptz
);
CREATE INDEX IF NOT EXISTS deleted_messages_archive_conversation_idx ON public.deleted_messages_archive(conversation_id);

CREATE TABLE IF NOT EXISTS public.family_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid NOT NULL REFERENCES public.profiles(id),
  receiver_id   uuid NOT NULL REFERENCES public.profiles(id),
  relation_type text NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_requests_receiver_idx ON public.family_requests(receiver_id, status);

CREATE TABLE IF NOT EXISTS public.notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id),
  target_user_id uuid REFERENCES public.profiles(id),
  title          text NOT NULL,
  message        text NOT NULL,
  type           text NOT NULL,
  data           jsonb,
  metadata       jsonb,
  is_read        boolean NOT NULL DEFAULT false,
  is_muted       boolean NOT NULL DEFAULT false,
  target_id      text,
  target_type    text,
  expires_at     timestamptz,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS public.post_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid REFERENCES public.posts(id),
  user_id    uuid REFERENCES public.profiles(id),
  platform   text NOT NULL DEFAULT 'web',
  metadata   jsonb,
  shared_at  timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS post_shares_post_user_platform_uq ON public.post_shares(post_id, user_id, platform);

CREATE TABLE IF NOT EXISTS public.profile_moderation_stats (
  user_id        uuid PRIMARY KEY REFERENCES public.profiles(id),
  approved_count integer NOT NULL DEFAULT 0,
  removed_count  integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_visits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.profiles(id),
  visited_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_visits_visited_idx ON public.profile_visits(visited_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.relationship_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      uuid NOT NULL REFERENCES public.profiles(id),
  receiver_id    uuid NOT NULL REFERENCES public.profiles(id),
  desired_status text NOT NULL,
  status         text NOT NULL DEFAULT 'pending',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relationship_requests_receiver_idx ON public.relationship_requests(receiver_id, status);

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  sender_id       uuid NOT NULL REFERENCES public.profiles(id),
  content         text,
  media_urls      text[],
  scheduled_at    timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  sent_message_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_messages_pending_idx ON public.scheduled_messages(status, scheduled_at);

CREATE TABLE IF NOT EXISTS public.zane_ai_chats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id),
  title      text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zane_ai_chats_user_idx ON public.zane_ai_chats(user_id);

CREATE TABLE IF NOT EXISTS public.zane_ai_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid NOT NULL REFERENCES public.zane_ai_chats(id) ON DELETE CASCADE,
  role       text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zane_ai_messages_chat_idx ON public.zane_ai_messages(chat_id, created_at);

-- =============================================================================
-- 1.5) PROFILES - colunas faltantes (recuperadas do cloud via types.ts)
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS debate_available boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorite_team text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorite_team_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_mood text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_mood_emoji text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_mood_updated_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mood_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mood_status_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS movement_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS movement_status_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS political_party text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS political_party_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_visits_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registration_number integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS relationship_partner_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS relationship_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS relationship_status_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sexual_orientation text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sexual_orientation_public boolean NOT NULL DEFAULT false;

-- =============================================================================
-- 2) RLS + POLICIES
-- =============================================================================

ALTER TABLE public.account_security_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_security_keys_select_own ON public.account_security_keys;
DROP POLICY IF EXISTS account_security_keys_insert_own ON public.account_security_keys;
DROP POLICY IF EXISTS account_security_keys_delete_own ON public.account_security_keys;
CREATE POLICY account_security_keys_select_own ON public.account_security_keys FOR SELECT USING (user_id = auth.uid());
CREATE POLICY account_security_keys_insert_own ON public.account_security_keys FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY account_security_keys_delete_own ON public.account_security_keys FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.age_verification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS age_verification_log_select_own ON public.age_verification_log;
DROP POLICY IF EXISTS age_verification_log_insert_own ON public.age_verification_log;
CREATE POLICY age_verification_log_select_own ON public.age_verification_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY age_verification_log_insert_own ON public.age_verification_log FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER TABLE public.attention_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attention_calls_select_involved ON public.attention_calls;
DROP POLICY IF EXISTS attention_calls_insert_own ON public.attention_calls;
DROP POLICY IF EXISTS attention_calls_update_receiver ON public.attention_calls;
CREATE POLICY attention_calls_select_involved ON public.attention_calls FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY attention_calls_insert_own ON public.attention_calls FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY attention_calls_update_receiver ON public.attention_calls FOR UPDATE USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());

ALTER TABLE public.attention_silence_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attention_silence_select_own ON public.attention_silence_settings;
DROP POLICY IF EXISTS attention_silence_insert_own ON public.attention_silence_settings;
DROP POLICY IF EXISTS attention_silence_delete_own ON public.attention_silence_settings;
CREATE POLICY attention_silence_select_own ON public.attention_silence_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY attention_silence_insert_own ON public.attention_silence_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY attention_silence_delete_own ON public.attention_silence_settings FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calls_select_involved ON public.calls;
DROP POLICY IF EXISTS calls_insert_own ON public.calls;
DROP POLICY IF EXISTS calls_update_involved ON public.calls;
CREATE POLICY calls_select_involved ON public.calls FOR SELECT USING (caller_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY calls_insert_own ON public.calls FOR INSERT WITH CHECK (caller_id = auth.uid());
CREATE POLICY calls_update_involved ON public.calls FOR UPDATE USING (caller_id = auth.uid() OR receiver_id = auth.uid());

ALTER TABLE public.conversation_save_mode ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversation_save_mode_select_involved ON public.conversation_save_mode;
DROP POLICY IF EXISTS conversation_save_mode_insert_requester ON public.conversation_save_mode;
DROP POLICY IF EXISTS conversation_save_mode_update_owner ON public.conversation_save_mode;
CREATE POLICY conversation_save_mode_select_involved ON public.conversation_save_mode FOR SELECT USING (owner_id = auth.uid() OR requester_id = auth.uid());
CREATE POLICY conversation_save_mode_insert_requester ON public.conversation_save_mode FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY conversation_save_mode_update_owner ON public.conversation_save_mode FOR UPDATE USING (owner_id = auth.uid());

ALTER TABLE public.deleted_messages_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deleted_messages_archive_select_admin ON public.deleted_messages_archive;
CREATE POLICY deleted_messages_archive_select_admin ON public.deleted_messages_archive FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

ALTER TABLE public.family_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS family_requests_select_involved ON public.family_requests;
DROP POLICY IF EXISTS family_requests_insert_own ON public.family_requests;
DROP POLICY IF EXISTS family_requests_update_receiver ON public.family_requests;
CREATE POLICY family_requests_select_involved ON public.family_requests FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY family_requests_insert_own ON public.family_requests FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY family_requests_update_receiver ON public.family_requests FOR UPDATE USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_insert_own ON public.notifications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS post_shares_select_own ON public.post_shares;
DROP POLICY IF EXISTS post_shares_insert_own ON public.post_shares;
CREATE POLICY post_shares_select_own ON public.post_shares FOR SELECT USING (user_id = auth.uid());
CREATE POLICY post_shares_insert_own ON public.post_shares FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER TABLE public.profile_moderation_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_moderation_stats_select_own ON public.profile_moderation_stats;
CREATE POLICY profile_moderation_stats_select_own ON public.profile_moderation_stats FOR SELECT USING (user_id = auth.uid());

ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_visits_select_own ON public.profile_visits;
DROP POLICY IF EXISTS profile_visits_insert_own ON public.profile_visits;
CREATE POLICY profile_visits_select_own ON public.profile_visits FOR SELECT USING (visitor_id = auth.uid() OR visited_id = auth.uid());
CREATE POLICY profile_visits_insert_own ON public.profile_visits FOR INSERT WITH CHECK (visitor_id = auth.uid());

ALTER TABLE public.relationship_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS relationship_requests_select_involved ON public.relationship_requests;
DROP POLICY IF EXISTS relationship_requests_insert_own ON public.relationship_requests;
DROP POLICY IF EXISTS relationship_requests_update_involved ON public.relationship_requests;
CREATE POLICY relationship_requests_select_involved ON public.relationship_requests FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY relationship_requests_insert_own ON public.relationship_requests FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY relationship_requests_update_involved ON public.relationship_requests FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid()) WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid());

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheduled_messages_select_own ON public.scheduled_messages;
DROP POLICY IF EXISTS scheduled_messages_insert_own ON public.scheduled_messages;
DROP POLICY IF EXISTS scheduled_messages_update_own ON public.scheduled_messages;
DROP POLICY IF EXISTS scheduled_messages_delete_own ON public.scheduled_messages;
CREATE POLICY scheduled_messages_select_own ON public.scheduled_messages FOR SELECT USING (sender_id = auth.uid());
CREATE POLICY scheduled_messages_insert_own ON public.scheduled_messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY scheduled_messages_update_own ON public.scheduled_messages FOR UPDATE USING (sender_id = auth.uid());
CREATE POLICY scheduled_messages_delete_own ON public.scheduled_messages FOR DELETE USING (sender_id = auth.uid());

ALTER TABLE public.zane_ai_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zane_ai_chats_select_own ON public.zane_ai_chats;
DROP POLICY IF EXISTS zane_ai_chats_insert_own ON public.zane_ai_chats;
DROP POLICY IF EXISTS zane_ai_chats_update_own ON public.zane_ai_chats;
DROP POLICY IF EXISTS zane_ai_chats_delete_own ON public.zane_ai_chats;
CREATE POLICY zane_ai_chats_select_own ON public.zane_ai_chats FOR SELECT USING (user_id = auth.uid());
CREATE POLICY zane_ai_chats_insert_own ON public.zane_ai_chats FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY zane_ai_chats_update_own ON public.zane_ai_chats FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY zane_ai_chats_delete_own ON public.zane_ai_chats FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.zane_ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zane_ai_messages_select_own ON public.zane_ai_messages;
DROP POLICY IF EXISTS zane_ai_messages_insert_own ON public.zane_ai_messages;
DROP POLICY IF EXISTS zane_ai_messages_delete_own ON public.zane_ai_messages;
CREATE POLICY zane_ai_messages_select_own ON public.zane_ai_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.zane_ai_chats c WHERE c.id = chat_id AND c.user_id = auth.uid()));
CREATE POLICY zane_ai_messages_insert_own ON public.zane_ai_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.zane_ai_chats c WHERE c.id = chat_id AND c.user_id = auth.uid()));
CREATE POLICY zane_ai_messages_delete_own ON public.zane_ai_messages FOR DELETE USING (EXISTS (SELECT 1 FROM public.zane_ai_chats c WHERE c.id = chat_id AND c.user_id = auth.uid()));

-- =============================================================================
-- 2.5) TABELAS DE APOIO (se não existirem)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.attention_call_limits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id),
  last_call_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS attention_call_limits_user_uq ON public.attention_call_limits(user_id);

CREATE TABLE IF NOT EXISTS public.friendships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id),
  friend_id  uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_user_friend_uq ON public.friendships(user_id, friend_id);

CREATE TABLE IF NOT EXISTS public.platform_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mood_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id),
  mood                text NOT NULL,
  emoji               text,
  details             jsonb,
  analysis_source     text,
  confidence          numeric,
  context             jsonb,
  intensity           integer,
  secondary_mood      text,
  secondary_intensity integer,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mood_daily_limits (
  user_id    uuid NOT NULL REFERENCES public.profiles(id),
  day        text NOT NULL,
  count      integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE UNIQUE INDEX IF NOT EXISTS mood_daily_limits_user_day_uq ON public.mood_daily_limits(user_id, day);

-- =============================================================================
-- 3) RPCs FALTANTES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.send_text_message(
  p_conversation_id uuid,
  p_text text
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.messages;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RAISE EXCEPTION 'Empty message';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id AND cp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  INSERT INTO public.messages (conversation_id, user_id, content, via_mesh)
  VALUES (p_conversation_id, auth.uid(), p_text, false)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_media_message(
  p_conversation_id uuid,
  p_media_urls text[]
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.messages;
BEGIN
  IF p_media_urls IS NULL OR array_length(p_media_urls, 1) IS NULL THEN
    RAISE EXCEPTION 'No media urls';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id AND cp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  INSERT INTO public.messages (conversation_id, user_id, media_urls, via_mesh)
  VALUES (p_conversation_id, auth.uid(), p_media_urls, false)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_viewed(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages m
  SET viewed_at = now()
  WHERE m.id = p_message_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = m.conversation_id AND cp.user_id = auth.uid()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_share_count(
  post_uuid uuid DEFAULT NULL,
  post_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE(post_uuid, post_id);
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'post id required';
  END IF;
  INSERT INTO public.post_shares (post_id, user_id, platform)
  VALUES (v_id, auth.uid(), 'web')
  ON CONFLICT (post_id, user_id, platform) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_mood(
  p_mood text,
  p_emoji text,
  p_details jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET current_mood = p_mood,
      current_mood_emoji = p_emoji,
      current_mood_updated_at = now(),
      updated_at = now()
  WHERE id = auth.uid();

  INSERT INTO public.mood_history (user_id, mood, emoji, details)
  VALUES (auth.uid(), p_mood, p_emoji, p_details);

  INSERT INTO public.mood_daily_limits (user_id, day, count, updated_at)
  VALUES (auth.uid(), to_char(now(), 'YYYY-MM-DD'), 1, now())
  ON CONFLICT (user_id, day) DO UPDATE
  SET count = mood_daily_limits.count + 1, updated_at = now();

  RETURN jsonb_build_object('user_id', auth.uid(), 'mood', p_mood, 'emoji', p_emoji, 'at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.registration_slots_left()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_used integer;
BEGIN
  v_max := COALESCE(
    (SELECT value::integer FROM public.platform_config WHERE key = 'max_users'),
    100
  );
  SELECT count(*) INTO v_used FROM auth.users;
  RETURN GREATEST(0, v_max - v_used);
END;
$$;

CREATE OR REPLACE FUNCTION public.attention_call_create(
  p_receiver_id uuid,
  p_message text DEFAULT NULL
)
RETURNS public.attention_calls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.attention_calls;
  v_last timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_receiver_id IS NULL THEN
    RAISE EXCEPTION 'receiver_required';
  END IF;
  IF p_receiver_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_alert_self';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.attention_silence_settings ss
    WHERE ss.user_id = p_receiver_id AND ss.sender_id = auth.uid() AND ss.silenced_until > now()
  ) THEN
    RAISE EXCEPTION 'silenced_by_receiver';
  END IF;

  SELECT last_call_at INTO v_last FROM public.attention_call_limits WHERE user_id = auth.uid();
  IF v_last IS NOT NULL AND v_last > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'rate_limited_10_min';
  END IF;

  INSERT INTO public.attention_call_limits (user_id, last_call_at)
  VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_call_at = now();

  INSERT INTO public.attention_calls (sender_id, receiver_id, message)
  VALUES (auth.uid(), p_receiver_id, p_message)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.attention_call_ack(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.attention_calls
  SET viewed_at = now()
  WHERE id = p_call_id AND receiver_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.attention_call_ack_many(p_call_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.attention_calls
  SET viewed_at = now()
  WHERE id = ANY(p_call_ids) AND receiver_id = auth.uid() AND viewed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_friendship_pair(a uuid, b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.friendships (user_id, friend_id) VALUES (a, b), (b, a)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friendship_pair(a uuid, b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE (user_id = a AND friend_id = b) OR (user_id = b AND friend_id = a);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_relationship_request(
  p_request_id uuid,
  p_response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
BEGIN
  IF p_response NOT IN ('accepted','rejected') THEN
    RAISE EXCEPTION 'Invalid response: %', p_response;
  END IF;

  SELECT *
  INTO v_req
  FROM public.relationship_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.receiver_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN;
  END IF;

  UPDATE public.relationship_requests
  SET status = p_response,
      updated_at = now()
  WHERE id = p_request_id;

  IF p_response = 'accepted' THEN
    UPDATE public.profiles
    SET relationship_status = v_req.desired_status,
        relationship_partner_id = CASE
          WHEN id = v_req.sender_id THEN v_req.receiver_id
          ELSE v_req.sender_id
        END,
        updated_at = now()
    WHERE id IN (v_req.sender_id, v_req.receiver_id);
  END IF;
END;
$$;

-- =============================================================================
-- 4) GRANTS
-- =============================================================================

REVOKE ALL ON FUNCTION public.send_text_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_text_message(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.send_media_message(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_media_message(uuid, text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.mark_viewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_viewed(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.increment_share_count(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_share_count(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_mood(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_mood(text, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.registration_slots_left() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_slots_left() TO authenticated;
REVOKE ALL ON FUNCTION public.attention_call_create(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attention_call_create(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.attention_call_ack(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attention_call_ack(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.attention_call_ack_many(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attention_call_ack_many(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.create_friendship_pair(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_friendship_pair(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_friendship_pair(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friendship_pair(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_relationship_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_relationship_request(uuid, text) TO authenticated;