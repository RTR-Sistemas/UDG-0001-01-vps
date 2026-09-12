-- =============================================================================
-- File: supabase/migrations/20251014052621_c948e25f-7e05-4dad-9fdf-7a3dccf36107.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Função para verificar se dois usuários são amigos
CREATE OR REPLACE FUNCTION public.are_friends(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE (user_id = user1_id AND friend_id = user2_id)
       OR (user_id = user2_id AND friend_id = user1_id)
  )
$$;

-- Atualizar política de votos para permitir apenas entre amigos ou próprio post
DROP POLICY IF EXISTS "Users can create votes" ON post_votes;
CREATE POLICY "Users can create votes"
ON post_votes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    -- Pode votar no próprio post
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid())
    OR
    -- Ou pode votar se for amigo do autor
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id 
      AND public.are_friends(auth.uid(), p.user_id)
    )
  )
);

DROP POLICY IF EXISTS "Users can update their own votes" ON post_votes;
CREATE POLICY "Users can update their own votes"
ON post_votes FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id 
      AND public.are_friends(auth.uid(), p.user_id)
    )
  )
);

-- Atualizar política de likes para permitir apenas entre amigos ou próprio post
DROP POLICY IF EXISTS "Users can create likes" ON likes;
CREATE POLICY "Users can create likes"
ON likes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id 
      AND public.are_friends(auth.uid(), p.user_id)
    )
  )
);

-- Atualizar política de comentários para permitir apenas entre amigos ou próprio post
DROP POLICY IF EXISTS "Users can create comments" ON comments;
CREATE POLICY "Users can create comments"
ON comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM posts WHERE id = post_id AND user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id 
      AND public.are_friends(auth.uid(), p.user_id)
    )
  )
);

-- Atualizar política de visualização de posts para mostrar apenas posts de amigos
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
CREATE POLICY "Posts are viewable by friends and own posts"
ON posts FOR SELECT
TO authenticated
USING (
  -- Próprios posts
  user_id = auth.uid()
  OR
  -- Posts de amigos
  public.are_friends(auth.uid(), user_id)
  OR
  -- Posts aprovados pela comunidade (visíveis para todos)
  is_community_approved = true
);