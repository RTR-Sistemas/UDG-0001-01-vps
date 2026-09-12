-- ==========================================================
-- SCRIPT CONSOLIDADO E CORRIGIDO PARA MODERAÇÃO E DENÚNCIAS
-- ==========================================================

-- 1. ADICIONAR CAMPOS DE BLOQUEIO NA TABELA DE POSTS
-- Usamos 'ALTER TABLE' para adicionar as colunas necessárias para o novo sistema.
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_reason text;

-- 2. CRIAR TABELA DE DENÚNCIAS (REPORTS)
-- Esta tabela armazena as denúncias feitas pelos usuários.
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text, -- pending, reviewed, actioned, dismissed
    admin_note text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. CRIAR TABELA DE LOGS DE MODERAÇÃO IA (AUDITORIA)
-- Armazena os resultados das análises feitas pela IA (HuggingFace).
CREATE TABLE IF NOT EXISTS public.content_moderation_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
    content_type text NOT NULL, -- image, text, video
    text_content text,
    media_url text,
    flagged_labels jsonb DEFAULT '{}'::jsonb,
    severity text DEFAULT 'low'::text, -- low, medium, high, critical
    action_taken text DEFAULT 'allowed'::text, -- allowed, blocked, pending_review
    auto_blocked boolean DEFAULT false,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. CONFIGURAR SEGURANÇA (RLS)
-- Garante que apenas usuários autorizados e admins possam acessar os dados.
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_moderation_log ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA REPORTS
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
    DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
    DROP POLICY IF EXISTS "Logged users can create reports" ON public.reports;
    DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
END $$;

-- Usuários veem suas próprias denúncias
CREATE POLICY "Users can view their own reports" 
ON public.reports FOR SELECT USING (auth.uid() = reporter_id);

-- Admins veem tudo (baseado em is_admin ou e-mail do admin no JWT)
CREATE POLICY "Admins can view all reports" 
ON public.reports FOR SELECT USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    OR 
    ((auth.jwt() ->> 'email') IN ('undoingapp@gmail.com', 'sistemasrtr@gmail.com'))
);

-- Qualquer usuário logado pode denunciar
CREATE POLICY "Logged users can create reports" 
ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Somente Admins podem tratar as denúncias
CREATE POLICY "Admins can update reports" 
ON public.reports FOR UPDATE USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    OR 
    ((auth.jwt() ->> 'email') IN ('undoingapp@gmail.com', 'sistemasrtr@gmail.com'))
);

-- POLÍTICAS PARA MODERATION LOG
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can view moderation logs" ON public.content_moderation_log;
    DROP POLICY IF EXISTS "Logged users can create moderation logs" ON public.content_moderation_log;
END $$;

CREATE POLICY "Admins can view moderation logs" 
ON public.content_moderation_log FOR SELECT USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    OR 
    ((auth.jwt() ->> 'email') IN ('undoingapp@gmail.com', 'sistemasrtr@gmail.com'))
);

CREATE POLICY "Logged users can create moderation logs" 
ON public.content_moderation_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_posts_is_blocked ON public.posts(is_blocked);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_post_id ON public.reports(post_id);
CREATE INDEX IF NOT EXISTS idx_modlog_post_id ON public.content_moderation_log(post_id);
