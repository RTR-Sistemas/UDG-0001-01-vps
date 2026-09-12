/* ===========================================================================
   UndoinG Admin - tabelas que o painel precisa
   Rode uma vez no SQL Editor do Supabase. E idempotente.

   Sao duas tabelas, e nenhuma delas e "burocracia":

     lgpd_requests  - o registro dos pedidos dos titulares. O art. 19 da LGPD da
                      15 dias para responder um pedido de acesso. Sem uma lista
                      com prazo, esse relogio corre sem ninguem ver.

     admin_audit    - copia no banco do que o painel registra em disco. O
                      arquivo local basta para o dia a dia; a copia no banco
                      sobrevive a formatacao do computador e permite mostrar a
                      trilha a um terceiro (advogado, ANPD) sem entregar a
                      maquina.
   =========================================================================== */


/* --------------------------------------------------------------------------
   1. Pedidos dos titulares (LGPD, art. 18)
   -------------------------------------------------------------------------- */

create table if not exists public.lgpd_requests (
  id           bigserial primary key,
  criado_em    timestamptz not null default now(),
  user_id      uuid references auth.users(id) on delete set null,
  tipo         text not null check (tipo in ('acesso','portabilidade','correcao','exclusao','revogacao')),
  status       text not null default 'aberto' check (status in ('aberto','em_analise','concluido','recusado')),
  observacao   text,
  resultado    text,
  prazo_em     timestamptz not null default (now() + interval '15 days'),
  concluido_em timestamptz
);

comment on table public.lgpd_requests is
  'Pedidos de titulares sob a LGPD. prazo_em e o limite legal de 15 dias do art. 19.';

create index if not exists lgpd_requests_status_idx on public.lgpd_requests (status, prazo_em);
create index if not exists lgpd_requests_user_idx   on public.lgpd_requests (user_id);

/* RLS ligado e sem policy: so a service_role (o painel) enxerga.
   Nenhum usuario do aplicativo pode ler os pedidos de outro. */
alter table public.lgpd_requests enable row level security;


/* --------------------------------------------------------------------------
   2. Trilha de auditoria administrativa
   -------------------------------------------------------------------------- */

create table if not exists public.admin_audit (
  id         bigserial primary key,
  em         timestamptz not null default now(),
  acao       text not null,
  alvo       text,
  motivo     text,
  detalhes   jsonb,
  origem     text default 'painel-local'
);

comment on table public.admin_audit is
  'O que a administracao fez: remocoes, banimentos, exclusoes de dados. Nunca apagar linhas daqui.';

create index if not exists admin_audit_em_idx   on public.admin_audit (em desc);
create index if not exists admin_audit_acao_idx on public.admin_audit (acao);

alter table public.admin_audit enable row level security;


/* --------------------------------------------------------------------------
   3. Colunas que o painel usa e podem nao existir ainda
   -------------------------------------------------------------------------- */

alter table public.profiles
  add column if not exists is_banned          boolean not null default false,
  add column if not exists is_adult_verified  boolean not null default false;

comment on column public.profiles.is_banned is
  'Conta banida por decisao de moderacao. O aplicativo deve recusar o login e ocultar o conteudo.';
comment on column public.profiles.is_adult_verified is
  'Verificacao 18+ concluida. Exigida pelo ECA Digital (Lei 15.211/2025): autodeclaracao nao basta.';

create index if not exists profiles_banidos_idx on public.profiles (id) where is_banned = true;


/* --------------------------------------------------------------------------
   4. Conferencia - todas as linhas devem vir com ok = true
   -------------------------------------------------------------------------- */

select 'lgpd_requests' as item,
       to_regclass('public.lgpd_requests') is not null as ok
union all
select 'admin_audit',
       to_regclass('public.admin_audit') is not null
union all
select 'profiles.is_banned',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='profiles' and column_name='is_banned')
union all
select 'profiles.is_adult_verified',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='profiles' and column_name='is_adult_verified');
