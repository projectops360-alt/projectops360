// ============================================================================
// ProjectOps360° — Project Export — Blueprint transforms (pure)
// ============================================================================
// Turn a project AS EXECUTED into a clean reusable template. Every function is
// pure and returns NEW objects — it never mutates its input, which is how the
// "export must not mutate the original project" rule (TASK 7) is upheld at the
// data-shaping layer. Resets: statuses → planned, actual dates → blank, owners →
// role placeholders, evidence/transcripts → removed (lessons summary optional).
// ============================================================================

export const ROLE_PLACEHOLDER = "{{role}}";

// ── Input shapes (subset of the real rows; keeps this layer DB-agnostic) ─────
export interface SourceTask {
  id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  estimate_hours: number | null;
  acceptance_criteria: string | null;
  order_index: number;
  assigned_to: string | null;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  actual_hours: number | null;
}
export interface SourceMilestone {
  id: string;
  title: string;
  description: string | null;
  status: string;
  order_index: number;
  start_date: string | null;
  target_date: string | null;
  completed_date: string | null;
}
export interface SourceRisk {
  id: string;
  title: string;
  category: string | null;
  probability: string | null;
  impact: string | null;
  severity: string | null;
  status: string;
  mitigation_plan: string | null;
  owner_user_id: string | null;
}
export interface SourceMemoryItem {
  title: string;
  summary: string | null;
  ai_classification: string | null;
  importance_level: string | null;
}

// ── Output template shapes ───────────────────────────────────────────────────
export interface TaskTemplate {
  templateKey: string;
  phaseKey: string | null;
  title: string;
  description: string | null;
  status: "planned";
  priority: string | null;
  estimateHours: number | null;
  acceptanceCriteria: string | null;
  order: number;
  ownerRole: string;
  startDate: null;
  endDate: null;
}
export interface PhaseTemplate {
  phaseKey: string;
  title: string;
  description: string | null;
  status: "planned";
  order: number;
  startDate: null;
  targetDate: null;
}
export interface RiskTemplate {
  title: string;
  category: string | null;
  probability: string | null;
  impact: string | null;
  severity: string | null;
  mitigationPlan: string | null;
  status: "identified";
}
export interface LessonLearned {
  title: string;
  summary: string | null;
  classification: string | null;
  importance: string | null;
}

/** Any executed status collapses to a planned/template status. */
export function statusToPlanned(): "planned" {
  return "planned";
}

export function taskToTemplate(t: SourceTask): TaskTemplate {
  return {
    templateKey: t.id,
    phaseKey: t.milestone_id,
    title: t.title,
    description: t.description,
    status: "planned",
    priority: t.priority,
    estimateHours: t.estimate_hours,
    acceptanceCriteria: t.acceptance_criteria,
    order: t.order_index,
    ownerRole: ROLE_PLACEHOLDER, // actual owner removed
    startDate: null,             // actual dates reset
    endDate: null,
    // NOTE: completed_at / actual_hours / blocker history intentionally dropped.
  };
}

export function milestoneToPhase(m: SourceMilestone): PhaseTemplate {
  return {
    phaseKey: m.id,
    title: m.title,
    description: m.description,
    status: "planned",
    order: m.order_index,
    startDate: null,
    targetDate: null,
  };
}

export function riskToTemplate(r: SourceRisk): RiskTemplate {
  return {
    title: r.title,
    category: r.category,
    probability: r.probability,
    impact: r.impact,
    severity: r.severity,
    mitigationPlan: r.mitigation_plan, // reusable mitigation guidance
    status: "identified",              // reset to a fresh, unresolved template state
    // owner_user_id and resolution status intentionally dropped.
  };
}

/** Project Memory → optional lessons-learned summary (never raw evidence/transcripts). */
export function memoryToLessons(items: SourceMemoryItem[]): LessonLearned[] {
  return items
    .filter((m) => m.importance_level === "high" || m.importance_level === "critical")
    .map((m) => ({
      title: m.title,
      summary: m.summary, // short summary only — raw `content` is never copied
      classification: m.ai_classification,
      importance: m.importance_level,
    }));
}

/** Owner identity → reusable role placeholder. */
export function ownerToRolePlaceholder(): string {
  return ROLE_PLACEHOLDER;
}
