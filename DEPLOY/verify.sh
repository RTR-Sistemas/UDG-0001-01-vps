echo "=== TABELAS public ==="
docker exec supabase-db psql -U postgres -d postgres -t -c "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
echo "=== RPCs public ==="
docker exec supabase-db psql -U postgres -d postgres -t -c "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by 1;" | tr '\n' ' '
echo
echo "=== AUDIT ==="
sh /tmp/audit.sh 2>&1 | tail -30
echo "=== SMOKE ==="
for p in badge-count app-config get-vapid-public-key; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://udgservidor.online/.netlify/functions/$p")
  echo "$p -> $code"
done
echo "=== translate ==="
curl -s "https://udgservidor.online/.netlify/functions/translate?text=ola+mundo&to=en" | head -c 300
echo
echo "=== badge body ==="
curl -s "https://udgservidor.online/.netlify/functions/badge-count" | head -c 400
echo
echo "=== auth health ==="
curl -s -o /dev/null -w '%{http_code}\n' "https://udgservidor.online/auth/v1/health"
echo "=== service ==="
systemctl is-active undoing.service