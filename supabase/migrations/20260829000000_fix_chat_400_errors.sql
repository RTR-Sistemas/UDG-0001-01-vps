-- =============================================================================
-- Correção dos erros 400 do chat + suporte à dublagem
--
-- Resolve, de uma vez:
--   1) POST /rest/v1/rpc/get_blocked_users → 400   (a função não existia)
--   2) GET  /rest/v1/friend_requests?select=...sender:profiles!friend_requests_sender_id_fkey
--      → 400 ("Could not find a relationship"): a tabela friend_requests não
--      tinha foreign keys para profiles, então o PostgREST não conseguia fazer
--      o embed dos perfis do remetente/destinatário.
--   3) Cria a tabela message_translations, usada para guardar o histórico das
--      dublagens de áudio.
--
-- Seguro para rodar mais de uma vez (tudo é IF NOT EXISTS / OR REPLACE).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BLOQUEIO DE USUÁRIOS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_users_unique_pair UNIQUE (blocker_id, blocked_id),
  CONSTRAINT blocked_users_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê seus próprios bloqueios" ON public.blocked_users;
CREATE POLICY "Usuário vê seus próprios bloqueios"
  ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "Usuário bloqueia" ON public.blocked_users;
CREATE POLICY "Usuário bloqueia"
  ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Usuário desbloqueia" ON public.blocked_users;
CREATE POLICY "Usuário desbloqueia"
  ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- Função chamada pelo front-end: supabase.rpc('get_blocked_users')
-- Devolve os perfis que o usuário logado bloqueou.
CREATE OR REPLACE FUNCTION public.get_blocked_users()
RETURNS TABLE (
  id         uuid,
  blocked_id uuid,
  username   text,
  full_name  text,
  avatar_url text,
  reason     text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.blocked_id,
    p.username,
    p.full_name,
    p.avatar_url,
    b.reason,
    b.created_at
  FROM public.blocked_users b
  LEFT JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

-- Variante com parâmetro explícito (algumas telas chamam assim).
CREATE OR REPLACE FUNCTION public.get_blocked_users(p_user_id uuid)
RETURNS TABLE (
  id         uuid,
  blocked_id uuid,
  username   text,
  full_name  text,
  avatar_url text,
  reason     text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.blocked_id,
    p.username,
    p.full_name,
    p.avatar_url,
    b.reason,
    b.created_at
  FROM public.blocked_users b
  LEFT JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = COALESCE(p_user_id, auth.uid())
    AND (p_user_id IS NULL OR p_user_id = auth.uid())
  ORDER BY b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_blocked_users() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_blocked_users(uuid) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FOREIGN KEYS DE friend_requests → profiles
--    (é o que faz o "select=...,sender:profiles!friend_requests_sender_id_fkey"
--     parar de dar 400)
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove pedidos órfãos, senão a criação da FK falha.
DELETE FROM public.friend_requests fr
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = fr.sender_id)
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = fr.receiver_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_sender_id_fkey'
  ) THEN
    ALTER TABLE public.friend_requests
      ADD CONSTRAINT friend_requests_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_receiver_id_fkey'
  ) THEN
    ALTER TABLE public.friend_requests
      ADD CONSTRAINT friend_requests_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender   ON public.friend_requests(sender_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HISTÓRICO DAS DUBLAGENS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.message_translations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id           uuid,
  original_text        text,
  original_language    text,
  translated_text      text,
  target_language      text,
  original_audio_url   text,
  translated_audio_url text,
  translation_status   text DEFAULT 'completed',
  dubbing_method       text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_translations_message ON public.message_translations(message_id);

ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários logados leem traduções" ON public.message_translations;
CREATE POLICY "Usuários logados leem traduções"
  ON public.message_translations FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Usuários logados gravam traduções" ON public.message_translations;
CREATE POLICY "Usuários logados gravam traduções"
  ON public.message_translations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Recarrega o cache de schema do PostgREST (aplica as FKs imediatamente)
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
