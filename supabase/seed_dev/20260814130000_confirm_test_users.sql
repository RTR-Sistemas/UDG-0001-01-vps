/* Movido de supabase/migrations/ em 06/09/2026.
   Isto e semente de DESENVOLVIMENTO (confirma as 50 contas-bot de teste (@udgtest.com)).
   NAO deve rodar em producao. Aplique a mao, so no banco local. */

-- =============================================================================
-- undoing_confirm_test_users
-- Confirma os emails das contas de teste e garante perfis + saldos.
-- =============================================================================

do $$
declare
  v_user_a uuid;
  v_user_b uuid;
begin
  select id into v_user_a from auth.users where email = 'batalha1@udgtest.com';
  select id into v_user_b from auth.users where email = 'batalha2@udgtest.com';

  if v_user_a is not null then
    update auth.users set email_confirmed_at = now(), updated_at = now() where id = v_user_a;
    -- perfil criado pelo trigger handle_new_user; garante username/full_name
    update public.profiles
       set username = 'batalha1', full_name = 'Batalha Um', updated_at = now()
     where id = v_user_a;
    insert into public.profiles (id, username, full_name, updated_at)
    values (v_user_a, 'batalha1', 'Batalha Um', now())
    on conflict (id) do nothing;
    insert into public.user_coins (user_id, balance, total_purchased, total_spent, updated_at)
    values (v_user_a, 10000, 10000, 0, now())
    on conflict (user_id) do update
      set balance = 10000, total_purchased = 10000, updated_at = now();
    insert into public.user_diamonds (user_id, balance, total_earned, total_withdrawn, pending_withdrawal, updated_at)
    values (v_user_a, 0, 0, 0, 0, now())
    on conflict (user_id) do update
      set balance = 0, total_earned = 0, pending_withdrawal = 0, updated_at = now();
  end if;

  if v_user_b is not null then
    update auth.users set email_confirmed_at = now(), updated_at = now() where id = v_user_b;
    update public.profiles
       set username = 'batalha2', full_name = 'Batalha Dois', updated_at = now()
     where id = v_user_b;
    insert into public.profiles (id, username, full_name, updated_at)
    values (v_user_b, 'batalha2', 'Batalha Dois', now())
    on conflict (id) do nothing;
    insert into public.user_coins (user_id, balance, total_purchased, total_spent, updated_at)
    values (v_user_b, 10000, 10000, 0, now())
    on conflict (user_id) do update
      set balance = 10000, total_purchased = 10000, updated_at = now();
    insert into public.user_diamonds (user_id, balance, total_earned, total_withdrawn, pending_withdrawal, updated_at)
    values (v_user_b, 0, 0, 0, 0, now())
    on conflict (user_id) do update
      set balance = 0, total_earned = 0, pending_withdrawal = 0, updated_at = now();
  end if;
end $$;