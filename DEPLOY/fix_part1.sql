-- Part 1: blocked_users + get_blocked_users

-- Drop old function first (returns jsonb, we need TABLE)
DROP FUNCTION IF EXISTS public.get_blocked_users();

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_users_unique_pair UNIQUE (blocker_id, blocked_id),
  CONSTRAINT blocked_users_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_select_blocked" ON public.blocked_users;
CREATE POLICY "policy_select_blocked"
  ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "policy_insert_blocked" ON public.blocked_users;
CREATE POLICY "policy_insert_blocked"
  ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "policy_delete_blocked" ON public.blocked_users;
CREATE POLICY "policy_delete_blocked"
  ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- Create get_blocked_users() - no params
CREATE FUNCTION public.get_blocked_users()
RETURNS TABLE (
  id         uuid,
  blocked_id uuid,
  username   text,
  full_name  text,
  avatar_url text,
  reason     text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.blocked_id,
    p.username,
    p.full_name,
    p.avatar_url,
    b.reason,
    b.created_at
  FROM public.blocked_users b
  LEFT JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

-- Create get_blocked_users(uuid) - with param
CREATE FUNCTION public.get_blocked_users(p_user_id uuid)
RETURNS TABLE (
  id         uuid,
  blocked_id uuid,
  username   text,
  full_name  text,
  avatar_url text,
  reason     text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.blocked_id,
    p.username,
    p.full_name,
    p.avatar_url,
    b.reason,
    b.created_at
  FROM public.blocked_users b
  LEFT JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = COALESCE(p_user_id, auth.uid())
    AND (p_user_id IS NULL OR p_user_id = auth.uid())
  ORDER BY b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_blocked_users() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_blocked_users(uuid) TO authenticated, anon;
