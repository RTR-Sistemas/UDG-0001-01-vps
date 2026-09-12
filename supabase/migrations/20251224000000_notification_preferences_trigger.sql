-- =============================================================================
-- File: supabase/migrations/20251224000000_notification_preferences_trigger.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- Ensure every profile has a row in notification_preferences

create or replace function public.ensure_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_profiles_notification_prefs on public.profiles;

create trigger trg_profiles_notification_prefs
after insert on public.profiles
for each row execute function public.ensure_notification_preferences();
