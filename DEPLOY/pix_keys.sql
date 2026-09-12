-- =============================================================================
-- pix_keys: cadastro, validação e confirmação de chave PIX para recebimento
-- (prêmios de batalha e saques de diamantes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pix_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_value text NOT NULL,
  key_type text NOT NULL CHECK (key_type IN ('CPF','CNPJ','EMAIL','PHONE','EVP')),
  owner_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed')),
  is_default boolean NOT NULL DEFAULT false,
  confirmation_code_hash text,
  code_expires_at timestamptz,
  confirm_attempts integer NOT NULL DEFAULT 0,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key_value)
);

CREATE INDEX IF NOT EXISTS pix_keys_user_idx ON public.pix_keys (user_id);
CREATE INDEX IF NOT EXISTS pix_keys_value_idx ON public.pix_keys (key_value);

ALTER TABLE public.pix_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pix_keys_select_own ON public.pix_keys;
CREATE POLICY pix_keys_select_own ON public.pix_keys FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pix_keys_insert_own ON public.pix_keys;
CREATE POLICY pix_keys_insert_own ON public.pix_keys FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS pix_keys_update_own ON public.pix_keys;
CREATE POLICY pix_keys_update_own ON public.pix_keys FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS pix_keys_delete_own ON public.pix_keys;
CREATE POLICY pix_keys_delete_own ON public.pix_keys FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Dígitos verificadores (CPF e CNPJ — módulo 11)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pix_cpf_valid(p_cpf text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d text;
  s integer;
  dv1 integer;
  dv2 integer;
  i integer;
BEGIN
  d := regexp_replace(p_cpf, '\D', '', 'g');
  IF length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN
    RETURN false;
  END IF;
  s := 0;
  FOR i IN 1..9 LOOP
    s := s + (substring(d, i, 1)::integer * (11 - i));
  END LOOP;
  dv1 := (11 - (s % 11)) % 11;
  IF dv1 = 10 THEN dv1 := 0; END IF;
  IF substring(d, 10, 1)::integer <> dv1 THEN
    RETURN false;
  END IF;
  s := 0;
  FOR i IN 1..10 LOOP
    s := s + (substring(d, i, 1)::integer * (12 - i));
  END LOOP;
  dv2 := (11 - (s % 11)) % 11;
  IF dv2 = 10 THEN dv2 := 0; END IF;
  IF substring(d, 11, 1)::integer <> dv2 THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pix_cnpj_valid(p_cnpj text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d text;
  s integer;
  dv1 integer;
  dv2 integer;
  i integer;
  peso integer;
BEGIN
  d := regexp_replace(p_cnpj, '\D', '', 'g');
  IF length(d) <> 14 OR d ~ '^(\d)\1{13}$' THEN
    RETURN false;
  END IF;
  s := 0;
  FOR i IN 1..12 LOOP
    IF i <= 4 THEN peso := 6 - i; ELSE peso := 14 - i; END IF;
    s := s + (substring(d, i, 1)::integer * peso);
  END LOOP;
  dv1 := (11 - (s % 11)) % 11;
  IF dv1 = 10 THEN dv1 := 0; END IF;
  IF substring(d, 13, 1)::integer <> dv1 THEN
    RETURN false;
  END IF;
  s := 0;
  FOR i IN 1..13 LOOP
    IF i <= 5 THEN peso := 7 - i; ELSE peso := 15 - i; END IF;
    s := s + (substring(d, i, 1)::integer * peso);
  END LOOP;
  dv2 := (11 - (s % 11)) % 11;
  IF dv2 = 10 THEN dv2 := 0; END IF;
  IF substring(d, 14, 1)::integer <> dv2 THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pix_validate(p_key text, OUT normalized text, OUT key_type text)
RETURNS record LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text;
  v_clean text;
BEGIN
  v := trim(p_key);
  IF v = '' THEN
    RAISE EXCEPTION 'chave_vazia';
  END IF;

  IF position('@' in v) > 0 THEN
    v := lower(v);
    IF length(v) > 77 THEN
      RAISE EXCEPTION 'chave_email_muito_longa';
    END IF;
    IF v ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$' THEN
      normalized := v;
      key_type := 'EMAIL';
      RETURN;
    END IF;
    RAISE EXCEPTION 'chave_invalida_email';
  END IF;

  IF v ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN
    normalized := lower(v);
    key_type := 'EVP';
    RETURN;
  END IF;

  v_clean := regexp_replace(v, '[^0-9]', '', 'g');

  IF length(v_clean) = 11 AND v ~ '^[0-9.\-]+$' AND public.pix_cpf_valid(v_clean) THEN
    normalized := v_clean;
    key_type := 'CPF';
    RETURN;
  END IF;
  IF length(v_clean) = 14 AND v ~ '^[0-9./\-]+$' AND public.pix_cnpj_valid(v_clean) THEN
    normalized := v_clean;
    key_type := 'CNPJ';
    RETURN;
  END IF;

  IF left(v, 1) = '+' OR left(v, 2) = '55' OR v ~ '^\d{10,13}$' OR v ~ '^\(\d{2}\)\s?\d{4,5}-?\d{4}$' OR v ~ '^\d{2}-?\s?\d{4,5}-?\d{4}$' THEN
    IF left(v, 1) = '+' AND left(v_clean, 2) <> '55' THEN
      RAISE EXCEPTION 'chave_telefone_fora_brasil';
    END IF;
    IF length(v_clean) IN (12, 13) AND left(v_clean, 2) = '55' THEN
      v_clean := substring(v_clean, 3);
    END IF;
    IF length(v_clean) = 11 THEN
      v_clean := '55' || v_clean;
    ELSIF length(v_clean) = 10 THEN
      v_clean := '55' || v_clean;
    ELSE
      RAISE EXCEPTION 'chave_telefone_invalido';
    END IF;
    IF substring(v_clean, 3, 1) = '0' THEN
      RAISE EXCEPTION 'chave_telefone_ddd_invalido';
    END IF;
    normalized := '+' || v_clean;
    key_type := 'PHONE';
    RETURN;
  END IF;

  RAISE EXCEPTION 'chave_invalida';
END;
$$;

-- -----------------------------------------------------------------------------
-- register_pix_key: valida formato, normaliza, confere duplicidade e limite
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_pix_key(p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_normalized text;
  v_type text;
  v_existing public.pix_keys;
  v_count integer;
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_normalized, v_type FROM public.pix_validate(p_key);

  SELECT * INTO v_existing FROM public.pix_keys WHERE user_id = v_me AND key_value = v_normalized LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status = 'confirmed' THEN
      RAISE EXCEPTION 'chave_ja_cadastrada';
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;

  PERFORM 1 FROM public.pix_keys WHERE key_value = v_normalized LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'chave_em_uso_outro_usuario';
  END IF;

  SELECT count(*) INTO v_count FROM public.pix_keys WHERE user_id = v_me;
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'limite_chaves_atingido';
  END IF;

  INSERT INTO public.pix_keys (user_id, key_value, key_type)
  VALUES (v_me, v_normalized, v_type)
  RETURNING * INTO v_existing;

  RETURN to_jsonb(v_existing);
END;
$$;

-- -----------------------------------------------------------------------------
-- request_pix_confirmation: gera código de 6 dígitos (hash + validade 15min)
-- O código NUNCA retorna ao cliente REST: a função Netlify pix-confirm-code
-- entrega via push/notificação in-app e retorna apenas o estado de entrega.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_pix_confirmation(p_key_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_code text;
  v_row public.pix_keys;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.pix_keys WHERE id = p_key_id AND user_id = v_me;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'chave_nao_encontrada';
  END IF;
  IF v_row.status = 'confirmed' THEN
    RAISE EXCEPTION 'chave_ja_confirmada';
  END IF;

  v_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  UPDATE public.pix_keys
     SET confirmation_code_hash = encode(sha256(convert_to(v_code, 'UTF8')), 'hex'),
         code_expires_at = now() + interval '15 minutes',
         confirm_attempts = 0,
         updated_at = now()
   WHERE id = p_key_id;

  RETURN jsonb_build_object('code', v_code, 'expires_at', now() + interval '15 minutes');
END;
$$;

-- -----------------------------------------------------------------------------
-- confirm_pix_key: valida o código e confirma a chave
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_pix_key(p_key_id uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.pix_keys;
  v_hash text;
  v_is_first boolean;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.pix_keys WHERE id = p_key_id AND user_id = v_me;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'chave_nao_encontrada';
  END IF;
  IF v_row.status = 'confirmed' THEN
    RAISE EXCEPTION 'chave_ja_confirmada';
  END IF;
  IF v_row.confirmation_code_hash IS NULL OR v_row.code_expires_at IS NULL THEN
    RAISE EXCEPTION 'codigo_nao_solicitado';
  END IF;
  IF v_row.code_expires_at < now() THEN
    RAISE EXCEPTION 'codigo_expirado';
  END IF;
  IF v_row.confirm_attempts >= 5 THEN
    RAISE EXCEPTION 'codigo_muitas_tentativas';
  END IF;

  v_hash := encode(sha256(convert_to(trim(p_code), 'UTF8')), 'hex');
  IF v_hash <> v_row.confirmation_code_hash THEN
    UPDATE public.pix_keys
       SET confirm_attempts = confirm_attempts + 1,
           updated_at = now()
     WHERE id = p_key_id;
    RAISE EXCEPTION 'codigo_invalido';
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.pix_keys
     WHERE user_id = v_me AND status = 'confirmed' AND is_default
  ) INTO v_is_first;

  UPDATE public.pix_keys
     SET status = 'confirmed',
         is_default = v_is_first,
         confirmed_at = now(),
         confirmation_code_hash = NULL,
         code_expires_at = NULL,
         confirm_attempts = 0,
         updated_at = now()
   WHERE id = p_key_id
   RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'is_default', v_row.is_default);
END;
$$;

-- -----------------------------------------------------------------------------
-- delete_pix_key / set_default_pix_key / get_my_pix_keys
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_pix_key(p_key_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.pix_keys;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT * INTO v_row FROM public.pix_keys WHERE id = p_key_id AND user_id = v_me;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'chave_nao_encontrada';
  END IF;
  DELETE FROM public.pix_keys WHERE id = p_key_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_pix_key(p_key_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row public.pix_keys;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT * INTO v_row FROM public.pix_keys WHERE id = p_key_id AND user_id = v_me;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'chave_nao_encontrada';
  END IF;
  IF v_row.status <> 'confirmed' THEN
    RAISE EXCEPTION 'chave_nao_confirmada';
  END IF;
  UPDATE public.pix_keys SET is_default = (id = p_key_id) WHERE user_id = v_me;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_pix_keys()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.is_default DESC, t.created_at DESC), '[]'::jsonb)
    FROM public.pix_keys t
   WHERE t.user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.pix_validate(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pix_cpf_valid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pix_cnpj_valid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_pix_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_pix_key(text) TO authenticated;

REVOKE ALL ON FUNCTION public.request_pix_confirmation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_pix_confirmation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_pix_key(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_pix_key(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_pix_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_pix_key(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_default_pix_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_pix_key(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_pix_keys() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pix_keys() TO authenticated;