// ============================================================================
// ProjectOps360° — Playwright config (Phase 4B / Task 2)
// ============================================================================
// Real multi-tab / multi-context realtime E2E. This is DELIBERATELY NOT part of
// CI (`typecheck · test · build`): it needs a running app instance + a live
// Supabase Realtime environment + an authenticated storage state + seeded test
// data — none of which CI provides. Run it locally/staging with `npm run
// test:e2e` after exporting the env vars documented in
// docs/product-brain/phase4b-multi-tab-realtime-e2e.md.
// ============================================================================

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const STORAGE_STATE = process.env.E2E_STORAGE_STATE; // path to an authed storageState json

export default defineConfig({
  testDir: "./e2e",
  // Realtime spec mutates shared task data — never run its cases in parallel.
  fullyParallel: false,
  workers: 1,
  // Realtime propagation can take a moment; retry once and keep a trace.
  retries: process.env.CI ? 0 : 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    storageState: STORAGE_STATE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
