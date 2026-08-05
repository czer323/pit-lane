# Mock UI Behavior Contract — Track Entry

**Status:** Live contract. Changes require mock update + spec update + assertion update in same change.
**Source of truth:** `docs/mocked-ui/track_entry.html` (repo copy). Served working copy mirrors it.
**Branch:** `feat/track-entry-mock`

## Purpose

Codifies expected user behavior for the Track Entry mock, established through annotation-driven
review. Implementers of the hosted Pit Lane app MUST satisfy these behaviors and assertions.
The interactive mock is the reference UI; the hosted app UI must eventually match it.

## Workflow rule

Every behavior change to the mock (via annotation, direct edit, or review) MUST:

1. Update this spec (behavior + assertions).
2. Update `tests/mocked-ui/track-entry-behavior.spec.ts` to assert the new behavior.
3. Run the suite — green before the change ships:
   `vp run test:e2e` (repo root)

## Behavior contracts

### 1. Environment controls

User adjusts temperature and humidity via stepper row in entry form.

- Minus button decreases value by 1. Plus button increases value by 1. (temp and humidity both)
- Clicking the displayed digit opens inline numeric editor. Not a preset cycle. Decoupled from plus/minus behavior.
- Editor prefills current value. Enter or click-away commits. Escape cancels.
- Typed value accepted within generous bounds: temperature -40..200, humidity 0..100.
  Nothing else clamped. User-entered value assumed intentional.
- Empty or non-numeric input: no change, display keeps current value.
- Defaults when unset: temp 70, humidity 30 (adjusters), display shows `--` when never set.

### 2. Entry fields

- Session field (label + `inputSession`) does NOT exist on page. Not used here.
- Runs entered from this page carry no session label.
- Legacy session labels (stored on existing runs) still display and filter in Runs Log.
  Run edit modal still supports Session Label field.

### 3. Lane behavior

- Practice: lane auto-alternates PER CAR. Car's first practice run is Left.
  After each practice run, that car's next run goes to opposite lane. Independent per car.
  Selecting a different car sets lane to that car's expected next lane.
- Elimination: NO auto flip. Lane is user's explicit choice each run. Manual toggle always works.

### 4. Elimination choice

- Elimination run requires explicit Win or Loss choice. Missing choice blocks submit with alert.
  Choice resets after each elim run.

### 5. Data display (regression guard)

- RT displays to user: last-run bar shows RT after submit; Runs Log rows show RT per run;
  run edit modal prefills RT. Never regress this display.

## Assertions

Machine-checkable. Playwright spec mirrors these 1:1.

1. Clicking `#displayTemp` replaces digit with `input.env-val-input` prefilled `82`.
2. Type `87` + Enter in editor: display becomes `87°F`, editor closed.
3. Escape in editor: display unchanged.
4. Blur (click away) commits typed value.
5. `#displayHumidity` plus click: 45% -> 46%. Minus click twice: -> 44%.
6. Type `999` humidity + Enter: clamps to `100%`.
7. Type `150` temp + Enter: accepted, displays `150°F`.
8. Type `-5` temp + Enter: accepted, displays `-5°F`.
9. Type non-numeric + Enter: display unchanged.
10. `#inputSession` absent from DOM. Hint text contains "Lane auto-flips per car in Practice".
11. Fresh car selected in Practice: lane shows Left.
12. Car A practice run 1 (Left) -> lane becomes Right. Run 2 (Right) -> lane becomes Left.
13. Car B selected after A's runs: lane Left (fresh, per-car independence).
14. Elimination selected: lane stays whatever user picked across submits.
15. Elimination submit without Win/Loss: alert shown, no run recorded.
16. Elimination submit with Win: run recorded, lane unchanged, Win/Loss choice reset.
17. After practice submit: last-run bar contains formatted RT (e.g. `RT 0.1234`).
18. Runs Log row for submitted run shows RT value.

## Past changes log

| Change                                                | Behavior codified            |
| ----------------------------------------------------- | ---------------------------- |
| R1: env digit click-to-edit; Session field removed    | Contracts 1, 2               |
| R2: humidity step 5 -> 1; clamps relaxed              | Assertions 5-8               |
| R3: lane no longer global auto-flip                   | Contract 3                   |
| R4: per-car practice lane alternation; elim unchanged | Assertions 11-14             |
| R5: RT display regression guard                       | Contract 5, assertions 17-18 |
