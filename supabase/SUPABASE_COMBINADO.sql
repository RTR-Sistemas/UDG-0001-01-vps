-- =============================================================================
-- File: supabase/SUPABASE_COMBINADO.sql
-- Purpose: This SQL file is part of the project's Supabase schema/migrations.
-- Notes:
--  - This file was documented automatically on 2026-01-25.
--  - Review before running in production.
-- =============================================================================

-- SISTEMAX2 - SQL COMBINADO
-- Ordem recomendada: execute este arquivo inteiro no SQL Editor do Supabase.
-- Ele inclui: notification_preferences + PACK2 (perfil extra, privacidade, visits, relacionamento, familia).

-- Garantia: cria profile_visits se nao existir (o resto usa IF NOT EXISTS).
create table if not exists public.profile_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.profiles(id) on delete cascade,
  visited_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

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

-- SISTEMAX2 - PACK 2 (SUPABASE)
-- Migracoes para:
-- 1) Toggle "Quem me visitou" (se desligado: nao registra, nao exibe, nao pode ser visto)
-- 2) Campos extras de Perfil + visibilidade Publico/Privado por campo
-- 3) Pedidos de Relacionamento e Arvore Genealogica com notificacoes no feed de News
--
-- Observacao: este SQL foi escrito para ser colado e executado no SQL Editor do Supabase.

-- -----------------------------------------------------------------------------
-- 0) Utils
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1) PERFIL: campos extras + visibilidade
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sexual_orientation text,
  ADD COLUMN IF NOT EXISTS sexual_orientation_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS gender_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS favorite_team text,
  ADD COLUMN IF NOT EXISTS favorite_team_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS political_party text,
  ADD COLUMN IF NOT EXISTS political_party_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relationship_status text,
  ADD COLUMN IF NOT EXISTS relationship_status_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relationship_partner_id uuid;

-- FK auto-referenciada (parceiro do relacionamento)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_relationship_partner_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_relationship_partner_id_fkey
      FOREIGN KEY (relationship_partner_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Toggle "Quem me visitou" (controle unico)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visits_enabled boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- 2) QUEM ME VISITOU (RLS forte)
-- -----------------------------------------------------------------------------

ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;

-- Leitura: somente o dono do perfil (visited_id) e somente se ele ativou o toggle.
DROP POLICY IF EXISTS profile_visits_select_own_last_30_days ON public.profile_visits;
CREATE POLICY profile_visits_select_own_last_30_days
ON public.profile_visits
FOR SELECT
USING (
  visited_id = auth.uid()
  AND created_at >= (now() - interval '30 days')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_visits_enabled = true
  )
);

-- Insercao: somente o visitante (visitor_id) e somente se AMBOS ativaram.
DROP POLICY IF EXISTS profile_visits_insert_when_both_enabled ON public.profile_visits;
CREATE POLICY profile_visits_insert_when_both_enabled
ON public.profile_visits
FOR INSERT
WITH CHECK (
  visitor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.profile_visits_enabled = true
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = visited_id AND p.profile_visits_enabled = true
  )
);

-- (Opcional) Delete: o dono do perfil pode limpar os registros.
DROP POLICY IF EXISTS profile_visits_delete_own ON public.profile_visits;
CREATE POLICY profile_visits_delete_own
ON public.profile_visits
FOR DELETE
USING (
  visited_id = auth.uid()
);

-- Indice para consultas rapidas
CREATE INDEX IF NOT EXISTS idx_profile_visits_visited_created
ON public.profile_visits (visited_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3) RELACIONAMENTO: requests + notificacoes
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.relationship_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Ex.: 'solteiro', 'namorando', 'noivo', 'casado'
  desired_status text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relationship_requests_receiver_status
ON public.relationship_requests (receiver_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_relationship_requests_updated_at ON public.relationship_requests;
CREATE TRIGGER trg_relationship_requests_updated_at
BEFORE UPDATE ON public.relationship_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.relationship_requests ENABLE ROW LEVEL SECURITY;

-- Ver: remetente ou destinatario
DROP POLICY IF EXISTS relationship_requests_select_involved ON public.relationship_requests;
CREATE POLICY relationship_requests_select_involved
ON public.relationship_requests
FOR SELECT
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Criar: somente remetente
DROP POLICY IF EXISTS relationship_requests_insert_sender ON public.relationship_requests;
CREATE POLICY relationship_requests_insert_sender
ON public.relationship_requests
FOR INSERT
WITH CHECK (sender_id = auth.uid());

-- Atualizar: remetente pode cancelar; destinatario pode aceitar/rejeitar
DROP POLICY IF EXISTS relationship_requests_update_involved ON public.relationship_requests;
CREATE POLICY relationship_requests_update_involved
ON public.relationship_requests
FOR UPDATE
USING (sender_id = auth.uid() OR receiver_id = auth.uid())
WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid());

-- RPC: responde pedido de relacionamento e aplica em ambos os perfis
CREATE OR REPLACE FUNCTION public.respond_relationship_request(
  p_request_id uuid,
  p_response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
BEGIN
  IF p_response NOT IN ('accepted','rejected') THEN
    RAISE EXCEPTION 'Invalid response: %', p_response;
  END IF;

  SELECT *
  INTO v_req
  FROM public.relationship_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.receiver_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_req.status <> 'pending' THEN
    -- Idempotente: se ja foi respondido, nao faz nada
    RETURN;
  END IF;

  UPDATE public.relationship_requests
  SET status = p_response,
      updated_at = now()
  WHERE id = p_request_id;

  IF p_response = 'accepted' THEN
    UPDATE public.profiles
    SET relationship_status = v_req.desired_status,
        relationship_partner_id = CASE
          WHEN id = v_req.sender_id THEN v_req.receiver_id
          ELSE v_req.sender_id
        END,
        updated_at = now()
    WHERE id IN (v_req.sender_id, v_req.receiver_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_relationship_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_relationship_request(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) ARVORE GENEALOGICA: requests + notificacoes
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.family_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Ex.: 'pai', 'mae', 'filho', 'filha', 'irmao', 'irma', 'avo', 'avoh'
  relation_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_requests_receiver_status
ON public.family_requests (receiver_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_family_requests_updated_at ON public.family_requests;
CREATE TRIGGER trg_family_requests_updated_at
BEFORE UPDATE ON public.family_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.family_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_requests_select_involved ON public.family_requests;
CREATE POLICY family_requests_select_involved
ON public.family_requests
FOR SELECT
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS family_requests_insert_sender ON public.family_requests;
CREATE POLICY family_requests_insert_sender
ON public.family_requests
FOR INSERT
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS family_requests_update_involved ON public.family_requests;
CREATE POLICY family_requests_update_involved
ON public.family_requests
FOR UPDATE
USING (sender_id = auth.uid() OR receiver_id = auth.uid())
WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 5) TRIGGERS: gerar notificacoes em public.notifications
-- -----------------------------------------------------------------------------

-- Relationship: notify receiver on insert (pending)
CREATE OR REPLACE FUNCTION public.notify_relationship_request_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (
      type,
      user_id,
      target_user_id,
      title,
      message,
      data
    ) VALUES (
      'relationship_request',
      NEW.receiver_id,
      NEW.sender_id,
      'Pedido de relacionamento',
      'Voce recebeu um pedido de relacionamento. Aceita?',
      jsonb_build_object(
        'request_id', NEW.id,
        'sender_id', NEW.sender_id,
        'desired_status', NEW.desired_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_relationship_request_insert ON public.relationship_requests;
CREATE TRIGGER trg_notify_relationship_request_insert
AFTER INSERT ON public.relationship_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_relationship_request_insert();

-- Relationship: notify sender when receiver accepts/rejects
CREATE OR REPLACE FUNCTION public.notify_relationship_request_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('accepted','rejected') THEN
    INSERT INTO public.notifications (
      type,
      user_id,
      target_user_id,
      title,
      message,
      data
    ) VALUES (
      'relationship_request_result',
      NEW.sender_id,
      NEW.receiver_id,
      'Resposta ao pedido de relacionamento',
      CASE WHEN NEW.status = 'accepted' THEN 'Seu pedido foi aceito.' ELSE 'Seu pedido foi recusado.' END,
      jsonb_build_object(
        'request_id', NEW.id,
        'receiver_id', NEW.receiver_id,
        'status', NEW.status,
        'desired_status', NEW.desired_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_relationship_request_update ON public.relationship_requests;
CREATE TRIGGER trg_notify_relationship_request_update
AFTER UPDATE OF status ON public.relationship_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_relationship_request_update();

-- Family: notify receiver on insert (pending)
CREATE OR REPLACE FUNCTION public.notify_family_request_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (
      type,
      user_id,
      target_user_id,
      title,
      message,
      data
    ) VALUES (
      'family_request',
      NEW.receiver_id,
      NEW.sender_id,
      'Convite para arvore genealogica',
      'Voce recebeu um convite para arvore genealogica. Aceita?',
      jsonb_build_object(
        'request_id', NEW.id,
        'sender_id', NEW.sender_id,
        'relation_type', NEW.relation_type
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_family_request_insert ON public.family_requests;
CREATE TRIGGER trg_notify_family_request_insert
AFTER INSERT ON public.family_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_family_request_insert();

-- Family: notify sender when receiver accepts/rejects
CREATE OR REPLACE FUNCTION public.notify_family_request_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('accepted','rejected') THEN
    INSERT INTO public.notifications (
      type,
      user_id,
      target_user_id,
      title,
      message,
      data
    ) VALUES (
      'family_request_result',
      NEW.sender_id,
      NEW.receiver_id,
      'Resposta ao convite da arvore',
      CASE WHEN NEW.status = 'accepted' THEN 'Seu convite foi aceito.' ELSE 'Seu convite foi recusado.' END,
      jsonb_build_object(
        'request_id', NEW.id,
        'receiver_id', NEW.receiver_id,
        'status', NEW.status,
        'relation_type', NEW.relation_type
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_family_request_update ON public.family_requests;
CREATE TRIGGER trg_notify_family_request_update
AFTER UPDATE OF status ON public.family_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_family_request_update();

-- -----------------------------------------------------------------------------
-- FIM PACK 2
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- FIGURINHAS PERSONALIZADAS (user_stickers)
-- -----------------------------------------------------------------------------

create table if not exists public.user_stickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sticker_url text not null,
  created_at timestamptz not null default now()
);

alter table public.user_stickers enable row level security;

create policy if not exists "user_stickers_select_own"
  on public.user_stickers
  for select
  using (auth.uid() = user_id);

create policy if not exists "user_stickers_insert_own"
  on public.user_stickers
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "user_stickers_delete_own"
  on public.user_stickers
  for delete
  using (auth.uid() = user_id);

create policy if not exists "user_stickers_update_own"
  on public.user_stickers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
