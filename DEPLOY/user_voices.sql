-- =============================================================================
-- user_voices: voz clonada de cada usuário na ElevenLabs (dublagem com a
-- própria voz do usuário). Criado em 2026-08-16.
-- =============================================================================

create table if not exists public.user_voices (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  voice_id   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_voices enable row level security;

-- Dona da voz pode ver o próprio registro (a função serve os áudios via backend)
drop policy if exists "user_voices_select_own" on public.user_voices;
create policy "user_voices_select_own"
  on public.user_voices for select
  using (auth.uid() = user_id);

-- A criação/manutenção é feita pelo backend (service role), sem inserção direta do cliente.
-- (Sem política de insert/update/delete para usuários comuns.)
