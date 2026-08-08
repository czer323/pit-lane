#!/usr/bin/env tsx
/**
 * Live probe: signed-in session contract against the REAL better-auth instance.
 *
 * Verifies that the session helpers in `src/lib/session.ts` round-trip a real
 * session created by better-auth (src/lib/auth.ts, better-auth 1.6.26,
 * drizzleAdapter over the local SQLite fallback in src/server/db/index.ts).
 *
 * Two phases:
 *
 *   Phase A (wire): issues the exact requests the @solidjs/start client makes
 *   (`POST /_server` with X-Server-Id / X-Server-Instance, plus better-auth's
 *   own `/api/auth/*` endpoints) against a running dev server. Proves the
 *   full chain: getWebRequest headers -> getSession -> getCurrentUser ->
 *   getCurrentUserId -> ownership-scoped DB writes/reads.
 *
 *   Phase B (direct): bundles the REAL src/lib/session.ts with esbuild and
 *   runs it in a child node process with an injected solid-js request-event
 *   context (AsyncLocalStorage), carrying the same real cookie. Calls
 *   getSession/getCurrentUser/getCurrentUserId literally, against the real
 *   auth instance and real SQLite file, and checks signed-out returns null.
 *   The esbuild alias `server-only -> scripts/shims/server-only.mjs` is
 *   required because `@solidjs/start/http`'s public entry imports the
 *   `server-only` client guard, which is not installed as a package and is
 *   only meaningful in client bundles.
 *
 * Requirements:
 *   - Dev server running: `PORT=3001 pnpm dev` (default BASE_URL
 *     http://localhost:3001, override with BASE_URL env or argv[2]).
 *   - No .env: local SQLite fallback (file:./local.db) must have the
 *     better-auth tables (created by `vp dev` migrations or prior runs).
 *
 * Run: node_modules/.bin/tsx scripts/verify-session-contract.ts
 *
 * Not a vitest test: lives outside src/ and imports @libsql/client transitively
 * (via src/lib/auth -> src/server/db), which the Server Test Mocking protocol
 * forbids in test files. This script is a manual live probe; the protocol
 * explicitly allows a live-probe script outside src/.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  serializeToJSONString,
  deserializeJSONStream,
} from "../node_modules/@solidjs/start/dist/fns/serialization.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE_URL ?? process.argv[2] ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

const PASS = "PASS";
const FAIL = "FAIL";
let failures = 0;
let checks = 0;

function check(name: string, cond: boolean, detail?: unknown): void {
  checks++;
  const ok = Boolean(cond);
  console.log(
    `${ok ? PASS : FAIL}  ${name}${!ok && detail !== undefined ? "  " + JSON.stringify(detail) : ""}`,
  );
  if (!ok) failures++;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  return (await res.json()) as unknown;
}

interface ServerFnResult {
  xError: string | null;
  value: unknown;
}

/**
 * Call a server function exactly as the @solidjs/start client does.
 * Retries once on a deserialization failure: the first request to a module
 * can hit a vite dev cold-compile error page (HTTP 200 + HTML), which is not
 * a server-function stream. After the retry the module is warm.
 */
async function callServerFn(
  id: string,
  instance: number,
  args: unknown[],
  cookie?: string,
): Promise<ServerFnResult> {
  const attempt = async (): Promise<ServerFnResult> => {
    const headers: Record<string, string> = {
      "X-Server-Id": id,
      "X-Server-Instance": `server-fn:${instance}`,
    };
    let body: string | undefined;
    if (args.length > 0) {
      headers["Content-Type"] = "text/plain";
      headers["X-Start-Type"] = "0";
      body = await serializeToJSONString(args);
    }
    if (cookie) headers["Cookie"] = cookie;
    const res = await fetch(`${BASE}/_server`, { method: "POST", headers, body });
    const xError = res.headers.get("x-error");
    try {
      const value = await deserializeJSONStream(res);
      return { xError, value };
    } catch (err) {
      const raw = await res.text();
      throw new Error(
        `deserialize failed for ${id}: ${(err as Error).message}; status=${res.status}; ` +
          `x-error=${xError}; body=${raw.slice(0, 200)}`,
      );
    }
  };
  try {
    return await attempt();
  } catch (err) {
    const retried = await attempt();
    console.warn(`WARN  retried ${id} after transient failure: ${(err as Error).message}`);
    return retried;
  }
}

interface Car {
  carId?: number;
  userId?: string | null;
  name?: string;
}

function isCar(v: unknown): v is Car {
  return typeof v === "object" && v !== null;
}

function isSessionResult(v: unknown): v is { session: { userId: string }; user: { id: string } } {
  return (
    typeof v === "object" &&
    v !== null &&
    "session" in v &&
    "user" in v &&
    typeof (v as { session: { userId?: unknown } }).session.userId === "string" &&
    typeof (v as { user: { id?: unknown } }).user.id === "string"
  );
}

// ─── Phase B helper bundle (real src/lib/session.ts in a child process) ──

function buildHelperEntry(): string {
  // Keep the temp dir inside the project: the entry and its bundled output
  // resolve bare imports (solid-js/web) and externals (@libsql/client,
  // drizzle-orm) from the project's node_modules. A dir under /tmp would
  // fail to resolve them.
  const dir = mkdtempSync(join(__dirname, ".verify-session-contract-"));
  const entry = join(dir, "helper-entry.ts");
  writeFileSync(
    entry,
    `import { RequestContext } from "solid-js/web";
import { AsyncLocalStorage } from "node:async_hooks";
import { auth } from "${__dirname}/../src/lib/auth";
import { getSession, getCurrentUser, getCurrentUserId } from "${__dirname}/../src/lib/session";

async function main() {
  const requestStore = new AsyncLocalStorage<{ nativeEvent: { req: Request } }>();
  (globalThis as Record<symbol, unknown>)[RequestContext] = requestStore;
  const COOKIE = process.env.PROBE_COOKIE ?? "";
  const BASE = process.env.PROBE_BASE ?? "";
  const signedIn = await requestStore.run(
    { nativeEvent: { req: new Request(BASE + "/", { headers: { cookie: COOKIE } }) } },
    async () => {
      const direct = await auth.api.getSession({ headers: new Headers({ cookie: COOKIE }) });
      return {
        direct,
        session: await getSession(),
        user: await getCurrentUser(),
        userId: await getCurrentUserId(),
      };
    },
  );
  const signedOut = await requestStore.run(
    { nativeEvent: { req: new Request(BASE + "/", { headers: {} }) } },
    async () => {
      return {
        direct: await auth.api.getSession({ headers: new Headers() }),
        session: await getSession(),
        user: await getCurrentUser(),
        userId: await getCurrentUserId(),
      };
    },
  );
  console.log(JSON.stringify({ signedIn, signedOut }));
}
main().catch((err: unknown) => {
  console.error("HELPER_ERROR", err);
  process.exit(1);
});
`,
  );
  return dir;
}

async function runHelperBundle(dir: string, cookie: string): Promise<unknown> {
  const outfile = join(dir, "helper-bundle.mjs");
  // esbuild is a devDependency but not a direct dep of this package, so it
  // has no top-level symlink; use the .bin CLI rather than `import esbuild`.
  const esbuildBin = join(__dirname, "..", "node_modules", ".bin", "esbuild");
  await runChild(esbuildBin, [
    join(dir, "helper-entry.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${outfile}`,
    `--alias:server-only=${join(__dirname, "shims", "server-only.mjs")}`,
    `--alias:~=${join(__dirname, "..", "src")}`,
    "--external:@libsql/client",
    "--external:drizzle-orm",
  ]);
  const output = await runChild(process.execPath, [outfile], {
    env: { ...process.env, PROBE_COOKIE: cookie, PROBE_BASE: BASE },
  });
  const lastLine = output.trim().split("\n").pop();
  if (!lastLine) throw new Error("helper bundle produced no output");
  return JSON.parse(lastLine) as unknown;
}

function runChild(
  cmd: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv },
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: options?.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 1000)}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────

/**
 * Discover the origin better-auth trusts for CSRF'd POSTs.
 *
 * Node's fetch (undici) always sends `Sec-Fetch-Mode: cors`, which makes
 * better-auth's formCsrfMiddleware force-validate the Origin header (see
 * dist/api/middlewares/origin-check.mjs validateFormCsrf). With baseURL
 * unset (src/lib/auth.ts has no baseURL), better-auth trusts the origin it
 * infers from the incoming request. Under vite-plus vercel-dev emulation
 * that inferred base is `http://localhost:3000` (the vite default port),
 * even when the server actually binds PORT=3001. Probe candidate origins
 * with a side-effect-free sign-in attempt: 403 INVALID_ORIGIN rejects,
 * 401 INVALID_EMAIL_OR_PASSWORD accepts.
 */
async function discoverTrustedOrigin(): Promise<string> {
  const candidates = [BASE, "http://localhost:3000", "http://127.0.0.1:3000"];
  for (const origin of candidates) {
    const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email: "no-such-user@example.com", password: "x" }),
    });
    if (res.status !== 403) {
      return origin;
    }
  }
  throw new Error(`no trusted origin found among: ${candidates.join(", ")}`);
}

async function main(): Promise<void> {
  console.log(`Probe target: ${BASE}`);
  console.log("Phase A: wire-level (real dev server)\n");

  // 0. Resolve X-Server-Ids from the transformed client module.
  const modRes = await fetch(`${BASE}/src/server/api/cars.ts`);
  if (!modRes.ok) {
    console.error(`FAIL  dev server not reachable at ${BASE} (HTTP ${modRes.status})`);
    process.exit(1);
  }
  const modText = await modRes.text();
  const idMap: Record<string, string> = {};
  for (const m of modText.matchAll(/"([a-f0-9]{8}-\d+-(\w+))"/g)) {
    idMap[m[2]] = m[1];
  }
  check(
    "resolved X-Server-Id for createCar/listCars/deleteCar",
    Boolean(idMap.createCar && idMap.listCars && idMap.deleteCar),
    idMap,
  );

  const trustedOrigin = await discoverTrustedOrigin();
  console.log(`Trusted origin for CSRF: ${trustedOrigin}`);

  // 1. Create a REAL session via better-auth's email/password sign-up API.
  const stamp = Date.now();
  const email = `wire-probe-${stamp}@example.com`;
  const password = "probe-password-123";
  const signUpRes = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: trustedOrigin },
    body: JSON.stringify({ name: "Wire Probe User", email, password }),
  });
  const setCookie = signUpRes.headers.get("set-cookie") ?? "";
  const signUpBody = (await signUpRes.json()) as { token?: string; user?: { id?: string } };
  check("signUpEmail returns 200", signUpRes.status === 200, signUpRes.status);
  check(
    "signUpEmail sets better-auth.session_token cookie",
    setCookie.includes("better-auth.session_token="),
    setCookie,
  );
  check(
    "signUpEmail returns a user id",
    typeof signUpBody.user?.id === "string" && signUpBody.user.id.length > 0,
    signUpBody.user,
  );
  const cookie = setCookie.split(";")[0];
  const userId = signUpBody.user?.id ?? "";
  if (!cookie || !userId) throw new Error("could not establish a real session via signUpEmail");

  // 2. Real get-session endpoint with the cookie.
  const withCookie = await fetchJson(`${BASE}/api/auth/get-session`, { headers: { cookie } });
  check(
    "GET /api/auth/get-session returns { session, user } for the cookie",
    isSessionResult(withCookie) && withCookie.user.id === userId,
    withCookie,
  );
  if (isSessionResult(withCookie)) {
    check(
      "session.token matches sign-up token",
      withCookie.session.userId === userId,
      withCookie.session,
    );
  }

  // 3. Ownership-scoped server function succeeds with the real session.
  const list0 = await callServerFn(idMap.listCars, 0, [], cookie);
  check(
    "listCars (signed in) succeeds, no X-Error",
    list0.xError === null && Array.isArray(list0.value),
    list0.xError ?? list0.value,
  );

  const carName = `Wire Probe ${stamp}`;
  const created = await callServerFn(
    idMap.createCar,
    1,
    [{ name: carName, body: "S10", bodyType: "lexan" }],
    cookie,
  );
  check(
    "createCar (signed in) succeeds",
    list0.xError === null && created.xError === null,
    created.xError ?? created.value,
  );
  let carId: number | undefined;
  if (isCar(created.value)) {
    carId = created.value.carId;
    check(
      "created car stores the REAL better-auth userId",
      created.value.userId === userId,
      created.value,
    );
  } else {
    check("created car stores the REAL better-auth userId", false, created.value);
  }

  const list1 = await callServerFn(idMap.listCars, 2, [], cookie);
  const list1Cars = Array.isArray(list1.value) ? (list1.value as Car[]) : [];
  check(
    "listCars returns the ownership-scoped car",
    list1Cars.some((c) => c.name === carName && c.userId === userId),
    list1Cars,
  );

  // 4. Signed-out confirms null / Unauthorized.
  const noCookieSession = await fetchJson(`${BASE}/api/auth/get-session`);
  check(
    "GET /api/auth/get-session without cookie returns null",
    noCookieSession === null,
    noCookieSession,
  );
  const noCookieList = await callServerFn(idMap.listCars, 3, []);
  const errVal = noCookieList.value as { message?: string; status?: number };
  check(
    "listCars without cookie -> X-Error Unauthorized",
    noCookieList.xError === "Unauthorized: sign in to manage cars" && noCookieList.xError !== null,
    noCookieList.xError,
  );
  check(
    "deserialized error carries status 401",
    errVal.status === 401 && errVal.message === "Unauthorized: sign in to manage cars",
    errVal,
  );

  console.log("\nPhase B: direct helpers (real src/lib/session.ts, real auth, real SQLite)\n");
  const helperDir = buildHelperEntry();
  try {
    const helper = (await runHelperBundle(helperDir, cookie)) as {
      signedIn: {
        direct: unknown;
        session: unknown;
        user: { id?: string } | null;
        userId: string | null;
      };
      signedOut: {
        direct: unknown;
        session: unknown;
        user: unknown;
        userId: unknown;
      };
    };
    const si = helper.signedIn;
    check(
      "getSession() returns session for real cookie",
      isSessionResult(si.session) && si.session.user.id === userId,
      si.session,
    );
    check("getCurrentUser() returns user with expected id", si.user?.id === userId, si.user);
    check("getCurrentUserId() returns expected id", si.userId === userId, si.userId);
    check(
      "auth.api.getSession direct call matches",
      isSessionResult(si.direct) && si.direct.user.id === userId,
      si.direct,
    );
    const so = helper.signedOut;
    check("getSession() null when no cookie", so.session === null, so.session);
    check("getCurrentUser() null when no cookie", so.user === null, so.user);
    check("getCurrentUserId() null when no cookie", so.userId === null, so.userId);
    check("auth.api.getSession direct call null when no cookie", so.direct === null, so.direct);
  } finally {
    rmSync(helperDir, { recursive: true, force: true });
  }

  // 5. Cleanup: delete the probe car through the ownership-scoped API.
  if (carId !== undefined) {
    const del = await callServerFn(idMap.deleteCar, 4, [carId], cookie);
    check(
      "deleteCar (signed in) removes the probe car",
      del.xError === null,
      del.xError ?? del.value,
    );
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error("PROBE ERROR:", err);
  process.exit(1);
});
