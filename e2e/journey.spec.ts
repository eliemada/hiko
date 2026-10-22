import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Full pilot journey against a fresh database:
 * sign up → import DJI logs → fill ④ → draw signature → sign → journey log → XLSX.
 * Set E2E_FIXTURES to a folder of DJI FlightRecord .txt files.
 */
const FIXTURES = process.env.E2E_FIXTURES ?? path.join(process.cwd(), "e2e/fixtures");
const SHOTS = process.env.E2E_SHOTS;

const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
};

test.describe.configure({ mode: "serial" });

test("pilot journey", async ({ page }) => {
  test.skip(!process.env.E2E_FIXTURES, "Optional real-log test: supply private E2E_FIXTURES explicitly.");
  const email = `pilot-${Date.now()}@example.com`;

  await page.goto("/sign-up");
  await shot(page, "01-sign-up");
  await page.getByLabel(/Full name/).fill("Alex Smith");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("correct-horse-battery");
  const invite = page.getByLabel("Invite code");
  if (await invite.isVisible()) await invite.fill(process.env.INVITE_CODE ?? "");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-up"));

  // Import
  await page.goto("/import");
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".txt")).map((f) => path.join(FIXTURES, f));
  await page.locator('input[type="file"]').setInputFiles(files);
  await expect(page.getByText(/flights? imported|Already imported/).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("li").filter({ hasText: /Uploading|Decrypting/ })).toHaveCount(0, { timeout: 90_000 });
  await shot(page, "02-import");

  // Flights list
  await page.goto("/flights");
  await expect(page.getByRole("heading", { name: "Flights" })).toBeVisible();
  await shot(page, "03-flights");

  // Signature
  await page.goto("/settings");
  const pad = page.getByLabel("Signature pad");
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 100);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) await page.mouse.move(box.x + 60 + i * 25, box.y + 80 + Math.sin(i) * 30, { steps: 3 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Save signature" }).click();
  await expect(page.getByText("Signature saved")).toBeVisible();
  await shot(page, "04-settings");

  // Flight detail: fill purpose, sign
  await page.goto("/flights");
  await page.locator("tbody tr a").first().click();
  await page.waitForURL(/\/flights\/[\w-]+$/);
  await page.getByRole("button", { name: "Aerial photography", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500); // map tiles
  await shot(page, "05-flight-detail");
  await page.getByRole("button", { name: /Review & sign/ }).click();
  await page.getByRole("button", { name: "Sign", exact: true }).click();
  await expect(page.getByText("Flight signed")).toBeVisible();
  await expect(page.getByText("Signed", { exact: true }).first()).toBeVisible();

  // Dashboard
  await page.goto("/");
  await shot(page, "06-dashboard");

  // Journey log + XLSX
  await page.goto("/log");
  await expect(page.getByText("JOURNEY LOG OF UAS").first()).toBeVisible();
  await shot(page, "07-journey-log");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Excel/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^journey-log-.*\.xlsx$/);
  if (SHOTS) await file.saveAs(path.join(SHOTS, file.suggestedFilename()));

  // PDF logbook
  const href = await page.getByRole("link", { name: /PDF logbook/ }).getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const pdf = await res.body();
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  if (SHOTS) writeFileSync(path.join(SHOTS, "logbook.pdf"), pdf);

  // Aircraft + squawk
  await page.goto("/squawks");
  await page.getByRole("button", { name: "Add squawk" }).click();
  await page.getByLabel("Flight squawk").fill("プロペラ先端の欠け");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("プロペラ先端の欠け")).toBeVisible();
  await page.goto("/aircraft");
  await shot(page, "08-aircraft");

  // Sign out, sign back in
  await page.context().clearCookies();
  await page.goto("/flights");
  await page.waitForURL(/\/sign-in/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/flights");
});
