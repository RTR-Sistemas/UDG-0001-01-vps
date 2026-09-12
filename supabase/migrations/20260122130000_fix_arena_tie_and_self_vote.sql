-- =============================================================================
-- File: supabase/migrations/20260122130000_fix_arena_tie_and_self_vote.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Fix Arena voting rules:
-- 1) Tie no longer approves (approve only if hearts > bombs)
-- 2) Disallow voting on own posts (RLS)

-- --- RLS: post_votes (no self-vote) ---
DROP POLICY IF EXISTS "Users can create votes" ON post_votes;
CREATE POLICY "Users can create votes"
ON post_votes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.id = post_id
      AND p.user_id <> auth.uid()
      AND public.are_friends(auth.uid(), p.user_id)
  )
);

DROP POLICY IF EXISTS "Users can update their own votes" ON post_votes;
CREATE POLICY "Users can update their own votes"
ON post_votes FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM posts p
    WHERE p.id = post_id
      AND p.user_id <> auth.uid()
      AND public.are_friends(auth.uid(), p.user_id)
  )
);

-- --- Voting processing: approve only if hearts > bombs ---
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
      AND is_community_approved = FALSE
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
          voting_period_active = FALSE
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
      DELETE FROM public.posts WHERE id = post_record.id;
    END IF;
  END LOOP;

  -- Current in-voting count (after processing)
  SELECT COUNT(*) INTO in_voting_now
  FROM public.posts
  WHERE voting_period_active = TRUE
    AND is_community_approved = FALSE;

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
