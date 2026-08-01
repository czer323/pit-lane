"use server";

import { eq } from "drizzle-orm";

import { getDb } from "~/server/db";
import { runs, cars, carSnapshots } from "~/server/db/schema";
import { insertRunSchema, validateRun } from "~/server/db/validation";
import type { ValidationWarning } from "~/server/db/validation";

// ─── Input schema (derived, not modifying validation.ts) ─────────────

const runInputSchema = insertRunSchema.omit({
  runId: true,
});

// ─── Types ──────────────────────────────────────────────────────────────

export interface RunWithCar {
  runId: number;
  eventId: number;
  carId: number;
  carVersionId: number | null;
  lane: string | null;
  sessionType: string;
  round: number | null;
  rt: number | null;
  sixtyFt: number | null;
  three30Ft: number | null;
  et: number | null;
  mph: number | null;
  dialIn: number | null;
  win: boolean | null;
  temperatureF: number | null;
  humidityPct: number | null;
  comments: string | null;
  carName: string;
  snapshot: Record<string, unknown> | null;
}

export interface RunResult {
  run: RunWithCar;
  warnings: ValidationWarning[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Fetch all cars and snapshots once, then enrich a list of runs with
 * car name and snapshot info.
 */
async function enrichRuns(
  db: ReturnType<typeof getDb>,
  runRows: Array<Record<string, unknown>>,
): Promise<RunWithCar[]> {
  const allCars = await db.select().from(cars);
  const carById = new Map<number, Record<string, unknown>>();
  for (const c of allCars) {
    carById.set(c.carId as number, c);
  }

  const allSnapshots = await db.select().from(carSnapshots);
  const snapById = new Map<number, Record<string, unknown>>();
  for (const s of allSnapshots) {
    snapById.set(s.snapshotId as number, s);
  }

  return runRows.map((run) => {
    const car = carById.get(run.carId as number);
    const snapshot =
      run.carVersionId != null ? (snapById.get(run.carVersionId as number) ?? null) : null;
    return {
      ...run,
      carName: car?.name ?? "Unknown car",
      snapshot,
    } as unknown as RunWithCar;
  });
}

/** Build snapshot map for validateRun when carVersionId is provided. */
async function buildSnapshotMap(
  db: ReturnType<typeof getDb>,
): Promise<Map<number, { carId: number }> | undefined> {
  const all = await db.select().from(carSnapshots);
  const map = new Map<number, { carId: number }>();
  for (const s of all) {
    map.set(s.snapshotId as number, { carId: s.carId as number });
  }
  return map;
}

// ─── Server functions ──────────────────────────────────────────────────

export async function createRun(input: unknown): Promise<RunResult> {
  const parsed = runInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid run data: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const db = getDb();

  // Build snapshot map if carVersionId is present
  const snapshots = data.carVersionId != null ? await buildSnapshotMap(db) : undefined;

  // Normalize — ensure nullable fields are null, not undefined (selectRunSchema is strict)
  const nullableFields = [
    "lane",
    "carVersionId",
    "round",
    "rt",
    "sixtyFt",
    "three30Ft",
    "mph",
    "dialIn",
    "win",
    "temperatureF",
    "humidityPct",
    "comments",
  ] as const;
  const syntheticRun: Record<string, unknown> = { runId: 0, ...data };
  for (const f of nullableFields) {
    if (syntheticRun[f] === undefined) {
      syntheticRun[f] = null;
    }
  }

  // Use validateRun for domain enforcement + warnings
  const validated = validateRun(syntheticRun, snapshots);
  if (!validated.success) {
    throw new Error(`Invalid run data: ${validated.errors.message}`);
  }

  // Insert using the input-parsed data (validateRun already confirmed validity)
  const [created] = await db.insert(runs).values(data).returning();

  const [enriched] = await enrichRuns(db, [created]);
  return { run: enriched, warnings: validated.warnings };
}

export async function listRuns(eventId: number): Promise<RunWithCar[]> {
  const db = getDb();
  const allRuns = await db.select().from(runs).where(eq(runs.eventId, eventId));

  if (allRuns.length === 0) {
    return [];
  }

  const enriched = await enrichRuns(db, allRuns);

  // Sort by heat (sessionType, round) then car name
  const sessionRank: Record<string, number> = { Practice: 0, Elimination: 1 };
  enriched.sort((a, b) => {
    const sa = sessionRank[a.sessionType] ?? 99;
    const sb = sessionRank[b.sessionType] ?? 99;
    if (sa !== sb) return sa - sb;
    const ra = a.round ?? 0;
    const rb = b.round ?? 0;
    if (ra !== rb) return ra - rb;
    return (a.carName ?? "").localeCompare(b.carName ?? "");
  });

  return enriched;
}

export async function getRun(id: number): Promise<RunWithCar> {
  const db = getDb();

  const [runRow] = await db.select().from(runs).where(eq(runs.runId, id));
  if (!runRow) {
    throw new Error(`Run not found: ${id}`);
  }

  const [enriched] = await enrichRuns(db, [runRow]);
  return enriched;
}

export async function updateRun(id: number, input: unknown): Promise<RunResult> {
  const parsed = runInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid run data: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const db = getDb();

  // Check run exists
  const [current] = await db.select().from(runs).where(eq(runs.runId, id));
  if (!current) {
    throw new Error(`Run not found: ${id}`);
  }

  // Build snapshot map if carVersionId is present
  const snapshots = data.carVersionId != null ? await buildSnapshotMap(db) : undefined;

  // Normalize — ensure nullable fields are null, not undefined (selectRunSchema is strict)
  const nullableFields = [
    "lane",
    "carVersionId",
    "round",
    "rt",
    "sixtyFt",
    "three30Ft",
    "mph",
    "dialIn",
    "win",
    "temperatureF",
    "humidityPct",
    "comments",
  ] as const;
  const syntheticRun: Record<string, unknown> = { runId: id, ...data };
  for (const f of nullableFields) {
    if (syntheticRun[f] === undefined) {
      syntheticRun[f] = null;
    }
  }

  // Use validateRun for domain enforcement + warnings
  const validated = validateRun(syntheticRun, snapshots);
  if (!validated.success) {
    throw new Error(`Invalid run data: ${validated.errors.message}`);
  }

  // Update using the input-parsed data (validateRun already confirmed validity)
  const [updated] = await db.update(runs).set(data).where(eq(runs.runId, id)).returning();

  const [enriched] = await enrichRuns(db, [updated]);
  return { run: enriched, warnings: validated.warnings };
}

export async function deleteRun(id: number): Promise<RunWithCar> {
  const db = getDb();

  const [deleted] = await db.delete(runs).where(eq(runs.runId, id)).returning();
  if (!deleted) {
    throw new Error(`Run not found: ${id}`);
  }

  const [enriched] = await enrichRuns(db, [deleted]);
  return enriched;
}
