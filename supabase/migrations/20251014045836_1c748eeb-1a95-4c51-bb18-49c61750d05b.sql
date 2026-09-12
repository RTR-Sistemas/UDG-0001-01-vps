-- =============================================================================
-- File: supabase/migrations/20251014045836_1c748eeb-1a95-4c51-bb18-49c61750d05b.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Disable RLS on conversation_participants to test
ALTER TABLE conversation_participants DISABLE ROW LEVEL SECURITY;