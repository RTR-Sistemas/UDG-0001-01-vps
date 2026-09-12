-- =============================================================================
-- File: supabase/migrations/20251014030153_b3a58275-5975-4612-900d-a226f8584fb2.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Add new columns to posts table for voting system
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS voting_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_community_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS voting_period_active BOOLEAN DEFAULT TRUE;

-- Create votes table for heart/bomb voting
CREATE TABLE IF NOT EXISTS public.post_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('heart', 'bomb')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS on post_votes
ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for post_votes
CREATE POLICY "Votes are viewable by everyone"
ON public.post_votes
FOR SELECT
USING (true);

CREATE POLICY "Users can create votes"
ON public.post_votes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
ON public.post_votes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
ON public.post_votes
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to check and process expired posts
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
BEGIN
  -- Find posts where voting period has ended
  FOR post_record IN 
    SELECT id, voting_ends_at 
    FROM public.posts 
    WHERE voting_period_active = TRUE 
    AND voting_ends_at IS NOT NULL 
    AND voting_ends_at <= now()
  LOOP
    -- Count hearts and bombs
    SELECT 
      COUNT(*) FILTER (WHERE vote_type = 'heart') as hearts,
      COUNT(*) FILTER (WHERE vote_type = 'bomb') as bombs
    INTO heart_count, bomb_count
    FROM public.post_votes
    WHERE post_id = post_record.id;
    
    -- If more bombs than hearts, delete the post
    IF bomb_count > heart_count THEN
      DELETE FROM public.posts WHERE id = post_record.id;
    ELSE
      -- Otherwise, mark as community approved
      UPDATE public.posts 
      SET is_community_approved = TRUE,
          voting_period_active = FALSE
      WHERE id = post_record.id;
    END IF;
  END LOOP;
END;
$$;