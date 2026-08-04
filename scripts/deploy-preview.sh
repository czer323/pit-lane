#!/usr/bin/env bash
# Deploy a one-off preview of the current branch to Vercel (non-production).
# Run this when you want to look at the deployed site before cutting a release.
# Not part of CI — it only runs when you invoke it.
#
# Requires:
#   - VERCEL_TOKEN (from https://vercel.com/account/tokens), and
#   - VERCEL_ORG_ID + VERCEL_PROJECT_ID (or an existing `vercel link`)
#
# Usage:
#   pnpm deploy:preview
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "VERCEL_TOKEN is not set. Export it first, for example:"
  echo "  export VERCEL_TOKEN=<token from https://vercel.com/account/tokens>"
  exit 1
fi

# Write the project link from env (same shape as CI). Otherwise rely on an
# existing .vercel/project.json from `vercel link`.
if [ -n "${VERCEL_ORG_ID:-}" ] && [ -n "${VERCEL_PROJECT_ID:-}" ]; then
  mkdir -p .vercel
  printf '{\n  "projectId": "%s",\n  "orgId": "%s"\n}\n' \
    "$VERCEL_PROJECT_ID" "$VERCEL_ORG_ID" > .vercel/project.json
fi

echo "== Building =="
vp build

echo "== Deploying preview (non-production) =="
pnpm exec vercel deploy --prebuilt --token="${VERCEL_TOKEN}" --yes