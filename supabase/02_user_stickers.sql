-- =============================================================================
-- File: supabase/02_user_stickers.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- 02_user_stickers.sql
-- Permite que cada usuário armazene suas figurinhas personalizadas.

create table if not exists public.user_stickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sticker_url text not null,
  created_at timestamptz not null default now()
);

alter table public.user_stickers enable row level security;

-- Cada usuário só enxerga suas próprias figurinhas
create policy if not exists "user_stickers_select_own"
  on public.user_stickers
  for select
  using (auth.uid() = user_id);

-- Cada usuário só pode inserir figurinhas para si
create policy if not exists "user_stickers_insert_own"
  on public.user_stickers
  for insert
  with check (auth.uid() = user_id);

-- Cada usuário só pode apagar suas próprias figurinhas
create policy if not exists "user_stickers_delete_own"
  on public.user_stickers
  for delete
  using (auth.uid() = user_id);

-- (Opcional) permitir update do próprio registro
create policy if not exists "user_stickers_update_own"
  on public.user_stickers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
