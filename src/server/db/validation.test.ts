/* eslint-disable vitest/no-conditional-expect -- Discriminated union type guard is not conditional logic */

import { describe, it, expect } from "vite-plus/test";
import { validateRun, validateCar, selectRunSchema } from "./validation";

// ─── selectRunSchema (base type-check) ─────────────────────────────────

describe("selectRunSchema (base schema)", () => {
  it("parses a valid practice run", () => {
    const result = selectRunSchema.safeParse({
      runId: 1,
      eventId: 1,
      carId: 1,
      carVersionId: null,
      lane: "Left",
      sessionType: "Practice",
      round: null,
      rt: 0.025,
      sixtyFt: 0.895,
      three30Ft: 2.841,
      et: 4.321,
      mph: 28.7,
      dialIn: null,
      win: null,
      temperatureF: null,
      humidityPct: null,
      comments: null,
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid elimination run", () => {
    const result = selectRunSchema.safeParse({
      runId: 2,
      eventId: 1,
      carId: 1,
      carVersionId: 5,
      lane: "Right",
      sessionType: "Elimination",
      round: 1,
      rt: 0.012,
      sixtyFt: 0.902,
      three30Ft: 2.815,
      et: 4.298,
      mph: 29.1,
      dialIn: 4.3,
      win: true,
      temperatureF: null,
      humidityPct: null,
      comments: "Clean pass",
    });
    expect(result.success).toBe(true);
  });

  it("allows negative RT (red light / foul start)", () => {
    const result = selectRunSchema.safeParse({
      runId: 3,
      eventId: 1,
      carId: 1,
      carVersionId: null,
      lane: "Left",
      sessionType: "Practice",
      round: null,
      rt: -0.023,
      sixtyFt: null,
      three30Ft: null,
      et: null,
      mph: null,
      dialIn: null,
      win: null,
      temperatureF: null,
      humidityPct: null,
      comments: null,
    });
    expect(result.success).toBe(true);
  });
});

// ─── validateRun (domain-specific refinements) ────────────────────────

describe("validateRun", () => {
  const validPractice = {
    runId: 1,
    eventId: 1,
    carId: 1,
    carVersionId: null,
    lane: "Left",
    sessionType: "Practice" as const,
    round: null,
    rt: 0.025,
    sixtyFt: 0.895,
    three30Ft: 2.841,
    et: 4.321,
    mph: 28.7,
    dialIn: null,
    win: null,
    temperatureF: null,
    humidityPct: null,
    comments: null,
  };

  const validElimination = {
    runId: 2,
    eventId: 1,
    carId: 1,
    carVersionId: 5,
    lane: "Right",
    sessionType: "Elimination" as const,
    round: 1,
    rt: 0.012,
    sixtyFt: 0.902,
    three30Ft: 2.815,
    et: 4.298,
    mph: 29.1,
    dialIn: 4.3,
    win: true,
    temperatureF: null,
    humidityPct: null,
    comments: "Clean pass",
  };

  it("accepts a valid practice run with no warnings", () => {
    const result = validateRun(validPractice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warnings).toHaveLength(0);
    }
  });

  it("accepts a valid elimination run with no warnings", () => {
    const result = validateRun(validElimination);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warnings).toHaveLength(0);
    }
  });

  describe("enforcements", () => {
    it("rejects dial_in on practice runs", () => {
      const result = validateRun({ ...validPractice, dialIn: 4.5 });
      expect(result.success).toBe(false);
    });

    it("rejects round on practice runs", () => {
      const result = validateRun({ ...validPractice, round: 1 });
      expect(result.success).toBe(false);
    });

    it("rejects win on practice runs", () => {
      const result = validateRun({ ...validPractice, win: true });
      expect(result.success).toBe(false);
    });

    it("rejects round < 1 for elimination runs", () => {
      const result = validateRun({ ...validElimination, round: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects car_version_id referencing a snapshot with different car_id", () => {
      const snapshots = new Map([[5, { carId: 99 }]]);
      const result = validateRun({ ...validElimination, carVersionId: 5, carId: 1 }, snapshots);
      expect(result.success).toBe(false);
    });

    it("accepts car_version_id referencing a snapshot with matching car_id", () => {
      const snapshots = new Map([[5, { carId: 1 }]]);
      const result = validateRun({ ...validElimination, carVersionId: 5, carId: 1 }, snapshots);
      expect(result.success).toBe(true);
    });
  });

  describe("warnings", () => {
    it("warns on sixty_ft < 0.110 on Left Lane", () => {
      const result = validateRun({
        ...validPractice,
        lane: "Left",
        sixtyFt: 0.095,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        expect(result.warnings[0].field).toBe("sixtyFt");
      }
    });

    it("passes sixty_ft < 0.110 on Right Lane without warning", () => {
      const result = validateRun({
        ...validPractice,
        lane: "Right",
        sixtyFt: 0.095,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        const sixtyWarn = result.warnings.find((w) => w.field === "sixtyFt");
        expect(sixtyWarn).toBeUndefined();
      }
    });

    it("warns on mph over 90", () => {
      const result = validateRun({ ...validPractice, mph: 3253 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        expect(result.warnings[0].field).toBe("mph");
      }
    });

    it("warns on mph = 0", () => {
      const result = validateRun({ ...validPractice, mph: 0 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        expect(result.warnings[0].field).toBe("mph");
      }
    });

    it("warns on negative mph", () => {
      const result = validateRun({ ...validPractice, mph: -5 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        expect(result.warnings[0].field).toBe("mph");
      }
    });

    it("no mph warning for normal values like 5 mph", () => {
      const result = validateRun({ ...validPractice, mph: 5 });
      expect(result.success).toBe(true);
      if (result.success) {
        const mphWarn = result.warnings.find((w) => w.field === "mph");
        expect(mphWarn).toBeUndefined();
      }
    });

    it("no mph warning for typical slot car speeds like 28.7", () => {
      const result = validateRun({ ...validPractice, mph: 28.7 });
      expect(result.success).toBe(true);
      if (result.success) {
        const mphWarn = result.warnings.find((w) => w.field === "mph");
        expect(mphWarn).toBeUndefined();
      }
    });
  });
});

// ─── validateCar ───────────────────────────────────────────────────────

describe("validateCar", () => {
  const validCar = {
    carId: 1,
    name: "Test Car",
    body: "S10",
    bodyType: "lexan",
    chassis: "wire",
    weightG: 85,
    motor: "FK-180SH-15350",
    ampDraw3v: 0.48,
    pinion: 9,
    crown: 27,
    gearRatio: 3.0,
    tireDiaMm: 22.5,
    rollout: 26.18,
    createdAt: "2026-01-15",
    updatedAt: "2026-07-27",
  };

  it("accepts a valid car with no warnings", () => {
    const result = validateCar(validCar);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warnings).toHaveLength(0);
    }
  });

  it("warns when gear_ratio differs from crown / pinion", () => {
    const result = validateCar({ ...validCar, gearRatio: 3.5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings[0].field).toBe("gearRatio");
    }
  });

  it("passes without warning when gear_ratio matches crown / pinion", () => {
    const result = validateCar({ ...validCar, gearRatio: 3.0 });
    expect(result.success).toBe(true);
    if (result.success) {
      const grWarn = result.warnings.find((w) => w.field === "gearRatio");
      expect(grWarn).toBeUndefined();
    }
  });
});
