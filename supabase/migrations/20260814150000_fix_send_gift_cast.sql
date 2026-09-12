-- =============================================================================
-- undoing_fix_send_gift_cast
-- Corrige send_gift: credit_diamonds espera integer, mas v_diamonds é bigint.
-- Chamada de função exige cast explícito (PostgreSQL não aplica assignment
-- cast em argumentos de função → causava "function does not exist" 42883/404).
-- =============================================================================

create or replace function public.send_gift(
  p_receiver_id uuid,
  p_gift_id uuid,
  p_quantity int default 1,
  p_battle_id uuid default null
) returns public.gift_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_sender uuid := auth.uid();
  v_gift public.gifts_catalog%rowtype;
  v_cost bigint;
  v_diamonds bigint;
  v_fee bigint;
  v_battle public.battles%rowtype;
  v_row public.gift_transactions;
begin
  if v_sender is null then raise exception 'not_authenticated'; end if;
  if p_receiver_id is null then raise exception 'receiver_required'; end if;
  if p_receiver_id = v_sender then raise exception 'cannot_gift_self'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;

  select * into v_gift
    from public.gifts_catalog
   where id = p_gift_id and is_active
   for update;
  if not found then raise exception 'gift_not_found'; end if;

  v_cost := v_gift.coin_cost * p_quantity;
  v_diamonds := v_gift.diamond_value * p_quantity;
  v_fee := floor(v_diamonds * coalesce(
    nullif(public.get_platform_config('gift_fee'), '')::numeric, 0.5
  ));

  -- 1) debita moedas do sender (valida saldo)
  perform public.debit_coins(v_sender, v_cost);

  -- 2) credita diamantes no receiver
  perform public.credit_diamonds(p_receiver_id, v_diamonds::int);

  -- 3) registra transação
  insert into public.gift_transactions (
    battle_id, sender_id, receiver_id, gift_id, quantity,
    coins_spent, diamonds_earned, platform_fee, is_battle_gift
  ) values (
    p_battle_id, v_sender, p_receiver_id, p_gift_id, p_quantity,
    v_cost, v_diamonds, v_fee, p_battle_id is not null
  ) returning * into v_row;

  -- 4) ranking de participantes da batalha
  if p_battle_id is not null then
    insert into public.battle_participants (battle_id, user_id, total_coins_spent, gift_count, last_gift_at)
    values (p_battle_id, v_sender, v_cost, p_quantity, now())
    on conflict (battle_id, user_id) do update
      set total_coins_spent = public.battle_participants.total_coins_spent + excluded.total_coins_spent,
          gift_count = public.battle_participants.gift_count + excluded.gift_count,
          last_gift_at = now();
  end if;

  -- 5) placar da batalha (pontos = diamantes do presente)
  if p_battle_id is not null then
    select * into v_battle from public.battles where id = p_battle_id for update;
    if not found then raise exception 'battle_not_found'; end if;
    if v_battle.status <> 'live' then raise exception 'battle_not_live'; end if;

    if p_receiver_id = v_battle.host_id then
      update public.battles set host_score = host_score + v_diamonds where id = p_battle_id;
    elsif p_receiver_id = v_battle.guest_id then
      update public.battles set guest_score = guest_score + v_diamonds where id = p_battle_id;
    else
      raise exception 'receiver_not_in_battle';
    end if;

    update public.battles
       set total_gifts_sent = total_gifts_sent + p_quantity,
           total_coins_spent = total_coins_spent + v_cost
     where id = p_battle_id;
  end if;

  return v_row;
end $$;