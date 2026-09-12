-- =============================================================
-- Mesh-UDG security upgrade: PQ end-to-end encryption
-- - mesh_keys: public keys (ML-KEM-768) for E2EE
-- - mesh_relay_messages: opaque ciphertext relay queue
-- - relay_mesh_messages(): delivers ciphertext into messages
--   WITHOUT ever decrypting (gateway is a blind carrier)
-- =============================================================

-- 1. Public keys registry
create table if not exists public.mesh_keys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  public_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.mesh_keys enable row level security;

drop policy if exists "mesh_keys_select" on public.mesh_keys;
create policy "mesh_keys_select" on public.mesh_keys
  for select using (auth.role() = 'authenticated');

drop policy if exists "mesh_keys_insert" on public.mesh_keys;
create policy "mesh_keys_insert" on public.mesh_keys
  for insert with check (auth.uid() = user_id);

drop policy if exists "mesh_keys_update" on public.mesh_keys;
create policy "mesh_keys_update" on public.mesh_keys
  for update using (auth.uid() = user_id);

-- 2. Opaque relay queue (ciphertext only, no plaintext ever)
create table if not exists public.mesh_relay_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  encrypted_content text not null,
  size_bytes integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'delivered')),
  gateway_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists mesh_relay_pending_idx
  on public.mesh_relay_messages (status, receiver_id, gateway_id);

alter table public.mesh_relay_messages enable row level security;

drop policy if exists "mesh_relay_insert" on public.mesh_relay_messages;
create policy "mesh_relay_insert" on public.mesh_relay_messages
  for insert with check (
    auth.uid() is not null
    and (auth.uid() = sender_id or auth.uid() = gateway_id)
  );

drop policy if exists "mesh_relay_select" on public.mesh_relay_messages;
create policy "mesh_relay_select" on public.mesh_relay_messages
  for select using (
    auth.uid() = sender_id or auth.uid() = receiver_id or auth.uid() = gateway_id
  );

-- 3. Relay delivery: moves ciphertext into messages table.
--    SECURITY DEFINER runs with the owner privileges (bypasses RLS),
--    but NEVER decrypts: it only validates the opaque format and the
--    destination conversation. The gateway cannot read content.
create or replace function public.relay_mesh_messages(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  rec record;
  delivered integer := 0;
begin
  foreach rid in array p_ids loop
    select *
      into rec
      from public.mesh_relay_messages
      where id = rid and status = 'pending';
    if not found then
      continue;
    end if;

    -- Only transport opaque post-quantum ciphertext; reject anything else.
    if rec.encrypted_content is null
       or left(rec.encrypted_content, 4) <> 'pq1.' then
      continue;
    end if;

    if rec.conversation_id is null then
      continue;
    end if;

    insert into public.messages (conversation_id, user_id, content, via_mesh, created_at)
    values (rec.conversation_id, rec.sender_id, rec.encrypted_content, true, coalesce(rec.created_at, now()))
    on conflict do nothing;

    update public.mesh_relay_messages
       set status = 'delivered', delivered_at = now()
     where id = rid;

    delivered := delivered + 1;
  end loop;

  return delivered;
end;
$$;

revoke all on function public.relay_mesh_messages(uuid[]) from public;
grant execute on function public.relay_mesh_messages(uuid[]) to authenticated;
