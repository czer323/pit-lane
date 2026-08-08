import { test, expect } from "@playwright/test";

/**
 * Layer-1 proof gate: Google OAuth sign-in against the LOCAL dev server.
 *
 * Reads test credentials from env (set in .env.local, gitignored):
 *   GOOGLE_TEST_EMAIL / GOOGLE_TEST_PASSWORD
 *
 * This is the deterministic gate that proves the Google flow works end-to-end
 * BEFORE anything is deployed to a Vercel dev or production environment.
 */
const GOOGLE_TEST_EMAIL = process.env.GOOGLE_TEST_EMAIL;
const GOOGLE_TEST_PASSWORD = process.env.GOOGLE_TEST_PASSWORD;

test("Google sign-in works end-to-end on local dev", async ({ page }) => {
  test.skip(
    !GOOGLE_TEST_EMAIL || !GOOGLE_TEST_PASSWORD,
    "GOOGLE_TEST_EMAIL / GOOGLE_TEST_PASSWORD not set in .env.local",
  );

  // 1. Signed-out access to app routes redirects to /login
  await page.goto("/");
  await page.waitForURL("**/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  // 2. Click "Sign in with Google"
  await page.getByRole("button", { name: /sign in with google/i }).click();

  // 3. Google consent screen: fill email, next, password, next
  const emailInput = page.getByRole("textbox", { name: /email|phone/i }).first();
  await emailInput.fill(GOOGLE_TEST_EMAIL!);
  await page.getByRole("button", { name: /next/i }).click();

  const passwordInput = page.getByRole("textbox", { name: /password/i }).first();
  await passwordInput.fill(GOOGLE_TEST_PASSWORD!);
  await page.getByRole("button", { name: /next/i }).click();

  // 4. Land back signed-in (callback -> app root)
  await page.waitForURL("**/", { timeout: 30_000 });
  await expect(page.getByText(/sign out/i)).toBeVisible();
});
