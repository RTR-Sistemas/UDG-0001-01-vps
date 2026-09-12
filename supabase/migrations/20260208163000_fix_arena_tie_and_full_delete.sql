-- =============================================================================
-- File: supabase/migrations/20260208163000_fix_arena_tie_and_full_delete.sql
-- Purpose:
--  1) Arena voting rule: approve ONLY if hearts > bombs; tie (hearts = bombs) => reject.
--  2) On reject, delete the post completely.
--  3) Ensure FK cascades so deleting a post removes dependent rows (votes/likes/comments).
-- Notes:
--  - Uses DROP CONSTRAINT IF EXISTS to be safe across environments.
--  - Keeps function signature as RETURNS void for compatibility with app types.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Cascading deletes for "delete post completely"
-- -----------------------------------------------------------------------------

-- Votes
ALTER TABLE public.post_votes
  DROP CONSTRAINT IF EXISTS post_votes_post_id_fkey;
ALTER TABLE public.post_votes
  ADD CONSTRAINT post_votes_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- Likes
ALTER TABLE public.likes
  DROP CONSTRAINT IF EXISTS likes_post_id_fkey;
ALTER TABLE public.likes
  ADD CONSTRAINT likes_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- Comments
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_post_id_fkey;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- (Optional) Shares: keep consistent if used
ALTER TABLE public.post_shares
  DROP CONSTRAINT IF EXISTS post_shares_post_id_fkey;
ALTER TABLE public.post_shares
  ADD CONSTRAINT post_shares_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 2) Voting processing: approve only if hearts > bombs; else delete
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_expired_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_record RECORD;
  heart_count INTEGER;
  bomb_count INTEGER;
  approved_now INTEGER := 0;
  rejected_now INTEGER := 0;
  in_voting_now INTEGER := 0;
  latest_stats_id uuid;
BEGIN
  -- Ensure at least one arena_stats row exists
  IF NOT EXISTS (SELECT 1 FROM public.arena_stats) THEN
    INSERT INTO public.arena_stats (total_approved, total_rejected, total_in_voting, total_processed, last_updated)
    VALUES (0, 0, 0, 0, now());
  END IF;

  SELECT id INTO latest_stats_id
  FROM public.arena_stats
  ORDER BY created_at DESC
  LIMIT 1;

  -- Process posts where voting period has ended
  FOR post_record IN
    SELECT id, user_id
    FROM public.posts
    WHERE voting_period_active = TRUE
      AND COALESCE(is_community_approved, FALSE) = FALSE
      AND voting_ends_at IS NOT NULL
      AND voting_ends_at <= now()
  LOOP
    -- Count hearts and bombs
    SELECT
      COUNT(*) FILTER (WHERE vote_type = 'heart') AS hearts,
      COUNT(*) FILTER (WHERE vote_type = 'bomb')  AS bombs
    INTO heart_count, bomb_count
    FROM public.post_votes
    WHERE post_id = post_record.id;

    heart_count := COALESCE(heart_count, 0);
    bomb_count  := COALESCE(bomb_count, 0);

    -- APPROVE ONLY if hearts strictly greater than bombs.
    -- Tie => reject.
    IF heart_count > bomb_count THEN
      UPDATE public.posts
      SET is_community_approved = TRUE,
          voting_period_active = FALSE,
          updated_at = now()
      WHERE id = post_record.id;

      INSERT INTO public.profile_moderation_stats (user_id, approved_count, updated_at)
      VALUES (post_record.user_id, 1, now())
      ON CONFLICT (user_id) DO UPDATE
        SET approved_count = public.profile_moderation_stats.approved_count + 1,
            updated_at = now();

      approved_now := approved_now + 1;
    ELSE
      INSERT INTO public.profile_moderation_stats (user_id, removed_count, updated_at)
      VALUES (post_record.user_id, 1, now())
      ON CONFLICT (user_id) DO UPDATE
        SET removed_count = public.profile_moderation_stats.removed_count + 1,
            updated_at = now();

      rejected_now := rejected_now + 1;

      -- Delete the post completely. Dependent rows are removed via ON DELETE CASCADE.
      DELETE FROM public.posts WHERE id = post_record.id;
    END IF;
  END LOOP;

  -- Current in-voting count (after processing)
  SELECT COUNT(*) INTO in_voting_now
  FROM public.posts
  WHERE voting_period_active = TRUE
    AND COALESCE(is_community_approved, FALSE) = FALSE;

  -- Update arena_stats aggregates
  UPDATE public.arena_stats
  SET total_approved  = COALESCE(total_approved, 0)  + approved_now,
      total_rejected  = COALESCE(total_rejected, 0)  + rejected_now,
      total_processed = COALESCE(total_processed, 0) + approved_now + rejected_now,
      total_in_voting = in_voting_now,
      last_updated    = now()
  WHERE id = latest_stats_id;
END;
$$;
