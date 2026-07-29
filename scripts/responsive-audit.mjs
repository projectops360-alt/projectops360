// ============================================================================
// Responsive audit — screenshots + horizontal-overflow report
// ============================================================================
// Drives a real browser over the app at every target viewport, saves a
// screenshot per route/width and reports any element sticking out of the
// viewport. Complements the Playwright spec: this one produces the visual
// evidence, the spec is the pass/fail gate.
//
//   node scripts/responsive-audit.mjs
//
// Env:
//   BASE_URL            default http://localhost:3000
//   STORAGE_STATE       path to an authed Playwright storageState JSON.
//                       Without it only unauthenticated routes are captured,
//                       since everything else redirects to /login.
//   OUT_DIR             default ./responsive-audit
//   LOCALE              default en
// ============================================================================

import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const STORAGE_STATE = process.env.STORAGE_STATE;
const OUT_DIR = process.env.OUT_DIR ?? "responsive-audit";
const LOCALE = process.env.LOCALE ?? "en";

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "820x1180", width: 820, height: 1180 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
];

const ROUTES = [
  { name: "command-center", path: `/${LOCALE}`, auth: true },
  { name: "projects", path: `/${LOCALE}/projects`, auth: true },
  { name: "team", path: `/${LOCALE}/team`, auth: true },
  { name: "reports", path: `/${LOCALE}/reports`, auth: true },
  { name: "pmo-living-graph", path: `/${LOCALE}/pmo-living-graph`, auth: true },
  { name: "login", path: `/${LOCALE}/login`, auth: false },
];

/**
 * Elements that actually stick out of the viewport.
 *
 * An element whose box extends past the screen is only a defect if nothing
 * clips it. Decorative blur/glow layers, the closed nav drawer and the inside
 * of a deliberately scrollable strip (tabs, tables) all overhang by design and
 * are contained by an ancestor — counting them would bury the real findings.
 */
const COLLECT_OFFENDERS = (width) => {
  const isClipped = (el, rect) => {
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      const s = getComputedStyle(parent);
      const clipsX = s.overflowX !== "visible";
      if (clipsX) {
        const pr = parent.getBoundingClientRect();
        // Clipped horizontally by this ancestor?
        if (rect.right > pr.right - 1 || rect.left < pr.left + 1) return true;
      }
      parent = parent.parentElement;
    }
    return false;
  };

  const offenders = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (el.classList.contains("sr-only")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.right <= width + 1 && rect.left >= -1) continue;
    if (isClipped(el, rect)) continue;
    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === "string" ? el.className.slice(0, 140) : "",
      left: Math.round(rect.left),
      right: Math.round(rect.right),
    });
  }
  return offenders.slice(0, 12);
};

async function main() {
  const authed = Boolean(STORAGE_STATE && existsSync(STORAGE_STATE));
  if (STORAGE_STATE && !authed) {
    console.warn(`! STORAGE_STATE "${STORAGE_STATE}" not found — running unauthenticated.`);
  }
  if (!authed) {
    console.warn("! No auth state: only public routes will be captured.\n");
  }

  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext(authed ? { storageState: STORAGE_STATE } : {});
  const page = await context.newPage();

  const report = [];
  let failures = 0;

  for (const route of ROUTES) {
    if (route.auth && !authed) continue;
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      let scrollWidth = -1;
      let offenders = [];
      let error = null;
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle", timeout: 45_000 });
        await page.waitForTimeout(400);
        scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        offenders = await page.evaluate(COLLECT_OFFENDERS, vp.width);
        await page.screenshot({
          path: join(OUT_DIR, `${route.name}__${vp.name}.png`),
          fullPage: false,
        });
      } catch (e) {
        error = String(e.message ?? e).split("\n")[0];
      }

      const overflowing = scrollWidth > vp.width + 1 || offenders.length > 0;
      if (overflowing || error) failures++;
      report.push({ route: route.name, viewport: vp.name, width: vp.width, scrollWidth, offenders, error });

      const mark = error ? "ERR " : overflowing ? "FAIL" : "ok  ";
      console.log(
        `${mark} ${route.name.padEnd(18)} ${vp.name.padEnd(9)} scrollWidth=${scrollWidth}` +
          (offenders.length ? `  offenders=${offenders.length}` : "") +
          (error ? `  ${error}` : ""),
      );
      for (const o of offenders) {
        console.log(`       ↳ <${o.tag}> left=${o.left} right=${o.right} class="${o.cls}"`);
      }
    }
  }

  await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");
  await browser.close();

  console.log(`\nScreenshots + report.json → ${OUT_DIR}`);
  console.log(failures === 0 ? "No horizontal overflow detected." : `${failures} viewport/route combos need attention.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
