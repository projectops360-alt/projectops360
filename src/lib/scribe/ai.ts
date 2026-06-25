// ============================================================================
// ProjectOps360° — ProjectOps Scribe AI (server-only). Reuses runAi('custom').
// ============================================================================
// Turns a captured note / dictation / pasted transcript into STRUCTURED project
// intelligence. Anti-hallucination is the priority: extract only what the text
// supports, null when missing, a source_excerpt for every item, confidence
// scores, and needs_review flags. Same runJson pattern as src/lib/delivery/ai.ts.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";

const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const arr = (x: unknown) => (Array.isArray(x) ? x : []);
const numOrNull = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (x: unknown): string | null => { const s = str(x); return s || null; };
const boolish = (x: unknown): boolean => x === true || x === "true";

// ── Output types ──────────────────────────────────────────────────────────────

export interface ScribeItem {
  item_type: ScribeItemType;
  description: string;
  suggested_owner: string | null;
  suggested_due_date: string | null;
  confidence: number | null;
  source_excerpt: string;
  needs_review: boolean;
  proposed_action: string;
  /** Extra typed fields the model returned (impact, probability, severity, …). */
  extra: Record<string, unknown>;
}

export type ScribeItemType =
  | "action_item" | "decision" | "risk" | "issue" | "blocker"
  | "dependency" | "project_impact" | "open_question" | "follow_up";

export interface ScribeAnalysis {
  summary: string;
  detected_language: string;
  items: ScribeItem[];
}

const EMPTY: ScribeAnalysis = { summary: "", detected_language: "", items: [] };

async function runJson(org: OrgContext, projectId: string, prompt: string): Promise<Record<string, unknown> | null> {
  const { runAi } = await import("@/lib/ai/service");
  const res = await runAi(org, { promptType: "custom", templateVars: { prompt }, temperature: 0.1, sourceType: "project", sourceId: projectId });
  return res.status === "completed" ? ((res.parsedJson ?? null) as Record<string, unknown> | null) : null;
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(text: string, locale: Locale): string {
  const lang = locale === "es" ? "español" : "English";
  const today = new Date().toISOString().slice(0, 10);
  return [
    `You are ProjectOps Scribe, a meticulous project-management assistant. Analyze the CAPTURE below and extract structured project intelligence. Respond in ${lang}.`,
    `Today's date is ${today}.`,
    "",
    "STRICT RULES (avoid hallucinated project data):",
    "- Extract ONLY information explicitly supported by the capture text.",
    "- NEVER invent owners, dates, decisions, risks, dependencies or numbers. If a field is not stated, use null.",
    "- For EVERY extracted item include a verbatim \"source_excerpt\" copied from the capture (the exact phrase that supports it).",
    "- Set \"needs_review\": true whenever the item is uncertain, ambiguous, or inferred rather than explicit.",
    "- Include a \"confidence\" between 0 and 1 for every item.",
    "- Separate facts from assumptions: assumptions must have needs_review = true and lower confidence.",
    "- Identify possible project impact WITHOUT proposing to apply any change automatically.",
    "- DATES: capture deadlines and due dates. Convert any date or deadline you find — explicit (e.g. \"June 30, 2026\", \"30 de junio\") OR relative (e.g. \"end of the month\", \"fin de mes\", \"next Friday\", \"in two weeks\") — into an absolute ISO date (YYYY-MM-DD) resolved against today's date. If a deadline applies to the deliverable/work that an action item describes (e.g. \"the design must be ready by June 30\"), set that action item's due_date to it. If no date or deadline is mentioned at all, use null. Never invent a date that is not implied by the text.",
    "- OWNERS: if a person is named as responsible (e.g. \"Diego will handle…\"), put just their name (as written) in the owner field. Do not invent owners.",
    "- Keep a professional, project-management tone. Return VALID JSON only — no prose outside the JSON.",
    "",
    "Return EXACTLY this JSON shape:",
    `{
  "summary": "2-4 sentence neutral summary of the capture",
  "detected_language": "en | es | mixed",
  "action_items": [ { "description": "", "details": "", "priority": null, "owner": null, "due_date": null, "confidence": 0.0, "source_excerpt": "", "needs_review": true, "proposed_action": "create_task" } ],
  "decisions": [ { "description": "", "decision_maker": null, "date": null, "confidence": 0.0, "source_excerpt": "", "needs_review": true, "proposed_action": "save_decision" } ],
  "risks": [ { "description": "", "impact": null, "probability": null, "owner": null, "confidence": 0.0, "source_excerpt": "", "needs_review": true, "proposed_action": "create_risk" } ],
  "issues": [ { "description": "", "owner": null, "severity": null, "confidence": 0.0, "source_excerpt": "", "needs_review": true, "proposed_action": "flag_issue" } ],
  "blockers": [ { "description": "", "blocked_entity": null, "owner": null, "confidence": 0.0, "source_excerpt": "", "needs_review": true, "proposed_action": "flag_blocker" } ],
  "dependencies": [ { "description": "", "upstream_dependency": null, "downstream_impact": null, "confidence": 0.0, "source_excerpt": "", "needs_review": true, "proposed_action": "save_dependency" } ],
  "project_impacts": [ { "impact_type": "schedule|budget|scope|quality|resource|stakeholder", "description": "", "confidence": 0.0, "source_excerpt": "", "needs_review": true } ],
  "open_questions": [ { "question": "", "reason": "", "source_excerpt": "" } ]
}`,
    "For each action_item: \"description\" is a short imperative title; \"details\" is a 1-2 sentence description of what the work involves and its context (deliverable, deadline, who is involved) WITHOUT inventing anything; \"priority\" is High/Medium/Low only if the text implies urgency, else null.",
    "Use empty arrays for sections with nothing to extract. Do not add keys that are not in the shape.",
    "",
    "=== CAPTURE ===",
    text,
  ].join("\n");
}

// ── Normalization ─────────────────────────────────────────────────────────────

function mapItems(json: Record<string, unknown>): ScribeItem[] {
  const out: ScribeItem[] = [];
  const push = (
    type: ScribeItemType,
    rows: unknown,
    descKey: string,
    defaultAction: string,
    extraKeys: string[],
  ) => {
    for (const r of arr(rows)) {
      const o = r as Record<string, unknown>;
      const description = str(o[descKey]);
      if (!description) continue;
      const extra: Record<string, unknown> = {};
      for (const k of extraKeys) if (o[k] != null && str(o[k])) extra[k] = str(o[k]);
      out.push({
        item_type: type,
        description,
        suggested_owner: strOrNull(o.owner) ?? strOrNull(o.decision_maker),
        suggested_due_date: strOrNull(o.due_date) ?? strOrNull(o.date),
        confidence: numOrNull(o.confidence),
        source_excerpt: str(o.source_excerpt),
        needs_review: o.needs_review == null ? true : boolish(o.needs_review),
        proposed_action: str(o.proposed_action) || defaultAction,
        extra,
      });
    }
  };

  push("action_item", json.action_items, "description", "create_task", ["details", "priority"]);
  push("decision", json.decisions, "description", "save_decision", []);
  push("risk", json.risks, "description", "create_risk", ["impact", "probability"]);
  push("issue", json.issues, "description", "flag_issue", ["severity"]);
  push("blocker", json.blockers, "description", "flag_blocker", ["blocked_entity"]);
  push("dependency", json.dependencies, "description", "save_dependency", ["upstream_dependency", "downstream_impact"]);
  push("project_impact", json.project_impacts, "description", "note_impact", ["impact_type"]);

  // Open questions have a different shape (question/reason).
  for (const r of arr(json.open_questions)) {
    const o = r as Record<string, unknown>;
    const q = str(o.question);
    if (!q) continue;
    out.push({
      item_type: "open_question",
      description: q,
      suggested_owner: null,
      suggested_due_date: null,
      confidence: numOrNull(o.confidence),
      source_excerpt: str(o.source_excerpt),
      needs_review: true,
      proposed_action: "answer_question",
      extra: str(o.reason) ? { reason: str(o.reason) } : {},
    });
  }

  return out;
}

/**
 * Analyze a Scribe capture and return normalized structured intelligence.
 * No DB writes (other than the ai_runs row runAi records). Returns EMPTY on
 * AI failure so the caller can still let the user save the raw note.
 */
export async function analyzeScribeCapture(
  org: OrgContext, projectId: string, text: string, locale: Locale,
): Promise<ScribeAnalysis> {
  const clean = str(text);
  if (!clean) return EMPTY;
  const json = await runJson(org, projectId, buildPrompt(clean, locale));
  if (!json) return EMPTY;
  return {
    summary: str(json.summary),
    detected_language: str(json.detected_language) || (locale === "es" ? "es" : "en"),
    items: mapItems(json),
  };
}
