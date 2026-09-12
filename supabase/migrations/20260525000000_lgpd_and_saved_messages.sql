-- =====================================================================
-- MIGRATION: LGPD Consent tracking and saved messages
-- Date: 2026-05-25
-- =====================================================================

-- 1. TABLE: saved_messages
CREATE TABLE IF NOT EXISTS public.saved_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_message_id uuid,
  conversation_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  content text,
  media_urls text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  saved_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '2 minutes'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT saved_messages_pkey PRIMARY KEY (id),
  CONSTRAINT saved_messages_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  CONSTRAINT saved_messages_requester_id_fkey 
    FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT saved_messages_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Indexes for saved_messages
CREATE INDEX IF NOT EXISTS idx_saved_messages_conversation ON public.saved_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_saved_messages_requester ON public.saved_messages(requester_id);
CREATE INDEX IF NOT EXISTS idx_saved_messages_owner ON public.saved_messages(owner_id);
CREATE INDEX IF NOT EXISTS idx_saved_messages_status ON public.saved_messages(status);

-- RLS for saved_messages
ALTER TABLE public.saved_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_messages_select" ON public.saved_messages;
CREATE POLICY "saved_messages_select" ON public.saved_messages
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "saved_messages_insert" ON public.saved_messages;
CREATE POLICY "saved_messages_insert" ON public.saved_messages
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "saved_messages_update" ON public.saved_messages;
CREATE POLICY "saved_messages_update" ON public.saved_messages
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "saved_messages_delete" ON public.saved_messages;
CREATE POLICY "saved_messages_delete" ON public.saved_messages
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = owner_id);

-- Cleanup function for expired save requests
CREATE OR REPLACE FUNCTION cleanup_expired_save_requests()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.saved_messages
  WHERE status = 'pending' AND expires_at < now();
END;
$$;

-- 2. TABLE: user_consents
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  terms_version text NOT NULL DEFAULT '1.0.0',
  privacy_version text NOT NULL DEFAULT '1.0.0',
  accepted_terms boolean NOT NULL DEFAULT false,
  accepted_privacy boolean NOT NULL DEFAULT false,
  accepted_cookies boolean NOT NULL DEFAULT false,
  accepted_data_processing boolean NOT NULL DEFAULT false,
  accepted_location boolean NOT NULL DEFAULT false,
  accepted_push_notifications boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  revocation_reason text,
  CONSTRAINT user_consents_pkey PRIMARY KEY (id),
  CONSTRAINT user_consents_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);

-- RLS for user_consents
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_consents_select_own" ON public.user_consents;
CREATE POLICY "user_consents_select_own" ON public.user_consents
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

DROP POLICY IF EXISTS "user_consents_insert_own" ON public.user_consents;
CREATE POLICY "user_consents_insert_own" ON public.user_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_consents_update_own" ON public.user_consents;
CREATE POLICY "user_consents_update_own" ON public.user_consents
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. TABLE: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  status text DEFAULT 'success',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "audit_logs_own_select" ON public.audit_logs;
CREATE POLICY "audit_logs_own_select" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- 4. TRIGGER: Hard delete of messages
CREATE OR REPLACE FUNCTION hard_delete_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.messages WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hard_delete_message ON public.messages;
CREATE TRIGGER trg_hard_delete_message
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION hard_delete_message();

-- 5. Profiles columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS lgpd_data_deletion_requested_at timestamp with time zone;

-- Documentation comments
COMMENT ON TABLE public.saved_messages IS 'Mensagens salvas bilateralmente - requer aprovação de ambos os usuários';
COMMENT ON TABLE public.user_consents IS 'Registro de consentimentos LGPD - Art. 7 e 8 da Lei 13.709/2018';
COMMENT ON TABLE public.audit_logs IS 'Log de auditoria de eventos de segurança e acesso a dados';
COMMENT ON COLUMN public.user_consents.ip_address IS 'IP no momento do aceite - rastreabilidade LGPD';
COMMENT ON COLUMN public.saved_messages.expires_at IS 'Expiração automática de 2 min se status=pending';
