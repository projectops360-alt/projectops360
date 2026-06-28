// ============================================================================
// ProjectOps360° — Project Export — Full Archive builder (server-ish, pure over bundle)
// ============================================================================
// Builds the file set for "the project AS EXECUTED": real statuses, dates,
// decisions, evidence, traceability. Sensitive sets (memory, transcripts, audit)
// are only included when the option AND the caller's permission allow it.
// ============================================================================

import type { ProjectBundle } from "./gather";
import type { ExportEntity, ExportFile, FullArchiveOptions } from "./types";
import { toCsv } from "./csv";

export interface BuildResult {
  files: ExportFile[];
  included: ExportEntity[];
  excluded: ExportEntity[];
  warnings: string[];
}

/** Read a field that may be a plain string or an i18n object {en,es}. */
function text(v: unknown, locale: "en" | "es" = "en"): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o[locale] ?? o.en ?? o.es ?? "");
  }
  return String(v);
}
const s = (v: unknown): string => (v == null ? "" : String(v));

export function buildFullArchive(
  bundle: ProjectBundle,
  options: FullArchiveOptions,
  meta: { projectName: string; locale: "en" | "es"; canIncludeSensitive: boolean },
): BuildResult {
  const files: ExportFile[] = [];
  const included: ExportEntity[] = [];
  const excluded: ExportEntity[] = [];
  const warnings = [...bundle.warnings];
  const loc = meta.locale;

  // Project profile (always).
  files.push({ name: "project.json", data: json(bundle.project ?? {}) });
  included.push("project_profile");

  // Structure & execution as CSV.
  files.push({ name: "milestones.csv", data: toCsv(
    bundle.milestones.map((m) => ({
      id: s(m.id), title: text(m.title ?? m.title_i18n, loc), status: s(m.status),
      start_date: s(m.start_date), target_date: s(m.target_date), completed_date: s(m.completed_date), order: s(m.order_index),
    })),
    ["id", "title", "status", "start_date", "target_date", "completed_date", "order"],
  ) });
  included.push("milestones");

  files.push({ name: "tasks.csv", data: toCsv(
    bundle.tasks.map((t) => ({
      id: s(t.id), milestone_id: s(t.milestone_id), title: text(t.title ?? t.title_i18n, loc), status: s(t.status),
      priority: s(t.priority), estimate_hours: s(t.estimate_hours), actual_hours: s(t.actual_hours),
      start_date: s(t.start_date), end_date: s(t.end_date), completed_at: s(t.completed_at), is_critical: s(t.is_critical),
    })),
    ["id", "milestone_id", "title", "status", "priority", "estimate_hours", "actual_hours", "start_date", "end_date", "completed_at", "is_critical"],
  ) });
  included.push("tasks");

  files.push({ name: "risks.csv", data: toCsv(
    bundle.risks.map((r) => ({
      id: s(r.id), title: text(r.title, loc), category: s(r.category), severity: s(r.severity),
      probability: s(r.probability), status: s(r.status), mitigation_plan: text(r.mitigation_plan, loc),
    })),
    ["id", "title", "category", "severity", "probability", "status", "mitigation_plan"],
  ) });
  included.push("risks");

  files.push({ name: "decisions.csv", data: toCsv(
    bundle.decisions.map((d) => ({
      id: s(d.id), title: text(d.title_i18n ?? d.title, loc), status: s(d.status),
      decision_date: s(d.decision_date), impact_area: s(d.impact_area),
    })),
    ["id", "title", "status", "decision_date", "impact_area"],
  ) });
  included.push("decisions");

  // Action items + communications (always part of the executed record).
  files.push({ name: "action-items.json", data: json(bundle.actionItems) });
  included.push("action_items");
  files.push({ name: "communications.json", data: json(bundle.communications) });
  included.push("communications");

  // Meetings — transcripts/raw notes only when explicitly allowed.
  const allowTranscripts = options.includeTranscripts && meta.canIncludeSensitive;
  const meetings = bundle.meetings.map((m) => {
    if (allowTranscripts) return m;
    const { transcript, notes_i18n, ...rest } = m as Record<string, unknown>;
    void transcript; void notes_i18n;
    return rest;
  });
  files.push({ name: "meetings.json", data: json(meetings) });
  included.push("meetings");
  if (allowTranscripts) included.push("transcripts"); else excluded.push("transcripts");

  // Traceability map.
  if (options.includeTraceability) {
    files.push({ name: "traceability.json", data: json({
      taskToMilestone: bundle.tasks.map((t) => ({ taskId: s(t.id), milestoneId: s(t.milestone_id) })),
      dependencies: bundle.dependencies.map((d) => ({ predecessor: s(d.predecessor_id), successor: s(d.successor_id), type: s(d.dependency_type) })),
      riskLinks: bundle.risks.map((r) => ({ riskId: s(r.id), taskId: s(r.linked_task_id), milestoneId: s(r.linked_milestone_id) })),
    }) });
    included.push("traceability");
  } else excluded.push("traceability");

  // Project Memory (sensitive — gated).
  if (options.includeProjectMemory && meta.canIncludeSensitive) {
    files.push({ name: "project-memory.json", data: json(bundle.memory) });
    included.push("project_memory");
  } else { excluded.push("project_memory"); if (options.includeProjectMemory) warnings.push("Project Memory excluded — insufficient permission"); }

  // Documents manifest (titles/metadata only — never file bytes here).
  if (options.includeDocuments) {
    files.push({ name: "documents-manifest.json", data: json(bundle.documents.map((d) => ({
      id: s(d.id), title: text(d.title_i18n ?? d.title, loc), type: s(d.document_type ?? d.type), created_at: s(d.created_at),
    }))) });
    included.push("documents");
  } else excluded.push("documents");

  // Closeout report.
  if (options.includeCloseout && bundle.closeout) {
    files.push({ name: "closeout-report.json", data: json(bundle.closeout) });
    included.push("closeout");
  } else { excluded.push("closeout"); if (options.includeCloseout && !bundle.closeout) warnings.push("Closeout Report not generated yet"); }

  if (!options.includeAuditTrail || !meta.canIncludeSensitive) excluded.push("audit_trail");

  // Human-readable summary + README.
  files.push({ name: "project-summary.md", data: summaryMd(bundle, meta.projectName, loc) });
  files.push({ name: "README.md", data: readmeMd(meta.projectName, included) });

  return { files, included, excluded, warnings };
}

function json(v: unknown): string { return JSON.stringify(v, null, 2); }

function summaryMd(bundle: ProjectBundle, name: string, loc: "en" | "es"): string {
  void loc;
  const done = bundle.tasks.filter((t) => ["done", "completed", "approved"].includes(String(t.status))).length;
  return [
    `# ${name} — Project Summary`,
    "",
    `- Milestones: ${bundle.milestones.length}`,
    `- Tasks: ${bundle.tasks.length} (completed: ${done})`,
    `- Risks: ${bundle.risks.length}`,
    `- Decisions: ${bundle.decisions.length}`,
    `- Meetings: ${bundle.meetings.length}`,
    `- Documents: ${bundle.documents.length}`,
    "",
    "This is a **Full Project Archive** — the project as executed, including evidence and traceability.",
  ].join("\n");
}

function readmeMd(name: string, included: ExportEntity[]): string {
  return [
    `# Full Project Archive — ${name}`,
    "",
    "This package preserves the project **as executed** for audits, closeout, documentation and PMO records.",
    "",
    "## Included",
    ...included.map((e) => `- ${e}`),
    "",
    "See `export-manifest.json` for the full inventory, privacy mode and any warnings.",
  ].join("\n");
}
