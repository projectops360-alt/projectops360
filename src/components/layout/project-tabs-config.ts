// ── Project tabs configuration (pure data) ───────────────────────────────────
// Extracted from project-tabs.tsx so the navigation model can be imported by
// server code and unit tests WITHOUT pulling in the "use client" / next-intl
// import chain. The TabItem icons come from lucide-react (no Next.js deps).
//
// UX-006 / REG-012 / PD-009: the project navigation is GROUPED by user intent
// (`TAB_GROUPS`) instead of a flat 13-tab bar. Grouping reduces clutter without
// hiding strategic modules. `TAB_ITEMS` is derived (flatMap) so prior importers
// and the REG-011 nav test keep working.
//
// Binding rules encoded here:
//  • REG-011: the nav must never expose two visible items for the same
//    meeting/rhythm capability. `/rythm` is a redirect, not a second nav item.
//  • REG-012 / PD-009: BIM (Drawing Intelligence) lives in a dedicated
//    "Technical / BIM" group and must never be silently removed. When the
//    `drawing_intelligence` module is not enabled, BIM is kept visible as a
//    disabled, explained entry (`keepDisabledWhenModuleMissing`).
//  • PD-009: Resource Capacity is OPERATIONAL — it lives under Resources, never
//    only in Settings. Settings holds configuration/admin, not operational modules.

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
  Route,
  Contact,
  Compass,
  Sparkles,
  Wrench,
  GitGraph,
  MoreHorizontal,
} from "lucide-react";

import type { ProjectModule } from "@/types/database";

export interface TabItem {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPattern: string;
  /** Module gate: by default the tab is hidden when the project doesn't enable it. */
  module?: ProjectModule;
  /** REG-012 / PD-009: when the gating `module` is missing, keep the item VISIBLE
   *  but disabled (with an explanatory tooltip) instead of hiding it. Used for
   *  strategic modules like BIM that must never silently disappear. */
  keepDisabledWhenModuleMissing?: boolean;
}

export interface TabGroup {
  /** i18n key under `projectTabs.groups.*` */
  groupKey: string;
  icon: React.ComponentType<{ className?: string }>;
  items: TabItem[];
}

// ── Grouped navigation (UX-006) ──────────────────────────────────────────────
// Command Center · Planning · Execution · Resources · Intelligence ·
// Technical / BIM · More.

export const TAB_GROUPS: TabGroup[] = [
  {
    groupKey: "commandCenter",
    icon: LayoutDashboard,
    items: [
      {
        titleKey: "overview",
        href: "/projects/[projectId]",
        icon: LayoutDashboard,
        matchPattern: "/projects/[projectId]",
      },
      {
        titleKey: "statusReport",
        href: "/projects/[projectId]/status",
        icon: FileBarChart,
        matchPattern: "/projects/[projectId]/status",
      },
    ],
  },
  {
    groupKey: "planning",
    icon: Compass,
    items: [
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
        titleKey: "roadmap",
        href: "/projects/[projectId]/roadmap",
        icon: Route,
        matchPattern: "/projects/[projectId]/roadmap",
      },
      {
        titleKey: "financialControl",
        href: "/projects/[projectId]/budget",
        icon: FileBarChart,
        matchPattern: "/projects/[projectId]/budget",
      },
    ],
  },
  {
    groupKey: "execution",
    icon: Map,
    items: [
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
        // GitHub Intelligence — software-project execution evidence. Conceptually
        // a software-specific Living Graph extension, so it lives beside the
        // Execution Map. Gated by the `github_intelligence` module, which the
        // project layout injects ONLY when project_type='software_development'
        // AND GITHUB_INTELLIGENCE_ENABLED=true. Hidden everywhere else.
        titleKey: "githubIntelligence",
        href: "/projects/[projectId]/github",
        icon: GitGraph,
        matchPattern: "/projects/[projectId]/github",
        module: "github_intelligence",
      },
    ],
  },
  {
    groupKey: "resources",
    icon: Users,
    items: [
      {
        titleKey: "teamRoles",
        href: "/projects/[projectId]/team",
        icon: Users,
        matchPattern: "/projects/[projectId]/team",
      },
      {
        titleKey: "stakeholders",
        href: "/projects/[projectId]/stakeholders",
        icon: Contact,
        matchPattern: "/projects/[projectId]/stakeholders",
      },
      {
        // PD-009: Resource Capacity is OPERATIONAL — lives under Resources,
        // never only in Settings.
        titleKey: "resourceCapacity",
        href: "/projects/[projectId]/resource-capacity",
        icon: Gauge,
        matchPattern: "/projects/[projectId]/resource-capacity",
      },
      {
        titleKey: "laborCapacity",
        href: "/projects/[projectId]/labor-capacity",
        icon: HardHat,
        matchPattern: "/projects/[projectId]/labor-capacity",
        module: "labor_capacity",
      },
    ],
  },
  {
    groupKey: "intelligence",
    icon: Sparkles,
    items: [
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
    ],
  },
  {
    // REG-012 / PD-009: dedicated Technical / BIM group keeps BIM strategic and
    // discoverable. BIM is the Drawing Intelligence capability (label "BIM").
    groupKey: "technical",
    icon: Wrench,
    items: [
      {
        titleKey: "drawingIntelligence",
        href: "/projects/[projectId]/drawing-intelligence",
        icon: DraftingCompass,
        matchPattern: "/projects/[projectId]/drawing-intelligence",
        module: "drawing_intelligence",
        // Never silently remove BIM — show a disabled, explained entry instead.
        keepDisabledWhenModuleMissing: true,
      },
    ],
  },
  {
    groupKey: "more",
    icon: MoreHorizontal,
    items: [
      {
        titleKey: "settings",
        href: "/projects/[projectId]/settings",
        icon: Settings,
        matchPattern: "/projects/[projectId]/settings",
      },
    ],
  },
];

// Flattened view — preserved for backward compatibility with prior importers
// and the REG-011 navigation test. Order follows the grouped structure.
export const TAB_ITEMS: TabItem[] = TAB_GROUPS.flatMap((g) => g.items);
