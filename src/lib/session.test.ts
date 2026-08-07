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
