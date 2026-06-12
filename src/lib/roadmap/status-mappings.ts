// ============================================================================
// ProjectOps360° — Centralized Milestone & Task Status Mappings
// ============================================================================
// Single source of truth for milestone status → color/icon mappings.
// All Roadmap, Timeline, Gantt, Flow, Living Graph, and Dashboard components
// MUST import from this module instead of defining local constants.
// ============================================================================

import type { MilestoneStatus, MilestoneStatusDisplay, TaskStatus, TaskPriority } from "@/types/database";

// ── Task completion status sets ────────────────────────────────────────────────

/** Task statuses that count as "complete" for milestone progress calculation. */
export const TASK_COMPLETE_STATUSES: TaskStatus[] = ["done"];

/** Task statuses that count as "complete" for dependency checking. */
export const DEPENDENCY_COMPLETE_STATUSES: TaskStatus[] = ["done", "tested"];

// ── Milestone status color mappings (Tailwind classes) ─────────────────────────

export interface MilestoneStatusColors {
  ring: string;
  fill: string;
  bar: string;
  badge: string;
  iconBg: string;
  textColor: string;
}

/** Canonical Tailwind class mappings for each milestone status, including at_risk. */
export const MILESTONE_STATUS_COLORS: Record<MilestoneStatusDisplay, MilestoneStatusColors> = {
  completed: {
    ring: "ring-green-500",
    fill: "bg-green-500",
    bar: "bg-green-500",
    badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-900/50",
    textColor: "text-green-700 dark:text-green-400",
  },
  in_progress: {
    ring: "ring-brand-500",
    fill: "bg-brand-500 animate-pulse",
    bar: "bg-brand-600 dark:bg-brand-500",
    badge: "bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400",
    iconBg: "bg-brand-100 dark:bg-brand-900/50",
    textColor: "text-brand-700 dark:text-brand-400",
  },
  planned: {
    ring: "ring-gray-300 dark:ring-gray-600",
    fill: "bg-gray-300 dark:bg-gray-600",
    bar: "bg-gray-400 dark:bg-gray-600",
    badge: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    iconBg: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-700 dark:text-gray-300",
  },
  blocked: {
    ring: "ring-red-500",
    fill: "bg-red-500",
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/50",
    textColor: "text-red-700 dark:text-red-400",
  },
  deferred: {
    ring: "ring-amber-500",
    fill: "bg-amber-500",
    bar: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    textColor: "text-amber-700 dark:text-amber-400",
  },
  at_risk: {
    ring: "ring-orange-500",
    fill: "bg-orange-500",
    bar: "bg-orange-500",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/50",
    textColor: "text-orange-700 dark:text-orange-400",
  },
};

// ── Milestone status icon names (Lucide) ──────────────────────────────────────

export const MILESTONE_STATUS_ICON_NAMES: Record<MilestoneStatusDisplay, string> = {
  completed: "CheckCircle2",
  in_progress: "Loader2",
  planned: "Circle",
  blocked: "Ban",
  deferred: "Pause",
  at_risk: "AlertTriangle",
};

// ── Task status icon definitions ──────────────────────────────────────────────

export interface TaskStatusIconDef {
  iconName: string;
  className: string;
  strike: boolean;
}

export const TASK_STATUS_ICON_DEFS: Record<TaskStatus, TaskStatusIconDef> = {
  done: { iconName: "CheckCircle2", className: "text-green-600 dark:text-green-400", strike: true },
  tested: { iconName: "ShieldCheck", className: "text-emerald-600 dark:text-emerald-400", strike: false },
  implemented: { iconName: "Code", className: "text-cyan-600 dark:text-cyan-400", strike: false },
  in_progress: { iconName: "Loader2", className: "text-blue-600 dark:text-blue-400", strike: false },
  sent_to_ai: { iconName: "Send", className: "text-indigo-600 dark:text-indigo-400", strike: false },
  prompt_ready: { iconName: "FileText", className: "text-purple-600 dark:text-purple-400", strike: false },
  not_started: { iconName: "Circle", className: "text-gray-400", strike: false },
  blocked: { iconName: "Ban", className: "text-red-600 dark:text-red-400", strike: false },
  deferred: { iconName: "Pause", className: "text-amber-600 dark:text-amber-400", strike: false },
};

// ── Task status badge classes ──────────────────────────────────────────────────

export const TASK_STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  tested: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  implemented: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sent_to_ai: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  prompt_ready: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  not_started: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  deferred: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

// ── Task status bar classes (Gantt) ───────────────────────────────────────────

export const TASK_STATUS_BAR_CLASSES: Record<TaskStatus, { bg: string; fill: string; text: string; border: string }> = {
  done: { bg: "bg-green-200 dark:bg-green-900/40", fill: "bg-green-500", text: "text-green-700 dark:text-green-400", border: "border-green-300 dark:border-green-700" },
  tested: { bg: "bg-emerald-200 dark:bg-emerald-900/40", fill: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-700" },
  implemented: { bg: "bg-cyan-200 dark:bg-cyan-900/40", fill: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-300 dark:border-cyan-700" },
  in_progress: { bg: "bg-blue-200 dark:bg-blue-900/40", fill: "bg-blue-500", text: "text-blue-700 dark:text-blue-400", border: "border-blue-300 dark:border-blue-700" },
  sent_to_ai: { bg: "bg-indigo-200 dark:bg-indigo-900/40", fill: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-300 dark:border-indigo-700" },
  prompt_ready: { bg: "bg-purple-200 dark:bg-purple-900/40", fill: "bg-purple-500", text: "text-purple-700 dark:text-purple-400", border: "border-purple-300 dark:border-purple-700" },
  not_started: { bg: "bg-gray-200 dark:bg-gray-800/40", fill: "bg-gray-400 dark:bg-gray-500", text: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600" },
  blocked: { bg: "bg-red-200 dark:bg-red-900/40", fill: "bg-red-500", text: "text-red-700 dark:text-red-400", border: "border-red-300 dark:border-red-700" },
  deferred: { bg: "bg-amber-200 dark:bg-amber-900/40", fill: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-700" },
};

// ── Milestone status bar classes (Gantt) ───────────────────────────────────────

export const MILESTONE_STATUS_BAR_CLASSES: Record<MilestoneStatusDisplay, { bg: string; fill: string; dot: string; text: string; border: string }> = {
  completed: { bg: "bg-green-200 dark:bg-green-900/40", fill: "bg-green-500", dot: "bg-green-500", text: "text-green-700 dark:text-green-400", border: "border-green-300 dark:border-green-700" },
  in_progress: { bg: "bg-brand-200 dark:bg-brand-900/40", fill: "bg-brand-500", dot: "bg-brand-500 animate-pulse", text: "text-brand-700 dark:text-brand-400", border: "border-brand-300 dark:border-brand-700" },
  planned: { bg: "bg-gray-200 dark:bg-gray-800/40", fill: "bg-gray-400 dark:bg-gray-500", dot: "bg-gray-400 dark:bg-gray-500", text: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600" },
  blocked: { bg: "bg-red-200 dark:bg-red-900/40", fill: "bg-red-500", dot: "bg-red-500", text: "text-red-700 dark:text-red-400", border: "border-red-300 dark:border-red-700" },
  deferred: { bg: "bg-amber-200 dark:bg-amber-900/40", fill: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-700" },
  at_risk: { bg: "bg-orange-200 dark:bg-orange-900/40", fill: "bg-orange-500", dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-400", border: "border-orange-300 dark:border-orange-700" },
};

// ── Priority badge classes ─────────────────────────────────────────────────────

export const PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  p1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  p2: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  p3: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

// ── Milestone icon key mapping (icon_key → Lucide icon name) ───────────────────

export const MILESTONE_ICON_KEY_NAMES: Record<string, string> = {
  setup: "Settings",
  shield_database: "Shield",
  users: "Users",
  notebook: "BookOpen",
  link: "Link2",
  sparkles: "Sparkles",
  chart: "BarChart3",
  loop: "RotateCcw",
  check_circle: "CheckCircle",
  rocket: "Rocket",
};

// ── Milestone board column config ──────────────────────────────────────────────

export const MILESTONE_BOARD_COLUMNS: { status: MilestoneStatus; colorClass: string; headerClass: string; dotClass: string }[] = [
  { status: "completed", colorClass: "border-green-200 dark:border-green-800", headerClass: "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-400", dotClass: "bg-green-500" },
  { status: "in_progress", colorClass: "border-brand-200 dark:border-brand-800", headerClass: "bg-brand-50 dark:bg-brand-950/20 text-brand-800 dark:text-brand-400", dotClass: "bg-brand-500" },
  { status: "planned", colorClass: "border-gray-200 dark:border-gray-700", headerClass: "bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300", dotClass: "bg-gray-400" },
  { status: "blocked", colorClass: "border-red-200 dark:border-red-800", headerClass: "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-400", dotClass: "bg-red-500" },
  { status: "deferred", colorClass: "border-amber-200 dark:border-amber-800", headerClass: "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400", dotClass: "bg-amber-500" },
];

// ── Hex color mappings for SVG/Flow/Living Graph ───────────────────────────────

export const MILESTONE_HEALTH_HEX: Record<MilestoneStatusDisplay, { color: string; dim: string }> = {
  completed: { color: "#34d399", dim: "rgba(52,211,153,0.12)" },  // emerald-400
  in_progress: { color: "#818cf8", dim: "rgba(129,140,248,0.14)" }, // indigo-400
  planned: { color: "#64748b", dim: "rgba(71,85,105,0.14)" },      // slate-500
  blocked: { color: "#f87171", dim: "rgba(248,113,113,0.12)" },     // red-400
  deferred: { color: "#fbbf24", dim: "rgba(251,191,36,0.12)" },    // amber-400
  at_risk: { color: "#fb923c", dim: "rgba(251,146,60,0.14)" },     // orange-400
};

// ── Milestone status config for Hero/Dashboard cards ───────────────────────────

export interface MilestoneStatusCardConfig {
  color: string;
  bg: string;
  borderColor: string;
  iconBg: string;
}

export const MILESTONE_STATUS_CARD_CONFIG: Record<MilestoneStatusDisplay, MilestoneStatusCardConfig> = {
  completed: {
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    iconBg: "bg-green-100 dark:bg-green-900/50",
  },
  in_progress: {
    color: "text-brand-700 dark:text-brand-400",
    bg: "bg-brand-50 dark:bg-brand-950/20",
    borderColor: "border-brand-200 dark:border-brand-800",
    iconBg: "bg-brand-100 dark:bg-brand-900/50",
  },
  planned: {
    color: "text-gray-700 dark:text-gray-300",
    bg: "bg-gray-50 dark:bg-gray-900/30",
    borderColor: "border-gray-200 dark:border-gray-700",
    iconBg: "bg-gray-100 dark:bg-gray-800",
  },
  blocked: {
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    iconBg: "bg-red-100 dark:bg-red-900/50",
  },
  deferred: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
  },
  at_risk: {
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    iconBg: "bg-orange-100 dark:bg-orange-900/50",
  },
};

// ── Milestone status labels (for form dropdowns) ──────────────────────────────

export const MILESTONE_STATUS_OPTIONS: MilestoneStatus[] = [
  "planned",
  "in_progress",
  "completed",
  "blocked",
  "deferred",
];

// ── Helper: get progress bar color class from computed status ─────────────────

/** Returns the Tailwind class for a progress bar fill based on milestone status. */
export function getProgressBarClass(status: MilestoneStatusDisplay): string {
  return MILESTONE_STATUS_COLORS[status].bar;
}

// ── Helper: resolve status display from milestone ───────────────────────────────

import type { Milestone, RoadmapTask } from "@/types/database";
import { getComputedMilestoneStatus } from "./progress";

/**
 * Get the display status for a milestone, considering override.
 * Uses computed status from tasks unless override is enabled.
 * Falls back to milestone.status if tasks array is not available.
 */
export function getMilestoneDisplayStatus(
  milestone: Milestone,
  tasks: RoadmapTask[] | undefined,
): MilestoneStatusDisplay {
  if (milestone.status_override_enabled && milestone.status_override_value) {
    return milestone.status_override_value;
  }
  if (tasks) {
    return getComputedMilestoneStatus(milestone, tasks);
  }
  return milestone.status;
}