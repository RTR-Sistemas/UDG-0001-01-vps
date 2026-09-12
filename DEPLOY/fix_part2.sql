-- Part 2: friend_requests foreign keys + indexes

-- Remove orphans first
DELETE FROM public.friend_requests fr
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = fr.sender_id)
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = fr.receiver_id);

-- Add FKs (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_sender_id_fkey'
  ) THEN
    ALTER TABLE public.friend_requests
      ADD CONSTRAINT friend_requests_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_receiver_id_fkey'
  ) THEN
    ALTER TABLE public.friend_requests
      ADD CONSTRAINT friend_requests_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender   ON public.friend_requests(sender_id, status);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
