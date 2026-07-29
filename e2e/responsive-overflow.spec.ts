// ============================================================================
// Responsive / horizontal-overflow E2E sweep
// Guards: RESPONSIVE-NO-PAGE-OVERFLOW, RESPONSIVE-MOBILE-DRAWER
// ============================================================================
// Like the realtime spec, this is DELIBERATELY NOT part of CI: it needs a
// running app and an authenticated storage state. Run locally with:
//
//   npx playwright test e2e/responsive-overflow.spec.ts
//
// with E2E_BASE_URL (default http://localhost:3000) and E2E_STORAGE_STATE
// pointing at an authed session. Without the storage state every route
// redirects to /login and the sweep is meaningless, so it skips instead of
// reporting a false pass.
// ============================================================================

import { test, expect, type Page } from "@playwright/test";

const LOCALE = process.env.E2E_LOCALE ?? "en";

/** The four screens named in the bug report, plus the shell-level routes. */
const ROUTES = [
  { name: "PMO Command Center", path: `/${LOCALE}` },
  { name: "Projects", path: `/${LOCALE}/projects` },
  { name: "Team", path: `/${LOCALE}/team` },
  { name: "Reports & Intelligence", path: `/${LOCALE}/reports` },
  { name: "PMO Living Graph", path: `/${LOCALE}/pmo-living-graph` },
];

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

test.skip(
  !process.env.E2E_STORAGE_STATE,
  "Needs E2E_STORAGE_STATE — without a session every route redirects to /login.",
);

/**
 * Elements that genuinely stick out of the viewport.
 *
 * Overhang is only a defect when nothing clips it. A closed drawer sits at
 * translateX(-100%) by design, `sr-only` text is positioned off-screen, and
 * the contents of a deliberately scrollable strip (tabs, wide tables) or a
 * decorative blur layer are contained by an ancestor. Flagging those would
 * make the sweep permanently red and hide the real findings.
 */
async function offendingElements(page: Page, viewportWidth: number) {
  return page.evaluate((width) => {
    const isClipped = (el: HTMLElement, rect: DOMRect) => {
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        if (getComputedStyle(parent).overflowX !== "visible") {
          const pr = parent.getBoundingClientRect();
          if (rect.right > pr.right - 1 || rect.left < pr.left + 1) return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const offenders: { tag: string; cls: string; left: number; right: number }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.classList.contains("sr-only")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      // 1px of tolerance absorbs sub-pixel rounding on fractional DPR.
      if (rect.right <= width + 1 && rect.left >= -1) continue;
      if (isClipped(el, rect)) continue;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === "string" ? el.className.slice(0, 120) : "",
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      });
    }
    return offenders.slice(0, 10);
  }, viewportWidth);
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name}`, () => {
    for (const route of ROUTES) {
      test(`${route.name} has no horizontal page scroll`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(route.path, { waitUntil: "networkidle" });

        // 1. The page itself must not scroll sideways.
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(
          scrollWidth,
          `${route.name} @ ${viewport.name}: document scrollWidth ${scrollWidth} > ${viewport.width}`,
        ).toBeLessThanOrEqual(viewport.width + 1);

        // 2. And nothing may sit outside it. Reported together so a failure
        //    names the culprit instead of just the symptom.
        const offenders = await offendingElements(page, viewport.width);
        expect(
          offenders,
          `${route.name} @ ${viewport.name} overflowing elements:\n${JSON.stringify(offenders, null, 2)}`,
        ).toEqual([]);
      });
    }

    test("the shell reserves sidebar width only from 768px up", async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/${LOCALE}`, { waitUntil: "networkidle" });

      const paddingLeft = await page.evaluate(() => {
        const main = document.querySelector("main");
        const wrapper = main?.parentElement;
        return wrapper ? parseFloat(getComputedStyle(wrapper).paddingLeft) : -1;
      });

      if (viewport.width < 768) {
        expect(paddingLeft, "desktop sidebar must claim no width on mobile").toBe(0);
      } else {
        expect(paddingLeft, "sidebar gutter must survive on tablet/desktop").toBeGreaterThan(0);
      }
    });
  });
}

test.describe("mobile navigation drawer", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens from the header, closes on overlay tap and on Escape", async ({ page }) => {
    await page.goto(`/${LOCALE}`, { waitUntil: "networkidle" });

    const drawer = page.locator("aside").first();
    const trigger = page.getByRole("button", { name: /open navigation menu|abrir men/i });

    // Closed: off-canvas and unreachable.
    await expect(drawer).toBeHidden();

    await trigger.click();
    await expect(drawer).toBeVisible();

    // Escape dismisses.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // Overlay tap dismisses. The overlay is the sibling directly before the
    // drawer; clicking the far edge avoids landing on the panel itself.
    await trigger.click();
    await expect(drawer).toBeVisible();
    await page.mouse.click(380, 400);
    await expect(drawer).toBeHidden();
  });

  test("selecting a destination closes the drawer and navigates", async ({ page }) => {
    await page.goto(`/${LOCALE}`, { waitUntil: "networkidle" });

    const drawer = page.locator("aside").first();
    await page.getByRole("button", { name: /open navigation menu|abrir men/i }).click();
    await expect(drawer).toBeVisible();

    await drawer.getByRole("link", { name: /projects|proyectos/i }).first().click();

    await expect(page).toHaveURL(/\/projects/);
    await expect(drawer).toBeHidden();
  });

  test("background scroll is locked while the drawer is open", async ({ page }) => {
    await page.goto(`/${LOCALE}`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /open navigation menu|abrir men/i }).click();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
});

test.describe("PMO Living Graph canvas", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fits the viewport and survives an orientation change", async ({ page }) => {
    await page.goto(`/${LOCALE}/pmo-living-graph`, { waitUntil: "networkidle" });

    const pane = page.locator(".react-flow").first();
    if ((await pane.count()) === 0) test.skip(true, "Living Graph not enabled for this org.");

    const portrait = await pane.boundingBox();
    expect(portrait!.width).toBeLessThanOrEqual(390 + 1);

    // Rotate. The canvas must re-measure rather than keep the portrait width,
    // and the graph must still be there (no remount wiping the nodes).
    const nodesBefore = await page.locator(".react-flow__node").count();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(600); // debounced refit

    const landscape = await pane.boundingBox();
    expect(landscape!.width).toBeGreaterThan(portrait!.width);
    expect(landscape!.width).toBeLessThanOrEqual(844 + 1);
    expect(await page.locator(".react-flow__node").count()).toBe(nodesBefore);
  });
});
