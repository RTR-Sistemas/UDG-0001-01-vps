sed -i 's/\r$//' /tmp/functions_missing.sql
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < /tmp/functions_missing.sql 2>&1 | grep -i error
echo APPLY_DONE
docker exec supabase-db psql -U postgres -d postgres -t -c "select 'pool='||count(*) from public.daily_questions_pool;" -c "select 'trigger='||tgname from pg_trigger where tgname='trg_hard_delete_message';" -c "select 'fn='||proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('hard_delete_message','mark_daily_question_used') order by 1;"