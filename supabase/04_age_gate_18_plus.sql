-- =============================================================================
-- File: supabase/04_age_gate_18_plus.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Age Gate (18+) - Campos + Validacao no banco
-- Execute este arquivo no SQL Editor do Supabase.

-- 1) Novos campos no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS is_adult_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adult_confirmed_at timestamp with time zone;

-- 2) Helper: calcula se a pessoa tem 18 anos completos (inclusive)
CREATE OR REPLACE FUNCTION public.is_adult(birth_date date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT birth_date <= (current_date - interval '18 years')::date;
$$;

-- 3) Bloqueia cadastro de menores de 18 no momento em que o perfil eh criado
CREATE OR REPLACE FUNCTION public.enforce_adult_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.birth_date IS NULL THEN
    RAISE EXCEPTION 'birth_date is required';
  END IF;

  IF NOT public.is_adult(NEW.birth_date) THEN
    RAISE EXCEPTION 'User must be 18+ (18 years complete)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_enforce_adult ON public.profiles;
CREATE TRIGGER trg_profiles_enforce_adult
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_adult_on_profile_insert();

-- 4) Atualiza a trigger de criacao de perfil (auth.users -> public.profiles)
-- (Inclui birth_date vinda do raw_user_meta_data)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    friend_code,
    birth_date,
    is_adult_confirmed,
    adult_confirmed_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    public.generate_friend_code(),
    NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::date,
    false,
    NULL
  );

  RETURN NEW;
END;
$$;

-- Obs: a trigger on auth.users que chama handle_new_user ja existe no seu schema.
