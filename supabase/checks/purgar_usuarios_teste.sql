/* ===========================================================================
   UndoinG - Expurgo das contas de teste do banco de PRODUCAO
   Criado em 06/09/2026.

   Por que isto existe:
     Cinquenta contas-bot foram criadas com o dominio @udgtest.com e uma senha
     conhecida, para simular movimento na plataforma. Elas entraram no banco
     por migracoes que rodavam em producao. Contas com senha conhecida em
     producao sao porta aberta; e cinquenta perfis falsos poluem o feed e as
     metricas no dia do lancamento.

   COMO USAR (nesta ordem, sem pressa):
     1. Rode o PASSO 1 e leia os numeros. Se o total surpreender, pare.
     2. Faca backup do banco.
     3. Rode o PASSO 2.
     4. Rode o PASSO 3 para confirmar que sobrou zero.

   O PASSO 2 esta dentro de uma transacao ABERTA de proposito: leia o que ele
   informou e so entao escreva COMMIT (ou ROLLBACK para desistir).
   =========================================================================== */


/* --------------------------------------------------------------------------
   PASSO 1 - Diagnostico. Nao apaga nada.
   -------------------------------------------------------------------------- */

select 'contas @udgtest.com'      as item, count(*) as total
  from auth.users where email like '%@udgtest.com'
union all
select 'perfis dessas contas',      count(*)
  from public.profiles p
  join auth.users u on u.id = p.id
 where u.email like '%@udgtest.com'
union all
select 'posts dessas contas',       count(*)
  from public.posts p
  join auth.users u on u.id = p.user_id
 where u.email like '%@udgtest.com'
union all
select 'mensagens dessas contas',   count(*)
  from public.messages m
  join auth.users u on u.id = m.user_id
 where u.email like '%@udgtest.com';


/* --------------------------------------------------------------------------
   PASSO 2 - Remocao. Rode DEPOIS do backup.

   Apagar de auth.users normalmente arrasta profiles, posts, mensagens e o
   resto por ON DELETE CASCADE. Se alguma tabela nao tiver cascade, o comando
   falha com erro de chave estrangeira - e ai a transacao inteira volta atras
   sem deixar sujeira. E o comportamento desejado: melhor falhar do que apagar
   pela metade.
   -------------------------------------------------------------------------- */

begin;

do $$
declare
  qtd integer;
begin
  select count(*) into qtd from auth.users where email like '%@udgtest.com';
  raise notice 'Serao removidas % contas de teste.', qtd;
end $$;

delete from auth.users where email like '%@udgtest.com';

do $$
declare
  restante integer;
begin
  select count(*) into restante from auth.users where email like '%@udgtest.com';
  raise notice 'Restaram % contas de teste. Se for 0, escreva COMMIT.', restante;
end $$;

/*  >>> Leia as mensagens acima e escreva um dos dois:  <<<
    COMMIT;     -- confirma a remocao
    ROLLBACK;   -- desiste, nada muda
*/


/* --------------------------------------------------------------------------
   PASSO 3 - Conferencia final (depois do COMMIT)
   -------------------------------------------------------------------------- */

select count(*) as contas_teste_restantes
  from auth.users
 where email like '%@udgtest.com';
