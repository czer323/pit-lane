import { test, expect, type Page } from "@playwright/test";

// Mirrors docs/specs/mocked-ui-track-entry-behavior.md — assertions numbered there.
// Every behavior change to the mock MUST update both files together.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

async function gotoMock(page: Page) {
  await page.goto("/track_entry.html");
  await page.locator(".car-chip").first().waitFor();
}

async function submitPass(page: Page, rt = "0.1234") {
  await page.locator("#inputRT").fill(rt);
  await page.locator("#submitBtn").click();
}

function activeLane(page: Page) {
  return page.evaluate(() => {
    const left = document.querySelector('[data-lane="Left"]');
    const right = document.querySelector('[data-lane="Right"]');
    if (left?.classList.contains("active-lane-left")) return "Left";
    if (right?.classList.contains("active-lane-right")) return "Right";
    return "none";
  });
}

test.describe("Environment controls", () => {
  test("A1/A2: clicking digit opens editor prefilled; Enter commits", async ({ page }) => {
    await gotoMock(page);
    await page.locator("#displayTemp").click();
    const editor = page.locator("#displayTemp .env-val-input");
    await expect(editor).toHaveValue("82");
    await editor.fill("87");
    await editor.press("Enter");
    await expect(page.locator("#displayTemp")).toHaveText("87°F");
    await expect(page.locator("#displayTemp .env-val-input")).toHaveCount(0);
  });

  test("A3: Escape cancels, display unchanged", async ({ page }) => {
    await gotoMock(page);
    await page.locator("#displayHumidity").click();
    const editor = page.locator("#displayHumidity .env-val-input");
    await editor.fill("99");
    await editor.press("Escape");
    await expect(page.locator("#displayHumidity")).toHaveText("45%");
  });

  test("A4: blur commits typed value", async ({ page }) => {
    await gotoMock(page);
    await page.locator("#displayHumidity").click();
    const editor = page.locator("#displayHumidity .env-val-input");
    await editor.fill("33");
    await editor.blur();
    await expect(page.locator("#displayHumidity")).toHaveText("33%");
  });

  test("A5: humidity steppers move by 1", async ({ page }) => {
    await gotoMock(page);
    const group = page.locator(".env-group").nth(1);
    await group.locator("button").nth(1).click(); // + (0 = minus, 1 = plus)
    await expect(page.locator("#displayHumidity")).toHaveText("46%");
    await group.locator("button").nth(0).click(); // -
    await group.locator("button").nth(0).click(); // -
    await expect(page.locator("#displayHumidity")).toHaveText("44%");
  });

  test("A6-A8: relaxed clamps — humidity 0..100, temp -40..200", async ({ page }) => {
    await gotoMock(page);
    await page.locator("#displayHumidity").click();
    await page.locator("#displayHumidity .env-val-input").fill("999");
    await page.locator("#displayHumidity .env-val-input").press("Enter");
    await expect(page.locator("#displayHumidity")).toHaveText("100%");

    await page.locator("#displayTemp").click();
    await page.locator("#displayTemp .env-val-input").fill("150");
    await page.locator("#displayTemp .env-val-input").press("Enter");
    await expect(page.locator("#displayTemp")).toHaveText("150°F");

    await page.locator("#displayTemp").click();
    await page.locator("#displayTemp .env-val-input").fill("-5");
    await page.locator("#displayTemp .env-val-input").press("Enter");
    await expect(page.locator("#displayTemp")).toHaveText("-5°F");
  });

  test("A9: non-numeric input leaves value unchanged", async ({ page }) => {
    await gotoMock(page);
    await page.locator("#displayTemp").click();
    await page.locator("#displayTemp .env-val-input").fill("abc");
    await page.locator("#displayTemp .env-val-input").press("Enter");
    await expect(page.locator("#displayTemp")).toHaveText("82°F");
  });
});

test.describe("Entry fields", () => {
  test("A10: Session field absent; hint reflects per-car practice lanes", async ({ page }) => {
    await gotoMock(page);
    await expect(page.locator("#inputSession")).toHaveCount(0);
    await expect(page.locator(".hotkey-hint")).toContainText("Lane auto-flips per car in Practice");
  });
});

test.describe("Lane behavior", () => {
  test("A11-A13: practice alternates per car, fresh cars start Left", async ({ page }) => {
    await gotoMock(page);
    await page.locator('.car-chip[data-car-id="1"]').click();
    expect(await activeLane(page)).toBe("Left");

    await page.locator('.car-chip[data-car-id="2"]').click();
    expect(await activeLane(page)).toBe("Left"); // fresh car, own counter

    await submitPass(page);
    expect(await activeLane(page)).toBe("Right"); // car 2 run 1 -> Left, next Right
    await submitPass(page);
    expect(await activeLane(page)).toBe("Left"); // car 2 run 2 -> Right, next Left
    await submitPass(page);
    expect(await activeLane(page)).toBe("Right"); // car 2 run 3 -> Left, next Right

    await page.locator('.car-chip[data-car-id="1"]').click();
    expect(await activeLane(page)).toBe("Left"); // car 1 unaffected by car 2's runs
  });

  test("A14: elimination lane stays put across submits", async ({ page }) => {
    await gotoMock(page);
    await page.locator('[data-session="Elimination"]').click();
    await page.locator('.car-chip[data-car-id="1"]').click();
    await page.locator('[data-lane="Right"]').click();
    await page.locator('[data-wl="win"]').click();

    await submitPass(page);
    expect(await activeLane(page)).toBe("Right");

    await page.locator('[data-wl="win"]').click(); // choice resets per run
    await submitPass(page);
    expect(await activeLane(page)).toBe("Right");
  });
});

test.describe("Elimination choice", () => {
  test("A15: submit without Win/Loss alerts and records nothing", async ({ page }) => {
    await gotoMock(page);
    await page.locator('[data-session="Elimination"]').click();
    await page.locator('.car-chip[data-car-id="1"]').click();

    // Capture and dismiss inside the handler so the click doesn't deadlock on the modal alert.
    const dialogMessage = page.waitForEvent("dialog").then(async (d) => {
      const message = d.message();
      await d.dismiss();
      return message;
    });
    await submitPass(page);
    expect(await dialogMessage).toBe("Select Win or Loss before submitting.");
    await expect(page.locator(".run-row")).toHaveCount(0);
    expect(await activeLane(page)).toBe("Left"); // untouched
  });
});

test.describe("Data display", () => {
  test("A17-A18: RT shown in last-run bar and Runs Log", async ({ page }) => {
    await gotoMock(page);
    await page.locator('.car-chip[data-car-id="1"]').click();
    await submitPass(page, "0.1234");

    await expect(page.locator("#lastRunBar")).toContainText("RT 0.1234");
    await page.locator('[data-tab="log"]').click();
    const firstDataRow = page.locator(".run-row:not(.header)").first();
    await expect(firstDataRow).toContainText("0.1234");
  });
});
