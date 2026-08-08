import { test, expect } from "@playwright/test";

/**
 * E2E CRUD smoke test: proves the full create → read → update → delete
 * lifecycle for cars and races using email/password auth (no Google OAuth).
 *
 * Run with: npx playwright test --config=playwright.auth.config.ts
 * Requires: vp dev running on localhost:3000
 */

const TEST_EMAIL = `e2e-crud-${Date.now()}@pitlane.dev`;
const TEST_PASSWORD = "e2e-crud-pass";

test.describe("Car CRUD", () => {
  test("create, view, edit, and delete a car", async ({ page }) => {
    // 1. Sign up via better-auth API
    const signUpResp = await page.request.post("http://localhost:3000/api/auth/sign-up/email", {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: "E2E CRUD Tester",
      },
    });
    expect(signUpResp.ok()).toBe(true);
    const { token } = await signUpResp.json();

    // Set the session cookie
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);

    // 2. Navigate to Fleet and verify it loads
    await page.goto("/fleet");
    await expect(page.getByText("Fleet Manager")).toBeVisible();

    // 3. Create a car
    await page.getByLabel("Car Name").fill("E2E Test Car");
    await page.getByLabel("Body").fill("S10");
    await page.getByLabel("Motor").fill("FK-180SH");
    await page.getByLabel("Weight (g)").fill("85");
    await page.getByRole("button", { name: "Add Car" }).click();

    // Verify success message
    await expect(page.getByText(/added!/i)).toBeVisible();

    // Verify car appears in list
    await expect(page.getByText("E2E Test Car")).toBeVisible();
    await expect(page.getByText("FK-180SH")).toBeVisible();

    // 4. Click car name to view detail
    await page.getByText("E2E Test Car").first().click();
    await page.waitForURL(/\/cars\/\d+/);
    await expect(page.getByRole("heading", { name: "E2E Test Car" })).toBeVisible();
    await expect(page.getByText("S10")).toBeVisible();
    await expect(page.getByText("85 g")).toBeVisible();

    // 5. Navigate to edit form
    await page.getByText("Edit").click();
    await page.waitForURL(/\/cars\/\d+\/edit/);
    await expect(page.getByLabel("Car Name")).toHaveValue("E2E Test Car");

    // Update the name
    await page.getByLabel("Car Name").fill("E2E Updated Car");
    await page.getByRole("button", { name: /save/i }).click();

    // Should navigate back to detail with updated name
    await page.waitForURL(/\/cars\/\d+$/);
    await expect(page.getByText("E2E Updated Car")).toBeVisible();

    // 6. Delete the car
    await page.getByText("Delete").click();
    await expect(page.getByText(/delete this car/i)).toBeVisible();
    await page.getByRole("button", { name: /confirm/i }).click();

    // Should navigate back to fleet
    await page.waitForURL("/cars");
    await expect(page.getByText("E2E Test Car")).toBeHidden();
    await expect(page.getByText("E2E Updated Car")).toBeHidden();
  });
});

test.describe("Race CRUD", () => {
  test("create and view a race event", async ({ page }) => {
    // Sign up
    const signUpResp = await page.request.post("http://localhost:3000/api/auth/sign-up/email", {
      data: {
        email: `e2e-race-${Date.now()}@pitlane.dev`,
        password: TEST_PASSWORD,
        name: "E2E Race Tester",
      },
    });
    const { token } = await signUpResp.json();
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);

    // Navigate to Races
    await page.goto("/races");
    await expect(page.getByText(/race events/i)).toBeVisible();

    // Create new event
    await page.getByRole("link", { name: /new event/i }).click();
    await page.waitForURL("/races/new");

    await page.getByLabel("Track").fill("E2E Speedway");
    await page.getByLabel("Event Date").fill("2026-12-25");
    await page.getByLabel("Session Label").fill("Christmas Cup");
    await page.getByRole("button", { name: /create event/i }).click();

    // Should navigate to the new event's detail page
    await page.waitForURL(/\/races\/\d+/);
    await expect(page.getByText("E2E Speedway")).toBeVisible();
    await expect(page.getByText("Christmas Cup")).toBeVisible();
    await expect(page.getByText(/no runs yet/i)).toBeVisible();
  });
});
