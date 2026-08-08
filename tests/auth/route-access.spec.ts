import { test, expect } from "@playwright/test";

/**
 * Route accessibility: confirms the middleware gating and page rendering
 * for unauthenticated users against the local dev server.
 *
 * Run with: npx playwright test --config=playwright.auth.config.ts
 * Requires: vp dev running on localhost:3000
 */
test.describe("unauthenticated route access", () => {
  test("/ renders dashboard", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/race dashboard/i)).toBeVisible();
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test("/login renders sign-in page", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/pit lane/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  test("/fleet redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/fleet");
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  test("/analytics redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  test("/cars routes redirect to login when unauthenticated", async ({ page }) => {
    await page.goto("/cars/1");
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  test("/races routes redirect to login when unauthenticated", async ({ page }) => {
    await page.goto("/races/1");
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });
});
