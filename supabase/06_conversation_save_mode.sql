-- =============================================================================
-- Migration: conversation_save_mode
-- Propósito: Tabela para controlar o modo "Salvar Conversa" bilateral
--            Um registro por conversa — representa o estado atual do interruptor
--
-- EXECUTE ESTE SQL NO SUPABASE → SQL Editor → New Query
-- =============================================================================

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS public.conversation_save_mode (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  requester_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  started_at        timestamptz NULL,
  deactivated_at    timestamptz NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. Índice: apenas UM registro ativo (pending ou approved) por conversa
CREATE UNIQUE INDEX IF NOT EXISTS conversation_save_mode_conv_active_unique
  ON public.conversation_save_mode (conversation_id)
  WHERE status IN ('pending', 'approved');

-- 3. Habilitar RLS
ALTER TABLE public.conversation_save_mode ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS — apenas participantes da conversa acessam
CREATE POLICY "save_mode: participantes podem ver"
  ON public.conversation_save_mode
  FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "save_mode: requester pode criar"
  ON public.conversation_save_mode
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "save_mode: participantes podem atualizar"
  ON public.conversation_save_mode
  FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "save_mode: participantes podem deletar"
  ON public.conversation_save_mode
  FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);

-- 5. Habilitar Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_save_mode;
