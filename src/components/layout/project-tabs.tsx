"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Map,
  Columns3,
  BookOpen,
  Settings,
  HardHat,
  DraftingCompass,
} from "lucide-react";

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

interface TabItem {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPattern: string;
  /** Module gate: the tab is hidden when the project doesn't enable it. */
  module?: ProjectModule;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TAB_ITEMS: TabItem[] = [
  {
    titleKey: "commandCenter",
    href: "/projects/[projectId]",
    icon: LayoutDashboard,
    matchPattern: "/projects/[projectId]",
  },
  {
    titleKey: "executionMap",
    href: "/projects/[projectId]/execution-map",
    icon: Map,
    matchPattern: "/projects/[projectId]/execution-map",
  },
  {
    titleKey: "workboard",
    href: "/projects/[projectId]/workboard",
    icon: Columns3,
    matchPattern: "/projects/[projectId]/workboard",
  },
  {
    titleKey: "laborCapacity",
    href: "/projects/[projectId]/labor-capacity",
    icon: HardHat,
    matchPattern: "/projects/[projectId]/labor-capacity",
    module: "labor_capacity",
  },
  {
    titleKey: "drawingIntelligence",
    href: "/projects/[projectId]/drawing-intelligence",
    icon: DraftingCompass,
    matchPattern: "/projects/[projectId]/drawing-intelligence",
    module: "drawing_intelligence",
  },
  {
    titleKey: "projectMemory",
    href: "/projects/[projectId]/memory",
    icon: BookOpen,
    matchPattern: "/projects/[projectId]/memory",
  },
  {
    titleKey: "settings",
    href: "/projects/[projectId]/settings",
    icon: Settings,
    matchPattern: "/projects/[projectId]/settings",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export function ProjectTabs({ projectId, locale, projectTitle, enabledModules }: ProjectTabsProps) {
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
          const href = `/${locale}${tab.href.replace("[projectId]", projectId)}`;
          // Match: exact for command center, startsWith for others
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