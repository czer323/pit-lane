import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { cars, carSnapshots, events, runs } from "./schema";

// ─── Base schemas (auto-generated from Drizzle) ────────────────────────
// userId is a nullable ownership column set by auth middleware later, so it
// is optional at the validation boundary (legacy data has no owner yet).

export const insertCarSchema = createInsertSchema(cars).extend({
  userId: z.string().nullish(),
});
export const selectCarSchema = createSelectSchema(cars).extend({
  userId: z.string().nullish(),
});

export const insertCarSnapshotSchema = createInsertSchema(carSnapshots);
export const selectCarSnapshotSchema = createSelectSchema(carSnapshots);

export const insertEventSchema = createInsertSchema(events).extend({
  userId: z.string().nullish(),
});
export const selectEventSchema = createSelectSchema(events).extend({
  userId: z.string().nullish(),
});

export const insertRunSchema = createInsertSchema(runs).extend({
  userId: z.string().nullish(),
});
export const selectRunSchema = createSelectSchema(runs).extend({
  userId: z.string().nullish(),
});

// ─── Validation helpers ────────────────────────────────────────────────

export interface ValidationWarning {
  field: string;
  message: string;
}

export type Validated<T> =
  | { success: true; data: T; warnings: ValidationWarning[] }
  | { success: false; errors: z.ZodError };

// ─── Run schema with domain refinements ────────────────────────────────

/**
 * Fully validated run schema with domain-specific rules.
 *
 * Enforcements reject invalid data.
 * Warnings are collected and returned alongside the parsed data.
 */
export function validateRun(
  input: unknown,
  snapshots?: Map<number, { carId: number }>,
): Validated<z.infer<typeof selectRunSchema>> {
  const warnings: ValidationWarning[] = [];

  // Base parse first — type-level validation
  const baseParse = selectRunSchema.safeParse(input);
  if (!baseParse.success) {
    return { success: false, errors: baseParse.error };
  }

  const data = baseParse.data;

  // ── Enforcements (reject) ─────────────────────────────────────────

  // dial_in must be NULL when session_type = 'Practice'
  if (data.sessionType === "Practice" && data.dialIn !== null && data.dialIn !== undefined) {
    return {
      success: false,
      errors: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["dialIn"],
          message: "dial_in must be NULL when session_type is 'Practice'",
        },
      ]),
    };
  }

  // round must be NULL when session_type = 'Practice'
  if (data.sessionType === "Practice" && data.round !== null && data.round !== undefined) {
    return {
      success: false,
      errors: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["round"],
          message: "round must be NULL when session_type is 'Practice'",
        },
      ]),
    };
  }

  // win must be NULL when session_type = 'Practice'
  if (data.sessionType === "Practice" && data.win !== null && data.win !== undefined) {
    return {
      success: false,
      errors: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["win"],
          message: "win must be NULL when session_type is 'Practice'",
        },
      ]),
    };
  }

  // round >= 1 when session_type = 'Elimination'
  if (
    data.sessionType === "Elimination" &&
    data.round !== null &&
    data.round !== undefined &&
    data.round < 1
  ) {
    return {
      success: false,
      errors: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["round"],
          message: "round must be >= 1 for Elimination runs",
        },
      ]),
    };
  }

  // car_version_id snapshot's car_id must match run's car_id
  if (data.carVersionId !== null && data.carVersionId !== undefined && snapshots) {
    const snapshot = snapshots.get(data.carVersionId);
    if (snapshot && snapshot.carId !== data.carId) {
      return {
        success: false,
        errors: new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ["carVersionId"],
            message: "Snapshot's car_id must match run's car_id",
          },
        ]),
      };
    }
  }

  // ── Warnings (collect, don't reject) ──────────────────────────────

  // sixty_ft < 0.110 on Left Lane — ghost sensor warning
  if (
    data.lane === "Left" &&
    data.sixtyFt !== null &&
    data.sixtyFt !== undefined &&
    data.sixtyFt < 0.11
  ) {
    warnings.push({
      field: "sixtyFt",
      message: "60ft time below 0.110s on Left Lane may be a ghost sensor reading",
    });
  }

  // mph outside plausible bounds — warning
  if (data.mph !== null && data.mph !== undefined) {
    if (data.mph <= 0) {
      warnings.push({
        field: "mph",
        message: `MPH value ${data.mph} is zero or negative.`,
      });
    } else if (data.mph > 90) {
      warnings.push({
        field: "mph",
        message: `MPH value ${data.mph} is over 90 — verify entry.`,
      });
    }
  }

  return { success: true, data, warnings };
}

// ─── Car schema with domain refinements ────────────────────────────────

/**
 * Validated car schema with gear_ratio consistency check.
 */
export function validateCar(input: unknown): Validated<z.infer<typeof selectCarSchema>> {
  const warnings: ValidationWarning[] = [];

  const baseParse = selectCarSchema.safeParse(input);
  if (!baseParse.success) {
    return { success: false, errors: baseParse.error };
  }

  const data = baseParse.data;

  // gear_ratio should equal crown / pinion (warn, allow override)
  if (
    data.crown !== null &&
    data.crown !== undefined &&
    data.pinion !== null &&
    data.pinion !== undefined &&
    data.pinion !== 0 &&
    data.gearRatio !== null &&
    data.gearRatio !== undefined
  ) {
    const calculated = data.crown / data.pinion;
    if (Math.abs(data.gearRatio - calculated) > 0.001) {
      warnings.push({
        field: "gearRatio",
        message: `gear_ratio ${data.gearRatio} differs from crown/pinion = ${calculated}.`,
      });
    }
  }

  return { success: true, data, warnings };
}
