-- =============================================================================
-- File: supabase/migrations/20251014034750_77d9764a-5fe3-4157-b2f9-4e3c80a8d6cd.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Create friend requests table
CREATE TABLE public.friend_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Users can view requests they sent or received
CREATE POLICY "Users can view their friend requests"
ON public.friend_requests
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create friend requests
CREATE POLICY "Users can send friend requests"
ON public.friend_requests
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Users can update requests they received (to accept/reject)
CREATE POLICY "Users can respond to received requests"
ON public.friend_requests
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Users can delete requests they sent
CREATE POLICY "Users can cancel sent requests"
ON public.friend_requests
FOR DELETE
USING (auth.uid() = sender_id);

-- Trigger to update updated_at
CREATE TRIGGER update_friend_requests_updated_at
BEFORE UPDATE ON public.friend_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();