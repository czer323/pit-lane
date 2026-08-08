#!/usr/bin/env bash
# Authenticated smoke test: sign up, then verify every protected route
# returns 200 with a valid session cookie.
# Requires: dev server running on localhost:3000
set -euo pipefail

BASE="${1:-http://localhost:3000}"
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

TIMESTAMP=$(date +%s)
EMAIL="smoke-${TIMESTAMP}@pitlane.dev"

echo "=== Signing up test user ==="
HTTP=$(curl -s -c "$COOKIE_JAR" -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"smoke-pass\",\"name\":\"Smoke Test\"}")
if [ "$HTTP" != "200" ]; then
  echo "FAIL: sign-up returned $HTTP"
  exit 1
fi
echo "Signed up: $EMAIL"

FAIL=0
check() {
  local path="$1" desc="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE$path")
  if [ "$code" = "200" ]; then
    printf "  %-25s %s  ✓  %s\n" "$path" "$code" "$desc"
  else
    printf "  %-25s %s  ✗  %s\n" "$path" "$code" "$desc"
    FAIL=1
  fi
}

echo "=== Authenticated routes ==="
check "/fleet"               "Fleet page"
check "/analytics"           "Analytics page"
check "/cars"                "Car list"
check "/races"               "Race events"
check "/races/new"           "New event form"

echo ""
if [ "$FAIL" -eq 1 ]; then
  echo "AUTH SMOKE FAILED"
  exit 1
fi
echo "All authenticated routes smoke-check passed"
