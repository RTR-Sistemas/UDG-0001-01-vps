-- =============================================================================
-- UndoinG - PHASE 1 SOCIAL: grupos, reações, edição/exclusão, enquetes, busca
-- Arquivo: deploy/phase1_social.sql
-- Alvo: Supabase Cloud (SQL Editor ou migração)
-- 100% idempotente (IF NOT EXISTS / DO $$ / DROP POLICY IF EXISTS)
-- Observação: mensagens usam coluna user_id (não existe sender_id no schema)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) EXTENSIONS (pgcrypto p/ gen_random_uuid, pg_trgm p/ busca)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- 1) CONVERSATIONS: avatar/descrição/pin do grupo
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_avatar text,
  ADD COLUMN IF NOT EXISTS group_description text,
  ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;

-- -----------------------------------------------------------------------------
-- 2) CONVERSATION_PARTICIPANTS: role/adicionado-por/nickname + check de role
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS added_by uuid,
  ADD COLUMN IF NOT EXISTS nickname text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_role_check'
  ) THEN
    ALTER TABLE public.conversation_participants
      ADD CONSTRAINT conversation_participants_role_check
      CHECK (role IN ('owner','admin','member'));
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3) MESSAGE_REACTIONS: reações por emoji em mensagens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx
  ON public.message_reactions (message_id);

-- -----------------------------------------------------------------------------
-- 4) POLLS / POLL_OPTIONS / POLL_VOTES: enquetes em mensagens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE CASCADE,
  question text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  "text" text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON public.poll_options (poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_option_id_idx ON public.poll_votes (option_id);

-- -----------------------------------------------------------------------------
-- 5) MESSAGES: edited_at (marcador de edição)
-- -----------------------------------------------------------------------------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;

-- -----------------------------------------------------------------------------
-- 6) ÍNDICES TRGM (guarda por coluna existente)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'content') THEN
    CREATE INDEX IF NOT EXISTS messages_content_trgm_idx
      ON public.messages USING gin (content gin_trgm_ops);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username') THEN
    CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
      ON public.profiles USING gin (username gin_trgm_ops);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'profiles'
             AND column_name = 'display_name') THEN
    CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
      ON public.profiles USING gin (display_name gin_trgm_ops);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'profiles'
                AND column_name = 'full_name') THEN
    CREATE INDEX IF NOT EXISTS profiles_full_name_trgm_idx
      ON public.profiles USING gin (full_name gin_trgm_ops);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'content') THEN
    CREATE INDEX IF NOT EXISTS posts_content_trgm_idx
      ON public.posts USING gin (content gin_trgm_ops);
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'name') THEN
    CREATE INDEX IF NOT EXISTS communities_name_trgm_idx
      ON public.communities USING gin (name gin_trgm_ops);
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7) RPCS (SECURITY DEFINER, search_path = public)
-- -----------------------------------------------------------------------------

-- 7.1 create_group: cria grupo + owner + membros
CREATE OR REPLACE FUNCTION public.create_group(
  p_name text,
  p_description text DEFAULT NULL,
  p_member_ids uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_members uuid[];
  v_total  int;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'group name cannot be empty';
  END IF;

  -- deduplica, remove nulos e o próprio owner
  SELECT COALESCE(array_agg(DISTINCT m), '{}')
    INTO v_members
    FROM unnest(COALESCE(p_member_ids, '{}')) AS m
   WHERE m IS NOT NULL AND m <> auth.uid();

  v_total := COALESCE(cardinality(v_members), 0) + 1;
  IF v_total > 50 THEN
    RAISE EXCEPTION 'group limited to 50 members';
  END IF;

  INSERT INTO public.conversations (name, is_group, created_by, group_description, max_participants)
  VALUES (trim(p_name), true, auth.uid(), p_description, 200)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id, role, joined_at)
  VALUES (v_conv_id, auth.uid(), 'owner', now());

  IF COALESCE(cardinality(v_members), 0) > 0 THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role, added_by, joined_at)
    SELECT v_conv_id, m, 'member', auth.uid(), now()
      FROM unnest(v_members) AS m;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- 7.2 add_group_members: owner/admin adiciona membros
CREATE OR REPLACE FUNCTION public.add_group_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role     text;
  v_limit    int;
  v_members  uuid[];
  v_existing int;
BEGIN
  SELECT role INTO v_role
    FROM public.conversation_participants
   WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'only owner or admin can add members';
  END IF;

  PERFORM 1 FROM public.conversations WHERE id = p_conversation_id AND is_group = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation is not a group';
  END IF;

  SELECT COALESCE(max_participants, 200) INTO v_limit
    FROM public.conversations WHERE id = p_conversation_id;

  SELECT COALESCE(array_agg(DISTINCT m), '{}') INTO v_members
    FROM unnest(COALESCE(p_member_ids, '{}')) AS m
   WHERE m IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = p_conversation_id AND cp.user_id = m
     );

  SELECT count(*) INTO v_existing
    FROM public.conversation_participants
   WHERE conversation_id = p_conversation_id;

  IF v_existing + COALESCE(cardinality(v_members), 0) > v_limit THEN
    RAISE EXCEPTION 'group member limit reached';
  END IF;

  IF COALESCE(cardinality(v_members), 0) > 0 THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role, added_by, joined_at)
    SELECT p_conversation_id, m, 'member', auth.uid(), now()
      FROM unnest(v_members) AS m;
  END IF;
END;
$$;

-- 7.3 remove_group_member: owner/admin remove (proteções de hierarquia)
CREATE OR REPLACE FUNCTION public.remove_group_member(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_target_role text;
BEGIN
  SELECT role INTO v_role
    FROM public.conversation_participants
   WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'only owner or admin can remove members';
  END IF;

  IF v_role = 'owner' AND p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'owner cannot remove himself';
  END IF;

  SELECT role INTO v_target_role
    FROM public.conversation_participants
   WHERE conversation_id = p_conversation_id AND user_id = p_user_id;

  IF v_role = 'admin' AND v_target_role = 'owner' THEN
    RAISE EXCEPTION 'admin cannot remove the owner';
  END IF;

  DELETE FROM public.conversation_participants
   WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;

-- 7.4 update_group_info: owner/admin edita nome/descrição/avatar
CREATE OR REPLACE FUNCTION public.update_group_info(
  p_conversation_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_name IS NOT NULL AND trim(p_name) = '' THEN
    RAISE EXCEPTION 'group name cannot be empty';
  END IF;

  SELECT role INTO v_role
    FROM public.conversation_participants
   WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'only owner or admin can update group info';
  END IF;

  UPDATE public.conversations
     SET name = COALESCE(trim(p_name), name),
         group_description = COALESCE(p_description, group_description),
         group_avatar = COALESCE(p_avatar, group_avatar)
   WHERE id = p_conversation_id;
END;
$$;

-- 7.5 toggle_message_reaction: add/remove reação (retorna se adicionou)
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
  p_message_id uuid,
  p_emoji text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF p_emoji IS NULL OR trim(p_emoji) = '' THEN
    RAISE EXCEPTION 'emoji required';
  END IF;

  PERFORM 1
    FROM public.messages m
    JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
   WHERE m.id = p_message_id AND cp.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a participant of this conversation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.message_reactions
     WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.message_reactions
     WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji;
    RETURN false;
  ELSE
    INSERT INTO public.message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji);
    RETURN true;
  END IF;
END;
$$;

-- 7.6 update_message_text: edita mensagem própria (janela de 15 min), retorna a linha
CREATE OR REPLACE FUNCTION public.update_message_text(
  p_message_id uuid,
  p_new_content text
)
RETURNS public.messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.messages%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found';
  END IF;

  IF v_row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'only the author can edit this message';
  END IF;

  IF v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'message was deleted';
  END IF;

  IF v_row.created_at + interval '15 minutes' < now() THEN
    RAISE EXCEPTION 'edit window expired (15 minutes)';
  END IF;

  IF p_new_content IS NULL OR trim(p_new_content) = '' THEN
    RAISE EXCEPTION 'content cannot be empty';
  END IF;

  UPDATE public.messages
     SET content = p_new_content,
         edited_at = now(),
         is_edited = true
   WHERE id = p_message_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 7.7 delete_message_for_all: autor marca deleted_at (trigger hard_delete faz limpeza física)
CREATE OR REPLACE FUNCTION public.delete_message_for_all(
  p_message_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
     SET deleted_at = now()
   WHERE id = p_message_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found or you are not the author';
  END IF;
END;
$$;

-- 7.8 set_poll_vote: vota/troca voto em enquete (expiração + anônimo)
CREATE OR REPLACE FUNCTION public.set_poll_vote(
  p_poll_id uuid,
  p_option_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_poll public.polls%ROWTYPE;
BEGIN
  SELECT * INTO v_poll FROM public.polls WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'poll not found';
  END IF;

  IF v_poll.expires_at IS NOT NULL AND v_poll.expires_at < now() THEN
    RAISE EXCEPTION 'poll expired';
  END IF;

  PERFORM 1
    FROM public.messages m
    JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
   WHERE m.id = v_poll.message_id AND cp.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a participant of this conversation';
  END IF;

  PERFORM 1 FROM public.poll_options
   WHERE id = p_option_id AND poll_id = p_poll_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'option does not belong to this poll';
  END IF;

  IF v_poll.is_anonymous THEN
    DELETE FROM public.poll_votes WHERE poll_id = p_poll_id AND user_id IS NULL;
    INSERT INTO public.poll_votes (poll_id, option_id, user_id)
    VALUES (p_poll_id, p_option_id, NULL);
  ELSE
    INSERT INTO public.poll_votes (poll_id, option_id, user_id)
    VALUES (p_poll_id, p_option_id, auth.uid())
    ON CONFLICT (poll_id, user_id)
    DO UPDATE SET option_id = EXCLUDED.option_id, created_at = now();
  END IF;
END;
$$;

-- 7.9 create_poll_message: mensagem + poll + opções em uma transação
CREATE OR REPLACE FUNCTION public.create_poll_message(
  p_conversation_id uuid,
  p_content text,
  p_question text,
  p_options text[],
  p_is_anonymous boolean DEFAULT false,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_msg_id  uuid;
  v_poll_id uuid;
  v_opt     text;
  v_pos     int := 1;
BEGIN
  PERFORM 1 FROM public.conversation_participants
   WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not a participant of this conversation';
  END IF;

  IF p_question IS NULL OR trim(p_question) = '' THEN
    RAISE EXCEPTION 'poll question required';
  END IF;

  IF p_options IS NULL OR cardinality(p_options) < 2 THEN
    RAISE EXCEPTION 'poll needs at least 2 options';
  END IF;

  INSERT INTO public.messages (conversation_id, user_id, content)
  VALUES (p_conversation_id, auth.uid(), p_content)
  RETURNING id INTO v_msg_id;

  INSERT INTO public.polls (message_id, question, is_anonymous, expires_at, created_by)
  VALUES (v_msg_id, p_question, COALESCE(p_is_anonymous, false), p_expires_at, auth.uid())
  RETURNING id INTO v_poll_id;

  FOREACH v_opt IN ARRAY p_options LOOP
    INSERT INTO public.poll_options (poll_id, position, "text")
    VALUES (v_poll_id, v_pos, v_opt);
    v_pos := v_pos + 1;
  END LOOP;

  RETURN v_msg_id;
END;
$$;

-- 7.10 leave_group: participante remove a si mesmo do grupo
CREATE OR REPLACE FUNCTION public.leave_group(
  p_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.conversation_participants
   WHERE conversation_id = p_conversation_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'you are not a member of this group';
  END IF;
END;
$$;

-- 7.11 search_messages: busca ILIKE nas conversas do usuário
CREATE OR REPLACE FUNCTION public.search_messages(
  p_query text,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  message_id uuid,
  conversation_id uuid,
  content text,
  sender_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RAISE EXCEPTION 'query required';
  END IF;

  RETURN QUERY
    SELECT m.id,
           m.conversation_id,
           left(COALESCE(m.content, ''), 500),
           m.user_id AS sender_id,
           m.created_at
      FROM public.messages m
     WHERE m.deleted_at IS NULL
       AND m.content ILIKE '%' || p_query || '%'
       AND m.conversation_id IN (
         SELECT cp.conversation_id FROM public.conversation_participants cp
          WHERE cp.user_id = auth.uid()
       )
     ORDER BY m.created_at DESC
     LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

-- Grants de execução
GRANT EXECUTE ON FUNCTION public.create_group(text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_info(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_message_text(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_message_for_all(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_poll_vote(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_poll_message(uuid, text, text, text[], boolean, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_messages(text, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8) RLS POLICIES (DROP IF EXISTS + CREATE, estilo do repo)
-- -----------------------------------------------------------------------------

-- Suppress ambiguous column name warnings between tables sharing "id"
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reactions_select_participant" ON public.message_reactions;
CREATE POLICY "message_reactions_select_participant"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "message_reactions_insert_own" ON public.message_reactions;
CREATE POLICY "message_reactions_insert_own"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "message_reactions_update_own" ON public.message_reactions;
CREATE POLICY "message_reactions_update_own"
  ON public.message_reactions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "message_reactions_delete_own" ON public.message_reactions;
CREATE POLICY "message_reactions_delete_own"
  ON public.message_reactions FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
    )
  );

-- polls: SELECT p/ participantes; UPDATE/DELETE só do criador; INSERT via RPC apenas
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polls_select_participant" ON public.polls;
CREATE POLICY "polls_select_participant"
  ON public.polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = polls.message_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "polls_update_creator" ON public.polls;
CREATE POLICY "polls_update_creator"
  ON public.polls FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "polls_delete_creator" ON public.polls;
CREATE POLICY "polls_delete_creator"
  ON public.polls FOR DELETE
  USING (created_by = auth.uid());

-- poll_options: SELECT p/ participantes; UPDATE/DELETE via poll do criador
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_options_select_participant" ON public.poll_options;
CREATE POLICY "poll_options_select_participant"
  ON public.poll_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.polls pl
      JOIN public.messages m ON m.id = pl.message_id
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE pl.id = poll_options.poll_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "poll_options_update_creator" ON public.poll_options;
CREATE POLICY "poll_options_update_creator"
  ON public.poll_options FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.polls pl WHERE pl.id = poll_options.poll_id AND pl.created_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.polls pl WHERE pl.id = poll_options.poll_id AND pl.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "poll_options_delete_creator" ON public.poll_options;
CREATE POLICY "poll_options_delete_creator"
  ON public.poll_options FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.polls pl WHERE pl.id = poll_options.poll_id AND pl.created_by = auth.uid())
  );

-- poll_votes: SELECT p/ participantes; escrita só do próprio user_id (anônimo via RPC)
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_votes_select_participant" ON public.poll_votes;
CREATE POLICY "poll_votes_select_participant"
  ON public.poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.polls pl
      JOIN public.messages m ON m.id = pl.message_id
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE pl.id = poll_votes.poll_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "poll_votes_insert_own" ON public.poll_votes;
CREATE POLICY "poll_votes_insert_own"
  ON public.poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "poll_votes_update_own" ON public.poll_votes;
CREATE POLICY "poll_votes_update_own"
  ON public.poll_votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "poll_votes_delete_own" ON public.poll_votes;
CREATE POLICY "poll_votes_delete_own"
  ON public.poll_votes FOR DELETE
  USING (auth.uid() = user_id);

-- conversations: UPDATE restrito a participantes, SOMENTE se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'conversations' AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "Users can update their conversations"
      ON public.conversations FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.conversation_participants cp
           WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.conversation_participants cp
           WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- conversation_participants: NÃO criamos policies novas (admin ops via RPC,
-- policies SELECT/INSERT existentes permanecem; nenhuma UPDATE ampla)

-- Grants de tabelas novas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO anon;

-- =============================================================================
-- == VERIFICAR ==
-- Confira estes pontos no Dashboard do Supabase (SQL Editor / Table Editor):
-- 1. TABELAS NOVAS: message_reactions, polls, poll_options, poll_votes criadas
--    com FKs em cascade; UNIQUE(message_id,user_id,emoji) e UNIQUE(poll_id,user_id).
-- 2. conversations tem group_avatar, group_description, pinned.
-- 3. conversation_participants tem role (default 'member') + added_by + nickname
--    e o CHECK conversation_participants_role_check existe.
-- 4. messages tem edited_at (tipos.ts NÃO tem sender_id: schema usa user_id; a
--    busca/edição usam user_id).
-- 5. Trigger trg_hard_delete_message existe? (marcado deleted_at = limpeza física).
--    Trigger update_messages_updated_at existe? (updated_at sobe ao editar).
-- 6. pg_trgm: índices gin em messages.content, profiles.username/full_name,
--    posts.content, communities.name (profiles NÃO tem display_name no types.ts;
--    foi indexado full_name).
-- 7. RPCs: teste create_group/add_group_members/remove_group_member/
--    update_group_info/toggle_message_reaction(coragem: select ... para ver true/false)/
--    update_message_text (dentro de 15 min)/delete_message_for_all/
--    set_poll_vote (expiração + anônimo)/create_poll_message (mín. 2 opções)/
--    search_messages.
-- 8. RLS: message_reactions/polls/poll_options/poll_votes com RLS ON; polls sem
--    policy INSERT (criação só via RPC); poll_votes anônimo (user_id NULL) só via RPC.
-- 9. conversation_participants: NÃO havia policy UPDATE antes/agora (admin via RPC).
-- 10. Rollback: DROP TABLE message_reactions, polls, poll_options, poll_votes CASCADE;
--     DROP FUNCTION create_group, add_group_members, remove_group_member,
--     update_group_info, toggle_message_reaction, update_message_text,
--     delete_message_for_all, set_poll_vote, create_poll_message, search_messages.
-- =============================================================================