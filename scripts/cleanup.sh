#!/usr/bin/env bash
# Session cleanup ritual for Pit Lane.
# Safe, idempotent, read-only except for explicit branch pruning of MERGED branches.
#
# Usage:
#   ./scripts/cleanup.sh          # dry-run (shows what would happen)
#   ./scripts/cleanup.sh --apply  # actually prune merged branches
set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=true
if [ "${1:-}" = "--apply" ]; then
  DRY_RUN=false
fi

say() { printf '\033[1;36m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }

say "== 1. Sync main =="
current=$(git branch --show-current)
if [ "$current" != "main" ]; then
  warn "   not on main (on '$current') — checkout main first"
  git checkout main
fi
git fetch --prune origin
if ! git merge-base --is-ancestor main origin/main; then
  git pull --ff-only origin main
else
  say "   main already up to date with origin/main"
fi

say "== 2. Prune merged local branches =="
merged=$(git branch --merged main | sed 's/^[* ]*//' | grep -vE '^(main)$' || true)
if [ -n "$merged" ]; then
  echo "$merged" | while read -r b; do
    if $DRY_RUN; then
      warn "   [dry-run] would delete local branch: $b"
    else
      git branch -d "$b" && warn "   deleted local branch: $b"
    fi
  done
else
  say "   no merged local branches to prune"
fi

say "== 3. Prune merged remote branches =="
# List remote branches, check each is an ancestor of main (merged) before deleting.
for ref in $(git ls-remote origin 'refs/heads/*' | awk '{print $2}' | sed 's|refs/heads/||'); do
  if [ "$ref" = "main" ]; then
    continue
  fi
  if git merge-base --is-ancestor "origin/$ref" origin/main 2>/dev/null; then
    if $DRY_RUN; then
      warn "   [dry-run] would delete remote branch: $ref"
    else
      if ! git push origin --delete "$ref" 2>&1 | tee /dev/stderr; then
        warn "   FAILED to delete remote branch: $ref"
      else
        warn "   deleted remote branch: $ref"
      fi
    fi
  fi
done

say "== 4. Sync beads tracker =="
if command -v br >/dev/null 2>&1 && [ -d .beads ]; then
  br sync --flush-only
else
  warn "   br not found — skipping tracker sync"
fi

say "== 5. Orphan card tripwire (read-only) =="
if command -v br >/dev/null 2>&1 && [ -d .beads ]; then
  # Key off the tool's exit code, not output string matching. br orphans exits 0
  # when clean; non-zero means a real error (or orphans found) — surface it.
  orphans=$(br orphans 2>&1)
  rc=$?
  if [ "$rc" -eq 0 ]; then
    if echo "$orphans" | grep -qi "no orphan"; then
      say "   no orphan cards — tracker is clean"
    else
      warn "   ⚠ OPEN CARDS REFERENCED IN MERGED COMMITS — write substantive closes:"
      echo "$orphans"
    fi
  else
    warn "   br orphans exited $rc — could not check for orphan cards:"
    echo "$orphans"
  fi
else
  warn "   br not found — skipping orphan check"
fi

if $DRY_RUN; then
  echo ""
  warn "Dry run complete. Re-run with --apply to prune merged branches."
fi
