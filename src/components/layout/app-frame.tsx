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
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

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
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={cn("transition-[padding] duration-200", collapsed ? "pl-16" : "pl-64")}>
        {header}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
