ANON=$(grep '^ANON_KEY=' /opt/supabase-project/.env | cut -d= -f2- | tr -d '"' | tr -d ' ')
echo "=== translate POST ==="
curl -s -X POST "https://udgservidor.online/.netlify/functions/translate" -H "Content-Type: application/json" -d '{"text":"Olá mundo","to":"en"}' | head -c 250
echo
echo "=== auth health ==="
curl -s -o /dev/null -w '%{http_code}\n' "https://udgservidor.online/auth/v1/health" -H "apikey: $ANON"
echo "=== signup E2E ==="
RESP=$(curl -s -X POST "https://udgservidor.online/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"email":"e2e-final@undoing.test","password":"Teste123!","data":{"username":"e2efinal","birth_date":"2000-01-01"}}')
echo "$RESP" | head -c 400
echo
TOKEN=$(echo "$RESP" | grep -o '"access_token":"[^"]*"' | sed 's/.*:"//;s/"//')
echo "token_len=${#TOKEN}"
if [ -n "$TOKEN" ]; then
  UID=$(echo "$RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/.*:"//;s/"//')
  echo "uid=$UID"
  echo "=== user profile via REST ==="
  curl -s "https://udgservidor.online/rest/v1/profiles?select=id,username,birth_date,is_adult_confirmed,friend_code,registration_number&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" | head -c 400
  echo
  echo "=== rpc mark_viewed (deve falhar p/ id inexistente sem erro 500) ==="
  curl -s -X POST "https://udgservidor.online/rest/v1/rpc/mark_viewed" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"p_message_id":"00000000-0000-0000-0000-000000000000"}' -o /dev/null -w '%{http_code}\n'
  echo "=== cleanup ==="
  if [ -n "$UID" ]; then
    docker exec supabase-db psql -U postgres -d postgres -q -c "delete from public.profiles where id='$UID'; delete from auth.identities where user_id='$UID'; delete from auth.sessions where user_id='$UID'; delete from auth.users where id='$UID';" && echo "user limpo"
  fi
fi
echo "=== audit (chat ignorado = bucket) ==="
sh /tmp/audit.sh 2>&1 | tail -6