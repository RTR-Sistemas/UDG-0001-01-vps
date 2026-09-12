-- =============================================================================
-- File: supabase/migrations/20260113193000_update_arena_stats_and_process_votes.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Atualiza contagem da Arena (aprovados/rejeitados/em votação) e evita deletar posts rejeitados.

-- 1) Garantir que exista uma linha em arena_stats
create or replace function public.ensure_arena_stats_row()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  select id into rid from public.arena_stats order by created_at asc limit 1;
  if rid is null then
    insert into public.arena_stats default values returning id into rid;
  end if;
  return rid;
end;
$$;

-- 2) Função utilitária para ler stats (conta "em votação" diretamente de posts)
create or replace function public.get_arena_stats()
returns table(
  total_approved integer,
  total_rejected integer,
  total_in_voting integer,
  total_processed integer,
  last_updated timestamptz
)
language sql
security definer
set search_path = public
as $$
  with base as (
    select
      coalesce(total_approved, 0)::int as total_approved,
      coalesce(total_rejected, 0)::int as total_rejected,
      coalesce(total_processed, 0)::int as total_processed,
      last_updated
    from public.arena_stats
    order by created_at asc
    limit 1
  )
  select
    b.total_approved,
    b.total_rejected,
    (
      select count(*)::int
      from public.posts
      where voting_period_active = true
        and coalesce(is_community_approved, false) = false
    ) as total_in_voting,
    b.total_processed,
    b.last_updated
  from base b;
$$;

-- 3) Processar posts expirados (encerra votação, decide aprovado/rejeitado, atualiza arena_stats)
create or replace function public.process_expired_posts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  v_approved int := 0;
  v_rejected int := 0;
  v_processed int := 0;
  v_in_voting int := 0;
begin
  rid := public.ensure_arena_stats_row();

  with expired as (
    select
      p.id,
      coalesce(sum(case when pv.vote_type = 'heart' then 1 else 0 end), 0)::int as hearts,
      coalesce(sum(case when pv.vote_type = 'bomb' then 1 else 0 end), 0)::int as bombs
    from public.posts p
    left join public.post_votes pv on pv.post_id = p.id
    where p.voting_period_active = true
      and p.voting_ends_at is not null
      and p.voting_ends_at <= now()
      and coalesce(p.is_community_approved, false) = false
    group by p.id
  ), decisions as (
    select
      id,
      hearts,
      bombs,
      (hearts >= bombs) as approved
    from expired
  ), upd as (
    update public.posts p
    set
      voting_period_active = false,
      is_community_approved = d.approved,
      updated_at = now()
    from decisions d
    where p.id = d.id
    returning d.approved
  )
  select
    count(*) filter (where approved) ::int,
    count(*) filter (where not approved) ::int
  into v_approved, v_rejected
  from upd;

  v_processed := coalesce(v_approved,0) + coalesce(v_rejected,0);

  select count(*)::int into v_in_voting
  from public.posts
  where voting_period_active = true
    and coalesce(is_community_approved, false) = false;

  update public.arena_stats
  set
    total_approved = coalesce(total_approved,0) + coalesce(v_approved,0),
    total_rejected = coalesce(total_rejected,0) + coalesce(v_rejected,0),
    total_processed = coalesce(total_processed,0) + coalesce(v_processed,0),
    total_in_voting = v_in_voting,
    last_updated = now()
  where id = rid;

  return jsonb_build_object(
    'processed', v_processed,
    'approved', v_approved,
    'rejected', v_rejected,
    'in_voting', v_in_voting,
    'at', now()
  );
end;
$$;

-- 4) RLS: permitir leitura de arena_stats para o app (atualização fica via SECURITY DEFINER)
-- (se já existir, o DO ignora o erro de duplicidade)
alter table public.arena_stats enable row level security;

do $$
begin
  begin
    create policy "read_arena_stats" on public.arena_stats
      for select
      using (true);
  exception when duplicate_object then
    null;
  end;
end $$;
