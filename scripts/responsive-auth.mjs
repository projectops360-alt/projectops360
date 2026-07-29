// ============================================================================
// Capture an authenticated Playwright storageState for the responsive audit
// ============================================================================
// Logs in through the real login form and saves the resulting session so
// `responsive-audit.mjs` and `e2e/responsive-overflow.spec.ts` can reach the
// screens behind auth. Credentials are read from the environment and are never
// written to disk — only the resulting session cookie is.
//
//   $env:E2E_EMAIL="you@example.com"
//   $env:E2E_PASSWORD="…"
//   node scripts/responsive-auth.mjs
//
// Writes .auth/storage-state.json (git-ignored).
// ============================================================================

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.STORAGE_STATE ?? ".auth/storage-state.json";
const LOCALE = process.env.LOCALE ?? "en";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Set E2E_EMAIL and E2E_PASSWORD first.");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${BASE_URL}/${LOCALE}/login`, { waitUntil: "networkidle" });
await page.getByLabel(/email|correo/i).fill(EMAIL);
await page.getByLabel(/password|contrase/i).fill(PASSWORD);
await page.getByRole("button", { name: /sign in|log in|iniciar|entrar/i }).click();

// The app lands on the PMO Command Center once the session is real.
await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 });

await mkdir(dirname(OUT), { recursive: true });
await page.context().storageState({ path: OUT });
await browser.close();

console.log(`Session saved → ${OUT}`);
console.log(`Now run:  $env:STORAGE_STATE="${OUT}"; node scripts/responsive-audit.mjs`);
