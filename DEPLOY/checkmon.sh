echo "=== features no catalogo ==="
docker exec supabase-db psql -U postgres -d postgres -t -c "select count(*) from public.features_catalog;" -c "select slug||'='||price_coins||'c/'||credit_cost||'cr' from public.features_catalog order by tipo, price_coins;" | head -50
echo "=== rpcs novas ==="
docker exec supabase-db psql -U postgres -d postgres -t -c "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('feature_prices','store_config','my_entitlements','check_feature','consume_feature','buy_coins','activate_subscription','use_ia_credit','admin_set_feature') order by 1;" | tr '\n' ' '
echo
echo "=== store_config via API (anon) ==="
ANON=$(grep '^ANON_KEY=' /opt/supabase-project/.env | cut -d= -f2- | tr -d '"' | tr -d ' ')
curl -s -X POST "https://udgservidor.online/rest/v1/rpc/store_config" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}' | head -c 500
echo
echo "=== feature_prices via API (anon) ==="
curl -s -X POST "https://udgservidor.online/rest/v1/rpc/feature_prices" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}' | head -c 200
echo