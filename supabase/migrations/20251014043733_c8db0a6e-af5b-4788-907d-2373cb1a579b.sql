-- =============================================================================
-- File: supabase/migrations/20251014043733_c8db0a6e-af5b-4788-907d-2373cb1a579b.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Fix conversations RLS policy to allow authenticated users to create conversations
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

CREATE POLICY "Users can create conversations"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (true);