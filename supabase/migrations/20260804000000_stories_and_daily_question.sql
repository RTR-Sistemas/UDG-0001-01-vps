-- =============================================================================
-- UNDOING: Stories de 24h + Pergunta do dia geral
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STORIES (status efêmero de 24h)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'audio')),
  media_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories (expires_at DESC);
CREATE INDEX IF NOT EXISTS stories_user_idx ON public.stories (user_id, created_at DESC);

-- Visualizações de stories (1 por viewer por story)
CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS story_views_story_idx ON public.story_views (story_id);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Criar/editar propria story
CREATE POLICY "stories_insert_own" ON public.stories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Ler stories não expiradas de todos
CREATE POLICY "stories_select_not_expired" ON public.stories
  FOR SELECT TO authenticated USING (expires_at > now());

-- Deletar própria story
CREATE POLICY "stories_delete_own" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- Insert visualização: apenas se for o próprio viewer
CREATE POLICY "story_views_insert_self" ON public.story_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Select visualizações: autor da story (através do REDU) + próprio viewer
CREATE POLICY "story_views_select_author_or_self" ON public.story_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
    OR viewer_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- PERGUNTA DO DIA (mural geral)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  question_date date NOT NULL UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Respostas do público (mural)
CREATE TABLE IF NOT EXISTS public.daily_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.daily_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS daily_answers_question_idx ON public.daily_answers (question_id, created_at DESC);

ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_answers ENABLE ROW LEVEL SECURITY;

-- Perguntas: todo mundo vê; apenas admin/criador insere
CREATE POLICY "daily_questions_select_all" ON public.daily_questions
  FOR SELECT USING (true);

CREATE POLICY "daily_questions_insert_admin" ON public.daily_questions
  FOR INSERT WITH CHECK (
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
  );

-- Respostas: todos veem; usuário insere a própria (uma por pergunta)
CREATE POLICY "daily_answers_select_all" ON public.daily_answers
  FOR SELECT USING (true);

CREATE POLICY "daily_answers_insert_self" ON public.daily_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_answers_update_self" ON public.daily_answers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "daily_answers_delete_self" ON public.daily_answers
  FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_questions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_answers;
  END IF;
END $$;