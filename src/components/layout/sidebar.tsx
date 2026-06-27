"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { sidebarNav, bottomNav, internalNav, type NavItem } from "@/config/navigation";
import { canViewProductIntelligence } from "@/lib/product-brain/access";
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

  return (
    <Link
      href={resolvedHref}
      title={collapsed ? displayTitle : undefined}
      aria-label={collapsed ? displayTitle : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2" : "px-3",
        active
          ? "bg-sidebar-active/10 text-sidebar-active"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{displayTitle}</span>}
      {!collapsed && item.badge && (
        <span className="ml-auto rounded-full bg-sidebar-active px-2 py-0.5 text-xs text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar component ─────────────────────────────────────────────────────────────
export function Sidebar({ collapsed = false, onToggle, role }: { collapsed?: boolean; onToggle?: () => void; role?: string }) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const projectId = extractProjectId(pathname);

  // Separate global and project-scoped items
  const globalItems = sidebarNav.filter((item) => !item.projectScoped);
  const projectItems = sidebarNav.filter((item) => item.projectScoped);
  // Internal, role-gated items (server route also enforces access).
  const internalItems = canViewProductIntelligence(role) ? internalNav : [];

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
        "fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar-bg text-sidebar-text transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* ── Logo + collapse toggle ── */}
      <div className={cn("relative border-b border-white/5", collapsed && "flex h-20 items-center justify-center px-2")}>
        {!collapsed && <Logo fullWidth />}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? expandLabel : collapseLabel}
            aria-label={collapsed ? expandLabel : collapseLabel}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
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

      {/* ── Language switcher (hidden when collapsed) ── */}
      {!collapsed && (
        <div className="border-t border-white/5 px-3 py-4">
          <LanguageSwitcher />
        </div>
      )}
    </aside>
  );
}