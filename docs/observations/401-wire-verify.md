# Live Wire Observation: 401 at the Server-Function Boundary

Date: 2026-08-07 · Node: live-401-wire-verify · Branch: feat/session-unit-tests

## Purpose

Verify by LIVE observation, not source inference, the claim in
`src/lib/session.ts:4-14` and `src/server/api/cars.test.ts:312-317`:

> Thrown errors cross the server-function boundary as `200 + X-Error(message)`
> for both auth failures and server errors. Seroval preserves `status`, `name`,
> and `message` as own properties on the client-side error, but the subclass
> prototype (and therefore `instanceof`) is lost.

## Method

1. Booted `pnpm dev` (vite-plus dev, Vercel dev emulation). No `.env` present,
   so `src/server/db/index.ts:12-24` fell back to local SQLite
   (`file:./local.db`) and `src/lib/auth.ts:16-17` defaulted `GOOGLE_CLIENT_ID`
   / `GOOGLE_CLIENT_SECRET` to `""`. Port 3000 busy, dev server bound
   `http://localhost:3001/`.
2. Resolved the real `X-Server-Id` values from the transformed client module
   served by the dev server: `4d723631-0-createCar`, `4d723631-1-listCars`,
   `4d723631-2-getCar`, `4d723631-3-updateCar`, `4d723631-4-deleteCar`,
   `4d723631-5-addSnapshot`.
3. Replicated the exact client request shape from
   `node_modules/@solidjs/start/dist/fns/client.js` (`createRequest` /
   `initializeResponse`): `POST /_server`, `X-Server-Id`, `X-Server-Instance:
server-fn:<n>`, `Content-Type: text/plain`, `X-Start-Type: 0|1`
   (`BODY_FORMAT_KEY` / `BodyFormat` from `dist/fns/shared.js`).
4. Round-tripped each response body through the REAL
   `deserializeJSONStream` imported from
   `node_modules/@solidjs/start/dist/fns/serialization.js`.

## Boot requirements (recorded)

- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`: absent → local SQLite fallback.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: absent → `""` (tolerated).
- No blockers. Dev server booted and served the app (HTTP 200 on `/`).

## Observations

### Test A — auth failure, no-args shape (listCars, no session)

Request: `POST /_server`, headers `X-Server-Id: 4d723631-1-listCars`,
`X-Server-Instance: server-fn:0`, no body (client sends none for zero args).

Wire:

- status: **200**
- headers: `x-error: Unauthorized: sign in to manage cars`,
  `x-start-type: 0`, `transfer-encoding: chunked`
- body prefix: `;0x00000499;{"t":13,"i":0,"s":0,"m":"Unauthorized: sign in to manage cars","p":{"k":["name","stack","status"],"v":[{"t":1,"s":"UnauthorizedError"},{"t":1,"s":"UnauthorizedError: ...` (length 1189)

Round-trip through real `deserializeJSONStream`:

- `instanceof Error` → **true**
- `constructor.name` → `"Error"`
- `instanceof UnauthorizedError` (mirror class) → **false**
- own keys: `["stack", "name", "status"]`; `message` own (non-enumerable)
- `status === 401` → **true**
- `name === "UnauthorizedError"` → **true**
- `message === "Unauthorized: sign in to manage cars"` → **true**

### Test B — generic server error (createCar("garbage"), String body format)

Request: `POST /_server`, `X-Server-Id: 4d723631-0-createCar`,
`X-Server-Instance: server-fn:1`, `Content-Type: text/plain`,
`X-Start-Type: 1` (String), body `garbage`. Server throws plain
`Error("Invalid car data: ...")` from `zod` before auth.

Wire:

- status: **200**
- headers: `x-error: Invalid car data: [ { "expected": "object", ... } ]`,
  `x-start-type: 0`
- body prefix: `;0x000007a6;{"t":13,"i":0,"s":0,"m":"Invalid car data: [...]` (length 1970)

Round-trip: `instanceof Error` true, `name "Error"`, no `status` property.
HTTP layer identical to Test A: **200 + X-Error(message)**.

### Test C — auth failure, Seroval body format (createCar({name}), no session)

Request: `POST /_server`, `X-Server-Id: 4d723631-0-createCar`,
`X-Server-Instance: server-fn:2`, `Content-Type: text/plain`,
`X-Start-Type: 0` (Seroval), body = `serializeToJSONString([{ name: "Wire Test Car" }])`
via the REAL serializer.

Wire: status **200**, `x-error: Unauthorized: sign in to manage cars`,
`x-start-type: 0`. Round-trip: identical to Test A (`status` 401, `name`
"UnauthorizedError", message preserved, `instanceof UnauthorizedError` false,
`instanceof Error` true).

## Conclusion

**CLAIM CONFIRMED.** The docstring in `src/lib/session.ts:4-14` and the comment
in `src/server/api/cars.test.ts:312-317` accurately describe the wire behavior:

- Auth failures and generic server errors are HTTP-layer INDISTINGUISHABLE:
  both return `200` with an `X-Error(message)` header and a seroval body.
  No 401-vs-500 distinction exists at this boundary.
- Seroval preserves `status`, `name`, and `message` on the client-side error
  (status/name enumerable own props, message own non-enumerable — standard
  Error semantics), but the subclass prototype is lost:
  `instanceof UnauthorizedError` is false on the client.

No source changes required. Observation script (reproducible):
`/tmp/observe-401-wire.mjs` (temp; not committed).

## What was NOT checked (scope)

- ~~Production build wire behavior~~ → **NOW CHECKED**, see addendum below.
- `X-Single-Flight` header path and single-flight revalidation.
- Response-returning server functions (this codebase throws Errors).
- No-JS / no-instance fallback (302 flash redirect path in `handleNoJS`).
- `SEROVAL_MODE=js` serialization variant.

---

# Addendum: Production Build Wire Verification (gap-prod-build-wire-verify)

Date: 2026-08-07 · Node: gap-prod-build-wire-verify · Branch: feat/session-unit-tests

## Purpose

Close the gap flagged in the dev observation: verify the same boundary claim
against the ACTUAL production artifact (nitro `vercel` preset), not Vercel dev
emulation.

## Build

- `pnpm build` (`vp build` → `vite.config.ts` plugins: `solidStart()` +
  `nitro({ preset: "vercel" })`). Output: `.vercel/output` (functions/
  `__server.func`, static/). No `dist/` is produced by this preset.
- `nitro.json` `commands.preview`: `npx srvx --static ../../static
./functions/__server.func/index.mjs`.

## Boot

- `vp preview --port 3011 --strictPort` **FAILS** for this preset:
  `Error: Could not find the SolidStart server entry in .../dist/server`
  (solid-start's `configurePreviewServer` only knows the `dist/` layout; the
  nitro vercel preset emits `.vercel/output` instead). This is a tooling
  mismatch, not a claim failure.
- Booted the artifact per the nitro-generated preview command instead, with
  srvx on port 3011:
  `srvx --static /mnt/.../pit-lane/.vercel/output/static ./index.mjs --port 3011`
  (run from `.vercel/output/functions/__server.func`).
- Smoke: `GET /` → 200 HTML; `POST /_server` → 200 with seroval body whose
  stack trace points at `.vercel/output/functions/__server.func/_ssr/ssr.mjs`
  — confirming the production bundle, not a dev server.

## Server-Id resolution (production client)

The production client bundle `.vercel/output/static/_build/assets/cars-TN5dtYgF.js`
embeds bare ids:

```js
import{t as e}from"./client-H6m4QLzk.js";var t=e(`4d723631-0`),n=e(`4d723631-1`),...
export{a,i,n,r,t};  // a=4(deleteCar) i=1(listCars) n=2(getCar) r=3(updateCar) t=0(createCar)
```

Same `4d723631` hash as dev, but NO `-createCar` name suffix: the dev server
appends the function name to the reference; the production client sends the bare
id. Handler splits on `#`, so both resolve to the same function. Probes below use
the production client's exact ids (`4d723631-0` = createCar, `4d723631-1` =
listCars).

## Observations (production)

Request shape identical to dev observation (from
`node_modules/@solidjs/start/dist/fns/client.js`): `POST /_server`,
`X-Server-Id`, `X-Server-Instance: server-fn:<n>`, body per args
(`X-Start-Type` `0|1` from `dist/fns/shared.js`). Bodies round-tripped through
the REAL `deserializeJSONStream` from `dist/fns/serialization.js`.

### Test A — auth failure, no-args shape (listCars, no session)

Wire: status **200**, headers `x-error: Unauthorized: sign in to manage cars`,
`x-start-type: 0`, chunked. Body prefix
`;0x000003cf;{"t":13,"i":0,"s":0,"m":"Unauthorized: sign in to manage cars",...`
(length 987).

Round-trip: `instanceof Error` true, `constructor.name` `"Error"`,
`instanceof UnauthorizedError` false, own keys `["stack","name","status"]`,
`status === 401`, `name === "UnauthorizedError"`, `message` preserved.

### Test B — generic server error (createCar("garbage"), String body format)

Wire: status **200**, `x-error: Invalid car data: [  {    "expected": "object", ...`
(newlines stripped from header — `toHeaderValue` removes `[\r\n]+`; message
retains `\n` in the seroval body), `x-start-type: 0`. Body length 1485.

Round-trip: `instanceof Error` true, `name "Error"`, no `status` property.
HTTP layer identical to Test A: **200 + X-Error(message)**.

### Test C — auth failure, Seroval body format (createCar({name}), no session)

Request body produced by the REAL `serializeToJSONString([{ name: "Wire Test Car" }])`,
`X-Start-Type: 0`. Wire: status **200**, `x-error: Unauthorized: sign in to
manage cars`, `x-start-type: 0`. Round-trip: identical to Test A (`status` 401,
`name` "UnauthorizedError", message preserved, `instanceof UnauthorizedError`
false, `instanceof Error` true).

## Conclusion (production)

**CLAIM CONFIRMED on the production artifact.** No divergence from dev
emulation:

- Auth failures and generic server errors are HTTP-layer INDISTINGUISHABLE:
  both return **200** with an `X-Error(message)` header and a seroval body.
- Seroval preserves `status`, `name`, and `message` on the client-side error
  (status/name enumerable own props, message own non-enumerable — standard
  Error semantics); the subclass prototype is lost (`instanceof
UnauthorizedError` false on the client).
- `src/lib/session.ts:4-14` docstring and `src/server/api/cars.test.ts:312-317`
  comment remain accurate. **No source changes required.**

## Production-only observations (vs dev)

1. Server reference ids are bare (`4d723631-0`) — no `-createCar` suffix. The
   dev server appends the function name; production does not.
2. `vp preview` cannot serve this preset (expects `dist/server`); use the
   nitro-generated `srvx` preview command (see `nitro.json`).
3. Stack traces in seroval bodies reference `.vercel/output/.../_ssr/ssr.mjs`.

Observation script (reproducible):
`/tmp/observe-401-wire-prod.mjs` (temp; not committed).
