/* ===========================================================================
   ARQUIVO NEUTRALIZADO EM 06/09/2026 — dado de teste em pasta de producao

   Este arquivo confirma as 50 contas-bot de teste (@udgtest.com).
   Estava em supabase/migrations/, ou seja, `supabase db push` o aplicava em
   PRODUCAO: contas com senha conhecida e caminho de pagamento ficticio no
   banco real. Nao ha razao para isso existir em producao.

   O conteudo original foi preservado em: supabase/seed_dev/20260814130000_confirm_test_users.sql
   Este arquivo continua existindo para nao quebrar o historico de migracoes
   ja aplicadas no banco, mas nao executa mais nada.
   =========================================================================== */

do $$ begin
  raise notice '20260814130000_confirm_test_users.sql: semente de teste neutralizada (ver supabase/seed_dev/).';
end $$;
