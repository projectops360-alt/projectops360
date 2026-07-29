// ============================================================================
// App shell — responsive source guards
// Guards: RESPONSIVE-SHELL-NO-MOBILE-GUTTER, RESPONSIVE-MOBILE-DRAWER
// ============================================================================
// `responsive.test.ts` proves the layout *tokens* are correct. This file proves
// the shell actually uses them — the original defect was not a wrong token, it
// was `pl-64` hard-coded straight into the content wrapper. A unit test of a
// helper nobody calls would have stayed green through the whole regression.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const appFrame = source("src/components/layout/app-frame.tsx");
const sidebar = source("src/components/layout/sidebar.tsx");
const header = source("src/components/layout/header.tsx");
const rootLayout = source("src/app/layout.tsx");

describe("the content wrapper reserves no sidebar width on mobile", () => {
  it("derives its gutter from the shared token, not a literal", () => {
    expect(appFrame).toContain("contentOffsetClass(collapsed)");
  });

  it("contains no unprefixed pl-16 / pl-64 anywhere", () => {
    // Matches `pl-64` but not `md:pl-16` / `lg:pl-64`.
    const unprefixed = /(?<![:\w-])pl-(16|64)\b/g;
    expect(appFrame.match(unprefixed)).toBeNull();
  });

  it("still applies the desktop gutter from md/lg up", () => {
    const offsets = appFrame.match(/(md|lg):pl-(16|64)/g) ?? [];
    expect(offsets.length).toBe(0); // it lives in responsive.ts, not inline
    expect(appFrame).toContain("@/lib/layout/responsive");
  });

  it("lets the content column shrink instead of forcing the page wider", () => {
    expect(appFrame).toContain("min-w-0");
  });
});

describe("mobile navigation drawer (RESPONSIVE-MOBILE-DRAWER)", () => {
  it("the shell owns the open state and passes it to the sidebar", () => {
    expect(appFrame).toContain("mobileOpen={mobileNavOpen}");
    expect(appFrame).toContain("onCloseMobile={closeMobileNav}");
  });

  it("closes on navigation", () => {
    expect(appFrame).toContain("setMobileNavOpen(false)");
    expect(appFrame).toContain("[pathname]");
  });

  it("locks background scroll while open", () => {
    expect(appFrame).toContain('document.body.style.overflow = "hidden"');
  });

  it("renders a dismissable overlay that disappears once the sidebar docks", () => {
    expect(sidebar).toContain("onClick={onCloseMobile}");
    expect(sidebar).toMatch(/bg-black\/50[^"]*md:hidden|md:hidden[^"]*bg-black\/50/);
  });

  it("is off-canvas and out of the tab order when closed, docked from md up", () => {
    expect(sidebar).toContain('mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"');
    expect(sidebar).toContain("md:visible");
    expect(sidebar).toContain("md:translate-x-0");
  });

  it("supports keyboard dismissal and traps focus while open", () => {
    expect(sidebar).toContain('e.key === "Escape"');
    expect(sidebar).toContain('e.key !== "Tab"');
  });

  it("the header exposes a labelled trigger that hides once the sidebar docks", () => {
    expect(header).toContain("openMobileNav");
    expect(header).toContain('tNav("openMenu")');
    expect(header).toContain("md:hidden");
  });
});

describe("viewport meta", () => {
  it("declares device-width so phones stop rendering a scaled-down desktop", () => {
    expect(rootLayout).toContain('width: "device-width"');
    expect(rootLayout).toContain("initialScale: 1");
  });

  it("does not disable pinch zoom (WCAG 1.4.4)", () => {
    expect(rootLayout).toContain("userScalable: true");
    const max = rootLayout.match(/maximumScale:\s*(\d+)/);
    expect(Number(max?.[1] ?? 0)).toBeGreaterThanOrEqual(2);
  });
});

describe("horizontal overflow is fixed at the source, not hidden", () => {
  it("the shell does not paper over overflow with overflow-x-hidden", () => {
    for (const file of [appFrame, sidebar, header]) {
      expect(file).not.toContain("overflow-x-hidden");
    }
  });
});
