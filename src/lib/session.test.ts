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
import { toCrossJSONStream, fromCrossJSON, Feature } from "seroval";

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
// Mirrors @solidjs/start 2.0.0-rc.3 dist/fns/serialization.js: thrown errors
// are serialized with seroval's toCrossJSONStream (";0x<bytes>;<json>" chunks)
// and rehydrated with fromCrossJSON. Proves the session.ts docstring claim:
// status survives as an own property, but instanceof does not. Plain errors
// need no web plugins, so plugins stay empty here.

const BOUNDARY_DISABLED_FEATURES = Feature.RegExp;
const BOUNDARY_DEPTH_LIMIT = 64;

function boundaryChunk(data: string): Uint8Array {
  const encoded = new TextEncoder().encode(data);
  const bytes = encoded.length;
  const totalHex = "00000000".substring(0, 8 - bytes.toString(16).length) + bytes.toString(16);
  const head = new TextEncoder().encode(`;0x${totalHex};`);
  const chunk = new Uint8Array(12 + bytes);
  chunk.set(head);
  chunk.set(encoded, 12);
  return chunk;
}

function boundarySerialize(value: unknown): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      toCrossJSONStream(value, {
        disabledFeatures: BOUNDARY_DISABLED_FEATURES,
        depthLimit: BOUNDARY_DEPTH_LIMIT,
        plugins: [],
        onParse(node) {
          controller.enqueue(boundaryChunk(JSON.stringify(node)));
        },
        onDone() {
          controller.close();
        },
      });
    },
  });
}

async function boundaryDeserialize(stream: ReadableStream<Uint8Array>): Promise<unknown> {
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const next = new Uint8Array(buffer.length + value.length);
    next.set(buffer);
    next.set(value, buffer.length);
    buffer = next;
  }
  const chunks = new TextDecoder()
    .decode(buffer)
    .split(/;0x[0-9a-fA-F]{8};/g)
    .filter(Boolean);
  const refs = new Map();
  let result: unknown;
  for (const payload of chunks) {
    result = fromCrossJSON(JSON.parse(payload), {
      refs,
      disabledFeatures: BOUNDARY_DISABLED_FEATURES,
      depthLimit: BOUNDARY_DEPTH_LIMIT,
      plugins: [],
    });
  }
  return result;
}

describe("UnauthorizedError across the server-function boundary", () => {
  it("round-trips as a plain Error with own status=401", async () => {
    const err = new UnauthorizedError();
    const out = (await boundaryDeserialize(boundarySerialize(err))) as Error & { status?: number };

    expect(out).toBeInstanceOf(Error);
    expect(out).not.toBeInstanceOf(UnauthorizedError);
    expect(out.message).toBe("Unauthorized");
    expect(out.name).toBe("UnauthorizedError");
    expect(out.status).toBe(401);
    expect(Object.hasOwn(out, "status")).toBe(true);
  });
});
