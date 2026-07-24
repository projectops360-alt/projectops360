// ============================================================================
// PMO Process Intelligence — pure case mapping (CAP-047 · M4)
// ============================================================================
// Turns PEG event rows into module cases for the flow projection. Two real
// framings (never artificial case ids — PD-018 §0.4):
//   organization level → case = project (the project's journey)
//   project level      → case = business object journey (subject_type:id)
// Pure: no I/O, deterministic, inputs never mutated.
// ============================================================================

import type { PmoPiCase, PmoPiEventRecord } from "./contracts";

/** Raw row shape read from project_event_log (adapter maps 1:1). */
export interface PmoPiEventRow {
  event_id: string;
  organization_id: string;
  project_id: string;
  event_type: string;
  event_category: string;
  occurred_at: string;
  recorded_at: string;
  event_lifecycle_class: string;
  is_compensating_event: boolean;
  subject_type: string;
  subject_id: string;
  actor_type: string;
  source_module: string | null;
}

export function toEventRecord(row: PmoPiEventRow, caseId: string): PmoPiEventRecord {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    eventCategory: row.event_category,
    occurredAt: row.occurred_at,
    lifecycleClass: row.event_lifecycle_class,
    isCompensatingEvent: row.is_compensating_event,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    actorType: row.actor_type,
    recordedAt: row.recorded_at,
    sourceModule: row.source_module ?? "unknown",
  };
}

/** Organization level: one case per project (the project journey). */
export function casesByProject(
  rows: readonly PmoPiEventRow[],
  projects: readonly { id: string; label: string; outcome: PmoPiCase["outcome"] }[],
): PmoPiCase[] {
  const byProject = new Map<string, PmoPiEventRecord[]>();
  for (const row of rows) {
    const list = byProject.get(row.project_id) ?? [];
    list.push(toEventRecord(row, row.project_id));
    byProject.set(row.project_id, list);
  }
  return projects.map((p) => ({
    caseId: p.id,
    caseLabel: p.label,
    organizationId: rows[0]?.organization_id ?? "",
    projectId: p.id,
    events: byProject.get(p.id) ?? [],
    outcome: p.outcome,
  }));
}

/**
 * Project level (drill-down): one case per business object journey inside the
 * project. Outcome is "open" — object-level outcomes are not inferred.
 */
export function casesBySubject(rows: readonly PmoPiEventRow[], projectId: string): PmoPiCase[] {
  const bySubject = new Map<string, PmoPiEventRecord[]>();
  for (const row of rows) {
    if (row.project_id !== projectId) continue;
    const caseId = `${row.subject_type}:${row.subject_id}`;
    const list = bySubject.get(caseId) ?? [];
    list.push(toEventRecord(row, caseId));
    bySubject.set(caseId, list);
  }
  return [...bySubject.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([caseId, events]) => ({
      caseId,
      caseLabel: caseId,
      organizationId: events[0]?.organizationId ?? "",
      projectId,
      events,
      outcome: "open" as const,
    }));
}
