-- =============================================================================
-- File: supabase/migrations/20251014045122_a9d55cbf-3ae7-47d3-81a4-1a1a00ec3125.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;

-- Create a new policy for INSERT that allows all authenticated users
CREATE POLICY "Authenticated users can create conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (true);