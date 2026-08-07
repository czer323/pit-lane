# Live Observation: Signed-In Session Contract Against the Real Better-Auth Instance

Date: 2026-08-07 · Node: gap-signed-in-auth-contract · Branch: feat/session-unit-tests

## Purpose

Verify by LIVE observation, not mocks, the signed-in contract behind
`src/lib/session.ts:27-49`:

> `getSession()` reads `getWebRequest()` headers and calls
> `auth.api.getSession({ headers })` on the real better-auth instance
> (`src/lib/auth.ts`, better-auth 1.6.26, drizzleAdapter over the local SQLite
> fallback in `src/server/db/index.ts`), returning `{ session, user } | null`.
> `getCurrentUser()` / `getCurrentUserId()` project `.user` / `.user.id`.
> An ownership-scoped API (`listCars`, `createCar`) requires that chain to
> resolve to the signed-in user's real id.

Every existing test mocks `./auth` or `~/lib/session` with the shape
`{ user: { id } } | null` (`src/lib/session.test.ts:8-23,44`, `src/server/api/
cars.test.ts:31-36`). The signed-out boundary was live-verified in
`401-wire-verify.md`; the signed-in path was verified nowhere. This document
records the signed-in contract against the REAL auth instance.

## Method

1. Booted `PORT=3001 pnpm dev` (vite-plus dev, Vercel dev emulation). No
   `.env`, so `src/server/db/index.ts:12-24` fell back to local SQLite
   (`file:./local.db`) and `src/lib/auth.ts:16-17` defaulted the Google
   credentials to `""`. Server bound `http://localhost:3001/`.
2. Resolved the real `X-Server-Id` values from the transformed client module
   served by the dev server: identical to `401-wire-verify.md` —
   `4d723631-0-createCar`, `4d723631-1-listCars`, `4d723631-2-getCar`,
   `4d723631-3-updateCar`, `4d723631-4-deleteCar`, `4d723631-5-addSnapshot`.
   The `4d723631` hash is stable across boots.
3. Created a REAL session server-side via better-auth's email/password
   sign-up API (`emailAndPassword.enabled` in `src/lib/auth.ts:11-13`):
   `POST /api/auth/sign-up/email`, capturing the `Set-Cookie` header. No login
   UI is needed; the API flow is the full reachable contract (pit-lane-5dn
   UI not landed is NOT a blocker).
4. Replicated the exact client request shape from
   `node_modules/@solidjs/start/dist/fns/client.js` (`createRequest` /
   `initializeResponse`): `POST /_server`, `X-Server-Id`, `X-Server-Instance:
server-fn:<n>`, `Content-Type: text/plain`, `X-Start-Type: 0` (Seroval),
   body `serializeToJSONString(args)` for one-or-more args, no body for zero
   args. Responses round-tripped through the REAL `deserializeJSONStream`
   from `dist/fns/serialization.js`.
5. Phase B: bundled the REAL `src/lib/session.ts` with esbuild and ran it in
   a child node process with a solid-js request-event context injected via
   AsyncLocalStorage (`getRequestEvent()` reads
   `globalThis[RequestContext]`, `solid-js/web/dist/server.js:685-691`),
   carrying the same real cookie. This calls `getSession` / `getCurrentUser`
   / `getCurrentUserId` literally, against the real auth instance and real
   SQLite file.

Committed probe (reproducible): `scripts/verify-session-contract.ts` +
`scripts/shims/server-only.mjs`. Run with the dev server up:
`node_modules/.bin/tsx scripts/verify-session-contract.ts` (22 checks).

## Boot requirements (recorded)

- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`: absent → local SQLite fallback.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: absent → `""` (tolerated).
- Port 3001 was free; earlier stale dev servers on 3000/3001 from previous
  sessions were stopped so the verification target was unambiguous.
- No blockers. Sign-up works without the login UI.

## Observations

### Test A — signUpEmail creates a real session

Request: `POST /api/auth/sign-up/email`, JSON
`{ name: "Wire Probe User", email: "wire-probe-<ts>@example.com",
password: "probe-password-123" }`, header `Origin: http://localhost:3000`
(see origin note below).

Wire:

- status: **200**
- `set-cookie`:
  `better-auth.session_token=<token>.<sig>; Max-Age=604800; Path=/;
HttpOnly; SameSite=Lax`
- body: `{ "token": "<token>", "user": { "name", "email",
"emailVerified": false, "image": null, "createdAt", "updatedAt",
"id": "<userId>" } }`

Real captured values (one run): user id `xOiZIPBssdWbb90KItn1sV3OZuWYxDu2`,
session row persisted to `local.db` with `user_id` matching.

### Test B — GET /api/auth/get-session with the cookie

Request: `GET /api/auth/get-session`, header `Cookie: <token>.<sig>`.

Wire: status **200**, body
`{ "session": { "expiresAt", "token", "createdAt", "updatedAt",
"ipAddress", "userAgent", "userId": "<userId>", "id": "<sessionId>" },
"user": { ..., "id": "<userId>" } }`.

- `user.id === <userId>` → true
- `session.userId === <userId>` → true
- `session.token === <token>` → true
- Shape matches the real better-auth return type
  (`dist/api/routes/session.d.mts`: `{ session: Session; user: User } | null`).

### Test C — listCars succeeds with the real session

Request: `POST /_server`, `X-Server-Id: 4d723631-1-listCars`,
`X-Server-Instance: server-fn:0`, no body (zero args), `Cookie`.

Wire: status **200**, `x-start-type: 0`, no `x-error`. Round-trip:
`[]` (empty). Success requires `requireUserId()` → `getCurrentUserId()` to
return the real id (`src/server/api/cars.ts:26-32,86-90`); any null would
have thrown `UnauthorizedError`.

### Test D — createCar stores the REAL userId; listCars is ownership-scoped

Request: `POST /_server`, `X-Server-Id: 4d723631-0-createCar`,
`X-Server-Instance: server-fn:1`, `Content-Type: text/plain`,
`X-Start-Type: 0`, body `serializeToJSONString([{ name, body: "S10",
bodyType: "lexan" }])` via the real serializer, `Cookie`.

Wire: status **200**, no `x-error`. Round-trip:
`{ carId: <n>, userId: "<userId>", name, body, bodyType, ..., createdAt,
updatedAt }`.

- `created.userId === <userId>` → **true**. `createCar` stores
  `getCurrentUserId()`'s value directly (`src/server/api/cars.ts:65,75`),
  so this PROVES `getCurrentUserId()` returned the real better-auth user id
  over the wire.
- Subsequent `listCars` returned the created car (filtered
  `where(eq(cars.userId, userId))`, `cars.ts:89`) → ownership scoping works
  with the real session.
- Cleanup `deleteCar` (signed in) removed the car → **true**.

### Test E — signed-out returns null / Unauthorized

- `GET /api/auth/get-session` without cookie → body `null`.
- `POST /_server` listCars without cookie → status **200**, header
  `x-error: Unauthorized: sign in to manage cars`; deserialized error has
  `status === 401`, `message === "Unauthorized: sign in to manage cars"`.
  Identical wire shape to `401-wire-verify.md` Test A.

### Test F — direct helpers (real src/lib/session.ts, same real cookie)

Phase B, standalone node process, esbuild bundle of `src/lib/session.ts`,
solid-js request-event context injected via AsyncLocalStorage:

- `getSession()` → `{ session, user }` with `user.id === <userId>` → true
- `getCurrentUser()` → `{ ..., id: "<userId>" }` → true
- `getCurrentUserId()` → `"<userId>"` → true
- `auth.api.getSession({ headers })` direct call → identical `{ session,
user }` → true
- Same three helpers with no cookie → `null` / `null` / `null` → true
- `auth.api.getSession` with empty headers → `null` → true

## Conclusion

**CLAIM CONFIRMED.** The signed-in contract holds end-to-end against the real
better-auth instance:

- better-auth's email/password sign-up API creates a real session (cookie +
  DB rows) without any login UI.
- `getSession` / `getCurrentUser` / `getCurrentUserId` — executed literally
  (Phase B) and over the wire through every server function that requires
  them (Phase C/D) — resolve to the real signed-in user's id.
- Ownership-scoped APIs (`listCars`, `createCar`, `deleteCar`) succeed with
  the real session and reject without it (`status 401` UnauthorizedError
  crossing as `200 + X-Error`, matching `401-wire-verify.md`).
- **Mock shape verdict:** the unit-test mock `{ user: { id } } | null`
  (`src/lib/session.test.ts:10`) is a compatible SUBSET of the real return
  `{ session, user } | null`. `getCurrentUser`/`getCurrentUserId` read only
  `user.id`, which exists on the real user object. NO correction needed to
  the test mock or `session.ts`.

## Technical notes

- **Trusted origin quirk:** node fetch (undici) always sends
  `Sec-Fetch-Mode: cors`, which makes better-auth's `formCsrfMiddleware`
  force-validate the `Origin` header (`dist/api/middlewares/origin-check.mjs`
  `validateFormCsrf`). With `baseURL` unset, better-auth trusts the origin it
  infers from the incoming request; under the vite-plus vercel-dev emulation
  that inferred base is `http://localhost:3000` even when the server binds
  `PORT=3001`. The probe discovers the trusted origin with a side-effect-free
  sign-in attempt (403 = rejected, 401 = accepted) and sends it on CSRF'd
  POSTs. A browser client is unaffected (same-origin).
- **server-only guard:** `@solidjs/start/http`'s public entry
  (`dist/http/index.js`) imports `"server-only"`, which is not installed as a
  package; vite's boundary-modules plugin resolves it in dev. Standalone node
  probes alias it to `scripts/shims/server-only.mjs` (empty) via esbuild.
  The guard is meaningless in server-only code.
- **X-Server-Id stability:** the `4d723631` prefix is stable across dev
  boots; the probe resolves the ids from the served client module anyway, so
  a hash change would not break it.
- The probe leaves one `wire-probe-*` user + session row per run in
  `local.db` (better-auth has no delete-user endpoint without the admin
  plugin). Probe cars are deleted via `deleteCar` each run.

## What was NOT checked (scope)

- Production build (Vercel) behavior — observed under dev emulation only.
- Google OAuth social login flow (credentials empty in dev).
- Session refresh / rotation, revocation, and expiry (a fresh 7-day session
  was used).
- The `X-Single-Flight` header path and single-flight revalidation.
- Email verification and password reset flows.
- Multiple concurrent sessions and cross-user isolation at scale (single
  user exercised; the ownership filter is proven per-user).
- `SEROVAL_MODE=js` serialization variant.
