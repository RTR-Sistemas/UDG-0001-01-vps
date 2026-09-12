-- =============================================================================
-- undoing_battle_invites_flow
-- Fluxo de convite de batalha: start_battle cria 'scheduled' (convite),
-- guest aceita/recusa -> 'live'/'canceled'. Host pode cancelar.
-- =============================================================================

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
              where status in ('scheduled', 'live')
                and (host_id = v_host or guest_id = v_host)) then
    raise exception 'already_in_battle';
  end if;

  insert into public.battles (host_id, guest_id, status, scheduled_start, duration_seconds)
  values (v_host, p_guest_id, 'scheduled', now(), v_duration)
  returning id into v_battle_id;

  return v_battle_id;
end $$;

-- Aceita convite (apenas o guest)
create or replace function public.accept_battle(p_battle_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_battle public.battles%rowtype;
begin
  select * into v_battle from public.battles where id = p_battle_id for update;
  if not found then raise exception 'battle_not_found'; end if;
  if v_battle.guest_id <> auth.uid() then raise exception 'not_the_guest'; end if;
  if v_battle.status <> 'scheduled' then raise exception 'battle_not_invite'; end if;

  update public.battles
     set status = 'live',
         actual_start = now(),
         updated_at = now()
   where id = p_battle_id;

  return p_battle_id;
end $$;

-- Recusa convite (apenas o guest)
create or replace function public.decline_battle(p_battle_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_battle public.battles%rowtype;
begin
  select * into v_battle from public.battles where id = p_battle_id for update;
  if not found then raise exception 'battle_not_found'; end if;
  if v_battle.guest_id <> auth.uid() then raise exception 'not_the_guest'; end if;
  if v_battle.status <> 'scheduled' then raise exception 'battle_not_invite'; end if;

  update public.battles set status = 'canceled', updated_at = now() where id = p_battle_id;
end $$;

-- Cancela convite (apenas o host, enquanto scheduled)
create or replace function public.cancel_battle(p_battle_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_battle public.battles%rowtype;
begin
  select * into v_battle from public.battles where id = p_battle_id for update;
  if not found then raise exception 'battle_not_found'; end if;
  if v_battle.host_id <> auth.uid() then raise exception 'not_the_host'; end if;
  if v_battle.status <> 'scheduled' then raise exception 'battle_not_invite'; end if;

  update public.battles set status = 'canceled', updated_at = now() where id = p_battle_id;
end $$;