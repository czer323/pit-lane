# Foundation stabilization hit list (from scout report)

## The scout's key findings (evidence-cited)

1. **SolidStart 2.0.0 stable exists (Aug 4, 2026)** — we're on rc.3 of the SAME line. Fix: one-line bump, NOT step back. Uses Vite's Environment API (matches Vite+ path).
2. **`vercel dev` was never going to work** — Vercel detects Nitro in deps → runs `nitro dev` → rejects Vite-plugin projects ("Nitro dev CLI does not support vite"). Vercel's own docs recommend the framework's dev command. Fix: use `vp dev` for local, or add `devCommand: "vp dev --port $PORT"` to vercel.json.
3. **drizzle-kit does NOT auto-load `.env.local`** (only `.env`). The migration to "Turso" was a wrong theory. Plain `drizzle-kit migrate` targets local.db. Robust path: explicit `drizzle.local.config.ts` + `--config` flag.
4. **Google OAuth local testing:** raw LAN IPs rejected (HTTPS required except localhost). Documented answers:
   - localhost redirect URI in Testing mode (works for local dev via port-forward)
   - cloudflared/ngrok tunnel (public https URL, add BETTER_AUTH_URL + trustedOrigins)
   - better-auth oAuthProxy plugin (for preview where redirect URL unknown in advance)
5. **pnpm warning (benign):** two-document YAML lockfile (pnpm 11) + Vercel multi-doc YAML limitation (vercel/vercel#17381 open). pnpm 11 NOT in Vercel's supported list. Options: ENABLE_EXPERIMENTAL_COREPACK=1 (already set) or pnpm 10. Works now, benign.
6. **Standardize shortcuts/scripts** — the user's point: document a clear mapping of "if you do THIS, THAT happens." Standardize commands so every env behaves identically.

## Consolidated action list (to implement)

### A. Foundation

- [ ] A1. Bump `@solidjs/start` 2.0.0-rc.3 → 2.0.0 (stable) via `vp add`
- [ ] A2. Run `vp check` + `vp test` to confirm nothing breaks
- [ ] A3. Commit as next snapshot

### B. Local dev (layer 1 — priority)

- [ ] B1. Fix local DB migration: use `drizzle.local.config.ts` explicitly (scout confirmed this is the right path)
- [ ] B2. Migrate local.db properly (drizzle-kit migrate --config=drizzle.local.config.ts)
- [ ] B3. Verify local dev with `vp dev` + local.db works
- [ ] B4. Google OAuth local: localhost redirect URI in Testing mode (already set) — verify works via port-forward

### C. Dev environment (layer 2 — after local works)

- [ ] C1. Vercel dev/preview deploy (non-prod) — use `vercel deploy` (no --prod)
- [ ] C2. Register dev URL callback in Google Cloud
- [ ] C3. Verify Google OAuth on dev URL

### D. Production (layer 3 — LAST, only when everything works)

- [ ] D1. Deploy to prod (rouge) with BETTER_AUTH_SECRET set
- [ ] D2. Verify Google OAuth on prod

### E. Standardization (user's point — shortcuts)

- [ ] E1. Add standardized scripts to package.json:
  - `dev` → `vp dev`
  - `dev:local` → `vp dev` (local.db)
  - `db:migrate:local` → `drizzle-kit migrate --config=drizzle.local.config.ts`
  - `db:migrate:remote` → `drizzle-kit migrate` (Turso)
  - `deploy:preview` → existing
  - `deploy:dev` → `vercel deploy` (non-prod)
  - `deploy:prod` → `vercel --prod` (LAST, gated)
- [ ] E2. Document the "if you do THIS, THAT happens" mapping in docs/ (dev workflow)

### F. Google OAuth strategy (from scout)

- [ ] F1. Decide: localhost Testing mode (simplest) vs tunnel (cloudflared/ngrok) vs oAuthProxy plugin
- [ ] F2. Implement chosen strategy with BETTER_AUTH_URL + trustedOrigins wired correctly

## Priority order (user's layered model)

1. Local works (B)
2. Local Vercel instance / dev env (C)
3. Production (D) — ONLY after 1+2 verified
