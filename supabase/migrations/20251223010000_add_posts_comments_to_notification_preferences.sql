-- =============================================================================
-- File: supabase/migrations/20251223010000_add_posts_comments_to_notification_preferences.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Add missing notification preference columns used by the app (comments + posts)

alter table if exists public.notification_preferences
  add column if not exists comments boolean not null default true;

alter table if exists public.notification_preferences
  add column if not exists posts boolean not null default true;
