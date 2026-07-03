// ============================================================================
// ProjectOps360° — Milestone Process Flow UI · Style maps (presentation only)
// ============================================================================
// Pure lookup tables from ENGINE vocabularies to Tailwind classes. No logic —
// an unknown value always falls back to the neutral "unknown" style, so the UI
// can never invent a healthier look than the engine reported.
// ============================================================================

/** Health badge classes per engine health status (MPF_HEALTH_STATUSES). */
export const HEALTH_BADGE_CLASSES: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  watch: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  degraded: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  at_risk: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  recovering: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  regressed: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

/** Corridor bar fill per engine segment type (MPF_SEGMENT_TYPES). */
export const SEGMENT_BAR_CLASSES: Record<string, string> = {
  active_work: "bg-emerald-500/70",
  waiting: "bg-amber-400/70",
  blocked: "bg-red-500/70",
  decision_delay: "bg-violet-500/70",
  approval_delay: "bg-indigo-500/70",
  rework: "bg-rose-500/70",
  handoff: "bg-sky-400/70",
  review: "bg-cyan-500/70",
  external_constraint: "bg-slate-500/70",
  unknown: "bg-muted-foreground/30",
};

/** Small dot/chip accent per segment type (legend + lists). */
export const SEGMENT_DOT_CLASSES: Record<string, string> = SEGMENT_BAR_CLASSES;

/** Severity chip classes (detection severity — NOT health). */
export const SEVERITY_CLASSES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

/** Confidence chip classes (engine evidence confidence). */
export const CONFIDENCE_CLASSES: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  medium: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  low: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function healthBadgeClass(status: string): string {
  return HEALTH_BADGE_CLASSES[status] ?? HEALTH_BADGE_CLASSES.unknown;
}

export function segmentBarClass(type: string): string {
  return SEGMENT_BAR_CLASSES[type] ?? SEGMENT_BAR_CLASSES.unknown;
}

export function severityClass(severity: string): string {
  return SEVERITY_CLASSES[severity] ?? SEVERITY_CLASSES.unknown;
}

export function confidenceClass(confidence: string): string {
  return CONFIDENCE_CLASSES[confidence] ?? CONFIDENCE_CLASSES.unknown;
}
