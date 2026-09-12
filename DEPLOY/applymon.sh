ls -la /tmp/monetizacao_phase1.sql
echo "---head---"
head -c 300 /tmp/monetizacao_phase1.sql
echo
echo "---apply---"
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=0 < /tmp/monetizacao_phase1.sql > /tmp/mon_apply.log 2>&1
echo "psql exit=$?"
echo "---erros---"
grep -i error /tmp/mon_apply.log | head -40
echo "---tail---"
tail -5 /tmp/mon_apply.log
echo "---tables---"
docker exec supabase-db psql -U postgres -d postgres -t -c "select tablename from pg_tables where schemaname='public' and tablename in ('features_catalog','user_subscriptions','feature_grants','consumption_ledger','credit_balances');"