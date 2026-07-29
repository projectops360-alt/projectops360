"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  sidebarWidthClass,
  sidebarLabelClass,
  sidebarItemLayoutClass,
  sidebarChromeClass,
} from "@/lib/layout/responsive";
import { sidebarNav, bottomNav, internalNav, type NavItem, type InternalGate } from "@/config/navigation";
import { Logo } from "@/components/shared/logo";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

// ── Project ID extraction ────────────────────────────────────────────────────────
// Extracts the projectId from a pathname like "/es/projects/abc-123/execution-map"
function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/\/projects\/([0-9a-f-]{36})\b/);
  return match ? match[1] : null;
}

// ── Active state detection ────────────────────────────────────────────────────────
// Pathname from next-intl's usePathname does NOT include the locale prefix
// (it returns the "clean" path like /projects/abc-123/execution-map)
function isActive(pathname: string, href: string): boolean {
  // Root path: exact match only (not startsWith, which would match everything)
  if (href === "/") {
    return pathname === "/" || pathname === "";
  }
  // /projects: match only the projects list page, not sub-paths
  if (href === "/projects") {
    return pathname === "/projects" || pathname === "/projects/";
  }
  // Everything else: startsWith
  return pathname.startsWith(href);
}

// ── NavButton component ──────────────────────────────────────────────────────────
// Labels are hidden with responsive classes rather than by not rendering them:
// the same markup then reads correctly as a labelled drawer on mobile, an
// icon-only rail on tablet, and the user's chosen state on desktop — with no
// hydration mismatch, because nothing here depends on client-side width.
function NavButton({ item, active, resolvedHref, collapsed }: { item: NavItem; active: boolean; resolvedHref: string; collapsed: boolean }) {
  const t = useTranslations("nav");
  const titleKey = item.title as Parameters<typeof t>[0];
  const displayTitle = t(titleKey);

  return (
    <Link
      href={resolvedHref}
      title={displayTitle}
      className={cn(
        // min-h-11 ≈ 44px, the minimum comfortable touch target.
        "flex min-h-11 items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors",
        sidebarItemLayoutClass(collapsed),
        active
          ? "bg-sidebar-active/10 text-sidebar-active"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span className={cn("truncate", sidebarLabelClass(collapsed))}>{displayTitle}</span>
      {item.badge && (
        <span className={cn("ml-auto shrink-0 rounded-full bg-sidebar-active px-2 py-0.5 text-xs text-white", sidebarLabelClass(collapsed))}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar component ─────────────────────────────────────────────────────────────
export function Sidebar({ collapsed = false, onToggle, role, canViewProductBrain = false, canViewAdminConsole = false, canViewPmoLivingGraph = false, mobileOpen = false, onCloseMobile }: { collapsed?: boolean; onToggle?: () => void; role?: string; canViewProductBrain?: boolean; canViewAdminConsole?: boolean; canViewPmoLivingGraph?: boolean; mobileOpen?: boolean; onCloseMobile?: () => void }) {
  void role;
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const projectId = extractProjectId(pathname);
  const drawerRef = useRef<HTMLElement>(null);

  // Drawer accessibility: Escape closes, and Tab is trapped inside while it is
  // open so keyboard focus can't wander onto the page hidden behind the overlay.
  useEffect(() => {
    if (!mobileOpen) return;
    const node = drawerRef.current;
    node?.querySelector<HTMLElement>("a, button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseMobile?.();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Separate global and project-scoped items
  const globalItems = sidebarNav.filter((item) => !item.projectScoped);
  const projectItems = sidebarNav.filter((item) => item.projectScoped);
  // Internal items — each gated by its own server-computed access flag
  // (email allowlist for Product Brain, platform-admin gate for the Admin
  // Console). Hiding here is UX only; the route + actions enforce access
  // server-side. The allowlists themselves never reach the client.
  const gateFlags: Record<InternalGate, boolean> = {
    productBrain: canViewProductBrain,
    adminConsole: canViewAdminConsole,
    pmoLivingGraph: canViewPmoLivingGraph,
  };
  const internalItems = internalNav.filter((item) => gateFlags[item.gate]);

  // Resolve project-scoped hrefs with the current projectId
  function resolveHref(item: NavItem): string {
    if (item.projectScoped && projectId) {
      return item.href.replace("[projectId]", projectId);
    }
    return item.href;
  }

  const collapseLabel = tNav("collapseSidebar");
  const expandLabel = tNav("expandSidebar");

  return (
    <>
      {/* ── Mobile overlay ── tapping it dismisses the drawer. */}
      <div
        aria-hidden
        onClick={onCloseMobile}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        ref={drawerRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar-bg text-sidebar-text transition-[width,transform,visibility] duration-200",
          // Safe-area padding keeps the nav clear of notches and home indicators.
          "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
          sidebarWidthClass(collapsed),
          // Off-canvas below `md`. `invisible` (not just the translate) is what
          // takes the closed drawer out of the tab order and the accessibility
          // tree; doing it in CSS rather than with an `inert` prop keeps the
          // docked desktop sidebar interactive without waiting on hydration.
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full",
          "md:visible md:z-30 md:translate-x-0",
        )}
      >
        {/* ── Logo + collapse toggle ── */}
        <div className={cn("relative flex items-center border-b border-white/5", collapsed && "md:h-20 md:justify-center md:px-2")}>
          <div className={cn("min-w-0 flex-1", sidebarChromeClass(collapsed))}>
            <Logo fullWidth />
          </div>

          {/* Close button — drawer only. */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={tNav("closeMenu")}
            className="absolute right-2 top-2 rounded-lg bg-black/30 p-2 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Collapse toggle — only meaningful where the sidebar is docked and
              wide enough to have two states, i.e. desktop. */}
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              title={collapsed ? expandLabel : collapseLabel}
              aria-label={collapsed ? expandLabel : collapseLabel}
              className={cn(
                "hidden rounded-lg p-1.5 transition-colors lg:block",
                collapsed
                  ? "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                  : "absolute right-2 top-2 bg-black/30 text-white/70 backdrop-blur-sm hover:bg-black/50 hover:text-white",
              )}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          )}
        </div>

        {/* ── Main nav ── */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {globalItems.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              active={isActive(pathname, resolveHref(item))}
              resolvedHref={resolveHref(item)}
              collapsed={collapsed}
            />
          ))}

          {/* ── Project-scoped section ── */}
          {projectId && projectItems.length > 0 && (
            <>
              <div className="my-2 border-t border-white/10" />
              {projectItems.map((item) => (
                <NavButton
                  key={item.href}
                  item={item}
                  active={isActive(pathname, resolveHref(item))}
                  resolvedHref={resolveHref(item)}
                  collapsed={collapsed}
                />
              ))}
            </>
          )}

          {/* ── Internal (role-gated) section ── */}
          {internalItems.length > 0 && (
            <>
              <div className="my-2 border-t border-white/10" />
              {internalItems.map((item) => (
                <NavButton
                  key={item.href}
                  item={item}
                  active={isActive(pathname, resolveHref(item))}
                  resolvedHref={resolveHref(item)}
                  collapsed={collapsed}
                />
              ))}
            </>
          )}

          <div className="my-2 border-t border-white/10" />

          {/* ── Bottom nav items inside main section ── */}
          {bottomNav.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              active={isActive(pathname, resolveHref(item))}
              resolvedHref={resolveHref(item)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* ── Language switcher (hidden on the icon-only rail) ── */}
        <div className={cn("border-t border-white/5 px-3 py-4", sidebarChromeClass(collapsed))}>
          <LanguageSwitcher />
        </div>
      </aside>
    </>
  );
}