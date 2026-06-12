// ============================================================================
// Project Import Intelligence — AI Extraction (unstructured text)
// ============================================================================
// When a file has no recognizable tables (PDF, DOCX prose, TXT), the AI
// reads the raw text and produces canonical-schema JSON. Evidence-first:
// the model is instructed to never invent data, AI-derived entities are
// capped at 0.6 confidence (always needs_review), and the whole step
// degrades gracefully when no AI key is configured.
// ============================================================================

import { runAi } from "@/lib/ai";
import type { OrgContext } from "@/lib/auth";
import type { CanonicalImport } from "@/types/import-intelligence";
import { emptyCanonicalImport, normalizeStatus, normalizePriority } from "./extract";

const AI_CONFIDENCE_CAP = 0.6;

const EXTRACTION_PROMPT = `You are a project-plan extraction engine. Read the project document below and extract ONLY information that is explicitly present. Do not invent tasks, dates, owners, quantities, or costs. If a field is not in the text, leave it as an empty string or null.

Return strict JSON with this exact shape:
{
  "project": { "name": "", "description": "", "start_date": "", "target_finish_date": "" },
  "milestones": [ { "name": "", "target_date": "", "phase": "" } ],
  "tasks": [ { "name": "", "description": "", "phase": "", "milestone": "", "status": "", "planned_start": "", "planned_finish": "", "duration_days": null, "assigned_to": "", "predecessors": [] } ],
  "materials": [ { "name": "", "quantity": null, "unit": "", "unit_cost": null, "supplier": "" } ],
  "budget_items": [ { "name": "", "category": "", "estimated_cost": null } ],
  "risks": [ { "title": "", "description": "", "probability": "", "impact": "", "mitigation": "" } ]
}

Dates must be ISO (YYYY-MM-DD) only when the document states them. "predecessors" holds task names mentioned as prerequisites (phrases like "after", "depends on", "blocked by", "después de", "depende de"). The document may be in English or Spanish.

DOCUMENT:
{document}`;

/** Run AI extraction over raw text. Returns null when AI is unavailable or fails. */
export async function aiExtractCanonicalImport(
  org: OrgContext,
  rawText: string,
): Promise<CanonicalImport | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const document = rawText.slice(0, 24_000);

  try {
    const result = await runAi(
      org,
      {
        promptType: "custom",
        templateVars: { prompt: EXTRACTION_PROMPT.replace("{document}", document) },
        temperature: 0.1,
      },
    );
    if (result.status !== "completed" || !result.parsedJson) return null;
    return mapAiJsonToCanonical(result.parsedJson);
  } catch {
    return null;
  }
}

/** Map the model's JSON into the canonical schema with capped confidence. */
export function mapAiJsonToCanonical(json: Record<string, unknown>): CanonicalImport {
  const out = emptyCanonicalImport();
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];

  const project = (json.project ?? {}) as Record<string, unknown>;
  out.project.name = str(project.name);
  out.project.description = str(project.description);
  out.project.start_date = str(project.start_date);
  out.project.target_finish_date = str(project.target_finish_date);

  for (const [i, m] of arr(json.milestones).entries()) {
    if (!str(m.name)) continue;
    out.milestones.push({
      source_id: `ai-ms-${i + 1}`,
      name: str(m.name),
      description: "",
      phase: str(m.phase),
      target_date: str(m.target_date),
      status: "planned",
      confidence_score: AI_CONFIDENCE_CAP,
      source_reference: "AI extraction from document text",
    });
  }

  const taskIdByName = new Map<string, string>();
  for (const [i, t] of arr(json.tasks).entries()) {
    const name = str(t.name);
    if (!name) continue;
    const sourceId = `ai-task-${i + 1}`;
    taskIdByName.set(name.toLowerCase(), sourceId);
    out.tasks.push({
      source_id: sourceId,
      name,
      description: str(t.description),
      phase: str(t.phase),
      milestone: str(t.milestone),
      status: normalizeStatus(str(t.status)),
      priority: normalizePriority(""),
      planned_start: str(t.planned_start),
      planned_finish: str(t.planned_finish),
      duration_days: num(t.duration_days),
      estimated_hours: null,
      assigned_to: str(t.assigned_to),
      required_materials: [],
      cost_code: "",
      location: "",
      discipline: "",
      trade: "",
      confidence_score: AI_CONFIDENCE_CAP,
      source_reference: "AI extraction from document text",
    });
  }

  for (const t of arr(json.tasks)) {
    const successor = taskIdByName.get(str(t.name).toLowerCase());
    if (!successor) continue;
    const preds = Array.isArray(t.predecessors) ? t.predecessors : [];
    for (const p of preds) {
      const predecessor = taskIdByName.get(str(p).toLowerCase());
      if (predecessor && predecessor !== successor) {
        out.dependencies.push({
          predecessor_source_id: predecessor,
          successor_source_id: successor,
          dependency_type: "finish_to_start",
          lag_days: 0,
          inferred: true,
          confidence_score: 0.5,
          source_reference: "AI extraction from document text",
        });
      }
    }
  }

  for (const [i, m] of arr(json.materials).entries()) {
    if (!str(m.name)) continue;
    out.materials.push({
      source_id: `ai-mat-${i + 1}`,
      name: str(m.name),
      quantity: num(m.quantity),
      unit: str(m.unit),
      unit_cost: num(m.unit_cost),
      total_cost: null,
      supplier: str(m.supplier),
      lead_time_days: null,
      required_by_task_source_id: "",
      required_by_date: "",
      confidence_score: AI_CONFIDENCE_CAP,
      source_reference: "AI extraction from document text",
    });
  }

  for (const [i, b] of arr(json.budget_items).entries()) {
    if (!str(b.name)) continue;
    out.budget_items.push({
      source_id: `ai-bud-${i + 1}`,
      name: str(b.name),
      category: str(b.category),
      cost_code: "",
      estimated_cost: num(b.estimated_cost),
      committed_cost: null,
      actual_cost: null,
      linked_task_source_id: "",
      confidence_score: AI_CONFIDENCE_CAP,
      source_reference: "AI extraction from document text",
    });
  }

  for (const [i, r] of arr(json.risks).entries()) {
    if (!str(r.title) && !str(r.description)) continue;
    const level = (v: string) => (["high", "alta", "alto"].includes(v.toLowerCase()) ? "high" : ["low", "baja", "bajo"].includes(v.toLowerCase()) ? "low" : "medium");
    out.risks.push({
      source_id: `ai-risk-${i + 1}`,
      title: str(r.title) || str(r.description).slice(0, 120),
      description: str(r.description),
      probability: level(str(r.probability)),
      impact: level(str(r.impact)),
      severity: level(str(r.impact)),
      mitigation: str(r.mitigation),
      linked_task_source_id: "",
      confidence_score: AI_CONFIDENCE_CAP,
      source_reference: "AI extraction from document text",
    });
  }

  return out;
}
