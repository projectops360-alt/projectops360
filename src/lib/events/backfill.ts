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
