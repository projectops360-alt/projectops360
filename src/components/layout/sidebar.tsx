"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
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
function NavButton({ item, active, resolvedHref }: { item: NavItem; active: boolean; resolvedHref: string }) {
  const t = useTranslations("nav");
  const titleKey = item.title as Parameters<typeof t>[0];
  const displayTitle = t(titleKey);

  return (
    <Link
      href={resolvedHref}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-active/10 text-sidebar-active"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span>{displayTitle}</span>
      {item.badge && (
        <span className="ml-auto rounded-full bg-sidebar-active px-2 py-0.5 text-xs text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar component ─────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
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

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar-bg text-sidebar-text">
      {/* ── Logo ── */}
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-6">
        <Logo />
      </div>

      {/* ── Main nav ── */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {globalItems.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            active={isActive(pathname, resolveHref(item))}
            resolvedHref={resolveHref(item)}
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
          />
        ))}
      </nav>

      {/* ── Language switcher ── */}
      <div className="border-t border-white/5 px-3 py-4">
        <LanguageSwitcher />
      </div>
    </aside>
  );
}