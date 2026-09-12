-- =============================================================================
-- File: supabase/00_notification_preferences.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Run this in Supabase SQL Editor (Project -> SQL Editor)
-- Creates the table used by the app to store per-user notification preferences.
-- Then reloads PostgREST schema cache.

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  messages boolean not null default true,
  mentions boolean not null default true,
  attention_calls boolean not null default true,
  friend_requests boolean not null default true,
  comments boolean not null default true,
  posts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.notification_preferences_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.notification_preferences_set_updated_at();

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can read their notification_preferences" on public.notification_preferences;
drop policy if exists "Users can insert their notification_preferences" on public.notification_preferences;
drop policy if exists "Users can update their notification_preferences" on public.notification_preferences;

create policy "Users can read their notification_preferences"
  on public.notification_preferences
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their notification_preferences"
  on public.notification_preferences
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their notification_preferences"
  on public.notification_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reload PostgREST schema cache so /rest/v1 sees the new table immediately.
notify pgrst, 'reload schema';
