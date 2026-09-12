-- =============================================================================
-- File: supabase/migrations/20251014021047_439206d8-5417-4505-a546-fa60054fe709.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Fix infinite recursion in conversation_participants policies
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;

-- Create security definer function to check if user is in conversation
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

-- Recreate policies using the function
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can add participants to conversations"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

-- Also fix conversations policy  
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (public.is_conversation_participant(id, auth.uid()));