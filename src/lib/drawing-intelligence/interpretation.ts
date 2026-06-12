// ============================================================================
// ProjectOps360° — Drawing Interpretation Engine (Prompt 4)
// ============================================================================
// Deterministic, evidence-first insight generation from extracted drawing
// content (notes, revisions, title block). Every candidate carries the note
// excerpt + page that produced it — no unsupported conclusions by design.
// Pure module (no I/O). The optional AI enhancement lives in the service
// layer; its output is validated against the same evidence rules.
// ============================================================================

import type { ExtractedNote, RevisionEntry } from "./extractors";
import type { DrawingInsightSeverity, DrawingInsightType } from "@/types/drawing-intelligence";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InsightEvidenceRef {
  page_number: number;
  text_excerpt: string;
}

export interface InsightCandidate {
  insight_type: DrawingInsightType;
  title: string;
  description: string;
  severity: DrawingInsightSeverity;
  confidence_score: number;
  evidence: InsightEvidenceRef[];
  recommended_action: string;
  /** Structured payload per insight type (RFI question, submittal item, …) */
  payload: Record<string, unknown>;
  linked_task_id: string | null;
  linked_milestone_id: string | null;
  needs_review: boolean;
}

export interface InterpretationContext {
  fileName: string;
  drawingNumber: string | null;
  discipline: string | null;
  currentRevision: string | null;
  notes: ExtractedNote[];
  revisions: RevisionEntry[];
  /** Minimal task shape needed for linking */
  tasks: { id: string; title: string; status: string; milestone_id: string | null }[];
  milestones: { id: string; title: string; status: string }[];
}

/** Confidence below this — or high severity — marks the insight needs_review */
export const INSIGHT_REVIEW_THRESHOLD = 0.7;

const ACTIVE_TASK_STATUSES = new Set(["sent_to_ai", "in_progress", "implemented", "tested", "prompt_ready"]);

// ── Rule definitions ──────────────────────────────────────────────────────────

interface NoteRule {
  insight_type: DrawingInsightType;
  pattern: RegExp;
  severity: DrawingInsightSeverity;
  confidence: number;
  titlePrefix: string;
  recommended_action: string;
}

const NOTE_RULES: NoteRule[] = [
  {
    insight_type: "rfi_candidate",
    pattern: /\b(field verify|VIF|verify (in field|with|all)|to be confirmed|coordinate with|conflict(s|ing)? with|unclear|clarif(y|ication)|discrepanc|by others|does not match|refer to .* for clarification)\b/i,
    severity: "medium",
    confidence: 0.78,
    titlePrefix: "Possible RFI",
    recommended_action: "create_draft_rfi",
  },
  {
    insight_type: "submittal_requirement",
    pattern: /\b(submit(tal)?s?\b|shop drawings?|product data|manufacturer('s)? (data|instructions|recommendations)|samples? for approval|approved equal|for (engineer|architect) (review|approval))\b/i,
    severity: "medium",
    confidence: 0.82,
    titlePrefix: "Submittal requirement",
    recommended_action: "create_submittal_requirement",
  },
  {
    insight_type: "inspection_requirement",
    pattern: /\b(inspect(ion|ed)?|test(ing|ed)? (required|prior|before)|pressure test|code compliance|permit|firestop(ping)?|structural observation|commissioning|AHJ|authority having jurisdiction|special inspection)\b/i,
    severity: "medium",
    confidence: 0.8,
    titlePrefix: "Inspection requirement",
    recommended_action: "create_inspection_requirement",
  },
  {
    insight_type: "schedule_impact",
    pattern: /\b(long[- ]lead|lead time|prior to (start|installation|construction)|sequence|sequencing|phasing|before (any|other) work|critical path|shutdown required)\b/i,
    severity: "high",
    confidence: 0.72,
    titlePrefix: "Schedule impact",
    recommended_action: "add_schedule_constraint",
  },
  {
    insight_type: "cost_impact",
    pattern: /\b(additional (scope|cost|work)|allowance|alternate|change order|rework|replace existing|upgrade|premium|provide new|at no additional cost)\b/i,
    severity: "high",
    confidence: 0.7,
    titlePrefix: "Cost impact",
    recommended_action: "add_cost_impact_candidate",
  },
  {
    insight_type: "missing_information",
    pattern: /\b(TBD|to be determined|not shown|pending|N\.?I\.?C\.?|missing|not included|see specifications? for|incomplete)\b/i,
    severity: "medium",
    confidence: 0.75,
    titlePrefix: "Missing information",
    recommended_action: "request_human_review",
  },
  {
    insight_type: "contradiction",
    pattern: /\b(contradicts?|in conflict|inconsistent with|supersedes|disregard (previous|prior)|does not agree)\b/i,
    severity: "high",
    confidence: 0.72,
    titlePrefix: "Possible contradiction",
    recommended_action: "request_human_review",
  },
  {
    insight_type: "decision_required",
    pattern: /\b(owner (to|shall) (select|approve|decide)|architect (to|shall) (select|approve)|to be selected|pending (decision|selection|approval)|option [A-Z0-9]|subject to approval)\b/i,
    severity: "medium",
    confidence: 0.74,
    titlePrefix: "Decision required",
    recommended_action: "notify_project_owner",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the", "and", "for", "with", "all", "shall", "this", "that", "from", "are",
  "los", "las", "del", "con", "para", "por", "una", "los",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-záéíóúñü0-9\s-]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

/** Conservative fuzzy link: ≥2 significant shared words between note and task title */
function findLinkedTask(
  noteText: string,
  tasks: InterpretationContext["tasks"],
): InterpretationContext["tasks"][number] | null {
  const noteWords = significantWords(noteText);
  let best: { task: InterpretationContext["tasks"][number]; overlap: number } | null = null;
  for (const task of tasks) {
    const taskWords = significantWords(task.title);
    let overlap = 0;
    for (const word of taskWords) {
      if (noteWords.has(word)) overlap++;
    }
    if (overlap >= 2 && (!best || overlap > best.overlap)) {
      best = { task, overlap };
    }
  }
  return best?.task ?? null;
}

function truncate(text: string, max = 90): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function interpretDrawingContent(ctx: InterpretationContext): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const drawingRef = ctx.drawingNumber ?? ctx.fileName;

  // 1. Note-driven insights (one per matching rule per note)
  for (const note of ctx.notes) {
    for (const rule of NOTE_RULES) {
      const match = note.text.match(rule.pattern);
      if (!match) continue;

      const linkedTask = findLinkedTask(note.text, ctx.tasks);
      // Note-extraction confidence dampens rule confidence
      const confidence = Math.round(rule.confidence * note.confidence_score * 100) / 100;
      const needsReview = confidence < INSIGHT_REVIEW_THRESHOLD || rule.severity === "high" || rule.severity === "critical";

      const payload: Record<string, unknown> =
        rule.insight_type === "rfi_candidate"
          ? {
              question: note.text,
              reason: `Note ${note.note_id} on ${drawingRef} signals "${match[0]}"`,
              drawing_reference: drawingRef,
              page_reference: note.page_number,
              evidence_excerpt: note.evidence.text_excerpt,
              suggested_recipient_role: "design_team",
              urgency: rule.severity,
              status: "suggested",
            }
          : rule.insight_type === "submittal_requirement" || rule.insight_type === "inspection_requirement"
            ? {
                required_item: truncate(note.text, 120),
                discipline: ctx.discipline,
                drawing_reference: drawingRef,
                recommended_owner_role: "subcontractor",
                status: "suggested",
              }
            : rule.insight_type === "schedule_impact"
              ? {
                  affected_task: linkedTask?.title ?? null,
                  impact_type: "sequencing_constraint",
                  estimated_delay_days: null, // unknown — never invented
                  explanation: note.text,
                }
              : rule.insight_type === "cost_impact"
                ? {
                    cost_category: "scope_change_candidate",
                    possible_scope_change: truncate(note.text, 160),
                    estimated_cost_range: null, // unknown — never invented
                    explanation: note.text,
                  }
                : { explanation: note.text };

      candidates.push({
        insight_type: rule.insight_type,
        title: `${rule.titlePrefix}: ${truncate(note.text)}`,
        description: `${drawingRef} — note ${note.note_id} (p.${note.page_number}): ${note.text}`,
        severity: rule.severity,
        confidence_score: confidence,
        evidence: [{ page_number: note.page_number, text_excerpt: note.evidence.text_excerpt }],
        recommended_action: rule.recommended_action,
        payload,
        linked_task_id: linkedTask?.id ?? null,
        linked_milestone_id: linkedTask?.milestone_id ?? null,
        needs_review: needsReview,
      });
    }
  }

  // 2. Revision-driven risk: a new revision while work is active/upcoming
  const latestRevision = ctx.revisions[ctx.revisions.length - 1];
  if (latestRevision) {
    const activeTasks = ctx.tasks.filter((t) => ACTIVE_TASK_STATUSES.has(t.status));
    const linkedTask = latestRevision.description
      ? findLinkedTask(latestRevision.description, ctx.tasks)
      : null;
    if (activeTasks.length > 0) {
      const confidence = Math.round(0.75 * latestRevision.confidence_score * 100) / 100;
      candidates.push({
        insight_type: "risk",
        title: `Revision ${latestRevision.revision} of ${drawingRef} may affect active work`,
        description: `${drawingRef} was revised (rev ${latestRevision.revision}${latestRevision.revision_date ? `, ${latestRevision.revision_date}` : ""}: ${latestRevision.description ?? "no description"}). ${activeTasks.length} task(s) are currently active in this project.`,
        severity: "high",
        confidence_score: confidence,
        evidence: [latestRevision.evidence],
        recommended_action: "compare_against_previous_revision",
        payload: {
          probability: "possible",
          impact: "rework_or_delay",
          category: "design_change",
          recommended_mitigation: "Review the revision against in-progress tasks before continuing affected work.",
          active_task_count: activeTasks.length,
        },
        linked_task_id: linkedTask?.id ?? activeTasks[0]?.id ?? null,
        linked_milestone_id: linkedTask?.milestone_id ?? null,
        needs_review: true, // high severity ⇒ human review
      });

      // Version-change schedule impact (separate, lower confidence)
      candidates.push({
        insight_type: "schedule_impact",
        title: `Revision ${latestRevision.revision} may affect sequencing on ${drawingRef}`,
        description: `Revision ${latestRevision.revision} arrived while ${activeTasks.length} task(s) are active. Sequencing, dependencies or the critical path may shift.`,
        severity: "medium",
        confidence_score: Math.round(0.6 * latestRevision.confidence_score * 100) / 100,
        evidence: [latestRevision.evidence],
        recommended_action: "add_schedule_constraint",
        payload: {
          affected_task: activeTasks[0]?.title ?? null,
          impact_type: "revision_resequencing",
          estimated_delay_days: null,
          explanation: latestRevision.description ?? "Revision issued during active work.",
        },
        linked_task_id: activeTasks[0]?.id ?? null,
        linked_milestone_id: null,
        needs_review: true,
      });
    }
  }

  // 3. Deduplicate: same type + same first-evidence excerpt
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.insight_type}|${c.evidence[0]?.text_excerpt ?? c.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
