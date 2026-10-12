// Takes the README screenshot: serves the production build, loads sample stats,
// starts a drill, and saves docs/screenshot.png.
//
//   npm run build && npm run screenshot
//
// Uses an installed Chromium browser (Chrome, Edge or Brave) via puppeteer-core.
// Set BROWSER_PATH to point at a different one.

import { existsSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { preview } from "vite";

const CANDIDATES = [
  process.env.BROWSER_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error("No Chromium browser found. Set BROWSER_PATH.");
  process.exit(1);
}
if (!existsSync("dist/index.html")) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}

// Made-up sample numbers so the stats table has something to show.
const t = (ms, n = 8) => Array.from({ length: n }, (_, i) => ms + ((i * 37) % 120) - 60);
const SAMPLE_STATS = {
  H: { n: 14, ok: 14, times: t(520), confused: {} },
  Z: { n: 12, ok: 11, times: t(690), confused: { H: 1 } },
  U: { n: 18, ok: 18, times: t(610), confused: {} },
  A: { n: 16, ok: 15, times: t(780), confused: { J: 1 } },
  E: { n: 9, ok: 8, times: t(1240), confused: { H: 1 } },
  T: { n: 13, ok: 13, times: t(700), confused: {} },
  F: { n: 11, ok: 9, times: t(1350), confused: { T: 2 } },
  J: { n: 15, ok: 13, times: t(900), confused: { R: 1, A: 1 } },
  R: { n: 14, ok: 11, times: t(1180), confused: { J: 2, G: 1 } },
  G: { n: 22, ok: 15, times: t(1720), confused: { R: 4, J: 2, A: 1 } },
  V: { n: 10, ok: 8, times: t(1410), confused: { Y: 2 } },
  Y: { n: 10, ok: 9, times: t(1100), confused: { V: 1 } },
  N: { n: 8, ok: 8, times: t(980), confused: {} },
};

const server = await preview({ preview: { port: 4173, strictPort: true } });
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({ executablePath, headless: true });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 1100, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.evaluateOnNewDocument((stats) => {
    localStorage.setItem("pllrt:stats", JSON.stringify(stats));
  }, SAMPLE_STATS);
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);

  await page.click("#startBtn");
  await page.waitForFunction(() => !document.getElementById("cube").classList.contains("idle"));
  await new Promise((r) => setTimeout(r, 900));

  mkdirSync("docs", { recursive: true });
  await page.screenshot({ path: "docs/screenshot.png", fullPage: true });
  console.log("Saved docs/screenshot.png");
} finally {
  await browser.close();
  await server.close();
}
