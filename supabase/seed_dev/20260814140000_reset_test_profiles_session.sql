/* Movido de supabase/migrations/ em 06/09/2026.
   Isto e semente de DESENVOLVIMENTO (reseta a sessao dos perfis de teste).
   NAO deve rodar em producao. Aplique a mao, so no banco local. */

-- =============================================================================
-- undoing_reset_test_profiles_session
-- Limpa active_session_id dos usuários de teste para permitir login limpo
-- nas execuções E2E (sessão única do app).
-- =============================================================================

update public.profiles
   set active_session_id = null, updated_at = now()
 where id in (
   select id from auth.users
   where email in ('batalha1@udgtest.com', 'batalha2@udgtest.com')
 );