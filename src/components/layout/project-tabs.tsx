"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TAB_ITEMS } from "./project-tabs-config";

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

// TAB_ITEMS lives in ./project-tabs-config (pure data) so it can be unit-tested
// without the client/next-intl import chain — see project-tabs-nav.test.ts.

// ── Component ────────────────────────────────────────────────────────────────

export function ProjectTabs({ projectId, projectTitle, enabledModules }: ProjectTabsProps) {
  // next-intl usePathname() returns the locale-less path (e.g. /projects/x/workboard).
  const pathname = usePathname();
  const t = useTranslations("projectTabs");

  const visibleTabs = TAB_ITEMS.filter(
    (tab) => !tab.module || !enabledModules || enabledModules.includes(tab.module),
  );

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center overflow-x-auto gap-1 px-4 py-2 scrollbar-hide">
        {projectTitle && (
          <span
            className="mr-3 max-w-[200px] truncate text-sm font-semibold text-foreground shrink-0 border-r border-border pr-3"
            title={projectTitle}
          >
            {projectTitle}
          </span>
        )}
        {visibleTabs.map((tab) => {
          // Pass the locale-less path to next-intl <Link>; it prepends the
          // active locale itself. (Manually adding /${locale} here caused a
          // double prefix like /es/es/... → 404.)
          const href = tab.href.replace("[projectId]", projectId);
          // Match against the locale-less pathname from next-intl.
          const isActive =
            tab.titleKey === "commandCenter"
              ? pathname === href
              : pathname.startsWith(href);

          return (
            <Link
              key={tab.titleKey}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t(tab.titleKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}