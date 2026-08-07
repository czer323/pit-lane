import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import middleware from "./index";
import { getSession } from "~/lib/session";

// createMiddleware(array) returns the array unchanged; mock the package so
// tests don't load @solidjs/start/middleware (which imports the not-installed
// "server-only" marker, virtualized only by SolidStart's build plugin).
vi.mock("@solidjs/start/middleware", () => ({ createMiddleware: (args: unknown[]) => args }));
vi.mock("~/lib/session", () => ({
  getSession: vi.fn<() => Promise<unknown>>(),
}));

const getSessionMock = vi.mocked(getSession);
const next = vi.fn<() => Promise<Response>>(async () => new Response("passed through"));

function fakeEvent(path: string) {
  return { path };
}

const guard = middleware[0] as unknown as (
  event: { path: string },
  next: () => Promise<unknown>,
) => Promise<unknown>;

describe("auth middleware", () => {
  beforeEach(() => {
    next.mockClear();
    getSessionMock.mockReset();
  });

  it("redirects signed-out requests for app pages to /login", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await guard(fakeEvent("/cars"), next);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(302);
    expect((res as Response).headers.get("Location")).toBe("/login");
    expect(next).not.toHaveBeenCalled();
  });

  it("passes through signed-in requests for app pages", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        email: "racer@example.com",
        emailVerified: true,
        name: "Racer",
      },
      session: {
        id: "s1",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "u1",
        expiresAt: new Date(Date.now() + 3_600_000),
        token: "session-token",
      },
    });
    await guard(fakeEvent("/cars"), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("passes through public paths without checking the session", async () => {
    getSessionMock.mockResolvedValue(null);
    for (const path of ["/login", "/api/auth/get-session", "/_server/cars.listCars"]) {
      next.mockClear();
      await guard(fakeEvent(path), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});
