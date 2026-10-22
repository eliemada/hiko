import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { chromium } from "@playwright/test";

await mkdir("docs/media", { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-demo.mjs"], { env: { ...process.env, DEMO_PORT: "4175" }, stdio: "inherit" });
let browser;
try {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch("http://127.0.0.1:4175")).ok) break; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, recordVideo: { dir: ".release/video", size: { width: 1440, height: 1000 } }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4175");
  await page.screenshot({ path: "docs/media/demo-overview.png", fullPage: true });
  await page.waitForTimeout(3500);
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Load sample flight/ }).click();
  await page.waitForTimeout(5000);
  await page.locator(".workspace").screenshot({ path: "docs/media/demo-review.png" });
  for (const check of await page.getByRole("checkbox").all()) { await check.check(); await page.waitForTimeout(1400); }
  await page.getByRole("button", { name: /Apply sample signature/ }).click();
  await page.waitForTimeout(4000);
  await page.locator(".workspace").screenshot({ path: "docs/media/demo-signed.png" });
  await page.getByRole("link", { name: /Download PDF/ }).hover();
  await page.waitForTimeout(2000);
  await page.getByRole("link", { name: /Download Excel/ }).hover();
  await page.waitForTimeout(3000);
  const video = page.video();
  await context.close();
  const source = await video.path();
  const conversion = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", source, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", "docs/media/walkthrough.mp4"], { stdio: "inherit" });
  if (conversion.status !== 0) throw new Error("Install ffmpeg to encode the walkthrough");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await mobile.goto("http://127.0.0.1:4175");
  await mobile.getByRole("button", { name: /Load sample flight/ }).click();
  await mobile.screenshot({ path: "docs/media/demo-mobile.png", fullPage: true });
  await rm(".release/video", { recursive: true, force: true });
  console.log("Saved desktop/mobile screenshots and the MP4 walkthrough to docs/media.");
} finally { await browser?.close(); server.kill("SIGTERM"); }
