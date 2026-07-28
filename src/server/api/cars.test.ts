// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vite-plus/test";

import * as schema from "../db/schema";

// ─── Mocks ─────────────────────────────────────────────────────────────
// Mock getDb() to return an in-memory store. This avoids importing
// drizzle-orm/libsql and @libsql/client in tests, which would pull in the
// `ws` package that breaks under vite's `browser` resolve condition.

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("../db", () => ({
  getDb: getDbMock,
  schema: schema,
  createDb: vi.fn(),
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

// ─── Helpers ────────────────────────────────────────────────────────────

function tableName(table: any): string {
  const sym = Object.getOwnPropertySymbols(table).find((s) =>
    s.toString().includes("drizzle:Name"),
  );
  return sym ? table[sym] : "unknown";
}

// ─── In-memory DB ───────────────────────────────────────────────────────

interface CarRow {
  carId: number;
  name: string;
  body: string | null;
  bodyType: string | null;
  chassis: string | null;
  weightG: number | null;
  motor: string | null;
  ampDraw3v: number | null;
  pinion: number | null;
  crown: number | null;
  gearRatio: number | null;
  tireDiaMm: number | null;
  rollout: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SnapshotRow {
  snapshotId: number;
  carId: number;
  snapshotDate: string;
  motor: string | null;
  pinion: number | null;
  crown: number | null;
  gearRatio: number | null;
  tireDiaMm: number | null;
  rollout: number | null;
  weightG: number | null;
  notes: string | null;
}

interface RunRow {
  runId: number;
  eventId: number;
  carId: number;
  sessionType: string;
}

function makeMockDb() {
  let carIdCounter = 0;
  let snapshotIdCounter = 0;
  let runIdCounter = 0;
  let eventIdCounter = 0;
  const carStore = new Map<number, CarRow>();
  const snapshotStore = new Map<number, SnapshotRow>();
  const runStore = new Map<number, RunRow>();
  const eventStore = new Map<number, { eventId: number; eventDate: string; track: string }>();

  function filterByCond<T>(rows: T[], cond: any): T[] {
    if (!cond) return rows;
    // cond.field is the DB column name (e.g. "car_id")
    // Map to the JS property name
    const propMap: Record<string, string> = {
      car_id: "carId",
      snapshot_id: "snapshotId",
      event_id: "eventId",
      run_id: "runId",
    };
    const prop = propMap[cond.field] ?? cond.field;
    return rows.filter((r: any) => r[prop] === cond.value);
  }

  return {
    insert: (table: any) => {
      const doInsert = (data: any) => {
        const tname = tableName(table);
        if (tname === "cars") {
          const id = ++carIdCounter;
          const row: CarRow = {
            carId: id,
            name: data.name,
            body: data.body ?? null,
            bodyType: data.bodyType ?? null,
            chassis: data.chassis ?? null,
            weightG: data.weightG ?? null,
            motor: data.motor ?? null,
            ampDraw3v: data.ampDraw3v ?? null,
            pinion: data.pinion ?? null,
            crown: data.crown ?? null,
            gearRatio: data.gearRatio ?? null,
            tireDiaMm: data.tireDiaMm ?? null,
            rollout: data.rollout ?? null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
          carStore.set(id, row);
          return [row];
        }
        if (tname === "car_snapshots") {
          const id = ++snapshotIdCounter;
          const row: SnapshotRow = {
            snapshotId: id,
            carId: data.carId,
            snapshotDate: data.snapshotDate,
            motor: data.motor ?? null,
            pinion: data.pinion ?? null,
            crown: data.crown ?? null,
            gearRatio: data.gearRatio ?? null,
            tireDiaMm: data.tireDiaMm ?? null,
            rollout: data.rollout ?? null,
            weightG: data.weightG ?? null,
            notes: data.notes ?? null,
          };
          snapshotStore.set(id, row);
          return [row];
        }
        if (tname === "runs") {
          const id = ++runIdCounter;
          const row: RunRow = {
            runId: id,
            eventId: data.eventId,
            carId: data.carId,
            sessionType: data.sessionType,
          };
          runStore.set(id, row);
          return [row];
        }
        if (tname === "events") {
          const id = ++eventIdCounter;
          const row = {
            eventId: id,
            eventDate: data.eventDate,
            track: data.track,
          };
          eventStore.set(id, row);
          return [row];
        }
        return [data];
      };
      return {
        values: (data: any) => ({
          // Support both .returning() and bare await (no .returning())
          returning: async () => doInsert(data),
          then: (resolve: any, reject: any) => {
            Promise.resolve(doInsert(data)).then(resolve, reject);
          },
        }),
      };
    },
    select: () => ({
      from: (table: any) => {
        const tname = tableName(table);

        const baseThen = (cond: any, order: any) => (resolve: any, reject: any) => {
          Promise.resolve()
            .then(() => {
              if (tname === "cars") {
                let rows = Array.from(carStore.values());
                rows = filterByCond(rows, cond);

                if (order && order.dir === "asc") {
                  rows.sort((a, b) => a.name.localeCompare(b.name));
                }
                return rows;
              }
              if (tname === "car_snapshots") {
                let rows = Array.from(snapshotStore.values());
                rows = filterByCond(rows, cond);
                rows.sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
                return rows;
              }
              if (tname === "runs") {
                let rows = Array.from(runStore.values());
                rows = filterByCond(rows, cond);
                return rows;
              }
              if (tname === "events") {
                return Array.from(eventStore.values());
              }
              return [];
            })
            .then(resolve, reject);
        };
        return {
          where: (cond: any) => ({
            orderBy: (order: any) => ({ then: baseThen(cond, order) }),
            then: baseThen(cond, null),
          }),
          orderBy: (order: any) => ({ then: baseThen(null, order) }),
          then: baseThen(null, null),
        };
      },
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: (cond: any) => ({
          returning: async () => {
            const tname = tableName(table);
            if (tname === "cars") {
              const id = cond.value;
              const existing = carStore.get(id);
              if (!existing) return [];
              const updated = { ...existing, ...data };
              carStore.set(id, updated);
              return [updated];
            }
            return [];
          },
        }),
      }),
    }),
    delete: (table: any) => {
      const doDelete = (cond: any) => {
        const tname = tableName(table);
        if (tname === "cars") {
          const id = cond.value;
          const existing = carStore.get(id);
          if (!existing) return [];
          carStore.delete(id);
          for (const [sid, snap] of snapshotStore) {
            if (snap.carId === id) snapshotStore.delete(sid);
          }
          return [existing];
        }
        if (tname === "car_snapshots") {
          const carId = cond.value;
          for (const [sid, snap] of snapshotStore) {
            if (snap.carId === carId) snapshotStore.delete(sid);
          }
          return [];
        }
        return [];
      };
      return {
        where: (cond: any) => ({
          returning: async () => doDelete(cond),
          then: (resolve: any, reject: any) => {
            Promise.resolve(doDelete(cond)).then(resolve, reject);
          },
        }),
      };
    },
    run: async () => {},
  };
}

beforeEach(() => {
  const db = makeMockDb();
  getDbMock.mockReturnValue(db);
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
    await expect(createCar({ body: "S10" })).rejects.toThrow();
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
