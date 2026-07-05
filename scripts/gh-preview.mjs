// One-command GitHub Intelligence visual harness: boots `next dev` pointed at a
// dummy LOCAL/non-prod env (never .env.local's production Supabase), waits for
// the dev-only harness route, screenshots the synthetic dashboard/graph/states,
// then shuts the dev server down. No database, no production contact.
//
// Usage: npm run gh:preview
import { spawn, execSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const PORT = process.env.GH_PREVIEW_PORT || "3011";
const BASE = `http://localhost:${PORT}`;
const URL = `${BASE}/navigator-preview/gh`;
const OUT = "gh-review-shots";

// Force a non-prod Supabase target so nothing can reach production, and keep the
// feature flag OFF (the harness renders components directly with mock data).
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-dummy-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "local-dummy-service",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
  GITHUB_INTELLIGENCE_ENABLED: "false",
  PORT,
};

function killTree(pid) {
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch {}
}

console.log(`▶ starting next dev on ${PORT} (dummy local env, flag OFF)…`);
const dev = spawn("npx", ["next", "dev", "-p", PORT], {
  env, shell: true, stdio: "ignore", detached: process.platform !== "win32",
});

async function waitReady(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(URL);
      if (r.ok) return true;
    } catch {}
    await new Promise((res) => setTimeout(res, 1500));
  }
  return false;
}

let exitCode = 0;
try {
  const ready = await waitReady();
  if (!ready) throw new Error(`harness route not ready at ${URL}`);
  console.log("✓ harness ready:", URL);

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-testid="sec-dashboard"]', { timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${OUT}/00_full_page.png`, fullPage: true });
  const simple = [
    ["sec-dashboard", "A-B_dashboard_and_fishbone.png"],
    ["sec-fishbone", "B_fishbone_only.png"],
    ["sec-settings", "D_settings_integration_connected.png"],
    ["sec-unavailable", "F_direct_access_blocked.png"],
  ];
  for (const [id, file] of simple) {
    await page.locator(`[data-testid="${id}"]`).first().screenshot({ path: `${OUT}/${file}` });
    console.log("saved", file);
  }
  for (const [id, file] of [
    ["sec-nav-software", "C_nav_software_execution_open_HAS_github.png"],
    ["sec-nav-nonsoftware", "E-G_nav_nonsoftware_execution_open_NO_github.png"],
  ]) {
    const sec = page.locator(`[data-testid="${id}"]`);
    await sec.scrollIntoViewIfNeeded();
    await sec.getByRole("button", { name: "Execution" }).click();
    await page.waitForTimeout(400);
    const box = await sec.boundingBox();
    await page.screenshot({ path: `${OUT}/${file}`, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 240) } });
    await page.mouse.click(5, 5).catch(() => {});
    console.log("saved", file);
  }
  await browser.close();
  console.log(`✓ DONE → ${OUT}/`);
} catch (e) {
  console.error("✗ gh:preview failed:", e.message);
  exitCode = 1;
} finally {
  killTree(dev.pid);
}
process.exit(exitCode);
