-- =============================================================================
-- File: supabase/migrations/20251014185441_33e053fd-122b-44e5-814c-c22267096619.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Add private community fields
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS password_hash text;