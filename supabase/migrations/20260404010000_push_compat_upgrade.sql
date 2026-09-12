begin;

create extension if not exists pgcrypto;

alter table public.push_subscriptions
  add column if not exists subscription_json jsonb,
  add column if not exists user_agent text,
  add column if not exists device_type text,
  add column if not exists platform text,
  add column if not exists app_context text not null default 'web',
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamp with time zone not null default now(),
  add column if not exists last_success_at timestamp with time zone,
  add column if not exists last_failure_at timestamp with time zone,
  add column if not exists failure_count integer not null default 0,
  add column if not exists disabled_at timestamp with time zone,
  add column if not exists disabled_reason text,
  add column if not exists updated_at timestamp with time zone not null default now();

create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions (user_id);
create index if not exists idx_push_subscriptions_user_active on public.push_subscriptions (user_id, is_active);

alter table public.notification_preferences
  add column if not exists comment_replies boolean not null default true,
  add column if not exists relationships boolean not null default true,
  add column if not exists communities boolean not null default true,
  add column if not exists system_alerts boolean not null default true,
  add column if not exists sound_enabled boolean not null default true,
  add column if not exists badge_enabled boolean not null default true;

insert into public.notification_preferences (user_id)
select p.id
from public.profiles p
left join public.notification_preferences np on np.user_id = p.id
where np.user_id is null;

commit;
