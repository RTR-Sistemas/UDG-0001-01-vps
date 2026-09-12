-- Adicionar funcionalidade de respostas aos comentários (Nested Comments)
ALTER TABLE public.comments ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Criar tabela de curtidas para comentários
CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- Ativar RLS (Row Level Security)
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Políticas de Privacidade de comment_likes
CREATE POLICY "Curtidas de comentários são visíveis publicamente"
ON public.comment_likes FOR SELECT
USING (true);

CREATE POLICY "Usuários podem curtir comentários"
ON public.comment_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem descurtir comentários"
ON public.comment_likes FOR DELETE
USING (auth.uid() = user_id);
