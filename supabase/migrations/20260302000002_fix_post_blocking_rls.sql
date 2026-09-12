-- ==========================================================
-- CORREÇÃO DEFINITIVA: RLS PARA BLOQUEIO DE POSTS POR ADMIN
-- ==========================================================

-- 1. Garantir que as colunas existem
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_reason text;

-- 2. Habilitar RLS na tabela de posts (provavelmente já está, mas por segurança)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para permitir que QUALQUER UM veja o status de bloqueio
-- (Isso é necessário para que o Feed consiga ler 'is_blocked')
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
END $$;

CREATE POLICY "Anyone can view posts" 
ON public.posts FOR SELECT 
USING (true);

-- 4. Criar política para permitir que ADMINS atualizem o status de bloqueio de QUALQUER post
-- (Fundamental para que a ação no Painel Admin funcione)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can block any post" ON public.posts;
END $$;

CREATE POLICY "Admins can block any post" 
ON public.posts FOR UPDATE 
USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    OR 
    ((auth.jwt() ->> 'email') IN ('undoingapp@gmail.com', 'sistemasrtr@gmail.com'))
)
WITH CHECK (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    OR 
    ((auth.jwt() ->> 'email') IN ('undoingapp@gmail.com', 'sistemasrtr@gmail.com'))
);

-- 5. Garantir que a tabela de reports também permita o update por admins
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
END $$;

CREATE POLICY "Admins can update reports" 
ON public.reports FOR UPDATE USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    OR 
    ((auth.jwt() ->> 'email') IN ('undoingapp@gmail.com', 'sistemasrtr@gmail.com'))
);

-- 6. Índice para busca rápida de posts bloqueados
CREATE INDEX IF NOT EXISTS idx_posts_is_blocked_status ON public.posts(is_blocked);
