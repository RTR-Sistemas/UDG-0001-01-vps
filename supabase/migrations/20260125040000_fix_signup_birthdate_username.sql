-- =============================================================================
-- File: supabase/migrations/20260125040000_fix_signup_birthdate_username.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Fix signup issues (username collisions / missing birth_date) + public/private birth date

-- 1) Public/private flag for birth date
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date_public boolean NOT NULL DEFAULT false;

-- 2) Helper: 18+ check (safe to re-declare)
CREATE OR REPLACE FUNCTION public.is_adult(birth_date date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT birth_date <= (current_date - interval '18 years')::date;
$$;

-- 3) Enforce 18+ at profile insert (safe to re-declare)
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

-- 4) Helper: ensure unique usernames (profiles.username is UNIQUE)
CREATE OR REPLACE FUNCTION public.make_unique_username(desired text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  tries int := 0;
BEGIN
  base := lower(coalesce(desired, ''));
  base := regexp_replace(base, '[^a-z0-9_]+', '_', 'g');
  base := trim(both '_' from base);
  IF base IS NULL OR base = '' THEN
    base := 'user';
  END IF;

  candidate := base;

  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE p.username = candidate) LOOP
    tries := tries + 1;
    -- adds a short random suffix; keeps it readable and avoids infinite loops
    candidate := base || '_' || substring(gen_random_uuid()::text from 1 for 4);
    IF tries > 25 THEN
      candidate := 'user_' || substring(gen_random_uuid()::text from 1 for 8);
      EXIT;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

-- 5) Update handle_new_user trigger to always create a valid profile
--    and avoid username collisions. Also reads birth_date from user metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  desired_username text;
  effective_username text;
  desired_full_name text;
  desired_birth_date date;
BEGIN
  desired_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE NULL END,
    'user_' || substring(NEW.id::text from 1 for 8)
  );

  effective_username := public.make_unique_username(desired_username);
  desired_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  desired_birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::date;

  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    friend_code,
    birth_date,
    is_adult_confirmed,
    adult_confirmed_at,
    birth_date_public
  )
  VALUES (
    NEW.id,
    effective_username,
    desired_full_name,
    public.generate_friend_code(),
    desired_birth_date,
    false,
    NULL,
    false
  );

  RETURN NEW;
END;
$$;

-- 6) Ensure trigger exists on auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
