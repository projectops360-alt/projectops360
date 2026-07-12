// ============================================================================
// ProjectOps360° — Historical Backfill Service (Phase 2)
// ============================================================================
// Reconstructs historical project events from existing canonical owners and
// records them in project_event_log as SYNTHETIC_BACKFILL_EVENT via the Event
// Ingestion Service. Safe, idempotent, evidence- and confidence-aware.
//
// Principles: do NOT invent history. Only backfill what existing data supports.
// Every backfilled event is marked (provenance.backfilled) with reduced
// confidence when inferred. Never touches process_nodes / process_edges / the
// dual-write path. See docs/product-brain/historical-backfill-service.md.
// ============================================================================

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitProjectEvent, emitProjectEventSafe, validateProjectEvent, type EmitEventInput } from "./ingestion";

// ── Confidence model ─────────────────────────────────────────────────────────
export const BACKFILL_CONFIDENCE = {
  /** Reconstructed from an explicit audit/history record. */
  EXPLICIT_AUDIT: 1.0,
  /** Derived from a direct owner timestamp (created_at of the record). */
  OWNER_TIMESTAMP: 0.9,
  /** Inferred from the current row state (e.g. terminal status, current assignee). */
  INFERRED_CURRENT_STATE: 0.6,
} as const;

interface OwnerRowBase {
  id: string;
  organization_id: string;
  project_id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

function backfillProvenance(p: {
  sourceTable: string;
  sourceRecordId: string;
  sourceField: string;
  inferenceMethod: string;
  confidenceReason: string;
  batchId: string;
}): Record<string, unknown> {
  return {
    backfilled: true,
    source_table: p.sourceTable,
    source_record_id: p.sourceRecordId,
    source_field: p.sourceField,
    inference_method: p.inferenceMethod,
    confidence_reason: p.confidenceReason,
    backfilled_at: new Date().toISOString(),
    backfill_batch_id: p.batchId,
  };
}

const SYNTH = "SYNTHETIC_BACKFILL_EVENT" as const;

// ── Pure mappers (unit-tested; owner row → backfill events) ───────────────────

export function mapProjectToEvents(row: OwnerRowBase & { title_i18n?: unknown }, batchId: string): EmitEventInput[] {
  const occurredAt = row.created_at ?? undefined;
  if (!occurredAt) return [];
  return [{
    organizationId: row.organization_id, projectId: row.project_id,
    eventType: "ProjectCreated", subjectId: row.project_id, actorType: "system",
    occurredAt, sourceModule: "projects", sourceEntityType: "projects", sourceEntityId: row.id,
    lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.OWNER_TIMESTAMP,
    provenance: backfillProvenance({ sourceTable: "projects", sourceRecordId: row.id, sourceField: "created_at", inferenceMethod: "owner_timestamp", confidenceReason: "record creation timestamp", batchId }),
  }];
}

export function mapMilestoneToEvents(row: OwnerRowBase & { status?: string | null }, batchId: string): EmitEventInput[] {
  const out: EmitEventInput[] = [];
  const org = row.organization_id, proj = row.project_id;
  if (row.created_at) {
    out.push({ organizationId: org, projectId: proj, eventType: "MilestoneCreated", subjectId: row.id,
      actorType: "system", occurredAt: row.created_at, sourceModule: "roadmap", sourceEntityType: "milestones", sourceEntityId: row.id,
      lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.OWNER_TIMESTAMP,
      provenance: backfillProvenance({ sourceTable: "milestones", sourceRecordId: row.id, sourceField: "created_at", inferenceMethod: "owner_timestamp", confidenceReason: "record creation timestamp", batchId }) });
  }
  if (row.status === "completed" && row.updated_at) {
    out.push({ organizationId: org, projectId: proj, eventType: "MilestoneAchieved", subjectId: row.id,
      actorType: "system", occurredAt: row.updated_at, sourceModule: "roadmap", sourceEntityType: "milestones", sourceEntityId: row.id,
      lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.INFERRED_CURRENT_STATE,
      provenance: backfillProvenance({ sourceTable: "milestones", sourceRecordId: row.id, sourceField: "status", inferenceMethod: "inferred_from_current_status", confidenceReason: "current terminal status; exact achievement time unknown", batchId }) });
  }
  return out;
}

const TASK_TERMINAL = new Set(["done", "tested"]);

export function mapTaskToEvents(
  row: OwnerRowBase & { status?: string | null; assigned_to?: string | null; assigned_resource_id?: string | null; title?: string | null; milestone_id?: string | null },
  batchId: string,
): EmitEventInput[] {
  const out: EmitEventInput[] = [];
  const org = row.organization_id, proj = row.project_id;
  if (row.created_at) {
    out.push({ organizationId: org, projectId: proj, eventType: "TaskCreated", subjectId: row.id,
      actorType: "system", occurredAt: row.created_at, sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: row.id,
      payload: { title: row.title ?? "(untitled)", ...(row.milestone_id ? { milestone_id: row.milestone_id } : {}) },
      lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.OWNER_TIMESTAMP,
      provenance: backfillProvenance({ sourceTable: "roadmap_tasks", sourceRecordId: row.id, sourceField: "created_at", inferenceMethod: "owner_timestamp", confidenceReason: "record creation timestamp", batchId }) });
  }
  const assignee = row.assigned_to ?? row.assigned_resource_id ?? null;
  if (assignee) {
    out.push({ organizationId: org, projectId: proj, eventType: "TaskAssigned", subjectId: row.id,
      actorType: "system", occurredAt: row.updated_at ?? row.created_at ?? undefined, sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: row.id,
      payload: { assignee_ref: assignee },
      lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.INFERRED_CURRENT_STATE,
      provenance: backfillProvenance({ sourceTable: "roadmap_tasks", sourceRecordId: row.id, sourceField: "assigned_to", inferenceMethod: "inferred_from_current_assignee", confidenceReason: "current assignee; assignment time unknown", batchId }) });
  }
  if (row.status && TASK_TERMINAL.has(row.status) && row.updated_at) {
    out.push({ organizationId: org, projectId: proj, eventType: "TaskCompleted", subjectId: row.id,
      actorType: "system", occurredAt: row.updated_at, sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: row.id,
      lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.INFERRED_CURRENT_STATE,
      provenance: backfillProvenance({ sourceTable: "roadmap_tasks", sourceRecordId: row.id, sourceField: "status", inferenceMethod: "inferred_from_current_status", confidenceReason: "current terminal status; exact completion time unknown", batchId }) });
  }
  return out;
}

/**
 * P2-T2 / PD-018 §B.4 — the ONLY authorized risk reconstruction:
 * `risk_registered` from the risk row's created_at (high confidence). The
 * actor is recovered exclusively through the Scribe/import provenance chains
 * (`actorHint`); otherwise the event carries `missing_actor`. No other risk
 * transition is ever reconstructed (frozen guardrail: no invented history).
 */
export function mapRiskToEvents(
  row: OwnerRowBase & {
    origin?: string | null;
    title?: string | null;
    linked_task_id?: string | null;
    linked_milestone_id?: string | null;
  },
  batchId: string,
  actorHint?: { actorId: string; source: "scribe" | "import" } | null,
): EmitEventInput[] {
  if (!row.created_at) return [];
  const flags = ["backfilled", ...(actorHint ? [] : ["missing_actor"])];
  return [{
    organizationId: row.organization_id,
    projectId: row.project_id,
    eventType: "risk_registered",
    subjectId: row.id,
    actorType: "system",
    actorId: actorHint?.actorId ?? null,
    occurredAt: row.created_at,
    sourceModule: "risks",
    sourceEntityType: "risks",
    sourceEntityId: row.id,
    lifecycleClassOverride: SYNTH,
    confidence: BACKFILL_CONFIDENCE.OWNER_TIMESTAMP,
    payload: { origin: row.origin ?? "manual", ...(row.title ? { title: row.title } : {}) },
    provenance: {
      ...backfillProvenance({
        sourceTable: "risks", sourceRecordId: row.id, sourceField: "created_at",
        inferenceMethod: "owner_timestamp",
        confidenceReason: actorHint
          ? `record creation timestamp; actor recovered via ${actorHint.source} chain`
          : "record creation timestamp; registering actor not recorded on risks",
        batchId,
      }),
      capture_method: "derived",
      data_quality_flags: flags,
      ...(actorHint ? { actor_recovered_via: actorHint.source } : {}),
    },
    objectRefs: [
      { objectType: "risk", objectId: row.id, role: "focal" },
      { objectType: "project", objectId: row.project_id, role: "context" },
      ...(row.linked_milestone_id ? [{ objectType: "milestone", objectId: row.linked_milestone_id, role: "impacted" }] : []),
      ...(row.linked_task_id ? [{ objectType: "task", objectId: row.linked_task_id, role: "response" }] : []),
    ],
  }];
}

export function mapDependencyToEvents(
  row: { id?: string | null; organization_id: string; project_id: string; predecessor_id: string; successor_id: string; created_at?: string | null },
  batchId: string,
): EmitEventInput[] {
  if (!row.created_at) return [];
  return [{
    organizationId: row.organization_id, projectId: row.project_id, eventType: "TaskDependencyAdded",
    subjectId: row.successor_id, actorType: "system", occurredAt: row.created_at,
    sourceModule: "roadmap", sourceEntityType: "task_dependencies", sourceEntityId: row.id ?? row.successor_id,
    payload: { dependency_id: row.predecessor_id },
    lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.OWNER_TIMESTAMP,
    provenance: backfillProvenance({ sourceTable: "task_dependencies", sourceRecordId: row.id ?? `${row.predecessor_id}->${row.successor_id}`, sourceField: "created_at", inferenceMethod: "owner_timestamp", confidenceReason: "dependency creation timestamp", batchId }),
  }];
}

export function mapDecisionToEvents(row: OwnerRowBase, batchId: string): EmitEventInput[] {
  if (!row.created_at) return [];
  return [{
    organizationId: row.organization_id, projectId: row.project_id, eventType: "DecisionProposed",
    subjectId: row.id, actorType: "system", occurredAt: row.created_at,
    sourceModule: "decisions", sourceEntityType: "decisions", sourceEntityId: row.id,
    lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.OWNER_TIMESTAMP,
    provenance: backfillProvenance({ sourceTable: "decisions", sourceRecordId: row.id, sourceField: "created_at", inferenceMethod: "owner_timestamp", confidenceReason: "record creation timestamp", batchId }),
  }];
}

export function mapDocumentToEvents(row: OwnerRowBase, batchId: string): EmitEventInput[] {
  if (!row.created_at) return [];
  return [{
    organizationId: row.organization_id, projectId: row.project_id, eventType: "DocumentUploaded",
    subjectId: row.id, actorType: "system", occurredAt: row.created_at,
    sourceModule: "documents", sourceEntityType: "documents", sourceEntityId: row.id,
    lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.OWNER_TIMESTAMP,
    provenance: backfillProvenance({ sourceTable: "documents", sourceRecordId: row.id, sourceField: "created_at", inferenceMethod: "owner_timestamp", confidenceReason: "record creation timestamp", batchId }),
  }];
}

export function mapDrawingToEvents(row: OwnerRowBase, batchId: string): EmitEventInput[] {
  if (!row.created_at) return [];
  return [{
    organizationId: row.organization_id, projectId: row.project_id, eventType: "DrawingUploaded",
    subjectId: row.id, actorType: "system", occurredAt: row.created_at,
    sourceModule: "drawing", sourceEntityType: "drawing_files", sourceEntityId: row.id,
    lifecycleClassOverride: SYNTH, confidence: BACKFILL_CONFIDENCE.OWNER_TIMESTAMP,
    provenance: backfillProvenance({ sourceTable: "drawing_files", sourceRecordId: row.id, sourceField: "created_at", inferenceMethod: "owner_timestamp", confidenceReason: "record creation timestamp", batchId }),
  }];
}

// ── Batch report ─────────────────────────────────────────────────────────────

export interface BackfillReport {
  backfillBatchId: string;
  projectId: string;
  organizationId: string;
  startedAt: string;
  completedAt: string;
  status: "completed" | "failed" | "dry_run";
  sourceModulesProcessed: string[];
  eventsCreated: number;
  eventsSkipped: number; // deduped (idempotent re-run)
  eventsFailed: number;
  byType: Record<string, number>;
  confidenceDistribution: { high: number; medium: number; low: number };
  /** Running confidence stats for quality/replay reports. */
  confidenceStats: { count: number; sum: number; min: number; max: number };
  explicitEvents: number;
  inferredEvents: number;
  unsupportedSources: string[];
  warnings: string[];
  errorSummary: string[];
}

const EXPLICIT_THRESHOLD = 0.85;

function recordConfidence(report: BackfillReport, c: number | null | undefined) {
  const v = c ?? 0;
  if (v >= EXPLICIT_THRESHOLD) { report.confidenceDistribution.high++; report.explicitEvents++; }
  else if (v >= 0.6) { report.confidenceDistribution.medium++; report.inferredEvents++; }
  else { report.confidenceDistribution.low++; report.inferredEvents++; }
  const s = report.confidenceStats;
  s.count++; s.sum += v; s.min = Math.min(s.min, v); s.max = Math.max(s.max, v);
}

// ── Risk backfill — shared infra (P2-T2 remediation: decoupled from the runner) ─
// PD-018 §B.4 authorizes `risk_registered` reconstruction from the risk row's
// created_at. P2-T2 remediation moved this out of the shared backfillProject
// runner so it cannot run accidentally and is not counted as a P2-T2
// deliverable. This collector is shared infrastructure for a FUTURE explicit,
// separately-gated risk-backfill invocation only — it is NOT called by
// backfillProject (no active scanners). It reuses mapRiskToEvents and the
// Scribe/import actor-recovery chain.

export async function collectRiskBackfillEvents(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  organizationId: string,
  batchId: string,
): Promise<EmitEventInput[]> {
  const { isRiskEventCaptureEnabled } = await import("./risk-capture-flag");
  if (!isRiskEventCaptureEnabled(projectId)) return [];
  const { data } = await supabase
    .from("risks")
    .select("id, organization_id, project_id, created_at, updated_at, origin, title, linked_task_id, linked_milestone_id")
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  const rows = (data ?? []) as unknown as Parameters<typeof mapRiskToEvents>[0][];
  if (rows.length === 0) return [];

  // Actor recovery — exclusively via the Scribe/import provenance chains.
  const riskIds = rows.map((r) => r.id);
  const actorByRisk = new Map<string, { actorId: string; source: "scribe" | "import" }>();
  const { data: scribeRows } = await supabase
    .from("project_scribe_items")
    .select("created_entity_id, created_by")
    .eq("created_entity_type", "risk")
    .in("created_entity_id", riskIds);
  for (const s of (scribeRows ?? []) as { created_entity_id: string | null; created_by: string | null }[]) {
    if (s.created_entity_id && s.created_by) actorByRisk.set(s.created_entity_id, { actorId: s.created_by, source: "scribe" });
  }
  const { data: importRows } = await supabase
    .from("project_import_created_records")
    .select("entity_id, project_import_jobs(created_by)")
    .eq("entity_table", "risks")
    .in("entity_id", riskIds);
  for (const r of (importRows ?? []) as { entity_id: string; project_import_jobs: { created_by: string | null } | { created_by: string | null }[] | null }[]) {
    const job = Array.isArray(r.project_import_jobs) ? r.project_import_jobs[0] : r.project_import_jobs;
    if (r.entity_id && job?.created_by && !actorByRisk.has(r.entity_id)) {
      actorByRisk.set(r.entity_id, { actorId: job.created_by, source: "import" });
    }
  }
  return rows.flatMap((r) => mapRiskToEvents(r, batchId, actorByRisk.get(r.id) ?? null));
}

// ── Runner ───────────────────────────────────────────────────────────────────

type Scanner = { module: string; run: () => Promise<EmitEventInput[]> };

/**
 * Backfill a project's history into project_event_log. Idempotent (dedup key +
 * backfill marker), evidence/confidence-aware. Reads owners only; never touches
 * process_nodes/process_edges or the dual-write path.
 */
export interface BackfillRunOptions {
  dryRun?: boolean;
  /** Audit: the admin who triggered the run (null = system/script). */
  actorUserId?: string | null;
  /** Audit: why the run was executed. */
  reason?: string | null;
  /** Audit: correlates all projects of one console execution. */
  executionId?: string | null;
}

export async function backfillProject(
  projectId: string,
  organizationId: string,
  options: BackfillRunOptions = {},
): Promise<BackfillReport> {
  const batchId = randomUUID();
  const startedAt = new Date().toISOString();
  const supabase = createAdminClient();

  const report: BackfillReport = {
    backfillBatchId: batchId, projectId, organizationId, startedAt, completedAt: startedAt,
    status: options.dryRun ? "dry_run" : "completed",
    sourceModulesProcessed: [], eventsCreated: 0, eventsSkipped: 0, eventsFailed: 0,
    byType: {}, confidenceDistribution: { high: 0, medium: 0, low: 0 },
    confidenceStats: { count: 0, sum: 0, min: 1, max: 0 }, explicitEvents: 0, inferredEvents: 0,
    unsupportedSources: [], warnings: [], errorSummary: [],
  };

  const q = (table: string, cols: string) =>
    supabase.from(table).select(cols).eq("project_id", projectId).eq("organization_id", organizationId);

  const scanners: Scanner[] = [
    { module: "projects", run: async () => {
      const { data } = await supabase.from("projects").select("id, organization_id, project_id:id, created_at").eq("id", projectId).eq("organization_id", organizationId).maybeSingle();
      const row = data as unknown as OwnerRowBase | null;
      return row ? mapProjectToEvents({ ...row, project_id: projectId }, batchId) : [];
    } },
    { module: "milestones", run: async () => {
      const { data } = await q("milestones", "id, organization_id, project_id, created_at, updated_at, status").is("deleted_at", null);
      return ((data ?? []) as unknown as (OwnerRowBase & { status?: string | null })[]).flatMap((r) => mapMilestoneToEvents(r, batchId));
    } },
    { module: "roadmap_tasks", run: async () => {
      const { data } = await q("roadmap_tasks", "id, organization_id, project_id, created_at, updated_at, status, assigned_to, assigned_resource_id, title, milestone_id").is("deleted_at", null);
      return ((data ?? []) as unknown as Parameters<typeof mapTaskToEvents>[0][]).flatMap((r) => mapTaskToEvents(r, batchId));
    } },
    { module: "task_dependencies", run: async () => {
      const { data } = await q("task_dependencies", "id, organization_id, project_id, predecessor_id, successor_id, created_at");
      return ((data ?? []) as unknown as Parameters<typeof mapDependencyToEvents>[0][]).flatMap((r) => mapDependencyToEvents(r, batchId));
    } },
    { module: "decisions", run: async () => {
      const { data } = await q("decisions", "id, organization_id, project_id, created_at").is("deleted_at", null);
      return ((data ?? []) as unknown as OwnerRowBase[]).flatMap((r) => mapDecisionToEvents(r, batchId));
    } },
    { module: "documents", run: async () => {
      const { data } = await q("documents", "id, organization_id, project_id, created_at").is("deleted_at", null);
      return ((data ?? []) as unknown as OwnerRowBase[]).flatMap((r) => mapDocumentToEvents(r, batchId));
    } },
    { module: "drawing_files", run: async () => {
      const { data } = await q("drawing_files", "id, organization_id, project_id, created_at").is("deleted_at", null);
      return ((data ?? []) as unknown as OwnerRowBase[]).flatMap((r) => mapDrawingToEvents(r, batchId));
    } },
    // NOTE: the risk scanner is deliberately NOT part of this runner. P2-T2
    // remediation (PD-018) decoupled risk backfill from the shared backfillProject
    // runner so it can never run accidentally and is not counted as a P2-T2
    // deliverable. The shared-infra collector (collectRiskBackfillEvents below)
    // remains available for a future EXPLICIT, separately-gated risk backfill
    // invocation; it is flag-gated and not wired here (no active scanners).
  ];

  const events: EmitEventInput[] = [];
  for (const scanner of scanners) {
    try {
      const evs = await scanner.run();
      events.push(...evs);
      report.sourceModulesProcessed.push(scanner.module);
    } catch (err) {
      // Missing table/column (e.g. estrato C not present) → unsupported, not fatal.
      report.unsupportedSources.push(scanner.module);
      report.warnings.push(`${scanner.module}: unsupported (${(err as Error).message})`);
    }
  }

  // Deterministic ordering: occurred_at, then source module, then subject, then type.
  events.sort((a, b) =>
    (a.occurredAt ?? "").localeCompare(b.occurredAt ?? "") ||
    a.sourceModule.localeCompare(b.sourceModule) ||
    (a.subjectId ?? "").localeCompare(b.subjectId ?? "") ||
    a.eventType.localeCompare(b.eventType));

  if (options.dryRun) {
    for (const e of events) { report.byType[e.eventType] = (report.byType[e.eventType] ?? 0) + 1; recordConfidence(report, e.confidence); }
    report.completedAt = new Date().toISOString();
    return report;
  }

  for (const e of events) {
    // Defensive: never write an event that fails registry/governance validation.
    const v = validateProjectEvent(e);
    if (!v.ok) { report.eventsFailed++; report.errorSummary.push(`${e.eventType}: ${v.errors.join("; ")}`); continue; }
    const res = await emitProjectEvent(e);
    if (res.ok && res.deduped) report.eventsSkipped++;
    else if (res.ok) { report.eventsCreated++; report.byType[e.eventType] = (report.byType[e.eventType] ?? 0) + 1; recordConfidence(report, e.confidence); }
    else { report.eventsFailed++; report.errorSummary.push(`${e.eventType}: ${res.error}`); }
  }

  report.completedAt = new Date().toISOString();

  // Audit trail: record the batch as a real (immutable) system event with who/why.
  emitProjectEventSafe({
    organizationId, projectId, eventType: "BackfillCompleted", subjectId: projectId,
    actorType: options.actorUserId ? "human" : "system", actorId: options.actorUserId ?? null,
    sourceModule: "system",
    payload: {
      backfill_batch_id: batchId, execution_id: options.executionId ?? null,
      reason: options.reason ?? null,
      created: report.eventsCreated, skipped: report.eventsSkipped, failed: report.eventsFailed,
      modules: report.sourceModulesProcessed,
    },
    provenance: { backfill_batch_id: batchId, execution_id: options.executionId ?? null },
  });

  return report;
}
