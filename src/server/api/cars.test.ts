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
  };
});

import { createCar, listCars, getCar, updateCar, deleteCar, addSnapshot } from "./cars";

import { createMockDb } from "../db/test-helpers";
// ─── Helpers ────────────────────────────────────────────────────────────
// Note: drizzle-orm operators are already mocked above (eq/desc/asc)

beforeEach(() => {
  getDbMock.mockReturnValue(createMockDb());
});

// ─── createCar ──────────────────────────────────────────────────────────

describe("createCar", () => {
  it("creates a car and auto-computes gearRatio and rollout", async () => {
    const car = await createCar({
      name: "Test Car",
      body: "S10",
      bodyType: "lexan",
      chassis: "wire",
      weightG: 85,
      motor: "FK-180SH-15350",
      ampDraw3v: 0.48,
      pinion: 9,
      crown: 27,
      tireDiaMm: 22.5,
    });

    expect(car.carId).toBeDefined();
    expect(car.name).toBe("Test Car");
    expect(car.gearRatio).toBeCloseTo(3.0, 5);
    expect(car.rollout).toBeCloseTo((22.5 * Math.PI) / 3.0, 5);
    expect(car.createdAt).toBeDefined();
    expect(car.updatedAt).toBeDefined();
  });

  it("rejects invalid input (missing required name)", async () => {
    await expect(createCar({ body: "S10" })).rejects.toThrow("Invalid car data");
  });
});

// ─── listCars ───────────────────────────────────────────────────────────

describe("listCars", () => {
  it("returns all cars ordered by name", async () => {
    await createCar({ name: "Zebra Car" });
    await createCar({ name: "Alpha Car" });
    await createCar({ name: "Mid Car" });

    const all = await listCars();
    expect(all).toHaveLength(3);
    expect(all[0].name).toBe("Alpha Car");
    expect(all[1].name).toBe("Mid Car");
    expect(all[2].name).toBe("Zebra Car");
  });
});

// ─── getCar ─────────────────────────────────────────────────────────────

describe("getCar", () => {
  it("returns car with empty snapshots array when no snapshots exist", async () => {
    const created = await createCar({ name: "Solo Car" });
    const result = await getCar(created.carId!);

    expect(result.name).toBe("Solo Car");
    expect(result.snapshots).toHaveLength(0);
  });

  it("returns car with snapshots ordered by snapshotDate DESC", async () => {
    const created = await createCar({ name: "Versioned Car" });
    const carId = created.carId!;

    await addSnapshot(carId, {
      snapshotDate: "2026-01-01T00:00:00.000Z",
      motor: "Old Motor",
      notes: "First version",
    });
    await addSnapshot(carId, {
      snapshotDate: "2026-06-01T00:00:00.000Z",
      motor: "New Motor",
      notes: "Motor swap",
    });

    const result = await getCar(carId);
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0].motor).toBe("New Motor");
    expect(result.snapshots[1].motor).toBe("Old Motor");
  });

  it("throws when car not found", async () => {
    await expect(getCar(99999)).rejects.toThrow("Car not found");
  });
});

// ─── updateCar ──────────────────────────────────────────────────────────

describe("updateCar", () => {
  it("updates car fields and inserts snapshot when config changes", async () => {
    const created = await createCar({
      name: "Update Me",
      motor: "FK-180SH-15350",
      pinion: 9,
      crown: 27,
      tireDiaMm: 22.5,
      weightG: 85,
    });
    const carId = created.carId!;

    const updated = await updateCar(carId, {
      name: "Update Me",
      motor: "FK-180SH-20500",
      pinion: 9,
      crown: 27,
      tireDiaMm: 22.5,
      weightG: 85,
    });

    expect(updated.motor).toBe("FK-180SH-20500");

    const result = await getCar(carId);
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].motor).toBe("FK-180SH-15350");
  });

  it("does not insert snapshot when only non-config fields change", async () => {
    const created = await createCar({
      name: "No Snapshot",
      motor: "FK-180SH-15350",
      pinion: 9,
      crown: 27,
      tireDiaMm: 22.5,
      weightG: 85,
    });
    const carId = created.carId!;

    await updateCar(carId, {
      name: "Renamed Car",
      motor: "FK-180SH-15350",
      pinion: 9,
      crown: 27,
      tireDiaMm: 22.5,
      weightG: 85,
    });

    const result = await getCar(carId);
    expect(result.snapshots).toHaveLength(0);
  });

  it("recomputes gearRatio and rollout on update", async () => {
    const created = await createCar({
      name: "Gear Test",
      pinion: 9,
      crown: 27,
      tireDiaMm: 22.5,
    });
    const carId = created.carId!;

    const updated = await updateCar(carId, {
      name: "Gear Test",
      pinion: 10,
      crown: 30,
      tireDiaMm: 22.5,
    });

    expect(updated.gearRatio).toBeCloseTo(3.0, 5);
    expect(updated.rollout).toBeCloseTo((22.5 * Math.PI) / 3.0, 5);
  });

  it("throws when car not found", async () => {
    await expect(updateCar(99999, { name: "Ghost" })).rejects.toThrow("Car not found");
  });
});

// ─── deleteCar ──────────────────────────────────────────────────────────

describe("deleteCar", () => {
  it("deletes a car with no runs", async () => {
    const created = await createCar({ name: "Delete Me" });
    const carId = created.carId!;

    const deleted = await deleteCar(carId);
    expect(deleted.carId).toBe(carId);

    await expect(getCar(carId)).rejects.toThrow("Car not found");
  });

  it("deletes associated snapshots when deleting car", async () => {
    const created = await createCar({ name: "With Snapshots" });
    const carId = created.carId!;

    await addSnapshot(carId, {
      snapshotDate: "2026-01-01T00:00:00.000Z",
      motor: "Old Motor",
    });

    await deleteCar(carId);
    await expect(getCar(carId)).rejects.toThrow("Car not found");
  });

  it("blocks deletion when car has runs", async () => {
    const car = await createCar({ name: "Has Runs" });
    const carId = car.carId!;

    const db = getDbMock();
    await db.insert(schema.events).values({
      eventDate: "2026-07-28",
      track: "Test Track",
    });
    const [event] = await db.select().from(schema.events);
    await db.insert(schema.runs).values({
      eventId: event.eventId!,
      carId,
      sessionType: "Practice",
    });

    await expect(deleteCar(carId)).rejects.toThrow("Cannot delete car");
  });

  it("throws when car not found", async () => {
    await expect(deleteCar(99999)).rejects.toThrow("Car not found");
  });
});

// ─── addSnapshot ────────────────────────────────────────────────────────

describe("addSnapshot", () => {
  it("creates a snapshot with provided data", async () => {
    const car = await createCar({ name: "Snapshot Test" });
    const carId = car.carId!;

    const snapshot = await addSnapshot(carId, {
      snapshotDate: "2026-03-15T00:00:00.000Z",
      motor: "PS-4000X",
      pinion: 8,
      crown: 28,
      gearRatio: 3.5,
      tireDiaMm: 21.0,
      rollout: 18.85,
      weightG: 82,
      notes: "Gear change for more top end",
    });

    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.carId).toBe(carId);
    expect(snapshot.motor).toBe("PS-4000X");
    expect(snapshot.notes).toBe("Gear change for more top end");
  });

  it("defaults snapshotDate to current time when not provided", async () => {
    const car = await createCar({ name: "Default Date" });
    const snapshot = await addSnapshot(car.carId!, { motor: "Some Motor" });

    expect(snapshot.snapshotDate).toBeDefined();
    expect(new Date(snapshot.snapshotDate).getTime()).not.toBeNaN();
  });
});
