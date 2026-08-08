# Pit Lane — Functional Specification

## Status: Draft · 2026-08-08

---

## User Stories

### 1. Fleet Manager

**As a racer, I want to manage my cars so my fleet is ready for race day.**

#### 1.1 Add car

**Given** I am on the Fleet page
**When** I click "Add Car" and fill in name, body, chassis, motor, gearing, and weight
**And** I submit the form
**Then** the car appears in the fleet list
**And** a car_snapshot is created with the initial build
| Where: `/fleet` → Add Car form | Data: `cars` | Component: Input, Button, Select, Label |

#### 1.2 Edit car specs

**Given** a car exists in the fleet
**When** I click Edit on that car and change the motor or gear ratio
**And** I save
**Then** the car's specs are updated
**And** a new car_snapshot records the change with timestamp
| Where: `/fleet` → Edit button per car | Data: `cars` + `car_snapshots` | Component: Dialog/Modal, Input, Button |

#### 1.3 Toggle at-track status

**Given** a car exists in the fleet
**When** I toggle its "At Track" switch on
**Then** the car appears in the car strip on the Dashboard
**When** I toggle it off
**Then** the car is removed from the Dashboard car strip
| Where: `/fleet` → Switch per car | Data: `cars` (needs `at_track` boolean) | Component: Switch |

#### 1.4 View car list

**Given** cars exist in the fleet
**When** I navigate to `/fleet`
**Then** I see each car with name, body, motor, weight, gear ratio, and at-track status
| Where: `/fleet` — card grid (mobile) / table (desktop) | Data: `cars` | Component: Card, Badge, Table |

#### 1.5 Delete a car

**Given** a car exists in the fleet
**When** I click Delete and confirm
**Then** the car is removed from the fleet
**And** all runs referencing this car remain (car is soft-deleted or preserved for history)
| Where: `/fleet` → Delete action | Data: `cars` | Component: Button (destructive), Dialog |

#### 1.6 View build history (Phase 2)

**Given** a car has had multiple build changes
**When** I view the car's detail/history
**Then** I see a timeline of changes: date, what changed, performance impact
| Where: `/fleet` → car detail → history | Data: `car_snapshots` + `runs` |

---

### 2. Race Day Setup

**As a racer, I want to set up an event so I can record passes against it.**

#### 2.1 Create event

**Given** I am on the Dashboard
**When** I click the event chip and fill in track name, date, session label, temperature, humidity
**And** I save
**Then** a new event is created
**And** the Dashboard header shows this event as active
| Where: `/` → header → event chip | Data: `events` | Component: Input, Select, Button, Dialog |

#### 2.2 Edit event

**Given** an event exists
**When** I click Edit on the event and change weather or notes
**And** I save
**Then** the event details are updated
**And** the Dashboard header reflects the changes
| Where: `/` → header → Edit button | Data: `events` | Component: Dialog, Input, Button |

#### 2.3 Switch between events

**Given** multiple events exist
**When** I click "Past" and select a previous event
**Then** the Dashboard loads that event's runs and car selection
**And** the event chip shows the selected event's details
| Where: `/` → header → Past button | Data: `events` | Component: Select/Combobox, Button |

#### 2.4 Event summary

**Given** runs have been recorded for the current event
**When** I view the Dashboard header
**Then** I see total run count, wins, losses, and win percentage
| Where: `/` → header → event stats | Data: aggregated `runs` | Component: Badge |

---

### 3. Pass Entry

**As a racer, I want to record a timed pass with minimal taps so I can get back to racing.**

#### 3.1 Select car

**Given** cars are marked at-track
**When** I tap a car in the car strip
**Then** that car is selected and highlighted
**And** the lane auto-flips if in Practice mode (per-car alternating)
| Where: `/` → car strip | Data: `cars` (at-track) | Component: Card, Tabs (horizontal scroll) |

#### 3.2 Set lane

**Given** a car is selected
**When** I toggle lane between Left and Right
**Then** the lane indicator updates
**And** the toggle shows the active lane highlighted
| Where: `/` → entry form → lane toggle | Data: `runs.lane` | Component: Switch or Tabs |

#### 3.3 Set session type

**Given** an event is active
**When** I toggle between Practice and Elimination
**Then** the session type updates
**And** if Elimination, the Round field and W/L toggle appear
| Where: `/` → entry form → session toggle | Data: `runs.session_type` | Component: Tabs |

#### 3.4 Enter timing data

**Given** a car and lane are set
**When** I type values into RT, 60ft, 330ft, ET, MPH fields
**Then** each field accepts decimal input
**And** Tab moves focus to the next field
**And** Enter submits the pass
| Where: `/` → entry form → timing fields | Data: `runs.rt`, `sixty_ft`, `three30_ft`, `et`, `mph` | Component: Input |

#### 3.5 Set environment

**Given** an event is active (with default temp/humidity)
**When** I tap +/- on temperature or humidity steppers
**Then** the values increment/decrement by 1
**And** the display updates immediately
| Where: `/` → entry form → environment | Data: `runs.temperature_f`, `humidity_pct` | Component: Button (icon), Input (readonly display) |

#### 3.6 Add notes

**Given** the entry form is open
**When** I type into the Notes field
**Then** the text is saved with the pass on submit
| Where: `/` → entry form → notes field | Data: `runs.comments` | Component: Textarea |

#### 3.7 Record result (Elimination only)

**Given** session type is Elimination
**When** I toggle Win or Loss
**Then** the result is recorded with the pass on submit
**And** the toggle is hidden when session is Practice
| Where: `/` → entry form → W/L toggle | Data: `runs.win` | Component: Switch or Tabs |

#### 3.8 Submit pass

**Given** all required fields are filled (car, lane, session, at minimum RT or ET)
**When** I click Submit or press Enter
**Then** the pass is persisted via `createRun()`
**And** the last-run bar updates with the new pass data
**And** the timing fields clear for the next entry
**And** the lane auto-flips for the selected car in Practice mode
| Where: `/` → entry form → Submit | Data: `createRun()` | Component: Button (primary, full-width) |

#### 3.9 Edit a run

**Given** runs exist in the history
**When** I click Edit on a run and modify a field
**And** I save
**Then** the run is updated via `updateRun()`
**And** the feed reflects the change
| Where: `/` → Runs Log → edit | Data: `updateRun()` | Component: Dialog, Input, Button |

#### 3.10 Delete a run

**Given** a run exists
**When** I click Delete and confirm
**Then** the run is removed via `deleteRun()`
**And** the feed no longer shows it
**And** event stats recalculate
| Where: `/` → Runs Log → delete | Data: `deleteRun()` | Component: Button (destructive), Dialog |

---

### 4. Run History

**As a racer, I want to see my passes so I can understand performance.**

#### 4.1 View all runs

**Given** runs exist for the current event
**When** I switch to the Runs Log tab
**Then** I see all runs, newest first
**And** each row shows: pass number, car name, lane, RT, ET, MPH, result
| Where: `/` → Runs Log tab | Data: `listRuns(eventId)` | Component: Table, Card, Badge |

#### 4.2 Filter by session

**Given** runs exist for both Practice and Elimination
**When** I select a session filter (Practice, Elimination, or All)
**Then** only runs matching that session are shown
| Where: `/` → Runs Log → session filters | Data: client-side filter | Component: Tabs or Select |

#### 4.3 Filter by car

**Given** runs exist for multiple cars
**When** I select a car from the car filter
**Then** only runs for that car are shown
| Where: `/` → Runs Log → car filter | Data: client-side filter | Component: Select |

#### 4.4 Search runs

**Given** runs exist with varied data
**When** I type into the search field
**Then** only runs matching the search text (car name, lane, result) are shown
| Where: `/` → Runs Log → search | Data: client-side filter | Component: Input |

#### 4.5 Lane comparison

**Given** runs exist for both Left and Right lanes
**When** I view the Runs Log
**Then** I see aggregate stats: average ET per lane, best ET per lane, win rate per lane
| Where: `/` → Runs Log → lane compare bar | Data: aggregated `runs` | Component: Card, Badge |

#### 4.6 Last pass result

**Given** a pass was just submitted
**When** I view the entry form
**Then** the last-run bar shows: pass number, car name, RT, ET, MPH, result
**And** the bar is always visible below the Submit button
| Where: `/` → entry form → last-run bar | Data: most recent run | Component: Card (compact), Badge |

---

### 5. Analytics (Phase 2)

**As a racer, I want to see trends and best times so I can tune my cars.**

#### 5.1 Fastest ET per car

**Given** runs exist across multiple events
**When** I navigate to `/analytics`
**Then** I see each car's fastest ET, with event and date
| Where: `/analytics` → best times | Data: `runs` aggregated |

#### 5.2 Best times per metric

**Given** runs exist
**When** I view the analytics dashboard
**Then** I see per-car: best RT, best 60ft, best 330ft, best MPH
| Where: `/analytics` | Data: `runs` aggregated |

#### 5.3 Event comparison

**Given** multiple events exist with runs
**When** I compare two events
**Then** I see side-by-side: avg ET, best ET, total runs, top car per event
| Where: `/analytics` → event comparison | Data: `runs` + `events` |

#### 5.4 Build change impact

**Given** a car has build snapshots and runs
**When** I view the car's timeline
**Then** I see ET trends over time with build change markers
| Where: `/analytics` → car timeline | Data: `runs` + `car_snapshots` |

---

### 6. Multi-Racer (Phase 3)

**As a racer, I want to race against others and share data.**

#### 6.1 Record opponent times

**When** I record a pass in Elimination mode, enter opponent's times alongside mine
| Data: `runs` (needs opponent columns) |

#### 6.2 Head-to-head results

**When** I view runs, see W/L against specific opponents
| Data: `runs.win` + opponent data |

#### 6.3 Share event

**When** I share an event, another racer can view (not edit) the runs
| Needs: sharing model |

#### 6.4 Public garage

**When** I share a car build, others can view specs and performance
| Needs: sharing model |

#### 6.5 AI recommendations

**When** I view analytics, see AI-suggested tuning changes based on performance patterns
| Needs: AI integration |

---

## App Structure

| Route        | Page           | Mobile-first?   | Contains                                               |
| ------------ | -------------- | --------------- | ------------------------------------------------------ |
| `/`          | Race Dashboard | Yes             | Event header, car strip, entry form, runs log (tabbed) |
| `/fleet`     | Fleet Manager  | Yes             | Car list, add/edit car forms                           |
| `/analytics` | Analytics      | Yes (read-only) | Best times, trends, comparisons                        |
| `/login`     | Sign In        | Yes             | Google OAuth                                           |
| `/settings`  | Settings       | Yes             | Account, preferences                                   |

---

## Navigation

**Mobile:** Bottom tab bar — Dashboard · Fleet · Analytics

**Desktop (≥1024px):** Left sidebar with same items, content panel fills remaining space.

---

## Design Tokens

Defined in `docs/design-system/tokens.json`. Applied via Tailwind config in `src/app.css` using the shadcn CSS variable system. Amber (`#f9a825`) is the sole accent color on near-black (`#0d0d0d`) backgrounds. Open Sans for UI, Roboto Mono for data.

---

## Component Library

Defined in `docs/design-system/component-library.md`. All UI components live in `src/components/ui/` as shadcn-solid source files. The library includes: Button, Input, Textarea, Label, Card, Badge, Separator, Switch, Tabs, Select.

---

## Implementation Order

| Phase       | Stories                                                                            | Dependencies                    |
| ----------- | ---------------------------------------------------------------------------------- | ------------------------------- |
| **Phase 1** | 1.1–1.5 Fleet basics, 2.1–2.4 Event setup, 3.1–3.8 Pass entry, 4.1–4.6 Run history | None — schema and API exist     |
| **Phase 2** | 1.6 Build history, 5.1–5.4 Analytics                                               | Phase 1 complete                |
| **Phase 3** | 6.1–6.5 Multi-racer, AI recommendations                                            | Phase 2 complete, design needed |
