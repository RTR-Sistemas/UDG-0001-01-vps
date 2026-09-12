-- =============================================================================
-- File: supabase/migrations/20260111120000_update_process_expired_posts_and_arena_stats.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Update arena stats + voting processing (approved/rejected/in voting)
-- This migration is safe to apply even if arena_stats already exists.

CREATE TABLE IF NOT EXISTS public.arena_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  total_approved integer NOT NULL DEFAULT 0,
  total_rejected integer NOT NULL DEFAULT 0,
  total_in_voting integer NOT NULL DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  total_processed integer NOT NULL DEFAULT 0,
  CONSTRAINT arena_stats_pkey PRIMARY KEY (id)
);

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

    IF bomb_count > heart_count THEN
      -- Rejected: increment profile moderation stats (removed)
      INSERT INTO public.profile_moderation_stats (user_id, removed_count, updated_at)
      VALUES (post_record.user_id, 1, now())
      ON CONFLICT (user_id) DO UPDATE
        SET removed_count = public.profile_moderation_stats.removed_count + 1,
            updated_at = now();

      rejected_now := rejected_now + 1;

      -- Delete the post (and cascades votes/likes/comments if FK is set)
      DELETE FROM public.posts WHERE id = post_record.id;

    ELSE
      -- Approved: mark as community approved + stop voting
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
