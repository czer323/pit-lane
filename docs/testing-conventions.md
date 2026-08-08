# Testing Conventions

What, how, and when to test in Pit Lane. Read before writing a single line of production code.

## The Three Layers

| Layer         | What to test                                                         | Tools                             | Speed       | Value                    |
| ------------- | -------------------------------------------------------------------- | --------------------------------- | ----------- | ------------------------ |
| **Unit**      | Pure logic: validation, formatting, data transforms, guard decisions | Vitest                            | Fast        | Highest bang-per-test    |
| **Component** | Behavioral contracts: render, interact, assert outcomes              | solid-testing-library + userEvent | Fast        | Catches broken UX        |
| **E2E**       | One critical-path smoke test per feature                             | Playwright                        | Slow, flaky | Catches integration gaps |

## Layer 1: Unit Tests

### What belongs here

Pure functions with no side effects. Imported directly — no mocks needed.

```ts
// src/lib/guard.test.ts
import { resolveGuardAction } from "./guard";

it("redirects signed-out users to login", () => {
  expect(resolveGuardAction("/fleet", false)).toBe("redirect-login");
});
```

### Server-side logic: dependency injection

When server code needs a database, extract pure logic into `src/lib/` and inject the DB. Never import `"use server"` modules in tests.

```ts
// src/lib/fleet.ts — pure, no "use server"
export async function toggleAtTrack(db, input) { ... }

// src/lib/fleet.test.ts — inject mock DB directly
import { createMockDb } from "~/server/db/test-helpers";

beforeEach(() => { db = createMockDb(); });
it("sets atTrack=true", async () => {
  await seedCar({ atTrack: false });
  const result = await toggleAtTrack(db, { carId: 1, atTrack: true });
  expect(result.atTrack).toBe(true);
});
```

### Do NOT test

- Drizzle ORM queries (trust the framework)
- Third-party library internals
- Framework routing (trust @solidjs/router)

## Layer 2: Component Tests

### Query selectors — durability rule

**Always prefer role-based and label-based selectors.** They survive class renames, component restructuring, and framework migration.

```
✓ screen.getByRole("button", { name: /add car/i })
✓ screen.getByLabelText("Car Name")
✓ screen.findByText(/name is required/i)

✗ container.querySelector(".submit-btn")
✗ screen.getByTestId("car-form")
✗ document.querySelector("#car-name")
```

### Pattern: mock server functions, test behavior

```ts
// src/components/AddCarForm.test.tsx
import { createCar } from "~/server/api/cars";

vi.mock("~/server/api/cars", () => ({
  createCar: vi.fn<typeof createCar>(),
}));
vi.mock("@solidjs/router", () => ({
  useNavigate: (): (() => void) => vi.fn<() => void>(),
}));

import AddCarForm from "./AddCarForm";
const mockedCreateCar = vi.mocked(createCar);

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateCar.mockResolvedValue(mockCarReturn());
});

it("calls createCar with form data on valid submit", async () => {
  const user = userEvent.setup();
  render(() => <AddCarForm />);
  await user.type(screen.getByLabelText("Car Name"), "Lightning");
  await user.click(screen.getByRole("button", { name: /add car/i }));
  expect(mockedCreateCar).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Lightning" }),
  );
});
```

### Test the contract, not the pixels

```
✓ Does clicking "Add Car" call createCar?
✓ Does empty name show "Name is required"?
✓ Does empty state show "No cars yet"?
✓ Does server error show the error message?
✓ Does car with atTrack=true show "At track" badge?

✗ Is the button amber-colored?
✗ Is the padding exactly 16px?
✗ Is the font 14px semibold?
✗ Does the DOM have class "car-form__wrapper"?
```

### Wrap with router/provider context

```ts
const wrapper = (props: { children: unknown }) => (
  <MetaProvider>{props.children as string}</MetaProvider>
);
render(() => <Component />, { wrapper });
```

### Mock type parameters

Always add type parameters to `vi.fn()`:

```ts
createCar: vi.fn<typeof createCar>(),           // matches real signature
setAtTrack: vi.fn<() => Promise<void>>(),        // explicit when shape differs
useNavigate: (): (() => void) => vi.fn<() => void>(),  // nested factory
```

### Never use dynamic imports for mocks

`vi.mock` hoists — importing the mocked module statically gives you the mock, not the real thing. Use `vi.mocked(importedFn)` to get typed access.

```ts
import { createCar } from "~/server/api/cars"; // this is the mock
const mocked = vi.mocked(createCar); // typed wrapper
```

## Layer 3: E2E Tests

One smoke test per critical flow. Keep them to a minimum.

```ts
// tests/fleet.spec.ts
test("user can add a car and see it in the list", async ({ page }) => {
  await page.goto("/fleet");
  await page.getByLabel("Car Name").fill("Lightning");
  await page.getByRole("button", { name: /add car/i }).click();
  await expect(page.getByText("Lightning added!")).toBeVisible();
  await expect(page.getByText("Lightning")).toBeVisible();
});
```

## When to Write Tests

1. **Before code** — pure logic functions (TDD)
2. **During code** — component behavioral contracts (test behavior as you build)
3. **After code** — E2E smoke tests (validate the integration)

## File Naming

```
src/lib/fleet.ts          → src/lib/fleet.test.ts
src/components/CarList.tsx → src/components/CarList.test.tsx
src/routes/fleet.tsx      → tests/fleet.spec.ts (E2E)
```

## DB Mocking

```ts
import { createMockDb } from "~/server/db/test-helpers";

// Each test gets a fresh isolated store
beforeEach(() => {
  db = createMockDb();
});

// Seed data
await db.insert(schema.cars).values({ carId: 1, name: "Test", ... });

// Query (mock supports select/insert/update/delete with where/orderBy)
const rows = await db.select().from(schema.cars).where(eq(cars.carId, 1));
```

## Reference: Example Commits

```
6f3efd1 feat: at_track toggle with migration and TDD-pure unit tests
4a7b3c2 feat: AddCarForm with submission, success, error states (8 tests)
a1c9e44 feat: Fleet page — AddCarForm + CarList cards with behavioral tests
```

## Red Flags

- Tests that break when CSS changes
- `data-testid` selectors (no — use role/label)
- Tests without assertions
- Mocking `@libsql/client` or `drizzle-orm/libsql` directly (use createMockDb)
- Dynamic imports for mocked modules
- `vi.fn()` without type parameters
