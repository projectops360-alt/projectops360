"use client";

// ============================================================================
// ProjectOps360° — Status Icon Renderer
// ============================================================================
// Maps icon name strings from status-mappings.ts to actual Lucide React JSX.
// This module depends on React/Lucide and should only be imported in client
// components. The status-mappings.ts module is pure TypeScript with no React
// dependency, so it can be safely imported in server code and tests.
// ============================================================================

import {
  CheckCircle2,
  Loader2,
  Circle,
  Ban,
  Pause,
  AlertTriangle,
  FileText,
  Send,
  Code,
  ShieldCheck,
  Settings,
  Shield,
  Users,
  BookOpen,
  Link2,
  Sparkles,
  BarChart3,
  RotateCcw,
  CheckCircle,
  Rocket,
} from "lucide-react";
import type { MilestoneStatusDisplay, TaskStatus } from "@/types/database";
import {
  MILESTONE_STATUS_ICON_NAMES,
  TASK_STATUS_ICON_DEFS,
  MILESTONE_ICON_KEY_NAMES,
} from "@/lib/roadmap/status-mappings";

// ── Lucide icon component lookup ────────────────────────────────────────────────

const LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CheckCircle2,
  Loader2,
  Circle,
  Ban,
  Pause,
  AlertTriangle,
  FileText,
  Send,
  Code,
  ShieldCheck,
  Settings,
  Shield,
  Users,
  BookOpen,
  Link2,
  Sparkles,
  BarChart3,
  RotateCcw,
  CheckCircle,
  Rocket,
};

// ── Milestone status icons ─────────────────────────────────────────────────────

/** Render the icon for a milestone status at a given size. */
export function renderMilestoneStatusIcon(
  status: MilestoneStatusDisplay,
  className = "h-3.5 w-3.5",
): React.ReactNode {
  const iconName = MILESTONE_STATUS_ICON_NAMES[status] ?? "Circle";
  const Icon = LUCIDE_ICONS[iconName] ?? Circle;
  // Loader2 should spin for in_progress status
  const extra = status === "in_progress" ? " animate-spin" : "";
  return <Icon className={`${className}${extra}`} />;
}

/** Full Record of milestone status icons as React nodes (for compatibility). */
export const MILESTONE_STATUS_ICONS: Record<MilestoneStatusDisplay, React.ReactNode> = {
  completed: renderMilestoneStatusIcon("completed"),
  in_progress: renderMilestoneStatusIcon("in_progress"),
  planned: renderMilestoneStatusIcon("planned"),
  blocked: renderMilestoneStatusIcon("blocked"),
  deferred: renderMilestoneStatusIcon("deferred"),
  at_risk: renderMilestoneStatusIcon("at_risk"),
};

// ── Task status icons ──────────────────────────────────────────────────────────

/** Render the icon for a task status at a given size. */
export function renderTaskStatusIcon(
  status: TaskStatus,
  className = "h-4 w-4",
): { icon: React.ReactNode; color: string; strike: boolean } {
  const def = TASK_STATUS_ICON_DEFS[status];
  const Icon = LUCIDE_ICONS[def.iconName] ?? Circle;
  const extra = status === "in_progress" ? " animate-spin" : "";
  return {
    icon: <Icon className={`${className} ${def.className}${extra}`} />,
    color: def.className,
    strike: def.strike,
  };
}

// ── Milestone icon_key icons ────────────────────────────────────────────────────

/** Render the icon for a milestone icon_key (e.g. "setup", "sparkles"). */
export function renderMilestoneIcon(
  iconKey: string | null,
  className = "h-4 w-4",
): React.ReactNode {
  const iconName = iconKey ? MILESTONE_ICON_KEY_NAMES[iconKey] : undefined;
  const Icon = iconName ? (LUCIDE_ICONS[iconName] ?? Circle) : Circle;
  return <Icon className={className} />;
}

/** Full Record of milestone icon_key icons as React nodes. */
export const MILESTONE_ICON_MAP: Record<string, React.ReactNode> = {
  setup: renderMilestoneIcon("setup"),
  shield_database: renderMilestoneIcon("shield_database"),
  users: renderMilestoneIcon("users"),
  notebook: renderMilestoneIcon("notebook"),
  link: renderMilestoneIcon("link"),
  sparkles: renderMilestoneIcon("sparkles"),
  chart: renderMilestoneIcon("chart"),
  loop: renderMilestoneIcon("loop"),
  check_circle: renderMilestoneIcon("check_circle"),
  rocket: renderMilestoneIcon("rocket"),
};