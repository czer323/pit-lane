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

- Production build wire behavior (observed under Vercel dev emulation; the
  `dist/fns/handler.js` path is shared with production, but not booted here).
- `X-Single-Flight` header path and single-flight revalidation.
- Response-returning server functions (this codebase throws Errors).
- No-JS / no-instance fallback (302 flash redirect path in `handleNoJS`).
- `SEROVAL_MODE=js` serialization variant.
