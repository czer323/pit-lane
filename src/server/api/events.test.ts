// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vite-plus/test";

import * as schema from "../db/schema";

// ─── Mocks ─────────────────────────────────────────────────────────────
// Mock getDb() to return an in-memory store. This avoids importing
// drizzle-orm/libsql and @libsql/client in tests, which would pull in the
// `ws` package that breaks under vite's `browser` resolve condition.

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn<() => any>() }));
vi.mock("../db", () => ({
  getDb: getDbMock,
  schema: schema,
  createDb: vi.fn<() => void>(),
}));

// Mock drizzle-orm operators so our mock DB can interpret them
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: any, val: any) => ({ field: col.name, value: val }),
    desc: (col: any) => ({ field: col.name, dir: "desc" }),
    asc: (col: any) => ({ field: col.name, dir: "asc" }),
    and: (...conds: any[]) => ({ and: conds }),
  };
});

// Mock the session helper: tests run authenticated as a fixed user.
const { getCurrentUserIdMock } = vi.hoisted(() => ({
  getCurrentUserIdMock: vi.fn<() => Promise<string | null>>(),
}));
vi.mock("~/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

import { createEvent, listEvents, getEvent, updateEvent, deleteEvent } from "./events";
import { createMockDb } from "../db/test-helpers";

// ─── Setup ──────────────────────────────────────────────────────────────

const TEST_USER = "test-user-1";

beforeEach(() => {
  getDbMock.mockReturnValue(createMockDb());
  getCurrentUserIdMock.mockResolvedValue(TEST_USER);
});

// ─── createEvent ────────────────────────────────────────────────────────

describe("createEvent", () => {
  it("creates an event with only required fields (eventDate + track)", async () => {
    const event = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
    });

    expect(event.eventId).toBeDefined();
    expect(event.eventDate).toBe("2026-07-28");
    expect(event.track).toBe("Atlanta Dragway");
    expect(event.sessionLabel).toBeUndefined();
    expect(event.temperatureF).toBeUndefined();
    expect(event.humidityPct).toBeUndefined();
    expect(event.notes).toBeUndefined();
  });

  it("creates an event with all optional fields", async () => {
    const event = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 1",
      temperatureF: 85,
      humidityPct: 60,
      notes: "Hot and humid",
    });

    expect(event.eventId).toBeDefined();
    expect(event.sessionLabel).toBe("Round 1");
    expect(event.temperatureF).toBe(85);
    expect(event.humidityPct).toBe(60);
    expect(event.notes).toBe("Hot and humid");
  });

  it("rejects input missing required eventDate", async () => {
    await expect(createEvent({ track: "Atlanta Dragway" })).rejects.toThrow("Invalid event data");
  });

  it("rejects input missing required track", async () => {
    await expect(createEvent({ eventDate: "2026-07-28" })).rejects.toThrow("Invalid event data");
  });

  it("rejects duplicate natural key (same eventDate + track + sessionLabel)", async () => {
    await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 1",
    });

    await expect(
      createEvent({
        eventDate: "2026-07-28",
        track: "Atlanta Dragway",
        sessionLabel: "Round 1",
      }),
    ).rejects.toThrow("Duplicate event");
  });

  it("allows same date + track with different sessionLabel", async () => {
    await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 1",
    });

    const event = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 2",
    });

    expect(event.sessionLabel).toBe("Round 2");
  });

  it("allows same date + sessionLabel at different track", async () => {
    await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 1",
    });

    const event = await createEvent({
      eventDate: "2026-07-28",
      track: "Palm Beach",
      sessionLabel: "Round 1",
    });

    expect(event.track).toBe("Palm Beach");
  });

  it("allows multiple events with null sessionLabel at same date+track", async () => {
    await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
    });

    // SQLite unique constraint treats NULLs as distinct, so this should succeed
    const event = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
    });

    expect(event.eventId).toBeDefined();
  });
});

// ─── listEvents ─────────────────────────────────────────────────────────

describe("listEvents", () => {
  it("returns events sorted by date DESC (most recent first)", async () => {
    await createEvent({ eventDate: "2026-01-15", track: "Track A" });
    await createEvent({ eventDate: "2026-07-28", track: "Track B" });
    await createEvent({ eventDate: "2026-03-01", track: "Track C" });

    const all = await listEvents();
    expect(all).toHaveLength(3);
    expect(all[0].eventDate).toBe("2026-07-28");
    expect(all[1].eventDate).toBe("2026-03-01");
    expect(all[2].eventDate).toBe("2026-01-15");
  });

  it("includes runCount for each event", async () => {
    const { eventId } = await createEvent({ eventDate: "2026-07-28", track: "Track A" });

    // Add runs directly to the mock DB
    const db = getDbMock();
    await db.insert(schema.runs).values({
      eventId,
      carId: 1,
      sessionType: "Practice",
    });
    await db.insert(schema.runs).values({
      eventId,
      carId: 2,
      sessionType: "Elimination",
    });

    const all = await listEvents();
    expect(all).toHaveLength(1);
    expect(all[0].runCount).toBe(2);
  });

  it("returns runCount as 0 when no runs exist", async () => {
    await createEvent({ eventDate: "2026-07-28", track: "Track A" });

    const all = await listEvents();
    expect(all).toHaveLength(1);
    expect(all[0].runCount).toBe(0);
  });

  it("returns empty array when no events exist", async () => {
    const all = await listEvents();
    expect(all).toHaveLength(0);
  });
});

// ─── getEvent ───────────────────────────────────────────────────────────

describe("getEvent", () => {
  it("returns an event by ID", async () => {
    const created = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 1",
      temperatureF: 85,
    });

    const event = await getEvent(created.eventId!);
    expect(event.eventId).toBe(created.eventId);
    expect(event.eventDate).toBe("2026-07-28");
    expect(event.track).toBe("Atlanta Dragway");
    expect(event.sessionLabel).toBe("Round 1");
    expect(event.temperatureF).toBe(85);
  });

  it("throws when event not found", async () => {
    await expect(getEvent(99999)).rejects.toThrow("Event not found");
  });
});

// ─── updateEvent ────────────────────────────────────────────────────────

describe("updateEvent", () => {
  it("updates event fields", async () => {
    const created = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
    });
    const eventId = created.eventId!;

    const updated = await updateEvent(eventId, {
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      temperatureF: 90,
      humidityPct: 55,
      notes: "Weather improved",
    });

    expect(updated.temperatureF).toBe(90);
    expect(updated.humidityPct).toBe(55);
    expect(updated.notes).toBe("Weather improved");
  });

  it("rejects update that creates natural key conflict", async () => {
    await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 1",
    });
    const second = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 2",
    });

    // Attempt to change second's sessionLabel to Round 1 — conflict
    await expect(
      updateEvent(second.eventId!, {
        eventDate: "2026-07-28",
        track: "Atlanta Dragway",
        sessionLabel: "Round 1",
      }),
    ).rejects.toThrow("Duplicate event");
  });

  it("allows update that preserves its own natural key", async () => {
    const created = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 1",
    });
    const eventId = created.eventId!;

    const updated = await updateEvent(eventId, {
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
      sessionLabel: "Round 1",
      notes: "Still the same event",
    });

    expect(updated.notes).toBe("Still the same event");
  });

  it("allows changing to a non-conflicting natural key", async () => {
    const created = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
    });

    const updated = await updateEvent(created.eventId!, {
      eventDate: "2026-07-29",
      track: "Atlanta Dragway",
    });

    expect(updated.eventDate).toBe("2026-07-29");
  });

  it("throws when event not found", async () => {
    await expect(updateEvent(99999, { eventDate: "2026-07-28", track: "Nowhere" })).rejects.toThrow(
      "Event not found",
    );
  });
});

// ─── deleteEvent ────────────────────────────────────────────────────────

describe("deleteEvent", () => {
  it("deletes an event with no runs", async () => {
    const created = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
    });
    const eventId = created.eventId!;

    const deleted = await deleteEvent(eventId);
    expect(deleted.eventId).toBe(eventId);

    await expect(getEvent(eventId)).rejects.toThrow("Event not found");
  });

  it("blocks deletion when event has runs", async () => {
    const created = await createEvent({
      eventDate: "2026-07-28",
      track: "Atlanta Dragway",
    });
    const eventId = created.eventId!;

    const db = getDbMock();
    await db.insert(schema.runs).values({
      eventId,
      carId: 1,
      sessionType: "Practice",
      userId: TEST_USER,
    });

    await expect(deleteEvent(eventId)).rejects.toThrow("Cannot delete event");

    // Event should still exist
    const event = await getEvent(eventId);
    expect(event.eventId).toBe(eventId);
  });

  it("throws when event not found", async () => {
    await expect(deleteEvent(99999)).rejects.toThrow("Event not found");
  });
});
