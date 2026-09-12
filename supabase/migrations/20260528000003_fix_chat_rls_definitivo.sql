-- =============================================================================
-- File: supabase/migrations/20260528000003_fix_chat_rls_definitivo.sql
-- Purpose: Solução definitiva para os erros 403 e 500 no chat.
--          Usa uma função PL/pgSQL que não sofre "inline" e não causa
--          recursão infinita.
-- =============================================================================

-- 1) Criar função helper à prova de recursão
-- Essa função pega os IDs das conversas em que o usuário está.
-- Usando PL/pgSQL e SECURITY DEFINER, garantimos que ela burla o RLS
-- local e não gera loop.
CREATE OR REPLACE FUNCTION public.get_my_conversations(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT conversation_id
  FROM public.conversation_participants
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_conversations(uuid) TO authenticated;

-- 2) Limpar QUALQUER política anterior problemática
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;

-- 3) Aplicar as novas políticas limpas e sem loop para as 3 tabelas de chat principais

-- -> conversation_participants
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    conversation_id IN (SELECT public.get_my_conversations(auth.uid()))
  );

CREATE POLICY "Users can add participants to conversations"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    conversation_id IN (SELECT public.get_my_conversations(auth.uid()))
  );

-- -> conversations
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    id IN (SELECT public.get_my_conversations(auth.uid()))
  );

-- -> messages
CREATE POLICY "Users can view messages from their conversations"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (SELECT public.get_my_conversations(auth.uid()))
  );

CREATE POLICY "Users can create messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    conversation_id IN (SELECT public.get_my_conversations(auth.uid()))
  );

-- -> temporaries / deleteds (Opcional, mas previne que falhem)
DROP POLICY IF EXISTS "Users can view temporary messages" ON public.temporary_messages_archive;
CREATE POLICY "Users can view temporary messages"
  ON public.temporary_messages_archive FOR SELECT
  USING (
    user_id = auth.uid() OR
    conversation_id IN (SELECT public.get_my_conversations(auth.uid()))
  );
