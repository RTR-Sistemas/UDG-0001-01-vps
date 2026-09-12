-- =============================================================================
-- File: supabase/05_fix_friend_code_generation.sql
-- Purpose: Corrige criacao automatica do codigo UDG (profiles.friend_code)
-- Notes:
--  - Execute este SQL no Supabase SQL Editor se o banco atual ja esta em producao.
--  - Ele e idempotente: pode ser executado mais de uma vez com seguranca.
-- =============================================================================

-- 1) Garante que a coluna existe e continua unica.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS friend_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_friend_code_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_friend_code_key UNIQUE (friend_code);
  END IF;
END $$;

-- 2) Funcao robusta para gerar codigo UDG unico.
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := 'UDG-' || LPAD(FLOOR(RANDOM() * 10000000)::text, 7, '0');

    SELECT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE friend_code = new_code
    ) INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN new_code;
END;
$$;

-- 3) Trigger de seguranca: qualquer insert em profiles sem friend_code recebe codigo.
CREATE OR REPLACE FUNCTION public.ensure_profile_friend_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.friend_code IS NULL OR btrim(NEW.friend_code) = '' THEN
    NEW.friend_code := public.generate_friend_code();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_ensure_friend_code ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_friend_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_profile_friend_code();

-- 4) Atualiza usuarios ja existentes que ficaram sem codigo UDG.
UPDATE public.profiles
SET friend_code = public.generate_friend_code()
WHERE friend_code IS NULL OR btrim(friend_code) = '';

-- 5) Helper para evitar colisao de username no trigger de cadastro.
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
    candidate := base || '_' || substring(gen_random_uuid()::text from 1 for 4);
    IF tries > 25 THEN
      candidate := 'user_' || substring(gen_random_uuid()::text from 1 for 8);
      EXIT;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

-- 6) Recria handle_new_user para sempre inserir friend_code no cadastro via auth.users.
--    Mantem os campos usados pelo app atual: username, full_name, birth_date e birth_date_public.
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
  desired_birth_date_public boolean;
BEGIN
  desired_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE NULL END,
    'user_' || substring(NEW.id::text from 1 for 8)
  );

  effective_username := public.make_unique_username(desired_username);

  desired_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  desired_birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::date;
  desired_birth_date_public := COALESCE((NEW.raw_user_meta_data->>'birth_date_public')::boolean, false);

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
    desired_birth_date_public
  )
  ON CONFLICT (id) DO UPDATE
  SET friend_code = COALESCE(public.profiles.friend_code, EXCLUDED.friend_code),
      username = COALESCE(NULLIF(public.profiles.username, ''), EXCLUDED.username),
      full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      birth_date = COALESCE(public.profiles.birth_date, EXCLUDED.birth_date),
      birth_date_public = COALESCE(public.profiles.birth_date_public, EXCLUDED.birth_date_public),
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
