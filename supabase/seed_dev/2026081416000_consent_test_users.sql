/* Movido de supabase/migrations/ em 06/09/2026.
   Isto e semente de DESENVOLVIMENTO (aceita os termos em nome das contas de teste).
   NAO deve rodar em producao. Aplique a mao, so no banco local. */

-- 2026081416000_consent_test_users.sql
-- Marca os usuários de teste como aceitos nos Termos & Privacidade (LGPD)
-- para que o LGPDConsentModal não bloqueie a interface durante os testes E2E.

INSERT INTO public.user_consents (
  user_id, terms_version, privacy_version,
  accepted_terms, accepted_privacy, accepted_cookies,
  accepted_data_processing, accepted_location, accepted_push_notifications,
  ip_address, user_agent, accepted_at, updated_at
)
SELECT
  u.id, '1.0.0', '1.0.0',
  true, true, true, true, false, false,
  '127.0.0.1', 'e2e-test', now(), now()
FROM auth.users u
WHERE u.email IN ('batalha1@udgtest.com', 'batalha2@udgtest.com')
ON CONFLICT (user_id) DO UPDATE SET
  accepted_terms = true, accepted_privacy = true, accepted_cookies = true,
  accepted_data_processing = true,
  terms_version = '1.0.0', privacy_version = '1.0.0',
  updated_at = now();

UPDATE public.profiles
SET terms_accepted_at = now(), privacy_accepted_at = now()
WHERE id IN (SELECT id FROM auth.users WHERE email IN ('batalha1@udgtest.com', 'batalha2@udgtest.com'));