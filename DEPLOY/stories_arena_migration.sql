-- Stories: privacidade Global / Amigos + ocultar de usuários específicos
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'global' CHECK (visibility IN ('global','friends'));
CREATE INDEX IF NOT EXISTS stories_visibility_idx ON public.stories (visibility);

CREATE TABLE IF NOT EXISTS public.story_hidden_users (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  hidden_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, hidden_user_id)
);
CREATE INDEX IF NOT EXISTS story_hidden_users_hidden_idx ON public.story_hidden_users (hidden_user_id);
ALTER TABLE public.story_hidden_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story_hidden_insert_owner" ON public.story_hidden_users;
CREATE POLICY "story_hidden_insert_owner" ON public.story_hidden_users FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "story_hidden_select_owner_or_hidden" ON public.story_hidden_users;
CREATE POLICY "story_hidden_select_owner_or_hidden" ON public.story_hidden_users FOR SELECT TO authenticated USING (hidden_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()));
DROP POLICY IF EXISTS "story_hidden_delete_owner" ON public.story_hidden_users;
CREATE POLICY "story_hidden_delete_owner" ON public.story_hidden_users FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()));

-- RLS stories: recria SELECT com visibilidade
DROP POLICY IF EXISTS "stories_select_not_expired" ON public.stories;
CREATE POLICY "stories_select_not_expired" ON public.stories FOR SELECT TO authenticated USING (
  expires_at > now()
  AND NOT EXISTS (SELECT 1 FROM public.story_hidden_users h WHERE h.story_id = stories.id AND h.hidden_user_id = auth.uid())
  AND (
    visibility = 'global'
    OR (visibility = 'friends' AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.user_id = stories.user_id AND f.friend_id = auth.uid())
         OR (f.friend_id = stories.user_id AND f.user_id = auth.uid())
         OR stories.user_id = auth.uid()
    ))
  )
);

-- Arena Polls: Global (todos votam) vs Amigos (só amigos do criador)
CREATE TABLE IF NOT EXISTS public.arena_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 200),
  options jsonb NOT NULL, -- ["op1","op2",...] 2-6 itens
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','friends')),
  is_anonymous boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arena_polls_created_idx ON public.arena_polls (created_at DESC);
CREATE INDEX IF NOT EXISTS arena_polls_scope_idx ON public.arena_polls (scope);

CREATE TABLE IF NOT EXISTS public.arena_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.arena_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_idx int NOT NULL CHECK (option_idx >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS arena_poll_votes_poll_idx ON public.arena_poll_votes (poll_id);

ALTER TABLE public.arena_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arena_polls_select_visible" ON public.arena_polls;
CREATE POLICY "arena_polls_select_visible" ON public.arena_polls FOR SELECT TO authenticated USING (
  scope = 'global'
  OR creator_id = auth.uid()
  OR (scope = 'friends' AND EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE (f.user_id = arena_polls.creator_id AND f.friend_id = auth.uid())
       OR (f.friend_id = arena_polls.creator_id AND f.user_id = auth.uid())
  ))
);
DROP POLICY IF EXISTS "arena_polls_insert_own" ON public.arena_polls;
CREATE POLICY "arena_polls_insert_own" ON public.arena_polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "arena_polls_delete_own" ON public.arena_polls;
CREATE POLICY "arena_polls_delete_own" ON public.arena_polls FOR DELETE TO authenticated USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "arena_poll_votes_select_visible" ON public.arena_poll_votes;
CREATE POLICY "arena_poll_votes_select_visible" ON public.arena_poll_votes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.arena_polls p WHERE p.id = poll_id AND (
    p.scope = 'global' OR p.creator_id = auth.uid() OR (p.scope = 'friends' AND EXISTS (
      SELECT 1 FROM public.friendships f WHERE (f.user_id = p.creator_id AND f.friend_id = auth.uid()) OR (f.friend_id = p.creator_id AND f.user_id = auth.uid())
    ))
  ))
);
DROP POLICY IF EXISTS "arena_poll_votes_insert_visible" ON public.arena_poll_votes;
CREATE POLICY "arena_poll_votes_insert_visible" ON public.arena_poll_votes FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.arena_polls p WHERE p.id = poll_id AND (p.expires_at IS NULL OR p.expires_at > now()) AND (
      p.scope = 'global' OR p.creator_id = auth.uid() OR (p.scope = 'friends' AND EXISTS (
        SELECT 1 FROM public.friendships f WHERE (f.user_id = p.creator_id AND f.friend_id = auth.uid()) OR (f.friend_id = p.creator_id AND f.user_id = auth.uid())
      ))
    )
  )
);
DROP POLICY IF EXISTS "arena_poll_votes_delete_own" ON public.arena_poll_votes;
CREATE POLICY "arena_poll_votes_delete_own" ON public.arena_poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Realtime
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_polls;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_poll_votes;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.story_hidden_users;
EXCEPTION WHEN duplicate_object THEN NULL; END IF; END $$;
