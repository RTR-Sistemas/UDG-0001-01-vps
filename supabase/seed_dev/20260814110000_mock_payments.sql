/* Movido de supabase/migrations/ em 06/09/2026.
   Isto e semente de DESENVOLVIMENTO (cria o caminho de pagamento FICTICIO).
   NAO deve rodar em producao. Aplique a mao, so no banco local. */

-- =============================================================================
-- undoing_mock_payments
-- Permite confirmar pedidos de compra em modo desenvolvimento/demo SEM gateway
-- real. Ativado apenas quando platform_config['mock_payments'] = 'enabled'
-- (desligado em produção). O usuário só pode confirmar pedidos próprios.
-- =============================================================================

insert into public.platform_config (key, value) values
  ('mock_payments', 'enabled')
on conflict (key) do update set value = excluded.value;

create or replace function public.mock_confirm_coin_purchase(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order public.coin_purchase_orders%rowtype;
begin
  if coalesce(public.get_platform_config('mock_payments'), 'disabled') <> 'enabled' then
    raise exception 'mock_payments_disabled';
  end if;

  select * into v_order from public.coin_purchase_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_order.status <> 'pending' then raise exception 'order_already_processed'; end if;

  update public.coin_purchase_orders
     set status = 'paid',
         gateway_transaction_id = 'mock_' || gen_random_uuid()::text,
         paid_at = now()
   where id = p_order_id;

  insert into public.user_coins (user_id, balance, total_purchased)
  values (v_order.user_id, v_order.amount_coins, v_order.amount_coins)
  on conflict (user_id) do update
    set balance = public.user_coins.balance + excluded.balance,
        total_purchased = public.user_coins.total_purchased + excluded.total_purchased,
        updated_at = now();
end $$;