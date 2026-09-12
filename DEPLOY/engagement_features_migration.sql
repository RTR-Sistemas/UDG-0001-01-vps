-- Bookmarks, Post Reactions, Pinned Posts, Location, Background Color, Views
-- Idempotent migration

-- 1) Bookmarks (save posts)
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user ON public.post_bookmarks (user_id, created_at DESC);
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookmarks_select_own" ON public.post_bookmarks;
CREATE POLICY "bookmarks_select_own" ON public.post_bookmarks FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "bookmarks_insert_own" ON public.post_bookmarks;
CREATE POLICY "bookmarks_insert_own" ON public.post_bookmarks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "bookmarks_delete_own" ON public.post_bookmarks;
CREATE POLICY "bookmarks_delete_own" ON public.post_bookmarks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) Post Reactions (multiple types: like, love, haha, wow, sad, angry)
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like','love','haha','wow','sad','angry')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions (post_id);
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_reactions_select" ON public.post_reactions;
CREATE POLICY "post_reactions_select" ON public.post_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "post_reactions_insert" ON public.post_reactions;
CREATE POLICY "post_reactions_insert" ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "post_reactions_update" ON public.post_reactions;
CREATE POLICY "post_reactions_update" ON public.post_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "post_reactions_delete" ON public.post_reactions;
CREATE POLICY "post_reactions_delete" ON public.post_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3) Add columns to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS background_color TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

-- 4) Post views tracking
CREATE TABLE IF NOT EXISTS public.post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_views_post ON public.post_views (post_id);
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_views_insert" ON public.post_views;
CREATE POLICY "post_views_insert" ON public.post_views FOR INSERT TO authenticated WITH CHECK (true);

-- RPC: Toggle bookmark
CREATE OR REPLACE FUNCTION public.toggle_bookmark(p_post_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user UUID := auth.uid(); v_exists BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_AUTH'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.post_bookmarks WHERE user_id = v_user AND post_id = p_post_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.post_bookmarks WHERE user_id = v_user AND post_id = p_post_id;
    RETURN jsonb_build_object('success', TRUE, 'bookmarked', FALSE);
  ELSE
    INSERT INTO public.post_bookmarks (user_id, post_id) VALUES (v_user, p_post_id);
    RETURN jsonb_build_object('success', TRUE, 'bookmarked', TRUE);
  END IF;
END $$;

-- RPC: Toggle post reaction
CREATE OR REPLACE FUNCTION public.toggle_post_reaction(p_post_id UUID, p_type TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user UUID := auth.uid(); v_existing TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', FALSE); END IF;
  SELECT reaction_type INTO v_existing FROM public.post_reactions WHERE post_id = p_post_id AND user_id = v_user;
  IF v_existing = p_type THEN
    DELETE FROM public.post_reactions WHERE post_id = p_post_id AND user_id = v_user;
    RETURN jsonb_build_object('success', TRUE, 'reaction', NULL);
  ELSIF v_existing IS NOT NULL THEN
    UPDATE public.post_reactions SET reaction_type = p_type WHERE post_id = p_post_id AND user_id = v_user;
    RETURN jsonb_build_object('success', TRUE, 'reaction', p_type);
  ELSE
    INSERT INTO public.post_reactions (post_id, user_id, reaction_type) VALUES (p_post_id, v_user, p_type);
    RETURN jsonb_build_object('success', TRUE, 'reaction', p_type);
  END IF;
END $$;

-- RPC: Increment post views
CREATE OR REPLACE FUNCTION public.increment_post_view(p_post_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.post_views (post_id, user_id) VALUES (p_post_id, auth.uid());
  UPDATE public.posts SET views_count = views_count + 1 WHERE id = p_post_id;
$$;

-- RPC: Toggle pin post
CREATE OR REPLACE FUNCTION public.toggle_pin_post(p_post_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user UUID := auth.uid(); v_current BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', FALSE); END IF;
  SELECT pinned INTO v_current FROM public.posts WHERE id = p_post_id AND user_id = v_user;
  IF v_current IS NULL THEN RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_OWNER'); END IF;
  UPDATE public.posts SET pinned = NOT COALESCE(v_current, false) WHERE id = p_post_id;
  RETURN jsonb_build_object('success', TRUE, 'pinned', NOT COALESCE(v_current, false));
END $$;

-- RPC: Get bookmarked posts
CREATE OR REPLACE FUNCTION public.get_bookmarked_posts()
RETURNS SETOF public.posts LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT p.* FROM public.posts p
  INNER JOIN public.post_bookmarks b ON b.post_id = p.id
  WHERE b.user_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

-- GRANTs
GRANT SELECT, INSERT, DELETE ON public.post_bookmarks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated;
GRANT SELECT, INSERT ON public.post_views TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_bookmark TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_reaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_post_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_pin_post TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bookmarked_posts TO authenticated;
