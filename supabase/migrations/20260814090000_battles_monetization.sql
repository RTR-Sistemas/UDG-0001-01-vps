-- =============================================================================
-- undoing_battles_monetization
-- Sistema de Batalhas ao Vivo com Monetização (update.md)
-- Tabelas, funções, RLS, triggers, realtime e seed do catálogo de presentes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CONFIG DA PLATAFORMA (parâmetros configuráveis)
-- -----------------------------------------------------------------------------
create table if not exists public.platform_config (
  key text primary key,
  value text not null
);

insert into public.platform_config (key, value) values
  ('gift_fee', '0.5'),               -- comissão da plataforma sobre presentes (50%)
  ('withdrawal_fee', '0.05'),        -- taxa de saque (5%)
  ('min_withdrawal_diamonds', '1000'),
  ('battle_default_duration', '300'),-- duração padrão (5 min)
  ('max_extensions', '3'),           -- máx. extensões por batalha
  ('extension_seconds', '60'),       -- segundos adicionados por extensão
  ('diamond_to_currency_rate', '0.05') -- 1 diamante = R$ 0,05
on conflict (key) do nothing;

create or replace function public.get_platform_config(p_key text)
returns text
language sql stable
as $$
  select value from public.platform_config where key = p_key
$$;

-- -----------------------------------------------------------------------------
-- 2. TABELAS
-- -----------------------------------------------------------------------------

-- 2.1 gifts_catalog: catálogo de presentes virtuais
create table if not exists public.gifts_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  description text,
  image_url text,
  coin_cost int not null check (coin_cost > 0),
  diamond_value int not null check (diamond_value >= 0),
  is_animated boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2.2 user_coins: saldo de moedas
create table if not exists public.user_coins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  total_purchased bigint not null default 0,
  total_spent bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- 2.3 user_diamonds: saldo de diamantes
create table if not exists public.user_diamonds (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  total_earned bigint not null default 0,
  total_withdrawn bigint not null default 0,
  pending_withdrawal bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- 2.4 battles: registro de cada batalha
create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'canceled')),
  scheduled_start timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  duration_seconds int not null default 300,
  host_score bigint not null default 0,
  guest_score bigint not null default 0,
  winner_id uuid references public.profiles(id) on delete set null,
  extension_count int not null default 0,
  total_gifts_sent int not null default 0,
  total_coins_spent bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host_id <> guest_id)
);

create index if not exists battles_status_idx on public.battles (status);
create index if not exists battles_host_idx on public.battles (host_id);
create index if not exists battles_guest_idx on public.battles (guest_id);

-- 2.5 battle_participants: espectadores que enviaram presentes (top fãs)
create table if not exists public.battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  total_coins_spent bigint not null default 0,
  gift_count int not null default 0,
  last_gift_at timestamptz,
  created_at timestamptz not null default now(),
  unique (battle_id, user_id)
);

-- 2.6 gift_transactions: registro de cada envio de presente
create table if not exists public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid references public.battles(id) on delete set null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  gift_id uuid not null references public.gifts_catalog(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  coins_spent int not null check (coins_spent >= 0),
  diamonds_earned int not null check (diamonds_earned >= 0),
  platform_fee int not null default 0,
  is_battle_gift boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists gift_transactions_battle_idx on public.gift_transactions (battle_id);
create index if not exists gift_transactions_sender_idx on public.gift_transactions (sender_id);
create index if not exists gift_transactions_receiver_idx on public.gift_transactions (receiver_id);

-- 2.7 battle_extensions: extensões de tempo
create table if not exists public.battle_extensions (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  approved_by uuid references public.profiles(id) on delete cascade,
  extra_seconds int not null default 60,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists battle_extensions_battle_idx on public.battle_extensions (battle_id);

-- 2.8 withdrawal_requests: pedidos de saque de diamantes
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  diamond_amount bigint not null check (diamond_amount > 0),
  conversion_rate decimal(10,2) not null default 0.05,
  payout_amount decimal(10,2) not null default 0,
  payment_method text not null default 'pix'
    check (payment_method in ('paypal', 'bank_transfer', 'pix')),
  payment_details jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  notes text
);

-- 2.9 coin_purchase_orders: pedidos de compra de moedas
create table if not exists public.coin_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_coins int not null check (amount_coins > 0),
  price decimal(10,2) not null default 0,
  currency text not null default 'BRL',
  payment_gateway text not null default 'stripe'
    check (payment_gateway in ('stripe', 'apple', 'google')),
  gateway_transaction_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS DE updated_at
-- -----------------------------------------------------------------------------
create or replace function public.battles_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.battle_extensions_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.wallet_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists battles_set_updated_at on public.battles;
create trigger battles_set_updated_at before update on public.battles
  for each row execute function public.battles_set_updated_at();

drop trigger if exists battle_extensions_set_updated_at on public.battle_extensions;
create trigger battle_extensions_set_updated_at before update on public.battle_extensions
  for each row execute function public.battle_extensions_set_updated_at();

drop trigger if exists user_coins_set_updated_at on public.user_coins;
create trigger user_coins_set_updated_at before update on public.user_coins
  for each row execute function public.wallet_set_updated_at();

drop trigger if exists user_diamonds_set_updated_at on public.user_diamonds;
create trigger user_diamonds_set_updated_at before update on public.user_diamonds
  for each row execute function public.wallet_set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. FUNÇÕES DE NEGÓCIO
-- -----------------------------------------------------------------------------

-- 4.1 helpers de saldo (seguros, SECURITY DEFINER)
create or replace function public.get_user_coins(p_user_id uuid default auth.uid())
returns public.user_coins
language plpgsql stable security definer set search_path = public as $$
declare v_row public.user_coins;
begin
  if p_user_id is null or p_user_id <> auth.uid() then return null; end if;
  select * into v_row from public.user_coins where user_id = p_user_id;
  if not found then
    insert into public.user_coins (user_id) values (p_user_id) returning * into v_row;
  end if;
  return v_row;
end $$;

create or replace function public.get_user_diamonds(p_user_id uuid default auth.uid())
returns public.user_diamonds
language plpgsql stable security definer set search_path = public as $$
declare v_row public.user_diamonds;
begin
  if p_user_id is null or p_user_id <> auth.uid() then return null; end if;
  select * into v_row from public.user_diamonds where user_id = p_user_id;
  if not found then
    insert into public.user_diamonds (user_id) values (p_user_id) returning * into v_row;
  end if;
  return v_row;
end $$;

-- 4.2 conversão de diamantes -> moeda real (desconta comissão de saque)
create or replace function public.convert_diamonds_to_currency(
  p_diamond_amount bigint,
  p_rate decimal default null
) returns decimal(10,2)
language plpgsql stable security definer set search_path = public as $$
declare
  v_rate decimal := coalesce(
    p_rate,
    nullif(public.get_platform_config('diamond_to_currency_rate'), '')::decimal,
    0.05
  );
  v_fee decimal := coalesce(
    nullif(public.get_platform_config('withdrawal_fee'), '')::decimal,
    0.05
  );
begin
  if p_diamond_amount is null or p_diamond_amount <= 0 then return 0; end if;
  return round(p_diamond_amount * v_rate * (1 - v_fee), 2);
end $$;

-- 4.3 debita moedas (interno)
create or replace function public.debit_coins(p_user_id uuid, p_amount bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  update public.user_coins
     set balance = balance - p_amount,
         total_spent = total_spent + p_amount,
         updated_at = now()
   where user_id = p_user_id and balance >= p_amount;
  if not found then raise exception 'insufficient_coins'; end if;
end $$;

-- 4.4 credita diamantes (interno)
create or replace function public.credit_diamonds(p_user_id uuid, p_amount int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  insert into public.user_diamonds (user_id, balance, total_earned)
  values (p_user_id, p_amount, p_amount)
  on conflict (user_id) do update
    set balance = public.user_diamonds.balance + excluded.balance,
        total_earned = public.user_diamonds.total_earned + excluded.total_earned,
        updated_at = now();
end $$;

-- 4.5 ENVIA PRESENTE (peça central da economia)
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
  perform public.credit_diamonds(p_receiver_id, v_diamonds);

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

-- 4.6 INICIA BATALHA (host = chamador)
create or replace function public.start_battle(
  p_guest_id uuid,
  p_duration int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_host uuid := auth.uid();
  v_duration int := coalesce(p_duration,
    nullif(public.get_platform_config('battle_default_duration'), '')::int, 300);
  v_battle_id uuid;
begin
  if v_host is null then raise exception 'not_authenticated'; end if;
  if p_guest_id is null then raise exception 'guest_required'; end if;
  if p_guest_id = v_host then raise exception 'cannot_battle_self'; end if;

  if not exists (select 1 from public.profiles where id = p_guest_id) then
    raise exception 'guest_not_found';
  end if;

  if exists (select 1 from public.battles
              where status = 'live' and (host_id = v_host or guest_id = v_host)) then
    raise exception 'already_in_battle';
  end if;

  insert into public.battles (host_id, guest_id, status, actual_start, duration_seconds)
  values (v_host, p_guest_id, 'live', now(), v_duration)
  returning id into v_battle_id;

  return v_battle_id;
end $$;

-- 4.7 ENCERRA BATALHA (apenas host/guest)
create or replace function public.end_battle(p_battle_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_battle public.battles%rowtype;
  v_winner uuid;
begin
  select * into v_battle from public.battles where id = p_battle_id for update;
  if not found then raise exception 'battle_not_found'; end if;
  if auth.uid() not in (v_battle.host_id, v_battle.guest_id) then
    raise exception 'not_a_participant';
  end if;
  if v_battle.status <> 'live' then raise exception 'battle_not_live'; end if;

  if v_battle.host_score > v_battle.guest_score then
    v_winner := v_battle.host_id;
  elsif v_battle.guest_score > v_battle.host_score then
    v_winner := v_battle.guest_id;
  else
    v_winner := null;
  end if;

  update public.battles
     set status = 'ended',
         actual_end = now(),
         winner_id = v_winner
   where id = p_battle_id;

  return v_winner;
end $$;

-- 4.8 SOLICITA EXTENSÃO (máx. de extensões configurável)
create or replace function public.extend_battle(p_battle_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_battle public.battles%rowtype;
  v_max int := coalesce(
    nullif(public.get_platform_config('max_extensions'), '')::int, 3);
  v_seconds int := coalesce(
    nullif(public.get_platform_config('extension_seconds'), '')::int, 60);
  v_ext_id uuid;
begin
  select * into v_battle from public.battles where id = p_battle_id for update;
  if not found then raise exception 'battle_not_found'; end if;
  if auth.uid() not in (v_battle.host_id, v_battle.guest_id) then
    raise exception 'not_a_participant';
  end if;
  if v_battle.status <> 'live' then raise exception 'battle_not_live'; end if;
  if v_battle.extension_count >= v_max then raise exception 'max_extensions_reached'; end if;

  insert into public.battle_extensions (battle_id, requested_by, extra_seconds)
  values (p_battle_id, auth.uid(), v_seconds)
  returning id into v_ext_id;

  update public.battles set extension_count = extension_count + 1 where id = p_battle_id;

  return v_ext_id;
end $$;

-- 4.9 APROVA/REJEITA EXTENSÃO (o outro participante)
create or replace function public.approve_battle_extension(
  p_extension_id uuid,
  p_approve boolean default true
) returns public.battle_extensions
language plpgsql security definer set search_path = public as $$
declare
  v_ext public.battle_extensions%rowtype;
  v_battle public.battles%rowtype;
begin
  select * into v_ext from public.battle_extensions where id = p_extension_id for update;
  if not found then raise exception 'extension_not_found'; end if;
  if v_ext.status <> 'requested' then raise exception 'extension_already_processed'; end if;

  select * into v_battle from public.battles where id = v_ext.battle_id for update;
  if not found then raise exception 'battle_not_found'; end if;
  if auth.uid() not in (v_battle.host_id, v_battle.guest_id) then
    raise exception 'not_a_participant';
  end if;
  if v_ext.requested_by = auth.uid() then raise exception 'cannot_approve_own_request'; end if;

  if p_approve then
    update public.battles
       set duration_seconds = duration_seconds + v_ext.extra_seconds
     where id = v_battle.id;
  end if;

  update public.battle_extensions
     set status = case when p_approve then 'approved' else 'rejected' end,
         approved_by = auth.uid(),
         updated_at = now()
   where id = p_extension_id
   returning * into v_ext;

  return v_ext;
end $$;

-- 4.10 RANKING DE ESPECTADORES DA BATALHA
create or replace function public.get_battle_leaderboard(p_battle_id uuid)
returns setof public.battle_participants
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select * from public.battle_participants
     where battle_id = p_battle_id
     order by total_coins_spent desc, gift_count desc
     limit 25;
end $$;

-- 4.11 PEDIDO DE COMPRA DE MOEDAS (cria ordem pendente)
create or replace function public.create_coin_purchase_order(
  p_amount_coins int,
  p_price decimal,
  p_currency text default 'BRL',
  p_gateway text default 'stripe'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_order_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_amount_coins is null or p_amount_coins <= 0 then
    raise exception 'invalid_amount';
  end if;
  -- apenas maiores de 18 podem comprar moedas
  if not public.is_adult((select birth_date from public.profiles where id = auth.uid())) then
    if (select birth_date from public.profiles where id = auth.uid()) is not null then
      raise exception 'underage_purchase_blocked';
    end if;
  end if;

  insert into public.coin_purchase_orders (user_id, amount_coins, price, currency, payment_gateway)
  values (auth.uid(), p_amount_coins, p_price, p_currency, p_gateway)
  returning id into v_order_id;

  return v_order_id;
end $$;

-- 4.12 CONFIRMA COMPRA (apenas service_role, chamado pela edge function)
create or replace function public.confirm_coin_purchase(
  p_order_id uuid,
  p_gateway_transaction_id text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order public.coin_purchase_orders%rowtype;
begin
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select * into v_order from public.coin_purchase_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'pending' then raise exception 'order_already_processed'; end if;

  update public.coin_purchase_orders
     set status = 'paid',
         gateway_transaction_id = coalesce(p_gateway_transaction_id, gateway_transaction_id),
         paid_at = now()
   where id = p_order_id;

  insert into public.user_coins (user_id, balance, total_purchased)
  values (v_order.user_id, v_order.amount_coins, v_order.amount_coins)
  on conflict (user_id) do update
    set balance = public.user_coins.balance + excluded.balance,
        total_purchased = public.user_coins.total_purchased + excluded.total_purchased,
        updated_at = now();
end $$;

-- 4.13 SOLICITA SAQUE DE DIAMANTES
create or replace function public.process_withdrawal(
  p_diamond_amount bigint,
  p_method text default 'pix',
  p_details jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_min bigint := coalesce(
    nullif(public.get_platform_config('min_withdrawal_diamonds'), '')::bigint, 1000);
  v_rate decimal := coalesce(
    nullif(public.get_platform_config('diamond_to_currency_rate'), '')::decimal, 0.05);
  v_request_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_diamond_amount is null or p_diamond_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_diamond_amount < v_min then raise exception 'below_minimum_withdrawal'; end if;

  update public.user_diamonds
     set balance = balance - p_diamond_amount,
         pending_withdrawal = pending_withdrawal + p_diamond_amount,
         updated_at = now()
   where user_id = v_user and balance >= p_diamond_amount;
  if not found then raise exception 'insufficient_diamonds'; end if;

  insert into public.withdrawal_requests (
    user_id, diamond_amount, conversion_rate, payout_amount, payment_method, payment_details
  ) values (
    v_user, p_diamond_amount, v_rate,
    public.convert_diamonds_to_currency(p_diamond_amount, v_rate),
    p_method, p_details
  ) returning id into v_request_id;

  return v_request_id;
end $$;

-- -----------------------------------------------------------------------------
-- 5. RLS POLICIES
-- -----------------------------------------------------------------------------

alter table public.platform_config enable row level security;
alter table public.gifts_catalog enable row level security;
alter table public.user_coins enable row level security;
alter table public.user_diamonds enable row level security;
alter table public.battles enable row level security;
alter table public.battle_participants enable row level security;
alter table public.gift_transactions enable row level security;
alter table public.battle_extensions enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.coin_purchase_orders enable row level security;

-- platform_config: somente leitura (escrita por admin/console)
drop policy if exists "platform_config_public_read" on public.platform_config;
create policy "platform_config_public_read" on public.platform_config
  for select using (true);

-- gifts_catalog: leitura pública, escrita só admin
drop policy if exists "gifts_catalog_read" on public.gifts_catalog;
create policy "gifts_catalog_read" on public.gifts_catalog
  for select using (true);

drop policy if exists "gifts_catalog_admin_write" on public.gifts_catalog;
create policy "gifts_catalog_admin_write" on public.gifts_catalog
  for all using (
    coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  ) with check (
    coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  );

-- user_coins: somente leitura prórpria; escrita só via função (definer)
drop policy if exists "user_coins_select_own" on public.user_coins;
create policy "user_coins_select_own" on public.user_coins
  for select using (auth.uid() = user_id);

drop policy if exists "user_coins_update_admin" on public.user_coins;
create policy "user_coins_update_admin" on public.user_coins
  for update using (
    coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  );

-- user_diamonds: idem
drop policy if exists "user_diamonds_select_own" on public.user_diamonds;
create policy "user_diamonds_select_own" on public.user_diamonds
  for select using (auth.uid() = user_id);

drop policy if exists "user_diamonds_update_admin" on public.user_diamonds;
create policy "user_diamonds_update_admin" on public.user_diamonds
  for update using (
    coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  );

-- battles: leitura autenticada, criação = host, update = participantes/admin
drop policy if exists "battles_select" on public.battles;
create policy "battles_select" on public.battles
  for select to authenticated using (true);

drop policy if exists "battles_insert_host" on public.battles;
create policy "battles_insert_host" on public.battles
  for insert to authenticated
  with check (auth.uid() = host_id);

drop policy if exists "battles_update_participants" on public.battles;
create policy "battles_update_participants" on public.battles
  for update to authenticated
  using (
    auth.uid() in (host_id, guest_id) or
    coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  );

-- battle_participants: leitura autenticada; inserção via função
drop policy if exists "battle_participants_select" on public.battle_participants;
create policy "battle_participants_select" on public.battle_participants
  for select to authenticated using (true);

-- gift_transactions: leitura própria (sender/receiver/admin)
drop policy if exists "gift_transactions_select" on public.gift_transactions;
create policy "gift_transactions_select" on public.gift_transactions
  for select to authenticated
  using (
    auth.uid() in (sender_id, receiver_id) or
    coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  );

-- battle_extensions: leitura de participantes; escreve só via função
drop policy if exists "battle_extensions_select" on public.battle_extensions;
create policy "battle_extensions_select" on public.battle_extensions
  for select to authenticated using (true);

-- withdrawal_requests: próprio usuário; update admin
drop policy if exists "withdrawal_requests_select_own" on public.withdrawal_requests;
create policy "withdrawal_requests_select_own" on public.withdrawal_requests
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "withdrawal_requests_insert_own" on public.withdrawal_requests;
create policy "withdrawal_requests_insert_own" on public.withdrawal_requests
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "withdrawal_requests_update_admin" on public.withdrawal_requests;
create policy "withdrawal_requests_update_admin" on public.withdrawal_requests
  for update using (
    coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  );

-- coin_purchase_orders: próprio usuário; update admin
drop policy if exists "coin_purchase_orders_select_own" on public.coin_purchase_orders;
create policy "coin_purchase_orders_select_own" on public.coin_purchase_orders
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "coin_purchase_orders_insert_own" on public.coin_purchase_orders;
create policy "coin_purchase_orders_insert_own" on public.coin_purchase_orders
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "coin_purchase_orders_update_admin" on public.coin_purchase_orders;
create policy "coin_purchase_orders_update_admin" on public.coin_purchase_orders
  for update using (
    coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  );

-- -----------------------------------------------------------------------------
-- 6. REALTIME (publication) para sincronização ao vivo
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'battles') then
    alter publication supabase_realtime add table public.battles;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'battle_participants') then
    alter publication supabase_realtime add table public.battle_participants;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'gift_transactions') then
    alter publication supabase_realtime add table public.gift_transactions;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'battle_extensions') then
    alter publication supabase_realtime add table public.battle_extensions;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. SEED DO CATÁLOGO DE PRESENTES
-- -----------------------------------------------------------------------------
insert into public.gifts_catalog (name, emoji, description, coin_cost, diamond_value, is_animated, is_active, sort_order) values
  ('Rosa', '🌹', 'Um clássico para apoiar seu criador favorito', 1, 1, false, true, 1),
  ('Coração', '❤️', 'Demonstração de carinho instantânea', 5, 3, false, true, 2),
  ('Fogo', '🔥', 'Esquenta qualquer batalha', 10, 6, false, true, 3),
  ('Leão', '🦁', 'Um presente digno de rei', 25, 15, true, true, 4),
  ('Castelo', '🏰', 'Estrutura uma virada épica', 50, 30, true, true, 5),
  ('Foguete', '🚀', 'Impulsiona a pontuação às alturas', 100, 60, true, true, 6),
  ('Coroa', '👑', 'Coroa o campeão da batalha', 250, 150, true, true, 7),
  ('Diamante', '💎', 'O presente mais raro do UndoinG', 500, 300, true, true, 8)
on conflict do nothing;