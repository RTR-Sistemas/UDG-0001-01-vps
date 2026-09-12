-- =============================================================================
-- File: supabase/migrations/20260528000002_fix_infinite_recursion_500.sql
-- Purpose: Corrige o erro 500 (Internal Server Error) causado por recursão
--          infinita nas políticas RLS recém-criadas.
-- =============================================================================

-- 1) Recria a função SECURITY DEFINER para checar a participação.
--    SECURITY DEFINER faz a função rodar como o dono (bypass RLS local), 
--    evitando a recursão infinita (erro 500) ao consultar a mesma tabela.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conversation_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = conversation_uuid
    AND user_id = user_uuid
  );
$$;

-- Garante que a role autenticada pode executar a função
GRANT EXECUTE ON FUNCTION public.is_conversation_participant TO authenticated;

-- 2) Remove as políticas recursivas (que causavam erro 500)
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

-- 3) Recria as políticas usando a função, eliminando o loop de RLS
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (
    user_id = auth.uid() OR public.is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY "Users can add participants to conversations"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR public.is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    public.is_conversation_participant(id, auth.uid())
  );

-- O erro 403 anterior era causado por falta de GRANT. Como já aplicamos
-- os GRANTs na migration anterior, agora combinamos GRANT + Política Sem Recursão.
