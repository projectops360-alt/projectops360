"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "@/i18n/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavContext } from "@/components/layout/mobile-nav-context";
import { contentOffsetClass, PAGE_PADDING_CLASS } from "@/lib/layout/responsive";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "po360.sidebarCollapsed";

/**
 * Client layout frame: owns the collapsible-sidebar state (persisted to
 * localStorage) and shifts the content padding to match the sidebar width.
 *
 * The gutter is applied from `md:` up only. Below that the sidebar becomes an
 * overlay drawer and the content gets the whole viewport — previously the
 * collapsed rail still reserved 64px of a 360px phone screen, which is what
 * squeezed every page into an unusable column.
 *
 * The mobile/tablet/desktop split is expressed in CSS (see
 * `@/lib/layout/responsive`) rather than in JS state, so the server-rendered
 * markup is already correct at every width and there is no post-hydration flash.
 */
export function AppFrame({
  header,
  children,
  role,
  canViewProductBrain = false,
  canViewAdminConsole = false,
  canViewPmoLivingGraph = false,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  /** Org role of the current user — drives role-gated sidebar items. */
  role?: string;
  /** Server-computed allowlist flag for the Product Brain Control Center. */
  canViewProductBrain?: boolean;
  /** Server-computed platform-admin flag for the Admin Console. */
  canViewAdminConsole?: boolean;
  /** Server-computed flag for the PMO Living Graph (CAP-048). Off ⇒ item hidden. */
  canViewPmoLivingGraph?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  // Hydrate the persisted preference after mount. We intentionally start at
  // `false` on the server/first render to avoid an SSR hydration mismatch,
  // then sync the stored value in — a legitimate external→React sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of a persisted UI preference
      setCollapsed(true);
    }
  }, []);

  // Close the drawer on navigation: picking a destination should reveal it, not
  // leave the overlay sitting on top of the page you just asked for.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route change is an external event
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!mobileNavOpen || typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileNavOpen]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  return (
    <MobileNavContext.Provider value={{ open: mobileNavOpen, openMobileNav, closeMobileNav }}>
      <div className="min-h-screen bg-background">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggle}
          role={role}
          canViewProductBrain={canViewProductBrain}
          canViewAdminConsole={canViewAdminConsole}
          canViewPmoLivingGraph={canViewPmoLivingGraph}
          mobileOpen={mobileNavOpen}
          onCloseMobile={closeMobileNav}
        />
        {/* `min-w-0` stops wide content (tables, graph canvases, unbroken
            strings) from stretching this column past the viewport. */}
        <div className={cn("min-w-0 transition-[padding] duration-200", contentOffsetClass(collapsed))}>
          {header}
          <main className={cn("min-w-0", PAGE_PADDING_CLASS)}>{children}</main>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}
