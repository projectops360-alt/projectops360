"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { OrgData, UserData } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "po360.sidebarCollapsed";

/**
 * Client layout frame: owns the sidebar state.
 * - Desktop (lg+): a fixed sidebar that can collapse to icons; content padding
 *   shifts to match (persisted to localStorage).
 * - Mobile (<lg): the sidebar is an off-canvas drawer toggled by the header
 *   hamburger, with a backdrop; content has no left padding.
 */
export function AppFrame({
  user,
  org,
  children,
}: {
  user?: UserData;
  org?: OrgData;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Hydrate the persisted desktop preference after mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of a persisted UI preference
      setCollapsed(true);
    }
  }, []);

  // Close the mobile drawer whenever the route changes (navigation → UI sync).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close drawer on route change
    setMobileOpen(false);
  }, [pathname]);

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
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-64")}>
        <Header user={user} org={org} onMenuClick={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
