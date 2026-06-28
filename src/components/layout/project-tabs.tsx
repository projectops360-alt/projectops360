"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAB_GROUPS, type TabItem } from "./project-tabs-config";

import type { ProjectModule } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProjectTabsProps {
  projectId: string;
  locale: string;
  projectTitle?: string;
  /** Modules enabled for this project (project_type defaults or explicit list).
   *  Undefined = show every tab (backward compatible). */
  enabledModules?: ProjectModule[];
}

// TAB_GROUPS lives in ./project-tabs-config (pure data) so the navigation model
// can be unit-tested without the client/next-intl import chain
// (see project-tabs-nav.test.ts). UX-006 / REG-012 / PD-009.

type ResolvedItem = TabItem & {
  /** Final href with [projectId] substituted. */
  resolvedHref: string;
  /** The item is gated by a module that is not enabled, but kept visible as a
   *  disabled, explained entry (e.g. BIM — REG-012). */
  disabled: boolean;
  isActive: boolean;
};

// ── Visibility resolution ────────────────────────────────────────────────────

function resolveItems(
  items: TabItem[],
  projectId: string,
  pathname: string,
  enabledModules?: ProjectModule[],
): ResolvedItem[] {
  return items.flatMap((item) => {
    const moduleEnabled =
      !item.module || !enabledModules || enabledModules.includes(item.module);

    // Hidden entirely when its module is off and it is not a "keep-disabled" item.
    if (!moduleEnabled && !item.keepDisabledWhenModuleMissing) return [];

    const resolvedHref = item.href.replace("[projectId]", projectId);
    const isActive =
      item.titleKey === "overview"
        ? pathname === resolvedHref
        : pathname.startsWith(resolvedHref);

    return [
      {
        ...item,
        resolvedHref,
        disabled: !moduleEnabled,
        isActive: moduleEnabled && isActive,
      },
    ];
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProjectTabs({ projectId, projectTitle, enabledModules }: ProjectTabsProps) {
  // next-intl usePathname() returns the locale-less path (e.g. /projects/x/workboard).
  const pathname = usePathname();
  const t = useTranslations("projectTabs");
  const tg = useTranslations("projectTabs.groups");

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close the open dropdown on outside click.
  useEffect(() => {
    if (!openGroup) return;
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openGroup]);

  // Close the dropdown when navigating to a new route.
  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  // Build the visible group model; drop groups that end up with no items.
  const groups = TAB_GROUPS.map((group) => {
    const items = resolveItems(group.items, projectId, pathname, enabledModules);
    const isActive = items.some((i) => i.isActive);
    return { ...group, resolvedItems: items, isActive };
  }).filter((g) => g.resolvedItems.length > 0);

  return (
    <nav
      ref={navRef}
      className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20"
    >
      <div className="flex items-center gap-1 px-4 py-2">
        {projectTitle && (
          <span
            className="mr-2 max-w-[160px] truncate text-sm font-semibold text-foreground shrink-0 border-r border-border pr-3"
            title={projectTitle}
          >
            {projectTitle}
          </span>
        )}

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {groups.map((group) => {
            const isOpen = openGroup === group.groupKey;
            const label = tg(group.groupKey);

            return (
              <div key={group.groupKey} className="relative shrink-0">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpenGroup((cur) => (cur === group.groupKey ? null : group.groupKey))
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    group.isActive || isOpen
                      ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <group.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline">{label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-30 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-border bg-card shadow-lg"
                  >
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                      {label}
                    </p>
                    {group.resolvedItems.map((item) =>
                      item.disabled ? (
                        // REG-012 / PD-009: strategic module not enabled here.
                        // Keep it visible as a disabled, explained entry — never
                        // silently removed.
                        <div
                          key={item.titleKey}
                          role="menuitem"
                          aria-disabled="true"
                          title={t("moduleNotEnabled", { module: t(item.titleKey) })}
                          className="flex cursor-not-allowed items-center gap-2 px-3 py-2 text-sm text-muted-foreground/50"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{t(item.titleKey)}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">
                            {t("notEnabledBadge")}
                          </span>
                        </div>
                      ) : (
                        <Link
                          key={item.titleKey}
                          href={item.resolvedHref}
                          role="menuitem"
                          onClick={() => setOpenGroup(null)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                            item.isActive
                              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium"
                              : "text-foreground hover:bg-muted/60",
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{t(item.titleKey)}</span>
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
