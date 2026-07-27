# Spec: Database Schema Design — Pit Lane

**Plane card:** SLOT-2
**Branch:** `feat/database-schema`
**Status:** Draft for review

---

## Objective

Authoritative database schema for Pit Lane slot drag racing application. Replaces SLOT-2 card generic description. Formal schema grounded in actual domain — slot drag racing, not circuit racing. Constrained by deployment target — Vercel Hobby + external database.

**User:** Slot drag racer. Races 1/24th, 1/25th scale cars on 40-foot track (MMW Dragway, Ohio). Records race data trackside on phone. Analyzes performance trends. Correlates car modifications with results.

**Success criteria:**

- Future agent implements schema (Drizzle + Turso) from this spec alone
- Four core entities (cars, car_snapshots, events, runs) fully specified — types, constraints, relationships
- Schema supports mid-event part swaps (crashes, emergency rebuilds)
- Schema captures dial-in predictions for elimination bracket racing
- Schema supports future analytics: consistency scoring, historical comparison, dial-in regression
- Works on Vercel Hobby tier with Turso as external database

---

## Tech Stack

| Component  | Choice             | Rationale                                                                                                                                                                   |
| ---------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database   | Turso (libSQL)     | SQLite-compatible. Minimal conversion from existing schema. Free tier (9GB, 500 DBs). Edge-replicated for fast trackside reads. `db0` connector already in dependency tree. |
| ORM        | Drizzle ORM        | TypeScript-native. Schema-as-code. Generates SQL migrations. First-class libSQL/Turso support. Lightweight — no query engine binary (unlike Prisma).                        |
| Validation | drizzle-zod        | Auto-generates Zod schemas from Drizzle definitions. Define validation once at schema boundary. Custom refinements for domain rules.                                        |
| Framework  | SolidStart + Nitro | Already scaffolded. Server actions as API boundary. Nitro provides server preset for Vercel deployment.                                                                     |

**Vercel Hobby constraint:** Serverless functions have no persistent filesystem. Database must be external. Turso accessed via `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables. Set in Vercel dashboard at deploy time (SLOT-7). Not a schema concern. Local development uses local SQLite file with same Drizzle schema.

---

## Domain Model

System tracks **slot drag racing**, not circuit/lap racing. Vocabulary comes from historical data artifacts + track entry mockup.

### Core concepts

- **Car** — Physical slot car in fleet. Has name, body, chassis, motor, gearing, tires, weight. `cars` table reflects _current_ build state only.
- **Car Snapshot** — Point-in-time capture of car's performance-critical configuration. Type-2 slowly-changing dimension. Part changes → new snapshot created. Snapshots are immutable. Freeze build at moment of change.
- **Event** — Race day or session at track. Has date, track name, session label (practice, test-and-tune, elimination rounds), ambient conditions (temperature, humidity, notes).
- **Run** — Single pass down track. Core observational unit. Contains raw timer data (RT, 60ft, 330ft, ET, MPH), context (lane, session type, round), optional driver notes.

### Key domain rules

1. **Negative RT is valid.** Red lights (foul starts) are real data. RT below zero = driver launched before green. Preserve as-is.
2. **Ghost sensor readings kept, not rejected.** MMW Left Lane 60ft sensor produces false readings below ~0.110 seconds. Flag in analysis. Do not discard at entry. Validation warns, does not block.
3. **One run = one pass.** Car making 6 practice passes generates 6 rows. No batch concept.
4. **Lane toggles naturally.** Practice passes alternate Left/Right. Elimination rounds may not have lane (single-car passes).
5. **Dial-in is per-run, elimination only.** Driver declares predicted ET before each elimination run. Christmas Tree staggers start based on difference between two drivers' dial-ins. Going faster than dial-in ("breaking out") typically loses race. Dial-in is NULL for practice.
6. **Mid-event part swaps are real.** Car may crash in Run 1, get replacement parts, run again in Run 2 — same event, same date. Each run must reference specific car build physically on track.
7. **Car names are primary human identifier.** `car_id` is for machines. UI always shows `name` prominently.
8. **Timestamps are dates, not datetimes.** System tracks which session a run belongs to, not exact second. Sufficient for all current analysis.

### Domain vocabulary → schema mapping

| Domain concept            | Schema location                               | Type                | Notes                                                              |
| ------------------------- | --------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| Car (physical vehicle)    | `cars`                                        | table               | Current build state only. History in `car_snapshots`.              |
| Car build / configuration | `car_snapshots`                               | table               | Immutable point-in-time snapshot. Type-2 SCD.                      |
| Race day / session        | `events`                                      | table               | Natural key: (event_date, track, session_label).                   |
| Pass / run                | `runs`                                        | table               | One row = one pass. Atomic.                                        |
| Reaction time (RT)        | `runs.rt`                                     | REAL nullable       | Negative = red light. Valid data.                                  |
| 60-foot time              | `runs.sixty_ft`                               | REAL nullable       | < 0.110 on Left Lane = ghost sensor. Warn, do not reject.          |
| 330-foot time             | `runs.three30_ft`                             | REAL nullable       | Mid-track marker. Validates 60ft.                                  |
| Elapsed time (ET)         | `runs.et`                                     | REAL nullable       | Full-track time. Primary performance metric.                       |
| Trap speed                | `runs.mph`                                    | REAL nullable       | Speed at finish.                                                   |
| Lane                      | `runs.lane`                                   | TEXT nullable       | Left, Right, or NULL (single-car elimination).                     |
| Session type              | `runs.session_type`                           | TEXT NOT NULL       | Practice or Elimination. CHECK constraint.                         |
| Elimination round         | `runs.round`                                  | INTEGER nullable    | 1-indexed. NULL for practice.                                      |
| Dial-in                   | `runs.dial_in`                                | REAL nullable       | Predicted ET for elimination bracket. NULL for practice.           |
| Breakout                  | derivable                                     | —                   | `et < dial_in`. Do not store. Compute at query time.               |
| Win / loss                | `runs.win`                                    | BOOLEAN nullable    | Won elimination pairing. NULL for practice.                        |
| Build at race time        | `runs.car_version_id`                         | INTEGER nullable FK | Direct link to `car_snapshots`. Temporal fallback in view if NULL. |
| Ambient conditions        | `events.temperature_f`, `events.humidity_pct` | INTEGER nullable    | Per-event. Override at run level if different.                     |
| Car weight                | `cars.weight_g`, `car_snapshots.weight_g`     | INTEGER nullable    | Current in cars. Historical in snapshots.                          |
| Gear ratio                | `cars.gear_ratio`, `car_snapshots.gear_ratio` | REAL nullable       | `crown / pinion`. Denormalized for query convenience.              |
| Rollout                   | `cars.rollout`, `car_snapshots.rollout`       | REAL nullable       | Distance per motor rev. Key gearing metric.                        |
| Analytical flat view      | `run_details`                                 | VIEW                | Joins all tables. COALESCE fallback for version resolution.        |

---

## Schema Definition

### `cars` — Present-state build sheet

Current, live configuration of every car. Always reflects what is physically on car right now. Part changes → update this row AND insert `car_snapshots` row.

| Column        | Type    | Constraints        | Description                                                                                    |
| ------------- | ------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `car_id`      | INTEGER | PK, AUTO INCREMENT | Unique identifier. Never reused.                                                               |
| `name`        | TEXT    | NOT NULL, UNIQUE   | Display name. Used in entry form, brackets, reports.                                           |
| `body`        | TEXT    | nullable           | Vehicle body model (e.g. "S10", "'64 Impala", "VW Beetle").                                    |
| `body_type`   | TEXT    | nullable           | Material: `lexan`, `hardbody`, `steel`, `3d printed`, `resin`.                                 |
| `chassis`     | TEXT    | nullable           | Construction: `wire`, `carbon fiber`, `3d printed no bar`, `custom wire`.                      |
| `weight_g`    | INTEGER | nullable           | Race-ready weight in grams (body + chassis + motor + wheels + lead).                           |
| `motor`       | TEXT    | nullable           | Motor make and model as printed on can.                                                        |
| `amp_draw_3v` | REAL    | nullable           | Amp draw at 3.0V on power supply. Used for motor blueprinting.                                 |
| `pinion`      | INTEGER | nullable           | Teeth on pinion gear (motor shaft).                                                            |
| `crown`       | INTEGER | nullable           | Teeth on crown/spur gear (axle).                                                               |
| `gear_ratio`  | REAL    | nullable           | Calculated: `crown / pinion`. Stored explicitly for query convenience.                         |
| `tire_dia_mm` | REAL    | nullable           | Rear tire diameter in millimeters, measured trued.                                             |
| `rollout`     | REAL    | nullable           | Distance per motor revolution. `tire_circumference / gear_ratio`. Key for gearing comparisons. |
| `created_at`  | TEXT    | NOT NULL           | ISO 8601 date car record first created.                                                        |
| `updated_at`  | TEXT    | NOT NULL           | ISO 8601 date car record last modified.                                                        |

### `car_snapshots` — Build history (type-2 SCD)

Immutable log of every meaningful configuration change. Each row captures performance-critical parts at point in time.

| Column          | Type    | Constraints                  | Description                                                |
| --------------- | ------- | ---------------------------- | ---------------------------------------------------------- |
| `snapshot_id`   | INTEGER | PK, AUTO INCREMENT           | Unique identifier.                                         |
| `car_id`        | INTEGER | NOT NULL, FK → `cars.car_id` | Which car this snapshot belongs to.                        |
| `snapshot_date` | TEXT    | NOT NULL                     | ISO 8601 date this change took effect.                     |
| `motor`         | TEXT    | nullable                     | Motor at this snapshot.                                    |
| `pinion`        | INTEGER | nullable                     | Pinion teeth at this snapshot.                             |
| `crown`         | INTEGER | nullable                     | Crown teeth at this snapshot.                              |
| `gear_ratio`    | REAL    | nullable                     | Ratio at this snapshot.                                    |
| `tire_dia_mm`   | REAL    | nullable                     | Tire diameter at this snapshot.                            |
| `rollout`       | REAL    | nullable                     | Rollout at this snapshot.                                  |
| `weight_g`      | INTEGER | nullable                     | Weight at this snapshot.                                   |
| `notes`         | TEXT    | nullable                     | Reason for change. Free-text. Encouraged for traceability. |

**Index:** `(car_id, snapshot_date)` — supports temporal lookup query.

**Rules:**

- Every time `cars` updated, check which performance-critical fields changed (motor, pinion, crown, tire, weight). If any changed, insert snapshot.
- Multiple snapshots for same car on same date are allowed (mid-event part swap). `snapshot_id` disambiguates.
- Snapshots are immutable once written. Corrections require new snapshot with note.

### `events` — Race day / session

| Column          | Type    | Constraints        | Description                                                   |
| --------------- | ------- | ------------------ | ------------------------------------------------------------- |
| `event_id`      | INTEGER | PK, AUTO INCREMENT | Unique identifier.                                            |
| `event_date`    | TEXT    | NOT NULL           | ISO 8601 date of event.                                       |
| `track`         | TEXT    | NOT NULL           | Track name. Same date can have different tracks.              |
| `session_label` | TEXT    | nullable           | Human label: "Practice & Tuning", "Round 1-4", "Test & Tune". |
| `temperature_f` | INTEGER | nullable           | Ambient temperature in Fahrenheit.                            |
| `humidity_pct`  | INTEGER | nullable           | Relative humidity percentage.                                 |
| `notes`         | TEXT    | nullable           | Track conditions, voltage, sensor issues, etc.                |

**Natural key:** `(event_date, track, session_label)` — enforced via UNIQUE constraint.

### `runs` — Single pass down track

Core observational table. One row = one pass.

| Column           | Type    | Constraints                                    | Description                                                                                                                                                                    |
| ---------------- | ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `run_id`         | INTEGER | PK, AUTO INCREMENT                             | Unique identifier.                                                                                                                                                             |
| `event_id`       | INTEGER | NOT NULL, FK → `events.event_id`               | Which event this run belongs to.                                                                                                                                               |
| `car_id`         | INTEGER | NOT NULL, FK → `cars.car_id`                   | Which car made this pass.                                                                                                                                                      |
| `car_version_id` | INTEGER | nullable, FK → `car_snapshots.snapshot_id`     | Specific build on car for this run. See version linkage rules below.                                                                                                           |
| `lane`           | TEXT    | nullable                                       | `Left` or `Right`. NULL for single-car elimination passes.                                                                                                                     |
| `session_type`   | TEXT    | NOT NULL, CHECK IN (`Practice`, `Elimination`) | Practice pass or elimination round.                                                                                                                                            |
| `round`          | INTEGER | nullable                                       | Elimination round number (1-indexed). NULL for practice.                                                                                                                       |
| `rt`             | REAL    | nullable                                       | Reaction time in seconds. Negative = red light (foul).                                                                                                                         |
| `sixty_ft`       | REAL    | nullable                                       | 60-foot time in seconds. Values < 0.110 on MMW Left Lane are suspect (ghost sensor).                                                                                           |
| `three30_ft`     | REAL    | nullable                                       | 330-foot time in seconds. Mid-track marker.                                                                                                                                    |
| `et`             | REAL    | nullable                                       | Full-track elapsed time in seconds.                                                                                                                                            |
| `mph`            | REAL    | nullable                                       | Trap speed at finish in MPH.                                                                                                                                                   |
| `dial_in`        | REAL    | nullable                                       | Driver's predicted ET for this elimination run. NULL for practice. Used for bracket racing start staging. Breakout (running faster than dial-in) is derivable: `et < dial_in`. |
| `win`            | BOOLEAN | nullable                                       | Whether this run won its elimination pairing. NULL for practice. Needed for bracket analysis and win-rate metrics.                                                             |
| `temperature_f`  | INTEGER | nullable                                       | Per-run temperature override. NULL = use event value.                                                                                                                          |
| `humidity_pct`   | INTEGER | nullable                                       | Per-run humidity override. NULL = use event value.                                                                                                                             |
| `comments`       | TEXT    | nullable                                       | Driver notes, anomalies, what went wrong.                                                                                                                                      |

**Indexes:**

- `(event_id)` — list runs for an event
- `(car_id)` — list runs for a car
- `(car_id, et)` — fastest-pass queries per car

**CHECK constraints:**

- `session_type IN ('Practice', 'Elimination')`
- `lane IS NULL OR lane IN ('Left', 'Right')`

### `run_details` — Analytical view

View joins runs with events, cars, and car build at race time. Provides flat, queryable surface for dashboards and analytics.

```sql
CREATE VIEW run_details AS
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
) = cs.snapshot_id;
```

`COALESCE` provides fallback behavior: if `car_version_id` set (live entry), use it directly. If NULL (retroactive CSV import), fall back to temporal join (latest snapshot before event date, disambiguated by `snapshot_id` for same-day swaps).

---

## Car Version Linkage Strategy

### Problem

Car configuration changes over time (gear swaps, motor upgrades, tire changes). Analyzing historical run requires knowing what was physically on car at that moment.

### Mid-event complication

Car may crash in Run 1, get replacement parts before Run 2 — same event, same date. Date-only temporal join cannot disambiguate two snapshots with same `snapshot_date`.

### Solution: Direct FK + temporal fallback

**Primary path (live entry):** `runs.car_version_id` set at entry time. Person entering data just installed parts — knows exactly what build is on car. Exact, fast, unambiguous.

**Fallback path (retroactive import):** When importing historical CSVs where exact build per run is unknown, `car_version_id` is NULL. `run_details` view falls back to temporal join: latest snapshot with `snapshot_date <= event_date`, disambiguated by `snapshot_id` DESC for same-day snapshots.

### Rules for snapshot creation

1. **Live entry with part change:** Update `cars`, insert new `car_snapshots` row, set `runs.car_version_id` to new snapshot's ID for all subsequent runs.
2. **Live entry without part change:** `runs.car_version_id` = car's current (latest) snapshot ID.
3. **Retroactive import:** `runs.car_version_id` = NULL. Temporal view resolves at query time.
4. **Mid-event crash + rebuild:** Create new snapshot with same `snapshot_date` as event. Set `runs.car_version_id` to new snapshot for runs after crash. Keep old snapshot ID for runs before.

---

## Validation Strategy

Use `drizzle-zod` to generate base Zod schemas from Drizzle schema definitions. Add custom refinements for domain constraints.

### Validation rules

| Rule                                 | Type    | Behavior                                                                                                                                  |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `rt` can be negative                 | Allow   | Red lights are real data. No min constraint.                                                                                              |
| `sixty_ft < 0.110` on Left Lane      | Warning | Ghost sensor reading. Allow entry, surface warning to user. Do not reject.                                                                |
| `mph` plausibility                   | Warning | Values outside 15–60 MPH flagged. Historical data has `3253.00` typos — catch at entry, not at analysis.                                  |
| `dial_in` only for Elimination       | Enforce | If `session_type = 'Practice'`, `dial_in` must be NULL.                                                                                   |
| `round` only for Elimination         | Enforce | If `session_type = 'Practice'`, `round` must be NULL. If `session_type = 'Elimination'`, `round` should be >= 1.                          |
| `win` only for Elimination           | Enforce | If `session_type = 'Practice'`, `win` must be NULL.                                                                                       |
| `gear_ratio` consistency             | Warning | If `pinion` and `crown` both set, `gear_ratio` should equal `crown / pinion`. Allow override (measured ratio may differ from calculated). |
| `car_version_id` references same car | Enforce | Snapshot's `car_id` must match run's `car_id`.                                                                                            |

### Implementation approach

Define Drizzle schema → `drizzle-zod` generates base schemas → wrap with Zod `.refine()` for domain rules. Server actions validate input before writing to database.

---

## Table Relationships

```
events ──1:N──→ runs ←──N:1── cars
                  |              |
                  |              1:N
                  |              |
                  |          car_snapshots
                  |
                  └── N:1 ──→ car_snapshots (via car_version_id, nullable)
```

- **events 1→N runs:** One event has many runs.
- **cars 1→N runs:** One car makes many runs across events.
- **cars 1→N car_snapshots:** One car has history of build snapshots.
- **runs N→1 car_snapshots:** Each run optionally references specific build on car. Temporal view provides fallback.

---

## Migration Strategy Reference

Existing `datamodel/data_model_guide.md` (Section 4) documents CSV import strategy in detail. Spec does not re-document it. Key points for implementers:

1. **Source files:** Spec Sheet CSV (cars), Practice CSV, Racing CSV, Sheet1 CSV (runs + events).
2. **Import order:** Sheet1 (earliest) → Racing → Practice (most recent, most reliable).
3. **Deduplication:** Same date + car + lane + RT in multiple files → prefer Practice > Racing > Sheet1.
4. **Data quality issues:** Documented per-file in guide (leading dots, double dots, mangled negatives, `#REF!`, `#DIV/0!`, `3253.00` typos). Validation layer catches these at entry for new data. Migration script handles them for historical imports.
5. **Bootstrap snapshots:** For each car, create initial `car_snapshots` row with `snapshot_date` = earliest known race date, populated from Spec Sheet CSV.
6. **Historical runs:** `car_version_id` = NULL for all migrated runs. Temporal view resolves build at query time.

---

## Artifact List for Future Agents

Spec is design artifact. Implementation produces:

| Artifact             | Path                          | Description                                                            |
| -------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Drizzle schema       | `src/server/db/schema.ts`     | TypeScript schema definitions for all 4 tables + view.                 |
| Drizzle config       | `drizzle.config.ts`           | Turso connection config, migration output directory.                   |
| Generated migrations | `drizzle/`                    | SQL migration files generated by `drizzle-kit generate`.               |
| Schema reference     | `docs/schema.md`              | Human-readable schema documentation (SLOT-2 DoD requirement).          |
| Validation schemas   | `src/server/db/validation.ts` | Zod schemas with domain refinements (generated from Drizzle + custom). |
| DB client            | `src/server/db/index.ts`      | Turso client initialization, connection helper.                        |

---

## Boundaries

### Always do

- Define schema in Drizzle (TypeScript), not raw SQL files.
- Generate migrations from schema changes via `drizzle-kit generate`.
- Validate all inputs with Zod schemas before writing.
- Run `vp check` and `vp test` after schema changes.

### Ask first

- Adding columns to existing tables (consider migration impact on historical data).
- Changing column type or nullable status.
- Adding new tables (consider whether they belong in core schema or should be separate).

### Never do

- Write raw SQL migrations by hand (use `drizzle-kit generate`).
- Store secrets (Turso tokens) in code — always via environment variables.
- Delete or modify `car_snapshots` rows (immutable history).
- Reject ghost sensor readings or negative RT values at validation layer.

---

## Success Criteria

- [ ] Drizzle schema defines all 4 tables with correct types, constraints, foreign keys.
- [ ] `car_version_id` FK on `runs` is nullable with temporal fallback in `run_details` view.
- [ ] `dial_in` and `win` columns on `runs` for elimination bracket racing.
- [ ] Zod validation schemas generated from Drizzle with domain-specific refinements.
- [ ] `run_details` view joins all tables with COALESCE fallback for version resolution.
- [ ] Schema reference document (`docs/schema.md`) committed to repo.
- [ ] Generated migrations apply cleanly to fresh Turso database.
- [ ] Schema is compatible with Vercel Hobby + Turso (no filesystem-dependent features).

---

## Open Questions

None at spec time. Implementation details (exact Drizzle API usage, migration tooling commands) are implementing agent's responsibility.
