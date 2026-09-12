-- =============================================================================
-- File: supabase/migrations/20251016001457_2a9d9341-447f-4901-99a5-5faa85d9f746.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Create mentions table
CREATE TABLE IF NOT EXISTS mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  is_read boolean DEFAULT false
);

-- Enable RLS on mentions
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;

-- RLS policies for mentions
CREATE POLICY "Users can view their own mentions"
  ON mentions FOR SELECT
  USING (auth.uid() = mentioned_user_id);

CREATE POLICY "Users can create mentions"
  ON mentions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mentions"
  ON mentions FOR UPDATE
  USING (auth.uid() = mentioned_user_id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_content ON mentions(content_type, content_id);