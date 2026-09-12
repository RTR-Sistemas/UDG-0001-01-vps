-- =============================================================================
-- File: supabase/attention_migration.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Attention feature migration for this schema
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.attention_calls (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  message text null,
  viewed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists attention_calls_receiver_idx on public.attention_calls(receiver_id);
create index if not exists attention_calls_created_idx on public.attention_calls(created_at desc);

create table if not exists public.attention_silence_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  silenced_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, sender_id)
);

create table if not exists public.attention_call_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_call_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.attention_calls enable row level security;
alter table public.attention_silence_settings enable row level security;
alter table public.attention_call_limits enable row level security;

drop policy if exists "insert_own_attentions" on public.attention_calls;
create policy "insert_own_attentions" on public.attention_calls
  for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "select_my_related_attentions" on public.attention_calls;
create policy "select_my_related_attentions" on public.attention_calls
  for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "update_viewed_by_receiver" on public.attention_calls;
create policy "update_viewed_by_receiver" on public.attention_calls
  for update to authenticated
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());
