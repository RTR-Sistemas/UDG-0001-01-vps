-- =============================================================================
-- File: supabase/migrations/20251016001436_7ccd48cb-a7fe-4f76-a3c8-746a57cddb90.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Add language preference to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'pt';

-- Add fields to conversations for private rooms
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_temporary boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS max_participants integer DEFAULT 2;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS auto_translate boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;