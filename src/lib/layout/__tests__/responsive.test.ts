// ============================================================================
// Responsive layout system — unit guards
// Guards: RESPONSIVE-SHELL-NO-MOBILE-GUTTER, RESPONSIVE-BREAKPOINTS
// ============================================================================
// The regression this file exists to prevent: the app shell reserving desktop
// sidebar width on a phone. Everything else about the responsive fix is
// cosmetic; that one is what made Team, Projects, Reports and the PMO Living
// Graph unusable below 768px, because every page had ~100px to lay out in.
// ============================================================================

import { describe, expect, it } from "vitest";
import {
  BREAKPOINTS,
  MEDIA_QUERIES,
  SIDEBAR_WIDTH_PX,
  contentOffsetClass,
  contentOffsetFor,
  isRailFor,
  sidebarChromeClass,
  sidebarItemLayoutClass,
  sidebarLabelClass,
  sidebarWidthClass,
  viewportFor,
} from "@/lib/layout/responsive";

describe("viewport classification", () => {
  it("matches the documented mobile / tablet / desktop ranges", () => {
    // The exact device widths the fix was specified against.
    expect(viewportFor(320)).toBe("mobile");
    expect(viewportFor(360)).toBe("mobile");
    expect(viewportFor(390)).toBe("mobile");
    expect(viewportFor(430)).toBe("mobile");
    expect(viewportFor(767)).toBe("mobile");
    expect(viewportFor(768)).toBe("tablet");
    expect(viewportFor(820)).toBe("tablet");
    expect(viewportFor(1023)).toBe("tablet");
    expect(viewportFor(1024)).toBe("desktop");
    expect(viewportFor(1440)).toBe("desktop");
  });

  it("keeps the numeric breakpoints and the media queries in sync", () => {
    expect(BREAKPOINTS.tablet).toBe(768);
    expect(BREAKPOINTS.desktop).toBe(1024);
    expect(MEDIA_QUERIES.tablet).toBe("(min-width: 768px)");
    expect(MEDIA_QUERIES.desktop).toBe("(min-width: 1024px)");
  });
});

describe("the sidebar steals no width on mobile (RESPONSIVE-SHELL-NO-MOBILE-GUTTER)", () => {
  it("reserves zero horizontal space on a phone, collapsed or not", () => {
    expect(contentOffsetFor("mobile", false)).toBe(0);
    expect(contentOffsetFor("mobile", true)).toBe(0);
  });

  it("uses the compact rail on a tablet regardless of the stored preference", () => {
    expect(contentOffsetFor("tablet", false)).toBe(SIDEBAR_WIDTH_PX.compact);
    expect(contentOffsetFor("tablet", true)).toBe(SIDEBAR_WIDTH_PX.compact);
  });

  it("honours the user's collapse preference on desktop — desktop is unchanged", () => {
    expect(contentOffsetFor("desktop", false)).toBe(SIDEBAR_WIDTH_PX.expanded);
    expect(contentOffsetFor("desktop", true)).toBe(SIDEBAR_WIDTH_PX.compact);
  });

  it("leaves a 320px phone its full width", () => {
    const narrowest = 320;
    expect(narrowest - contentOffsetFor(viewportFor(narrowest), false)).toBe(320);
  });

  it("shows labels in the drawer and hides them only on the tablet rail", () => {
    expect(isRailFor("mobile", false)).toBe(false);
    expect(isRailFor("mobile", true)).toBe(false);
    expect(isRailFor("tablet", false)).toBe(true);
    expect(isRailFor("desktop", false)).toBe(false);
    expect(isRailFor("desktop", true)).toBe(true);
  });
});

describe("class builders stay breakpoint-scoped", () => {
  // A bare `pl-64` / `w-64` with no `md:` or `lg:` prefix is exactly the bug
  // that shipped. These assertions fail the moment one is reintroduced.
  it("never emits an unprefixed content gutter", () => {
    for (const collapsed of [true, false]) {
      const classes = contentOffsetClass(collapsed).split(/\s+/);
      for (const cls of classes) {
        expect(cls).toMatch(/^(md|lg):/);
      }
    }
  });

  it("gives the mobile drawer its full width and the tablet rail the compact one", () => {
    expect(sidebarWidthClass(false)).toContain("w-64");
    expect(sidebarWidthClass(false)).toContain("md:w-16");
    expect(sidebarWidthClass(false)).toContain("lg:w-64");
    expect(sidebarWidthClass(true)).toContain("w-64");
    expect(sidebarWidthClass(true)).toContain("md:w-16");
    // Collapsed means collapsed on desktop too — no `lg:w-64` escape hatch.
    expect(sidebarWidthClass(true)).not.toContain("lg:w-64");
  });

  it("hides nav labels from `md` up, never below it", () => {
    for (const collapsed of [true, false]) {
      expect(sidebarLabelClass(collapsed)).toContain("md:hidden");
      expect(sidebarLabelClass(collapsed)).not.toMatch(/(^|\s)hidden(\s|$)/);
    }
    // Expanded desktop brings the labels back.
    expect(sidebarLabelClass(false)).toContain("lg:inline");
  });

  it("keeps chrome (logo, language switcher) visible in the drawer", () => {
    for (const collapsed of [true, false]) {
      expect(sidebarChromeClass(collapsed)).not.toMatch(/(^|\s)hidden(\s|$)/);
      expect(sidebarChromeClass(collapsed)).toContain("md:hidden");
    }
  });

  it("left-aligns nav rows on mobile and centres them only on the rail", () => {
    for (const collapsed of [true, false]) {
      const cls = sidebarItemLayoutClass(collapsed);
      expect(cls).toContain("justify-start");
      expect(cls).toContain("md:justify-center");
      expect(cls).not.toMatch(/(^|\s)justify-center(\s|$)/);
    }
    expect(sidebarItemLayoutClass(false)).toContain("lg:justify-start");
  });
});
