#!/usr/bin/env bash
# Smoke-test every known route against the local dev server.
# Run AFTER the dev server is started on port 3000.
# Exits non-zero on any unexpected HTTP code.
set -euo pipefail

BASE="${1:-http://localhost:3000}"
FAIL=0

check() {
  local path="$1" expected="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path" 2>/dev/null || echo "000")
  if [ "$code" = "$expected" ]; then
    printf "  %-25s %s  ✓\n" "$path" "$code"
  else
    printf "  %-25s %s  ✗ (expected %s)\n" "$path" "$code" "$expected"
    FAIL=1
  fi
}

echo "Smoke-testing $BASE"

# Public routes — should return 200
echo "--- Public ---"
check "/"           200
check "/login"      200

# Auth-gated routes — should return 302 (redirect to /login)
echo "--- Protected ---"
check "/fleet"              302
check "/analytics"          302
check "/cars"               302
check "/cars/1"             302
check "/cars/1/edit"        302
check "/cars/new"           302
check "/races"              302
check "/races/new"          302
check "/races/1"            302
check "/races/1/quick"      302
check "/races/1/batch"      302
check "/races/1/edit/1"     302

# Bogus routes still hit middleware (no 404 from unauthenticated curl —
# the guard redirects before the router resolves)
check "/nonexistent-xyz"    302

echo ""
if [ "$FAIL" -eq 1 ]; then
  echo "SMOKE FAILED — do not ask user to test"
  exit 1
fi
echo "All routes smoke-check passed"
