/* ===========================================================================
   Tabela de erros do front-end. Criada em 06/09/2026.

   Rode uma vez no SQL Editor do Supabase (ou com supabase db push, se preferir
   mover este arquivo para supabase/migrations com um carimbo de tempo).

   Para que serve: sem isto, um erro em producao so aparece se o usuario mandar
   um print. Com isto, voce abre o Supabase e ve o que quebrou, onde e quantas
   vezes.
   =========================================================================== */

create table if not exists public.client_errors (
  id          bigserial primary key,
  criado_em   timestamptz not null default now(),
  tipo        text,
  mensagem    text not null,
  pilha       text,
  rota        text,
  build_id    text,
  user_agent  text,
  user_id     uuid references auth.users(id) on delete set null
);

comment on table public.client_errors is
  'Erros de front-end enviados pela funcao client-error. Nao contem conteudo de mensagem nem dado pessoal alem do id do usuario.';

create index if not exists client_errors_criado_em_idx on public.client_errors (criado_em desc);
create index if not exists client_errors_mensagem_idx  on public.client_errors (mensagem);

/* RLS ligado e SEM policy de leitura: so a service_role (as funcoes do
   servidor) e voce, pelo painel do Supabase, enxergam a tabela. Nenhum usuario
   do aplicativo consegue ler os erros de outro. */
alter table public.client_errors enable row level security;

/* Limpeza: erros com mais de 90 dias nao servem para nada.
   Se a extensao pg_cron estiver disponivel, agende:

     select cron.schedule('limpar-client-errors', '0 4 * * *',
       $$ delete from public.client_errors where criado_em < now() - interval '90 days' $$);
*/


/* ---------------------------------------------------------------------------
   CONSULTAS UTEIS NO DIA A DIA
   --------------------------------------------------------------------------- */

/* Os 20 erros mais frequentes das ultimas 24 horas: */
-- select mensagem, rota, count(*) as vezes, max(criado_em) as ultimo
--   from public.client_errors
--  where criado_em > now() - interval '24 hours'
--  group by mensagem, rota
--  order by vezes desc
--  limit 20;

/* Erros que apareceram so depois do ultimo deploy: */
-- select build_id, count(*) from public.client_errors
--  where criado_em > now() - interval '2 days'
--  group by build_id order by 2 desc;
