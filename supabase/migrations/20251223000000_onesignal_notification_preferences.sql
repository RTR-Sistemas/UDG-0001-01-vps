-- =============================================================================
-- File: supabase/migrations/20251223000000_onesignal_notification_preferences.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- OneSignal push notification preferences per user

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  messages boolean not null default true,
  attention_calls boolean not null default true,
  mentions boolean not null default true,
  friend_requests boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.notification_preferences enable row level security;

-- Users can read their own preferences
create policy "Users can view own notification prefs"
  on public.notification_preferences
  for select
  using (auth.uid() = user_id);

-- Users can insert/update their own preferences
create policy "Users can upsert own notification prefs"
  on public.notification_preferences
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification prefs"
  on public.notification_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh
create or replace function public.set_notification_prefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_prefs_updated_at on public.notification_preferences;
create trigger trg_notification_prefs_updated_at
before update on public.notification_preferences
for each row
execute function public.set_notification_prefs_updated_at();
