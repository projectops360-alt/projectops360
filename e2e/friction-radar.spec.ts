import { test, expect } from "@playwright/test";

const LOCALE = process.env.E2E_LOCALE ?? "en";
const PROJECT_ID = process.env.E2E_FRICTION_RADAR_PROJECT_ID;
const FOREIGN_PROJECT_ID = process.env.E2E_FRICTION_RADAR_FOREIGN_PROJECT_ID;
const HAS_AUTHORIZED_ENV = Boolean(process.env.E2E_STORAGE_STATE && PROJECT_ID);

const radarUrl = (projectId: string) => `/${LOCALE}/projects/${projectId}/friction-radar`;

test.describe("@friction-radar protected read-only surface", () => {
  test.skip(!HAS_AUTHORIZED_ENV, "Friction Radar E2E env is not configured.");

  test("authorized project renders signals, filters and evidence panel", async ({ page }) => {
    await page.goto(radarUrl(PROJECT_ID!));
    await expect(page.getByTestId("friction-radar-root")).toBeVisible();
    await expect(page.getByTestId("friction-signal-list")).toBeVisible();
    await page.getByTestId("friction-filter-search").fill("reopen");
    const rows = page.getByTestId("friction-signal-row");
    await expect(rows.first()).toBeVisible();
    await rows.first().getByTestId("open-friction-evidence").click();
    await expect(page.getByTestId("friction-evidence-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("friction-evidence-panel")).toBeHidden();
  });

  test("GET API is private and read-only", async ({ request }) => {
    const response = await request.get(`/api/projects/${PROJECT_ID}/friction-radar?locale=${LOCALE}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).projectId).toBe(PROJECT_ID);
  });

  test("foreign project is concealed as not found", async ({ page }) => {
    test.skip(!FOREIGN_PROJECT_ID, "No cross-organization fixture configured.");
    const response = await page.goto(radarUrl(FOREIGN_PROJECT_ID!));
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("friction-radar-root")).toHaveCount(0);
  });
});
