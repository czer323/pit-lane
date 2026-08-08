// @vitest-environment node
//
// Unit tests for fleet operations (at_track toggle).
// Tests the pure logic in src/lib/fleet.ts — no "use server", no mocks.
// The mock DB is injected directly.

import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createMockDb } from "~/server/db/test-helpers";
import * as schema from "~/server/db/schema";
import { toggleAtTrack } from "~/lib/fleet";

let db: ReturnType<typeof createMockDb>;

beforeEach(async () => {
  db = createMockDb();
});

async function seedCar(overrides: Partial<typeof schema.cars.$inferInsert> = {}) {
  const car = {
    carId: 1,
    name: "Test Car",
    userId: "user_1",
    atTrack: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
  db.insert(schema.cars).values(car);
  return car;
}

describe("toggleAtTrack", () => {
  it("sets atTrack=true for a car currently false", async () => {
    await seedCar({ atTrack: false });

    const result = await toggleAtTrack(db, { carId: 1, atTrack: true });

    expect(result.atTrack).toBe(true);
  });

  it("sets atTrack=false for a car currently true", async () => {
    await seedCar({ atTrack: true });

    const result = await toggleAtTrack(db, { carId: 1, atTrack: false });

    expect(result.atTrack).toBe(false);
  });

  it("throws when car does not exist", async () => {
    await expect(toggleAtTrack(db, { carId: 999, atTrack: true })).rejects.toThrow("Car not found");
  });

  it("does not change other car fields", async () => {
    await seedCar({ name: "Original", weightG: 85, atTrack: false });

    const result = await toggleAtTrack(db, { carId: 1, atTrack: true });

    expect(result.name).toBe("Original");
    expect(result.weightG).toBe(85);
    expect(result.atTrack).toBe(true);
  });
});
