// ============================================================================
// Phase 4B · Task 2 — Real multi-tab realtime E2E
// Guard: PHASE4B-REAL-MULTI-TAB-REALTIME-E2E
// ============================================================================
// Proves the beta-readiness guarantee with REAL browser clients:
//
//   Browser A moves a task In Progress → Done through the approved app UI
//   (task editor → status select → save → updateTaskStatusAction), and
//   Browser B's Workboard AND Living Graph update AUTOMATICALLY — no manual
//   refresh — while Browser B's realtime sync indicator stays honest (live).
//
// It never touches project_event_log / process_nodes / process_edges directly;
// the only mutation is the user-visible status change (and its restore), both
// via the approved UI path. It waits on real UI conditions (web-first
// assertions + expect.poll), never arbitrary sleeps.
//
// Prerequisites (see docs/product-brain/phase4b-multi-tab-realtime-e2e.md):
//   E2E_BASE_URL, E2E_STORAGE_STATE (authed), E2E_PROJECT_ID, E2E_TASK_ID,
//   E2E_TASK_TITLE, optional E2E_LOCALE. The spec self-skips if unset so it
//   never fails a run that isn't wired for realtime.
// ============================================================================

import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const LOCALE = process.env.E2E_LOCALE ?? "en";
const PROJECT_ID = process.env.E2E_PROJECT_ID;
const TASK_ID = process.env.E2E_TASK_ID;
const TASK_TITLE = process.env.E2E_TASK_TITLE;
const HAS_ENV = Boolean(process.env.E2E_STORAGE_STATE && PROJECT_ID && TASK_ID);

// Realtime propagation budget for Browser B to reflect Browser A's change.
const REALTIME_TIMEOUT = 20_000;

const workboardUrl = () => `/${LOCALE}/projects/${PROJECT_ID}/workboard`;
const realtimeGraphUrl = () => `/${LOCALE}/projects/${PROJECT_ID}/execution-map/realtime`;

/** Change a task's status through the approved UI (card → editor → save). */
async function setTaskStatusViaUI(page: Page, taskId: string, toStatus: string) {
  await page.getByTestId(`workboard-card-${taskId}`).first().click();
  const select = page.getByTestId("task-status-select");
  await expect(select).toBeVisible();
  await select.selectOption(toStatus);
  await page.getByTestId("task-form-submit").click();
  // Editor closes on a successful save.
  await expect(page.getByTestId("task-status-select")).toBeHidden();
}

test.describe("@realtime cross-browser task status sync", () => {
  test.skip(!HAS_ENV, "Realtime E2E env not configured (see phase4b-multi-tab-realtime-e2e.md).");
  test.describe.configure({ mode: "serial" });

  let ctxA: BrowserContext;
  let ctxB: BrowserContext;
  let pageA: Page; // actor — Workboard
  let boardB: Page; // observer — Workboard
  let graphB: Page; // observer — Living Graph (realtime)

  test.beforeAll(async ({ browser }) => {
    // Two ISOLATED browser contexts = two real browsers, same authorized user.
    ctxA = await browser.newContext();
    ctxB = await browser.newContext();
    pageA = await ctxA.newPage();
    boardB = await ctxB.newPage();
    graphB = await ctxB.newPage();

    await pageA.goto(workboardUrl());
    await boardB.goto(workboardUrl());
    await graphB.goto(realtimeGraphUrl());

    // Flakiness control: ensure Browser B is actually subscribed/rendered BEFORE
    // Browser A acts. Wait for the realtime root + sync bar to mount.
    await expect(graphB.getByTestId("rt-root")).toBeVisible();
    await expect(graphB.getByTestId("rt-sync-bar")).toBeVisible();
    await expect(boardB.getByTestId(`workboard-card-${TASK_ID}`).first()).toBeVisible();

    // Deterministic precondition: the task starts In Progress (approved UI).
    const card = pageA.getByTestId(`workboard-card-${TASK_ID}`).first();
    await expect(card).toBeVisible();
    if ((await card.getAttribute("data-task-status")) !== "in_progress") {
      await setTaskStatusViaUI(pageA, TASK_ID!, "in_progress");
    }
  });

  test.afterAll(async () => {
    // Restore the task to In Progress through the approved UI (no DB mutation).
    try {
      await setTaskStatusViaUI(pageA, TASK_ID!, "in_progress");
    } catch {
      /* best-effort restore */
    }
    await ctxA?.close();
    await ctxB?.close();
  });

  test("Browser A → Done updates Browser B Workboard + Living Graph without refresh", async () => {
    // Snapshot Browser B's Living Graph last-sync so we can prove it advanced.
    const beforeSync = await graphB.getByTestId("rt-sync-bar").innerText();

    // ── ACTION: Browser A moves the task In Progress → Done via the UI ──
    await setTaskStatusViaUI(pageA, TASK_ID!, "done");
    // Browser A itself reflects the save (its own optimistic/refresh path).
    await expect(
      pageA.getByTestId("workboard-column-done").getByTestId(`workboard-card-${TASK_ID}`),
    ).toBeVisible({ timeout: REALTIME_TIMEOUT });

    // ── ASSERT (no reload anywhere): Browser B Workboard moved the card ──
    // The card now lives under the Done column and no longer under In Progress.
    await expect(
      boardB.getByTestId("workboard-column-done").getByTestId(`workboard-card-${TASK_ID}`),
    ).toBeVisible({ timeout: REALTIME_TIMEOUT });
    await expect(
      boardB.getByTestId("workboard-column-in_progress").getByTestId(`workboard-card-${TASK_ID}`),
    ).toHaveCount(0);

    // ── ASSERT: Browser B Living Graph reflects the new task status ──
    // The task node's data-node-status flips to a completed status.
    await expect
      .poll(
        async () => {
          const node = graphB
            .locator('[data-testid="rt-node-task"]')
            .filter({ hasText: TASK_TITLE ?? "" })
            .first();
          if ((await node.count()) === 0) return null;
          return node.getAttribute("data-node-status");
        },
        { timeout: REALTIME_TIMEOUT, message: "Living Graph task node never reflected Done" },
      )
      .toBe("done");

    // ── ASSERT: sync state is honest — advanced, not falsely stale ──
    await expect
      .poll(async () => graphB.getByTestId("rt-sync-bar").innerText(), { timeout: REALTIME_TIMEOUT })
      .not.toBe(beforeSync);
    await expect(graphB.getByTestId("rt-sync-bar")).not.toContainText(/stale|degraded|desactualiz/i);

    // ── ASSERT: no manual refresh happened (page objects were never reloaded) ──
    // (This test never calls page.reload(); the assertions above prove push.)
  });
});
