/**
 * Centralized check for demo/offline mode.
 * Returns true when the app is running with dummy Supabase credentials
 * or the user logged in as a demo visitor.
 */
export function isDemoMode(userId?: string | null): boolean {
  const isDummyUrl = import.meta.env.VITE_SUPABASE_URL?.includes("dummy");
  const isDemoUser = !!userId && userId.startsWith("demo-");
  return isDummyUrl || isDemoUser;
}
