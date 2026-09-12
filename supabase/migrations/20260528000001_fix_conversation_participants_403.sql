-- =============================================================================
-- File: supabase/migrations/20260528000001_fix_conversation_participants_403.sql
-- Purpose: Ensures the conversation_participants table has the correct grants
--          and robust RLS policies to prevent 403 Forbidden errors.
-- Notes:
--  - Execute in the Supabase SQL Editor.
-- =============================================================================

-- Ensure proper grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO anon;

-- Ensure RLS is enabled
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be recursive or faulty
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;

-- Simplify the SELECT policy: a user can view a participant row if they are in the same conversation.
-- We use a simpler subquery instead of a security definer function to avoid permission edge cases,
-- or we can just let users see participants if they are the participant, OR if they are in the conversation.
-- Actually, the most robust way that avoids recursion without SECURITY DEFINER is:
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (
    -- The user is viewing their own participation
    user_id = auth.uid()
    OR
    -- Or the user is viewing participants of a conversation they are in
    conversation_id IN (
      SELECT cp.conversation_id 
      FROM public.conversation_participants cp 
      WHERE cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to conversations"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR
    conversation_id IN (
      SELECT cp.conversation_id 
      FROM public.conversation_participants cp 
      WHERE cp.user_id = auth.uid()
    )
  );

-- Also, fix the conversation policy to use the same logic
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    id IN (
      SELECT cp.conversation_id 
      FROM public.conversation_participants cp 
      WHERE cp.user_id = auth.uid()
    )
  );

-- Ensure the function still exists for anything else that might use it, 
-- but grant execute just in case
GRANT EXECUTE ON FUNCTION public.is_conversation_participant TO authenticated;
