-- =============================================================================
-- File: supabase/migrations/20251014045329_6d8952f8-65bf-43c7-a4b9-2687a889dd09.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Temporarily check RLS status and recreate policies more explicitly
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;

-- Create a very permissive policy for INSERT
CREATE POLICY "Allow authenticated to insert conversations"
ON conversations
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Also ensure RLS is enabled
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;