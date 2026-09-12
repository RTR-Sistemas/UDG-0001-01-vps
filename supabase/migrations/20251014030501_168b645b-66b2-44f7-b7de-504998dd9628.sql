-- =============================================================================
-- File: supabase/migrations/20251014030501_168b645b-66b2-44f7-b7de-504998dd9628.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Drop existing policies if they exist to recreate them correctly
DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;

-- Create RLS policies for media bucket
CREATE POLICY "Users can upload their own media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'media');