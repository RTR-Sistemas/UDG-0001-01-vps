-- Status 'declined' para convites recusados
DO $$ BEGIN
  ALTER TYPE debate_status ADD VALUE IF NOT EXISTS 'declined';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Colunas novas em debates
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS votes_host INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS votes_guest INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ready_host BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ready_guest BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS viewers INTEGER NOT NULL DEFAULT 0;

-- Gravações do debate (vídeos armazenados no Cloudinary, mesma estrutura das mídias do sistema)
CREATE TABLE IF NOT EXISTS public.debate_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.debate_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debate_recordings_select" ON public.debate_recordings;
CREATE POLICY "debate_recordings_select" ON public.debate_recordings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "debate_recordings_insert" ON public.debate_recordings;
CREATE POLICY "debate_recordings_insert" ON public.debate_recordings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "debate_recordings_delete" ON public.debate_recordings;
CREATE POLICY "debate_recordings_delete" ON public.debate_recordings FOR DELETE USING (auth.uid() = user_id);

-- Debates encerrados visíveis a todos (galeria/replays públicos)
DROP POLICY IF EXISTS "Users can view debates they are part of or that are live" ON public.debates;
DROP POLICY IF EXISTS "Visualização de debates" ON public.debates;
CREATE POLICY "debates_select_public_ended" ON public.debates
  FOR SELECT USING (auth.uid() = host_id OR auth.uid() = guest_id OR status IN ('live','ended'));

-- Chat de debates encerrados visível a todos
DROP POLICY IF EXISTS "Users can view chat for debates they can see" ON public.debate_chat;
DROP POLICY IF EXISTS "Visualização de chat do debate" ON public.debate_chat;
CREATE POLICY "debate_chat_select_public_ended" ON public.debate_chat
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM debates
    WHERE debates.id = debate_chat.debate_id
      AND (debates.host_id = auth.uid() OR debates.guest_id = auth.uid() OR debates.status IN ('live','ended'))
  ));

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.debates;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_chat;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_votes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_recordings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;