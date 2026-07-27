# Schema Reference — Pit Lane Database

**Last updated:** 2026-07-27

## Overview

Pit Lane uses **Turso (libSQL)** in production and **local SQLite** for development.
The schema is defined in TypeScript via **Drizzle ORM** (`src/server/db/schema.ts`) and migrations are generated with `drizzle-kit`.

## Tables

### `cars` — Present-state build sheet

Current, live configuration of every car. Part changes update this row and insert a `car_snapshots` row.

| Column        | Type    | Constraints        | Description                                                               |
| ------------- | ------- | ------------------ | ------------------------------------------------------------------------- |
| `car_id`      | INTEGER | PK, AUTO INCREMENT | Unique identifier. Never reused.                                          |
| `name`        | TEXT    | NOT NULL, UNIQUE   | Display name. Used in entry form, brackets, reports.                      |
| `body`        | TEXT    |                    | Vehicle body model (e.g. "S10", "'64 Impala", "VW Beetle").               |
| `body_type`   | TEXT    |                    | Material: `lexan`, `hardbody`, `steel`, `3d printed`, `resin`.            |
| `chassis`     | TEXT    |                    | Construction: `wire`, `carbon fiber`, `3d printed no bar`, `custom wire`. |
| `weight_g`    | INTEGER |                    | Race-ready weight in grams.                                               |
| `motor`       | TEXT    |                    | Motor make and model as printed on can.                                   |
| `amp_draw_3v` | REAL    |                    | Amp draw at 3.0V on power supply.                                         |
| `pinion`      | INTEGER |                    | Teeth on pinion gear (motor shaft).                                       |
| `crown`       | INTEGER |                    | Teeth on crown/spur gear (axle).                                          |
| `gear_ratio`  | REAL    |                    | Calculated: `crown / pinion`. Stored for query convenience.               |
| `tire_dia_mm` | REAL    |                    | Rear tire diameter in millimeters, measured trued.                        |
| `rollout`     | REAL    |                    | Distance per motor revolution. `tire_circumference / gear_ratio`.         |
| `created_at`  | TEXT    | NOT NULL           | ISO 8601 date record created.                                             |
| `updated_at`  | TEXT    | NOT NULL           | ISO 8601 date record last modified.                                       |

### `car_snapshots` — Build history (type-2 slowly-changing dimension)

Immutable log of every meaningful configuration change. Multiple snapshots for the same car on the same date are allowed (mid-event part swap).

| Column          | Type    | Constraints                  | Description                            |
| --------------- | ------- | ---------------------------- | -------------------------------------- |
| `snapshot_id`   | INTEGER | PK, AUTO INCREMENT           | Unique identifier.                     |
| `car_id`        | INTEGER | NOT NULL, FK → `cars.car_id` | Which car this snapshot belongs to.    |
| `snapshot_date` | TEXT    | NOT NULL                     | ISO 8601 date this change took effect. |
| `motor`         | TEXT    |                              | Motor at this snapshot.                |
| `pinion`        | INTEGER |                              | Pinion teeth at this snapshot.         |
| `crown`         | INTEGER |                              | Crown teeth at this snapshot.          |
| `gear_ratio`    | REAL    |                              | Ratio at this snapshot.                |
| `tire_dia_mm`   | REAL    |                              | Tire diameter at this snapshot.        |
| `rollout`       | REAL    |                              | Rollout at this snapshot.              |
| `weight_g`      | INTEGER |                              | Weight at this snapshot.               |
| `notes`         | TEXT    |                              | Reason for change. Free-text.          |

**Indexes:** `(car_id, snapshot_date)` — temporal lookup.

### `events` — Race day / session

| Column          | Type    | Constraints        | Description                                    |
| --------------- | ------- | ------------------ | ---------------------------------------------- |
| `event_id`      | INTEGER | PK, AUTO INCREMENT | Unique identifier.                             |
| `event_date`    | TEXT    | NOT NULL           | ISO 8601 date of event.                        |
| `track`         | TEXT    | NOT NULL           | Track name.                                    |
| `session_label` | TEXT    |                    | "Practice & Tuning", "Round 1-4", etc.         |
| `temperature_f` | INTEGER |                    | Ambient temperature in Fahrenheit.             |
| `humidity_pct`  | INTEGER |                    | Relative humidity percentage.                  |
| `notes`         | TEXT    |                    | Track conditions, voltage, sensor issues, etc. |

**Natural key:** `(event_date, track, session_label)` — UNIQUE constraint `uq_events_natural`.

### `runs` — Single pass down track

Core observational table. One row = one pass.

| Column           | Type              | Constraints                                | Description                                                       |
| ---------------- | ----------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `run_id`         | INTEGER           | PK, AUTO INCREMENT                         | Unique identifier.                                                |
| `event_id`       | INTEGER           | NOT NULL, FK → `events.event_id`           | Which event this run belongs to.                                  |
| `car_id`         | INTEGER           | NOT NULL, FK → `cars.car_id`               | Which car made this pass.                                         |
| `car_version_id` | INTEGER           | FK → `car_snapshots.snapshot_id`, nullable | Specific build on car for this run. NULL for retroactive imports. |
| `lane`           | TEXT              | CHECK(IS NULL OR IN ('Left', 'Right'))     | Lane. NULL for single-car elimination passes.                     |
| `session_type`   | TEXT              | NOT NULL, CHECK('Practice', 'Elimination') | Practice pass or elimination round.                               |
| `round`          | INTEGER           |                                            | Elimination round number (1-indexed). NULL for practice.          |
| `rt`             | REAL              |                                            | Reaction time in seconds. Negative = red light (foul).            |
| `sixty_ft`       | REAL              |                                            | 60-foot time in seconds.                                          |
| `three30_ft`     | REAL              |                                            | 330-foot time in seconds.                                         |
| `et`             | REAL              |                                            | Full-track elapsed time in seconds.                               |
| `mph`            | REAL              |                                            | Trap speed at finish in MPH.                                      |
| `dial_in`        | REAL              |                                            | Predicted ET for elimination bracket. NULL for practice.          |
| `win`            | INTEGER (boolean) |                                            | Whether this run won its elimination pairing. NULL for practice.  |
| `temperature_f`  | INTEGER           |                                            | Per-run temperature override. NULL = use event value.             |
| `humidity_pct`   | INTEGER           |                                            | Per-run humidity override. NULL = use event value.                |
| `comments`       | TEXT              |                                            | Driver notes, anomalies, what went wrong.                         |

**Indexes:**

- `(event_id)` — list runs for an event
- `(car_id)` — list runs for a car
- `(car_id, et)` — fastest-pass queries per car

**CHECK constraints:**

- `ck_runs_session_type`: `session_type IN ('Practice', 'Elimination')`
- `ck_runs_lane`: `lane IS NULL OR lane IN ('Left', 'Right')`

## View

### `run_details` — Analytical flat view

Joins all tables with COALESCE temporal fallback for car version resolution.

**Columns:** `run_id`, `event_date`, `track`, `session_label`, `car_name`, `lane`, `session_type`, `round`, `rt`, `sixty_ft`, `three30_ft`, `et`, `mph`, `dial_in`, `win`, `comments`, `snapshot_motor`, `snapshot_gear_ratio`, `snapshot_rollout`, `snapshot_pinion`, `snapshot_crown`, `snapshot_tire_dia_mm`, `snapshot_weight_g`, `snapshot_notes`.

**Version resolution logic:**

1. If `runs.car_version_id` is set (live entry), use it directly.
2. If NULL (retroactive import), fall back to temporal join: latest `car_snapshots` with `snapshot_date <= event_date`, disambiguated by `snapshot_id DESC` for same-day swaps.

## Validation Layer

Defined in `src/server/db/validation.ts` using `drizzle-zod` + custom refinements.

| Rule                             | Behavior                           |
| -------------------------------- | ---------------------------------- |
| RT can be negative               | Allowed (red lights are real data) |
| `sixty_ft < 0.110` on Left Lane  | Warning only (ghost sensor)        |
| `mph` ≤ 0 or > 90                | Warning (physically implausible)   |
| `dial_in` on practice runs       | Enforced rejection                 |
| `round` on practice runs         | Enforced rejection                 |
| `win` on practice runs           | Enforced rejection                 |
| `round < 1` on elimination       | Enforced rejection                 |
| `gear_ratio ≠ crown/pinion`      | Warning, allow override            |
| `car_version_id` car_id mismatch | Enforced rejection                 |

## Relationships

```
events ──1:N──── runs ──N:1── cars
                   │              │
                   │              1:N
                   │              │
                   │          car_snapshots
                   │
                   └── N:1 ──→ car_snapshots (via car_version_id, nullable)
```

## Migration

Migrations are in `drizzle/` directory, generated by `drizzle-kit generate`.
Apply to a fresh database with:

```bash
vp exec drizzle-kit migrate
```

For Turso production, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables.
