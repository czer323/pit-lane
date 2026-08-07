// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vite-plus/test";

import * as schema from "../db/schema";

// ─── Mocks ─────────────────────────────────────────────────────────────

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn<() => any>() }));
vi.mock("../db", () => ({
  getDb: getDbMock,
  schema: schema,
  createDb: vi.fn<() => void>(),
}));

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

import { createRun, listRuns, getRun, updateRun, deleteRun } from "./runs";
import { createMockDb } from "../db/test-helpers";

// ─── Setup ──────────────────────────────────────────────────────────────

const TEST_USER = "test-user-1";

beforeEach(() => {
  getDbMock.mockReturnValue(createMockDb());
  getCurrentUserIdMock.mockResolvedValue(TEST_USER);
});

// ─── Helpers ────────────────────────────────────────────────────────────

async function seedEventAndCar(db: any) {
  await db.insert(schema.events).values({
    eventDate: "2026-07-28",
    track: "Atlanta Dragway",
    userId: TEST_USER,
  });
  await db.insert(schema.cars).values({ name: "Test Car", userId: TEST_USER });
  const [event] = await db.select().from(schema.events);
  const [car] = await db.select().from(schema.cars);
  return { eventId: event.eventId!, carId: car.carId! };
}

// ─── createRun ──────────────────────────────────────────────────────────

describe("createRun", () => {
  it("creates a practice run with required fields", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    const result = await createRun({
      eventId,
      carId,
      sessionType: "Practice",
      et: 4.321,
      mph: 28.7,
    });

    expect(result.run.runId).toBeDefined();
    expect(result.run.eventId).toBe(eventId);
    expect(result.run.carId).toBe(carId);
    expect(result.run.sessionType).toBe("Practice");
    expect(result.run.et).toBe(4.321);
    expect(result.run.mph).toBe(28.7);
    expect(result.run.round).toBeNull();
    expect(result.run.dialIn).toBeNull();
    expect(result.run.win).toBeNull();
    expect(result.run.lane).toBeNull();
    expect(result.warnings).toHaveLength(0);
  });

  it("creates an elimination run with round and dialIn", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    const result = await createRun({
      eventId,
      carId,
      lane: "Left",
      sessionType: "Elimination",
      round: 1,
      rt: 0.012,
      et: 4.298,
      mph: 29.1,
      dialIn: 4.3,
      win: true,
      comments: "Clean pass",
    });

    expect(result.run.runId).toBeDefined();
    expect(result.run.sessionType).toBe("Elimination");
    expect(result.run.round).toBe(1);
    expect(result.run.dialIn).toBe(4.3);
    expect(result.run.win).toBe(true);
    expect(result.run.lane).toBe("Left");
    expect(result.run.comments).toBe("Clean pass");
  });

  it("rejects input missing required eventId", async () => {
    await expect(createRun({ carId: 1, sessionType: "Practice", et: 4.3 })).rejects.toThrow(
      "Invalid run data",
    );
  });

  it("rejects input missing required carId", async () => {
    await expect(createRun({ eventId: 1, sessionType: "Practice", et: 4.3 })).rejects.toThrow(
      "Invalid run data",
    );
  });

  it("rejects input missing required sessionType", async () => {
    await expect(createRun({ eventId: 1, carId: 1, et: 4.3 })).rejects.toThrow("Invalid run data");
  });

  it("rejects practice run with dialIn (enforcement)", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    await expect(
      createRun({ eventId, carId, sessionType: "Practice", et: 4.3, dialIn: 4.5 }),
    ).rejects.toThrow("Invalid run data");
  });

  it("rejects practice run with round (enforcement)", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    await expect(
      createRun({ eventId, carId, sessionType: "Practice", et: 4.3, round: 1 }),
    ).rejects.toThrow("Invalid run data");
  });

  it("returns warnings from validateRun", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    // Left lane with low sixtyFt triggers ghost sensor warning
    const result = await createRun({
      eventId,
      carId,
      lane: "Left",
      sessionType: "Practice",
      et: 4.3,
      sixtyFt: 0.095,
    });

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w: any) => w.field === "sixtyFt")).toBe(true);
  });
});

// ─── listRuns ───────────────────────────────────────────────────────────

describe("listRuns", () => {
  it("returns runs for an event with car name", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    await createRun({ eventId, carId, sessionType: "Practice", et: 4.321 });
    await createRun({ eventId, carId, sessionType: "Elimination", round: 1, et: 4.298 });

    const runs = await listRuns(eventId);
    expect(runs).toHaveLength(2);
    expect(runs[0].carName).toBe("Test Car");
    expect(runs[0].runId).toBeDefined();
  });

  it("returns runs ordered by sessionType (Practice first), then round, then car name", async () => {
    const db = getDbMock();
    const { eventId, carId: car1 } = await seedEventAndCar(db);

    // Add a second car
    await db.insert(schema.cars).values({ name: "Alpha Car", userId: TEST_USER });
    const [car2] = await db
      .select()
      .from(schema.cars)
      .then((rows: any[]) => rows.filter((r: any) => r.carId !== car1));

    await createRun({ eventId, carId: car2.carId!, sessionType: "Practice", et: 4.5 });
    await createRun({ eventId, carId: car1, sessionType: "Elimination", round: 2, et: 4.2 });
    await createRun({ eventId, carId: car1, sessionType: "Practice", et: 4.3 });
    await createRun({ eventId, carId: car1, sessionType: "Elimination", round: 1, et: 4.1 });

    const runs = await listRuns(eventId);
    expect(runs).toHaveLength(4);
    // All Practice before Elimination
    expect(runs[0].sessionType).toBe("Practice");
    expect(runs[1].sessionType).toBe("Practice");
    // Within Practice, sorted by car name
    expect(runs[0].carName).toBe("Alpha Car");
    expect(runs[1].carName).toBe("Test Car");
    // Within Elimination, sorted by round then car name
    expect(runs[2].sessionType).toBe("Elimination");
    expect(runs[2].round).toBe(1);
    expect(runs[3].sessionType).toBe("Elimination");
    expect(runs[3].round).toBe(2);
  });

  it("returns empty array when no runs exist for event", async () => {
    const runs = await listRuns(999);
    expect(runs).toHaveLength(0);
  });
});

// ─── getRun ─────────────────────────────────────────────────────────────

describe("getRun", () => {
  it("returns a run with car name and snapshot by ID", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    const { run } = await createRun({
      eventId,
      carId,
      sessionType: "Practice",
      et: 4.321,
    });

    const found = await getRun(run.runId!);
    expect(found.runId).toBe(run.runId);
    expect(found.eventId).toBe(eventId);
    expect(found.carId).toBe(carId);
    expect(found.carName).toBe("Test Car");
    expect(found.sessionType).toBe("Practice");
    expect(found.et).toBe(4.321);
  });

  it("throws when run not found", async () => {
    await expect(getRun(99999)).rejects.toThrow("Run not found");
  });
});

// ─── updateRun ──────────────────────────────────────────────────────────

describe("updateRun", () => {
  it("updates run fields", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    const { run } = await createRun({
      eventId,
      carId,
      sessionType: "Practice",
      et: 4.321,
    });

    const result = await updateRun(run.runId!, {
      eventId,
      carId,
      sessionType: "Practice",
      et: 4.5,
      mph: 29.5,
      comments: "Updated time",
    });

    expect(result.run.runId).toBe(run.runId);
    expect(result.run.et).toBe(4.5);
    expect(result.run.mph).toBe(29.5);
    expect(result.run.comments).toBe("Updated time");
    expect(result.warnings).toHaveLength(0);
  });

  it("throws when run not found", async () => {
    await expect(
      updateRun(99999, { eventId: 1, carId: 1, sessionType: "Practice", et: 4.3 }),
    ).rejects.toThrow("Run not found");
  });

  it("returns warnings from validateRun on update", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    const { run } = await createRun({
      eventId,
      carId,
      sessionType: "Practice",
      et: 4.321,
    });

    // Update with mph > 90 triggers warning
    const result = await updateRun(run.runId!, {
      eventId,
      carId,
      sessionType: "Practice",
      et: 4.3,
      mph: 95,
    });

    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w: any) => w.field === "mph")).toBe(true);
  });
});

// ─── deleteRun ──────────────────────────────────────────────────────────

describe("deleteRun", () => {
  it("deletes a run", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    const { run } = await createRun({
      eventId,
      carId,
      sessionType: "Practice",
      et: 4.321,
    });

    const deleted = await deleteRun(run.runId!);
    expect(deleted.runId).toBe(run.runId);
    expect(deleted.eventId).toBe(eventId);

    await expect(getRun(run.runId!)).rejects.toThrow("Run not found");
  });

  it("throws when run not found", async () => {
    await expect(deleteRun(99999)).rejects.toThrow("Run not found");
  });
});

// ─── Ownership / adversarial tests ─────────────────────────────────────

describe("ownership isolation", () => {
  it("throws Unauthorized when signed out", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);
    await expect(listRuns(1)).rejects.toThrow("Unauthorized");
  });

  it("cannot create a run referencing another user's event or car", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);

    // Switch to a different user who owns neither
    getCurrentUserIdMock.mockResolvedValue("test-user-2");

    // Event ownership checked first: another user's event is rejected
    await expect(createRun({ eventId, carId, sessionType: "Practice", et: 4.3 })).rejects.toThrow(
      "Event not found",
    );

    // Even with an event the caller owns, a car they don't own is rejected.
    // Create a user-2 event, then try user-2's event with user-1's car.
    await db.insert(schema.events).values({
      eventDate: "2026-07-29",
      track: "User 2 Track",
      userId: "test-user-2",
    });
    const allEvents = await db.select().from(schema.events);
    const ev2 = allEvents.find((e: any) => e.userId === "test-user-2");
    await expect(
      createRun({ eventId: ev2.eventId!, carId, sessionType: "Practice", et: 4.3 }),
    ).rejects.toThrow("Car not found");
  });

  it("does not list, get, or delete another user's runs", async () => {
    const db = getDbMock();
    const { eventId, carId } = await seedEventAndCar(db);
    const { run } = await createRun({ eventId, carId, sessionType: "Practice", et: 4.3 });

    getCurrentUserIdMock.mockResolvedValue("test-user-2");
    const runs = await listRuns(eventId);
    expect(runs).toHaveLength(0);

    await expect(getRun(run.runId!)).rejects.toThrow("Run not found");
    await expect(deleteRun(run.runId!)).rejects.toThrow("Run not found");
  });
});
