import {
  sqliteTable,
  integer,
  text,
  real,
  index,
  unique,
  sqliteView,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * cars — Present-state build sheet.
 * Current, live configuration of every car.
 * Always reflects what is physically on car right now.
 * Part changes → update this row AND insert car_snapshots row.
 */
export const cars = sqliteTable("cars", {
  carId: integer("car_id").primaryKey({ autoIncrement: true }),
  /** Display name. Used in entry form, brackets, reports. */
  name: text("name").notNull().unique(),
  /** Vehicle body model (e.g. "S10", "'64 Impala", "VW Beetle"). */
  body: text("body"),
  /** Material: lexan, hardbody, steel, 3d printed, resin. */
  bodyType: text("body_type"),
  /** Construction: wire, carbon fiber, 3d printed no bar, custom wire. */
  chassis: text("chassis"),
  /** Race-ready weight in grams (body + chassis + motor + wheels + lead). */
  weightG: integer("weight_g"),
  /** Motor make and model as printed on can. */
  motor: text("motor"),
  /** Amp draw at 3.0V on power supply. Used for motor blueprinting. */
  ampDraw3v: real("amp_draw_3v"),
  /** Teeth on pinion gear (motor shaft). */
  pinion: integer("pinion"),
  /** Teeth on crown/spur gear (axle). */
  crown: integer("crown"),
  /** Calculated: crown / pinion. Stored explicitly for query convenience. */
  gearRatio: real("gear_ratio"),
  /** Rear tire diameter in millimeters, measured trued. */
  tireDiaMm: real("tire_dia_mm"),
  /** Distance per motor revolution. tire_circumference / gear_ratio. */
  rollout: real("rollout"),
  /** ISO 8601 date car record first created. */
  createdAt: text("created_at").notNull(),
  /** ISO 8601 date car record last modified. */
  updatedAt: text("updated_at").notNull(),
});

/**
 * car_snapshots — Build history (type-2 SCD).
 * Immutable log of every meaningful configuration change.
 * Each row captures performance-critical parts at point in time.
 */
export const carSnapshots = sqliteTable(
  "car_snapshots",
  {
    /** Unique identifier. */
    snapshotId: integer("snapshot_id").primaryKey({ autoIncrement: true }),
    /** Which car this snapshot belongs to. */
    carId: integer("car_id")
      .notNull()
      .references(() => cars.carId),
    /** ISO 8601 date this change took effect. */
    snapshotDate: text("snapshot_date").notNull(),
    /** Motor at this snapshot. */
    motor: text("motor"),
    /** Pinion teeth at this snapshot. */
    pinion: integer("pinion"),
    /** Crown teeth at this snapshot. */
    crown: integer("crown"),
    /** Ratio at this snapshot. */
    gearRatio: real("gear_ratio"),
    /** Tire diameter at this snapshot. */
    tireDiaMm: real("tire_dia_mm"),
    /** Rollout at this snapshot. */
    rollout: real("rollout"),
    /** Weight at this snapshot. */
    weightG: integer("weight_g"),
    /** Reason for change. Free-text. Encouraged for traceability. */
    notes: text("notes"),
  },
  (table) => ({
    /** Supports temporal lookup query. */
    carDateIdx: index("idx_car_snapshots_car_date").on(table.carId, table.snapshotDate),
  }),
);

/**
 * events — Race day / session.
 */
export const events = sqliteTable(
  "events",
  {
    /** Unique identifier. */
    eventId: integer("event_id").primaryKey({ autoIncrement: true }),
    /** ISO 8601 date of event. */
    eventDate: text("event_date").notNull(),
    /** Track name. Same date can have different tracks. */
    track: text("track").notNull(),
    /** Human label: "Practice & Tuning", "Round 1-4", "Test & Tune". */
    sessionLabel: text("session_label"),
    /** Ambient temperature in Fahrenheit. */
    temperatureF: integer("temperature_f"),
    /** Relative humidity percentage. */
    humidityPct: integer("humidity_pct"),
    /** Track conditions, voltage, sensor issues, etc. */
    notes: text("notes"),
  },
  (table) => ({
    /** Natural key: (event_date, track, session_label). */
    naturalKey: unique("uq_events_natural").on(table.eventDate, table.track, table.sessionLabel),
  }),
);

/**
 * runs — Single pass down track.
 * Core observational table. One row = one pass.
 */
export const runs = sqliteTable(
  "runs",
  {
    /** Unique identifier. */
    runId: integer("run_id").primaryKey({ autoIncrement: true }),
    /** Which event this run belongs to. */
    eventId: integer("event_id")
      .notNull()
      .references(() => events.eventId),
    /** Which car made this pass. */
    carId: integer("car_id")
      .notNull()
      .references(() => cars.carId),
    /** Specific build on car for this run. Nullable for retroactive imports. */
    carVersionId: integer("car_version_id").references(() => carSnapshots.snapshotId),
    /** Left or Right. NULL for single-car elimination passes. */
    lane: text("lane"),
    /** Practice pass or elimination round. */
    sessionType: text("session_type").notNull(),
    /** Elimination round number (1-indexed). NULL for practice. */
    round: integer("round"),
    /** Reaction time in seconds. Negative = red light (foul). */
    rt: real("rt"),
    /** 60-foot time in seconds. */
    sixtyFt: real("sixty_ft"),
    /** 330-foot time in seconds. Mid-track marker. */
    three30Ft: real("three30_ft"),
    /** Full-track elapsed time in seconds. */
    et: real("et"),
    /** Trap speed at finish in MPH. */
    mph: real("mph"),
    /** Predicted ET for elimination bracket. NULL for practice. */
    dialIn: real("dial_in"),
    /** Whether this run won its elimination pairing. NULL for practice. */
    win: integer("win", { mode: "boolean" }),
    /** Per-run temperature override. NULL = use event value. */
    temperatureF: integer("temperature_f"),
    /** Per-run humidity override. NULL = use event value. */
    humidityPct: integer("humidity_pct"),
    /** Driver notes, anomalies, what went wrong. */
    comments: text("comments"),
  },
  (table) => ({
    /** List runs for an event. */
    eventIdx: index("idx_runs_event").on(table.eventId),
    /** List runs for a car. */
    carIdx: index("idx_runs_car").on(table.carId),
    /** Fastest-pass queries per car. */
    carEtIdx: index("idx_runs_car_et").on(table.carId, table.et),
    /** session_type must be Practice or Elimination. */
    sessionTypeCheck: check(
      "ck_runs_session_type",
      sql`session_type IN ('Practice', 'Elimination')`,
    ),
    /** lane must be Left, Right, or NULL. */
    laneCheck: check("ck_runs_lane", sql`lane IS NULL OR lane IN ('Left', 'Right')`),
  }),
);

/**
 * run_details — Analytical view.
 * Joins runs with events, cars, and car build at race time.
 * Provides flat, queryable surface for dashboards and analytics.
 * COALESCE provides temporal fallback for car_version_id resolution.
 */
export const runDetails = sqliteView("run_details", {
  runId: integer("run_id").notNull(),
  eventDate: text("event_date").notNull(),
  track: text("track").notNull(),
  sessionLabel: text("session_label"),
  carName: text("car_name").notNull(),
  lane: text("lane"),
  sessionType: text("session_type").notNull(),
  round: integer("round"),
  rt: real("rt"),
  sixtyFt: real("sixty_ft"),
  three30Ft: real("three30_ft"),
  et: real("et"),
  mph: real("mph"),
  dialIn: real("dial_in"),
  win: integer("win", { mode: "boolean" }),
  comments: text("comments"),
  snapshotMotor: text("snapshot_motor"),
  snapshotGearRatio: real("snapshot_gear_ratio"),
  snapshotRollout: real("snapshot_rollout"),
  snapshotPinion: integer("snapshot_pinion"),
  snapshotCrown: integer("snapshot_crown"),
  snapshotTireDiaMm: real("snapshot_tire_dia_mm"),
  snapshotWeightG: integer("snapshot_weight_g"),
  snapshotNotes: text("snapshot_notes"),
}).as(
  sql`
SELECT
    r.run_id,
    e.event_date,
    e.track,
    e.session_label,
    c.name AS car_name,
    r.lane,
    r.session_type,
    r.round,
    r.rt,
    r.sixty_ft,
    r.three30_ft,
    r.et,
    r.mph,
    r.dial_in,
    r.win,
    r.comments,
    cs.motor AS snapshot_motor,
    cs.gear_ratio AS snapshot_gear_ratio,
    cs.rollout AS snapshot_rollout,
    cs.pinion AS snapshot_pinion,
    cs.crown AS snapshot_crown,
    cs.tire_dia_mm AS snapshot_tire_dia_mm,
    cs.weight_g AS snapshot_weight_g,
    cs.notes AS snapshot_notes
FROM runs r
JOIN cars c ON r.car_id = c.car_id
JOIN events e ON r.event_id = e.event_id
LEFT JOIN car_snapshots cs ON coalesce(
    r.car_version_id,
    (SELECT snapshot_id FROM car_snapshots
     WHERE car_id = c.car_id AND snapshot_date <= e.event_date
     ORDER BY snapshot_date DESC, snapshot_id DESC LIMIT 1)
) = cs.snapshot_id
`,
);
