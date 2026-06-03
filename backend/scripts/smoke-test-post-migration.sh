#!/bin/bash
# Smoke tests post schema migration
# Usage: ./smoke-test-post-migration.sh [base_url] [email] [password]
# Example: ./smoke-test-post-migration.sh http://localhost:3002 superadmin@jobplatform.com admin123

BASE="${1:-http://localhost:3002}"
EMAIL="${2:-superadmin@jobplatform.com}"
PASS="${3:-admin123}"
PASS_JSON="\"${PASS}\""

echo "=== Smoke Test Post-Migration ==="
echo "Base: $BASE"
echo ""

# 1. Login
echo "1. POST /api/auth/login"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":$PASS_JSON}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
TOKEN=$(echo "$RESPONSE" | head -1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
[ "$HTTP_CODE" = "200" ] && echo "  ✅ $HTTP_CODE" || echo "  ❌ $HTTP_CODE"

if [ -z "$TOKEN" ]; then
  echo "  ❌ No token received — stopping tests"
  exit 1
fi

AUTH="-H \"Authorization: Bearer $TOKEN\""

# 2. Verify token
echo "2. GET /api/auth/verify"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/verify" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && echo "  ✅ $CODE" || echo "  ❌ $CODE"

# 3. GET /job-offers
echo "3. GET /job-offers"
R=$(curl -s "$BASE/job-offers" -H "Authorization: Bearer $TOKEN")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/job-offers" -H "Authorization: Bearer $TOKEN")
TOTAL=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print('total='+str(d.get('total','?'))+' success='+str(d.get('success','?')))" 2>/dev/null)
[ "$CODE" = "200" ] && echo "  ✅ $CODE $TOTAL" || echo "  ❌ $CODE — $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get(\"details\",d.get(\"error\",\"\")))' 2>/dev/null)"

# 4. GET /job-offers/locations
echo "4. GET /job-offers/locations"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/job-offers/locations" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && echo "  ✅ $CODE" || echo "  ❌ $CODE"

# 5. GET /job-offers/sectors
echo "5. GET /job-offers/sectors"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/job-offers/sectors" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && echo "  ✅ $CODE" || echo "  ❌ $CODE"

# 6. GET /job-offers/external-ids
echo "6. GET /job-offers/external-ids"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/job-offers/external-ids" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && echo "  ✅ $CODE" || echo "  ❌ $CODE"

# 7. GET /api/segments
echo "7. GET /api/segments"
R=$(curl -s "$BASE/api/segments" -H "Authorization: Bearer $TOKEN")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/segments" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && echo "  ✅ $CODE" || echo "  ❌ $CODE — $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get(\"details\",d.get(\"error\",\"\")))' 2>/dev/null)"

# 8. GET /api/campaigns
echo "8. GET /api/campaigns"
R=$(curl -s "$BASE/api/campaigns" -H "Authorization: Bearer $TOKEN")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/campaigns" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && echo "  ✅ $CODE" || echo "  ❌ $CODE — $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get(\"details\",d.get(\"error\",\"\")))' 2>/dev/null)"

# 9. GET /api/metrics/dashboard
echo "9. GET /api/metrics/dashboard"
R=$(curl -s "$BASE/api/metrics/dashboard" -H "Authorization: Bearer $TOKEN")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/metrics/dashboard" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && echo "  ✅ $CODE" || echo "  ❌ $CODE — $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get(\"details\",d.get(\"error\",\"\")))' 2>/dev/null)"

# 10. GET /api/credentials/channels
echo "10. GET /api/credentials/channels"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/credentials/channels" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && echo "  ✅ $CODE" || echo "  ❌ $CODE"

echo ""
echo "=== Done ==="
