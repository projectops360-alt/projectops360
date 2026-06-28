// ============================================================================
// ProjectOps360° — Project Export — Starter Blueprint builder (pure over bundle)
// ============================================================================
// Turns the project into a clean reusable template: structure kept, execution
// history reset/removed. Defaults to privacy-safe (no raw memory/transcripts,
// owners → role placeholders, statuses → planned, dates blank). Designed so a
// future "Create project from blueprint" importer can consume blueprint.json.
// ============================================================================

import type { ProjectBundle } from "./gather";
import type { BuildResult } from "./full-archive";
import type { ExportEntity, ExportFile, BlueprintOptions } from "./types";
import { EXPORT_SCHEMA_VERSION } from "./types";
import { toCsv } from "./csv";
import {
  taskToTemplate, milestoneToPhase, riskToTemplate, memoryToLessons, ROLE_PLACEHOLDER,
  type SourceTask, type SourceMilestone, type SourceRisk, type SourceMemoryItem,
} from "./transform";

const s = (v: unknown): string => (v == null ? "" : String(v));
function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") { const o = v as Record<string, unknown>; return String(o.en ?? o.es ?? ""); }
  return String(v);
}

export function buildBlueprint(
  bundle: ProjectBundle,
  options: BlueprintOptions,
  meta: { projectName: string },
): BuildResult {
  const files: ExportFile[] = [];
  const included: ExportEntity[] = [];
  const excluded: ExportEntity[] = [];
  const warnings: string[] = [];

  // ── Phases (from milestones) ────────────────────────────────────────────────
  const phases = options.keepMilestones
    ? bundle.milestones.map((m) => milestoneToPhase(toSourceMilestone(m)))
    : [];
  if (options.keepMilestones) included.push("phases"); else excluded.push("phases");

  // ── Task templates (reset to planned, owners → role placeholder) ────────────
  const taskTemplates = options.keepTasks
    ? bundle.tasks.map((t) => taskToTemplate(toSourceTask(t)))
    : [];
  if (options.keepTasks) included.push("task_templates"); else excluded.push("task_templates");

  // ── Dependency patterns (structure only) ────────────────────────────────────
  const dependencies = options.keepDependencies
    ? bundle.dependencies.map((d) => ({ predecessorKey: s(d.predecessor_id), successorKey: s(d.successor_id), type: s(d.dependency_type) }))
    : [];
  if (options.keepDependencies) included.push("dependencies"); else excluded.push("dependencies");

  // ── Risk templates (reset; reusable mitigation guidance) ────────────────────
  const riskTemplates = options.keepRiskTemplates
    ? bundle.risks.map((r) => riskToTemplate(toSourceRisk(r)))
    : [];
  if (options.keepRiskTemplates) included.push("risk_templates"); else excluded.push("risk_templates");

  // ── Role templates (identity-stripped) + stakeholder categories ─────────────
  const roleTemplates = options.keepRoles ? deriveRoleTemplates(bundle) : [];
  if (options.keepRoles) included.push("role_templates"); else excluded.push("role_templates");

  // ── Document checklist (titles → checklist items, no files) ─────────────────
  const documentChecklist = options.keepDocumentChecklist
    ? bundle.documents.map((d) => ({ item: text(d.title_i18n ?? d.title), required: true }))
    : [];
  if (options.keepDocumentChecklist) included.push("document_checklist"); else excluded.push("document_checklist");

  // ── Lessons learned (optional, summary only — never raw evidence) ───────────
  const lessons = options.includeLessonsLearned
    ? memoryToLessons(bundle.memory.map(toSourceMemory))
    : [];
  if (options.includeLessonsLearned) included.push("lessons_learned");
  // Raw memory/transcripts are ALWAYS excluded from a blueprint.
  excluded.push("project_memory", "transcripts", "audit_trail");

  // ── blueprint.json (canonical, import-ready) ────────────────────────────────
  const blueprint = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    kind: "starter_blueprint",
    suggestedName: `${meta.projectName} (template)`,
    projectType: s(bundle.project?.project_type ?? bundle.project?.type),
    deliveryFramework: s(bundle.project?.delivery_method ?? bundle.project?.delivery_framework),
    phases, taskTemplates, dependencies, riskTemplates, roleTemplates, documentChecklist,
    lessonsLearned: lessons,
    resets: {
      statusesToPlanned: options.resetStatusesToPlanned,
      datesReset: options.resetDates,
      ownersToRoles: options.resetOwnersToRoles,
      sensitiveEvidenceRemoved: options.removeSensitiveEvidence,
    },
  };
  files.push({ name: "blueprint.json", data: JSON.stringify(blueprint, null, 2) });

  // ── CSV companions ──────────────────────────────────────────────────────────
  files.push({ name: "phases.csv", data: toCsv(
    phases.map((p) => ({ phaseKey: p.phaseKey, title: p.title, status: p.status, order: p.order })),
    ["phaseKey", "title", "status", "order"],
  ) });
  files.push({ name: "task-templates.csv", data: toCsv(
    taskTemplates.map((t) => ({ templateKey: t.templateKey, phaseKey: s(t.phaseKey), title: t.title, status: t.status, ownerRole: t.ownerRole, estimateHours: s(t.estimateHours), order: t.order })),
    ["templateKey", "phaseKey", "title", "status", "ownerRole", "estimateHours", "order"],
  ) });
  files.push({ name: "risk-templates.csv", data: toCsv(
    riskTemplates.map((r) => ({ title: r.title, category: s(r.category), severity: s(r.severity), probability: s(r.probability), status: r.status, mitigationPlan: s(r.mitigationPlan) })),
    ["title", "category", "severity", "probability", "status", "mitigationPlan"],
  ) });
  files.push({ name: "role-templates.csv", data: toCsv(
    roleTemplates.map((r) => ({ roleKey: r.roleKey, description: r.description })),
    ["roleKey", "description"],
  ) });
  files.push({ name: "document-checklist.csv", data: toCsv(
    documentChecklist.map((d) => ({ item: d.item, required: d.required })),
    ["item", "required"],
  ) });

  // ── Guidance docs ───────────────────────────────────────────────────────────
  files.push({ name: "README.md", data: readmeMd(meta.projectName, included) });
  files.push({ name: "starter-checklist.md", data: starterChecklistMd(meta.projectName, phases.length, taskTemplates.length) });
  files.push({ name: "import-notes.md", data: importNotesMd() });

  return { files, included, excluded, warnings };
}

// ── Mappers from generic rows to the pure transform inputs ───────────────────
function toSourceTask(t: Record<string, unknown>): SourceTask {
  return {
    id: s(t.id), milestone_id: (t.milestone_id as string) ?? null, title: text(t.title ?? t.title_i18n),
    description: (text(t.description ?? t.description_i18n) || null), status: s(t.status), priority: (t.priority as string) ?? null,
    estimate_hours: (t.estimate_hours as number) ?? null, acceptance_criteria: (t.acceptance_criteria as string) ?? null,
    order_index: Number(t.order_index ?? 0), assigned_to: (t.assigned_to as string) ?? null,
    start_date: (t.start_date as string) ?? null, end_date: (t.end_date as string) ?? null,
    completed_at: (t.completed_at as string) ?? null, actual_hours: (t.actual_hours as number) ?? null,
  };
}
function toSourceMilestone(m: Record<string, unknown>): SourceMilestone {
  return {
    id: s(m.id), title: text(m.title ?? m.title_i18n), description: (text(m.description ?? m.description_i18n) || null),
    status: s(m.status), order_index: Number(m.order_index ?? 0),
    start_date: (m.start_date as string) ?? null, target_date: (m.target_date as string) ?? null, completed_date: (m.completed_date as string) ?? null,
  };
}
function toSourceRisk(r: Record<string, unknown>): SourceRisk {
  return {
    id: s(r.id), title: text(r.title), category: (r.category as string) ?? null, probability: (r.probability as string) ?? null,
    impact: (r.impact as string) ?? null, severity: (r.severity as string) ?? null, status: s(r.status),
    mitigation_plan: (r.mitigation_plan as string) ?? null, owner_user_id: (r.owner_user_id as string) ?? null,
  };
}
function toSourceMemory(m: Record<string, unknown>): SourceMemoryItem {
  return { title: text(m.title), summary: (m.summary as string) ?? null, ai_classification: (m.ai_classification as string) ?? null, importance_level: (m.importance_level as string) ?? null };
}

function deriveRoleTemplates(bundle: ProjectBundle): { roleKey: string; description: string }[] {
  const base = [
    { roleKey: "project_owner", description: "Accountable owner / sponsor" },
    { roleKey: "project_manager", description: "Runs delivery and the cadence" },
    { roleKey: "contributor", description: "Executes tasks within phases" },
  ];
  // Stakeholder categories (identity-stripped — influence/interest only).
  const cats = new Set<string>();
  for (const st of bundle.stakeholders) {
    const inf = s(st.influence), int = s(st.interest);
    if (inf || int) cats.add(`stakeholder_${inf || "x"}_${int || "x"}`);
  }
  const stakeholderRoles = Array.from(cats).map((c) => ({ roleKey: c, description: "Stakeholder category (identity removed)" }));
  return [...base, ...stakeholderRoles];
}

function readmeMd(name: string, included: ExportEntity[]): string {
  return [
    `# Starter Blueprint — derived from ${name}`,
    "",
    "A **clean, reusable project template**. Execution history is reset: statuses are `planned`,",
    `owners are \`${ROLE_PLACEHOLDER}\` placeholders, dates are blank, and raw Project Memory,`,
    "transcripts and audit history are removed.",
    "",
    "## Included structure",
    ...included.map((e) => `- ${e}`),
    "",
    "Use `blueprint.json` to seed a new similar project, a simulation sandbox, or a comparison baseline.",
  ].join("\n");
}

function starterChecklistMd(name: string, phaseCount: number, taskCount: number): string {
  return [
    `# Setup checklist — ${name} (template)`,
    "",
    "1. Name the new project and set its real dates.",
    `2. Review the ${phaseCount} phase(s) and ${taskCount} task template(s); remove what does not apply.`,
    "3. Assign real owners to the `{{role}}` placeholders.",
    "4. Re-baseline estimates and the schedule.",
    "5. Review the risk templates and keep the relevant ones.",
    "6. Confirm the document checklist and governance/roles.",
  ].join("\n");
}

function importNotesMd(): string {
  return [
    "# Import notes",
    "",
    "- `blueprint.json` is the canonical, import-ready structure (schemaVersion " + EXPORT_SCHEMA_VERSION + ").",
    "- All statuses are reset to `planned`; all dates are blank; owners are role placeholders.",
    "- No raw Project Memory, transcripts, actual costs or audit history are included.",
    "- A future \"Create project from blueprint\" action can consume this file directly.",
  ].join("\n");
}
