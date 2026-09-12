-- =============================================================================
-- File: supabase/migrations/20260528000000_fix_adult_trigger_blocks_signup.sql
-- Purpose: Corrige o trigger enforce_adult_on_profile_insert que bloqueava
--          a criação de perfil (e do código UDG) quando birth_date era NULL.
-- Notes:
--  - Execute este SQL no Supabase SQL Editor.
--  - É idempotente: pode ser rodado mais de uma vez com segurança.
-- =============================================================================

-- 1) Corrige a função para NÃO lançar exceção quando birth_date é NULL.
--    O frontend já valida a data antes do signup; o banco só bloqueia menores
--    de 18 confirmados — nunca bloqueia quem ainda não informou a data.
CREATE OR REPLACE FUNCTION public.enforce_adult_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite NULL: o signup pode ocorrer em etapas; a data será preenchida depois.
  -- Bloqueia apenas quando a data está presente e confirma que o usuário é menor.
  IF NEW.birth_date IS NOT NULL AND NOT public.is_adult(NEW.birth_date) THEN
    RAISE EXCEPTION 'User must be 18+ (18 years complete)';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Recria o trigger (DROP + CREATE para garantir que está atualizado).
DROP TRIGGER IF EXISTS trg_profiles_enforce_adult ON public.profiles;
CREATE TRIGGER trg_profiles_enforce_adult
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_adult_on_profile_insert();

-- 3) Preenche códigos UDG que ficaram NULL em usuários já existentes
--    (consequência do bug anterior onde o INSERT era abortado).
UPDATE public.profiles
SET friend_code = public.generate_friend_code()
WHERE friend_code IS NULL OR btrim(friend_code) = '';

-- 4) Verifica e exibe usuários sem código UDG (deve retornar 0 linhas).
-- SELECT id, username, friend_code FROM public.profiles WHERE friend_code IS NULL;
