echo "--- fix index ---"
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.consumption_ledger ADD COLUMN IF NOT EXISTS usage_date date NOT NULL DEFAULT current_date;
DROP INDEX IF EXISTS public.consumption_ledger_usage_day_uq;
CREATE UNIQUE INDEX IF NOT EXISTS consumption_ledger_usage_day_uq
  ON public.consumption_ledger (user_id, slug, usage_date)
  WHERE source = 'usage';
SQL
echo "fix rc=$?"
echo "--- catalogo ---"
docker exec supabase-db psql -U postgres -d postgres -t -c "select count(*) as features from public.features_catalog;" -c "select count(*) as packs from jsonb_array_elements(coalesce(nullif(public.get_platform_config('store_packs'),'')::jsonb,'[]'));"
echo "--- rpcs ---"
docker exec supabase-db psql -U postgres -d postgres -t -c "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('feature_prices','store_config','my_entitlements','check_feature','consume_feature','buy_coins','activate_subscription','use_ia_credit','admin_set_feature') order by 1;" | tr '\n' ' '
echo
echo "--- api anon ---"
ANON=$(grep '^ANON_KEY=' /opt/supabase-project/.env | cut -d= -f2- | tr -d '"' | tr -d ' ')
curl -s -X POST "https://udgservidor.online/rest/v1/rpc/store_config" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}' | head -c 600
echo
curl -s -X POST "https://udgservidor.online/rest/v1/rpc/feature_prices" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}' | head -c 200
echo