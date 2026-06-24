"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sidebarNav, bottomNav, type NavItem } from "@/config/navigation";
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
function NavButton({ item, active, resolvedHref, collapsed }: { item: NavItem; active: boolean; resolvedHref: string; collapsed: boolean }) {
  const t = useTranslations("nav");
  const titleKey = item.title as Parameters<typeof t>[0];
  const displayTitle = t(titleKey);

  // `collapsed` is a DESKTOP-only width state — on the mobile drawer the nav is
  // always expanded, so collapsed visuals are gated behind `lg:`.
  return (
    <Link
      href={resolvedHref}
      title={collapsed ? displayTitle : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        collapsed && "lg:justify-center lg:px-2",
        active
          ? "bg-sidebar-active/10 text-sidebar-active"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span className={cn(collapsed && "lg:hidden")}>{displayTitle}</span>
      {item.badge && (
        <span className={cn("ml-auto rounded-full bg-sidebar-active px-2 py-0.5 text-xs text-white", collapsed && "lg:hidden")}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar component ─────────────────────────────────────────────────────────────
export function Sidebar({ collapsed = false, onToggle, mobileOpen = false, onMobileClose }: { collapsed?: boolean; onToggle?: () => void; mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const projectId = extractProjectId(pathname);

  // Separate global and project-scoped items
  const globalItems = sidebarNav.filter((item) => !item.projectScoped);
  const projectItems = sidebarNav.filter((item) => item.projectScoped);

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
    <aside
      className={cn(
        // Mobile: off-canvas drawer (full width 64) sliding in/out.
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar-bg text-sidebar-text transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: always visible, width follows the collapse state.
        "lg:z-30 lg:translate-x-0 lg:transition-[width,transform]",
        collapsed ? "lg:w-16" : "lg:w-64",
      )}
    >
      {/* ── Logo + collapse/close toggles ── */}
      <div className={cn("relative border-b border-white/5", collapsed && "lg:flex lg:h-20 lg:items-center lg:justify-center lg:px-2")}>
        <div className={cn(collapsed && "lg:hidden")}><Logo fullWidth /></div>
        {/* Desktop collapse toggle */}
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
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="absolute right-2 top-2 rounded-lg bg-black/30 p-1.5 text-white/70 backdrop-blur-sm hover:bg-black/50 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
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

      {/* ── Language switcher (hidden only when collapsed on desktop) ── */}
      <div className={cn("border-t border-white/5 px-3 py-4", collapsed && "lg:hidden")}>
        <LanguageSwitcher />
      </div>
    </aside>
  );
}