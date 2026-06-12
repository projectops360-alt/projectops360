"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { HardHat, CalendarClock, ClipboardList, TrendingDown } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LaborCapacityNavProps {
  projectId: string;
  locale: string;
  activeView: "matrix" | "lookahead" | "workface" | "variance";
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LaborCapacityNav({
  projectId,
  locale,
  activeView,
}: LaborCapacityNavProps) {
  const basePath = `/${locale}/projects/${projectId}/labor-capacity`;

  const tabs = [
    {
      key: "matrix" as const,
      href: basePath,
      icon: HardHat,
      label: locale === "en" ? "Capacity Matrix" : "Matriz de Capacidad",
    },
    {
      key: "lookahead" as const,
      href: `${basePath}/lookahead`,
      icon: CalendarClock,
      label: "Lookahead",
    },
    {
      key: "workface" as const,
      href: `${basePath}/workface`,
      icon: ClipboardList,
      label: locale === "en" ? "Workface Board" : "Frente de Obra",
    },
    {
      key: "variance" as const,
      href: `${basePath}/variance`,
      icon: TrendingDown,
      label: locale === "en" ? "Variance" : "Varianza",
    },
  ];

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === activeView;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}