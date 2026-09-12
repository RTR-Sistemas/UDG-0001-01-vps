-- =============================================================================
-- File: supabase/migrations/20260622153500_add_active_session_id.sql
-- Purpose: Add active_session_id to profiles to restrict multiple logins per account
-- =============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active_session_id text;
