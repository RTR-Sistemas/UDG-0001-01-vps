SRV=$(grep '^SERVICE_ROLE_KEY=' /opt/supabase-project/.env | cut -d= -f2- | tr -d '"' | tr -d ' ')
echo "--- create bucket"
curl -s -X POST https://udgservidor.online/storage/v1/bucket -H "apikey: $SRV" -H "Authorization: Bearer $SRV" -H "Content-Type: application/json" -d '{"id":"chat","name":"chat","public":true}'
echo
echo "--- list buckets"
curl -s https://udgservidor.online/storage/v1/bucket -H "apikey: $SRV" -H "Authorization: Bearer $SRV"
echo