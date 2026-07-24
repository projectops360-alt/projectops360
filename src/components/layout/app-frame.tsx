"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "po360.sidebarCollapsed";

/**
 * Client layout frame: owns the collapsible-sidebar state (persisted to
 * localStorage) and shifts the content padding to match the sidebar width.
 */
export function AppFrame({
  header,
  children,
  role,
  canViewProductBrain = false,
  canViewAdminConsole = false,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  /** Org role of the current user — drives role-gated sidebar items. */
  role?: string;
  /** Server-computed allowlist flag for the Product Brain Control Center. */
  canViewProductBrain?: boolean;
  /** Server-computed platform-admin flag for the Admin Console. */
  canViewAdminConsole?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [compactViewport, setCompactViewport] = useState(false);

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

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setCompactViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  const effectiveCollapsed = collapsed || compactViewport;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={effectiveCollapsed} onToggle={toggle} role={role} canViewProductBrain={canViewProductBrain} canViewAdminConsole={canViewAdminConsole} />
      <div className={cn("transition-[padding] duration-200", effectiveCollapsed ? "pl-16" : "pl-64")}>
        {header}
        <main className="p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
