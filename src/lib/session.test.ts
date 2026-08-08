// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vite-plus/test";

// ─── Mocks ─────────────────────────────────────────────────────────────
// Mock @solidjs/start/http and ./auth entirely. This keeps ~/server/db
// (and its @libsql/client / drizzle-orm/libsql / ws deps) from ever loading.

const { getWebRequestMock, getSessionMock } = vi.hoisted(() => ({
  getWebRequestMock: vi.fn<() => { headers: Headers }>(),
  getSessionMock: vi.fn<() => Promise<{ user: { id: string } } | null>>(),
}));

vi.mock("@solidjs/start/http", () => ({
  getWebRequest: getWebRequestMock,
}));

vi.mock("./auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

import {
  serializeToJSONStream,
  deserializeJSONStream,
} from "../../node_modules/@solidjs/start/dist/fns/serialization.js";
import { getSession, getCurrentUser, getCurrentUserId, UnauthorizedError } from "./session";

// ─── Helpers ────────────────────────────────────────────────────────────

const headers = new Headers();

beforeEach(() => {
  getWebRequestMock.mockReturnValue({ headers });
  getSessionMock.mockReset();
});

// ─── getSession ─────────────────────────────────────────────────────────

describe("getSession", () => {
  it("returns the session from auth.api.getSession", async () => {
    const session = { user: { id: "user-1" } };
    getSessionMock.mockResolvedValue(session);

    await expect(getSession()).resolves.toBe(session);
    expect(getWebRequestMock).toHaveBeenCalledOnce();
    expect(getSessionMock).toHaveBeenCalledWith({ headers });
  });

  it("returns null when signed out", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(getSession()).resolves.toBeNull();
  });
});

// ─── getCurrentUser ─────────────────────────────────────────────────────

describe("getCurrentUser", () => {
  it("returns session.user when a session exists", async () => {
    const user = { id: "user-1" };
    getSessionMock.mockResolvedValue({ user });

    await expect(getCurrentUser()).resolves.toBe(user);
  });

  it("returns null when signed out", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

// ─── getCurrentUserId ───────────────────────────────────────────────────

describe("getCurrentUserId", () => {
  it("returns user.id when a user exists", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    await expect(getCurrentUserId()).resolves.toBe("user-1");
  });

  it("returns null when signed out", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(getCurrentUserId()).resolves.toBeNull();
  });
});

// ─── UnauthorizedError ──────────────────────────────────────────────────

describe("UnauthorizedError", () => {
  it("extends Error with status 401", () => {
    const err = new UnauthorizedError();

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err.status).toBe(401);
  });

  it("has default message 'Unauthorized' and name 'UnauthorizedError'", () => {
    const err = new UnauthorizedError();

    expect(err.message).toBe("Unauthorized");
    expect(err.name).toBe("UnauthorizedError");
  });

  it("accepts a custom message", () => {
    const err = new UnauthorizedError("Nope");

    expect(err.message).toBe("Nope");
  });
});

// ─── UnauthorizedError across the server-function boundary ─────────────
// Uses the REAL @solidjs/start serialization pipeline
// (dist/fns/serialization.js, @solidjs/start 2.0.0-rc.3), not a mirror.
// serializeToJSONStream wraps seroval's toCrossJSONStream into
// ";0x<bytes>;<json>" chunks; deserializeJSONStream reads those chunks back
// through fromCrossJSON. Proves the session.ts docstring claim: status
// survives as an own property, but instanceof does not. If rc.4 changes
// the chunk format, this test fails loudly instead of re-mirroring.
//
// Import route: "@solidjs/start/dist/fns/serialization.js" (the package
// subpath) is blocked by @solidjs/start's exports map, which lists only
// ".", "./config", "./server", "./client", "./router", "./server/spa",
// "./client/spa", "./middleware", "./http", "./env", "./fns/server",
// "./fns/client". Vitest v4.1.10 (vite-plus 0.2.6) rejects the subpath
// with: '"./dist/fns/serialization.js" is not exported under the
// conditions ["solid","development","browser","node","development",
// "import"]'. The relative import into node_modules resolves the same
// single pnpm-installed instance of the module (and its sibling
// serialization.d.ts), so the test pins the REAL runtime contract. TODO:
// when @solidjs/start exposes ./fns/serialization in exports (or an
// upgrade changes the format), switch back to the package subpath.

describe("UnauthorizedError across the server-function boundary", () => {
  it("round-trips as a plain Error with own status=401", async () => {
    const err = new UnauthorizedError();
    const out = (await deserializeJSONStream(new Response(serializeToJSONStream(err)))) as Error & {
      status?: number;
    };

    expect(out).toBeInstanceOf(Error);
    expect(out).not.toBeInstanceOf(UnauthorizedError);
    expect(out.message).toBe("Unauthorized");
    expect(out.name).toBe("UnauthorizedError");
    expect(out.status).toBe(401);
    expect(Object.hasOwn(out, "status")).toBe(true);
  });
});
