-- =============================================================================
-- File: supabase/03_profiles_last_seen.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Adiciona coluna last_seen no perfil para exibir "última vez online"
-- (necessário porque Presence do Supabase só mostra usuários conectados)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Opcional: index para consultas futuras
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles(last_seen DESC);
