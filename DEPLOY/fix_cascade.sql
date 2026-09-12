-- FKs com CASCADE para permitir exclusão de usuário (cleanup/futuro LGPD)
ALTER TABLE public.consumption_ledger DROP CONSTRAINT IF EXISTS consumption_ledger_user_id_fkey;
ALTER TABLE public.consumption_ledger ADD CONSTRAINT consumption_ledger_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.feature_grants DROP CONSTRAINT IF EXISTS feature_grants_user_id_fkey;
ALTER TABLE public.feature_grants ADD CONSTRAINT feature_grants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.credit_balances DROP CONSTRAINT IF EXISTS credit_balances_user_id_fkey;
ALTER TABLE public.credit_balances ADD CONSTRAINT credit_balances_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- limpeza dos usuários de teste
DELETE FROM auth.users WHERE email LIKE 'smoke-%';
SELECT count(*) AS usuarios_restantes FROM auth.users;