// ── Project tabs configuration (pure data) ───────────────────────────────────
// Extracted from project-tabs.tsx so the navigation model can be imported by
// server code and unit tests WITHOUT pulling in the "use client" / next-intl
// import chain. The TabItem icons come from lucide-react (no Next.js deps).
//
// REG-011 invariant: the nav must never expose two visible items for the same
// meeting/rhythm capability. `/rythm` is a redirect, not a second nav item.

import {
  LayoutDashboard,
  Map,
  Columns3,
  BookOpen,
  Settings,
  HardHat,
  DraftingCompass,
  FileBarChart,
  CalendarClock,
  ShieldCheck,
  Layers,
  Users,
  Gauge,
} from "lucide-react";

import type { ProjectModule } from "@/types/database";

export interface TabItem {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPattern: string;
  /** Module gate: the tab is hidden when the project doesn't enable it. */
  module?: ProjectModule;
}

export const TAB_ITEMS: TabItem[] = [
  {
    titleKey: "commandCenter",
    href: "/projects/[projectId]",
    icon: LayoutDashboard,
    matchPattern: "/projects/[projectId]",
  },
  {
    titleKey: "charterGovernance",
    href: "/projects/[projectId]/charter",
    icon: ShieldCheck,
    matchPattern: "/projects/[projectId]/charter",
  },
  {
    titleKey: "deliveryFramework",
    href: "/projects/[projectId]/delivery",
    icon: Layers,
    matchPattern: "/projects/[projectId]/delivery",
  },
  {
    titleKey: "teamRoles",
    href: "/projects/[projectId]/team",
    icon: Users,
    matchPattern: "/projects/[projectId]/team",
  },
  {
    titleKey: "workboard",
    href: "/projects/[projectId]/workboard",
    icon: Columns3,
    matchPattern: "/projects/[projectId]/workboard",
  },
  {
    titleKey: "executionMap",
    href: "/projects/[projectId]/execution-map",
    icon: Map,
    matchPattern: "/projects/[projectId]/execution-map",
  },
  {
    titleKey: "laborCapacity",
    href: "/projects/[projectId]/labor-capacity",
    icon: HardHat,
    matchPattern: "/projects/[projectId]/labor-capacity",
    module: "labor_capacity",
  },
  {
    titleKey: "resourceCapacity",
    href: "/projects/[projectId]/resource-capacity",
    icon: Gauge,
    matchPattern: "/projects/[projectId]/resource-capacity",
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
    // REG-011: single canonical meeting surface. The former "rythm" (audio
    // meeting intelligence) tab was consolidated here; `/rythm` now redirects
    // to `/rhythm`. Do not re-add a second Rythm/Rhythm nav item.
    titleKey: "rhythm",
    href: "/projects/[projectId]/rhythm",
    icon: CalendarClock,
    matchPattern: "/projects/[projectId]/rhythm",
  },
  {
    titleKey: "statusReport",
    href: "/projects/[projectId]/status",
    icon: FileBarChart,
    matchPattern: "/projects/[projectId]/status",
  },
  {
    titleKey: "settings",
    href: "/projects/[projectId]/settings",
    icon: Settings,
    matchPattern: "/projects/[projectId]/settings",
  },
];
