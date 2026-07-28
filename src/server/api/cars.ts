"use server";

import { eq, desc, asc } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "~/server/db";
import { cars, carSnapshots, runs } from "~/server/db/schema";
import { insertCarSchema, insertCarSnapshotSchema } from "~/server/db/validation";

// ─── Input schemas (derived, not modifying validation.ts) ─────────────

const carInputSchema = insertCarSchema.omit({
  carId: true,
  createdAt: true,
  updatedAt: true,
});

const snapshotInputSchema = insertCarSnapshotSchema
  .omit({ snapshotId: true, carId: true })
  .extend({ snapshotDate: z.string().optional() });

// ─── Computation helpers ───────────────────────────────────────────────

function computeGearRatio(
  crown: number | null | undefined,
  pinion: number | null | undefined,
): number | null {
  if (crown != null && pinion != null && pinion !== 0) {
    return crown / pinion;
  }
  return null;
}

function computeRollout(
  tireDiaMm: number | null | undefined,
  gearRatio: number | null | undefined,
): number | null {
  if (tireDiaMm != null && gearRatio != null && gearRatio !== 0) {
    return (tireDiaMm * Math.PI) / gearRatio;
  }
  return null;
}

// ─── Server functions ──────────────────────────────────────────────────

export async function createCar(input: unknown) {
  const parsed = carInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid car data: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const gearRatio = computeGearRatio(data.crown, data.pinion) ?? data.gearRatio ?? null;
  const rollout = computeRollout(data.tireDiaMm, gearRatio) ?? data.rollout ?? null;
  const now = new Date().toISOString();

  const db = getDb();
  const [created] = await db
    .insert(cars)
    .values({
      ...data,
      gearRatio,
      rollout,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function listCars() {
  const db = getDb();
  return await db.select().from(cars).orderBy(asc(cars.name));
}

export async function getCar(id: number) {
  const db = getDb();

  const [car] = await db.select().from(cars).where(eq(cars.carId, id));
  if (!car) {
    throw new Error(`Car not found: ${id}`);
  }

  const snapshots = await db
    .select()
    .from(carSnapshots)
    .where(eq(carSnapshots.carId, id))
    .orderBy(desc(carSnapshots.snapshotDate));

  return { ...car, snapshots };
}

export async function updateCar(id: number, input: unknown) {
  const parsed = carInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid car data: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const db = getDb();

  const [current] = await db.select().from(cars).where(eq(cars.carId, id));
  if (!current) {
    throw new Error(`Car not found: ${id}`);
  }

  // Check if performance-critical config fields changed
  const configFields = ["motor", "pinion", "crown", "tireDiaMm", "weightG"] as const;
  const configChanged = configFields.some((field) => data[field] !== current[field]);

  if (configChanged) {
    // Insert snapshot capturing OLD values
    await db.insert(carSnapshots).values({
      carId: id,
      snapshotDate: new Date().toISOString(),
      motor: current.motor,
      pinion: current.pinion,
      crown: current.crown,
      gearRatio: current.gearRatio,
      tireDiaMm: current.tireDiaMm,
      rollout: current.rollout,
      weightG: current.weightG,
      notes: "Auto-snapshot on update",
    });
  }

  // Compute new gearRatio/rollout
  const gearRatio = computeGearRatio(data.crown, data.pinion) ?? data.gearRatio ?? null;
  const rollout = computeRollout(data.tireDiaMm, gearRatio) ?? data.rollout ?? null;

  const [updated] = await db
    .update(cars)
    .set({
      ...data,
      gearRatio,
      rollout,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(cars.carId, id))
    .returning();

  return updated;
}

export async function deleteCar(id: number) {
  const db = getDb();

  // Safety check: block if runs reference this car
  const carRuns = await db.select().from(runs).where(eq(runs.carId, id));
  if (carRuns.length > 0) {
    throw new Error(`Cannot delete car ${id}: ${carRuns.length} run(s) reference this car`);
  }

  // Delete snapshots first (no ON DELETE CASCADE in schema)
  await db.delete(carSnapshots).where(eq(carSnapshots.carId, id));

  // Delete car
  const [deleted] = await db.delete(cars).where(eq(cars.carId, id)).returning();

  if (!deleted) {
    throw new Error(`Car not found: ${id}`);
  }

  return deleted;
}

export async function addSnapshot(carId: number, input: unknown) {
  const parsed = snapshotInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid snapshot data: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const snapshotDate = data.snapshotDate ?? new Date().toISOString();

  const db = getDb();
  const [created] = await db
    .insert(carSnapshots)
    .values({
      ...data,
      carId,
      snapshotDate,
    })
    .returning();

  return created;
}
