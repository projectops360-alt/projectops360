// ============================================================================
// ProjectOps360° — Evidence Provenance & Traceability (CAP / PD-012) — types
// ============================================================================
// Provenance answers "why does this work exist?" for every AI-derived project
// entity. It is a READ-ONLY PROJECTION over the canonical records that already
// store the source chain — it never forks the truth into a parallel table:
//   • project_scribe_items   — forward link: extraction → created_entity_*
//   • project_backlog_items  — reverse link: source_memory_item_id / scribe_item
//   • traceability_links     — polymorphic memory/meeting → decision/risk links
//   • decisions.source_type / source_record_id — meeting-derived decisions
//
// Everything here is DETERMINISTIC and record-backed. When a source cannot be
// resolved from a real record, provenance is reported as `unknown` / a gap —
// never inferred from text similarity (PD-012 protection rule).
//
// Pure types, no server imports — safe to import from a client component.
// ============================================================================

/** The kind of origin an entity was derived from (record-backed, never guessed). */
export type ProvenanceSourceType =
  | "scribe_voice_note" // ProjectOps Scribe — dictated/voice capture
  | "scribe_note" // ProjectOps Scribe — typed/pasted capture
  | "meeting" // Rythm / Meetings — decision/action extracted from a meeting
  | "manual" // explicitly created by a person (known origin, not AI-derived)
  | "import" // brought in by the Project Import wizard
  | "unknown"; // no source record exists → traceability gap

/** The kinds of project entities provenance is tracked for. */
export type ProvenanceTargetType =
  | "task"
  | "decision"
  | "risk"
  | "follow_up";

/** Per-source-type counts of the entities derived from that source. */
export interface ProvenanceCounts {
  tasks: number;
  decisions: number;
  risks: number;
  followUps: number;
}

/** Entities that exist but have no resolvable source record (gaps). */
export interface TraceabilityGaps {
  tasksWithoutSource: number;
  decisionsWithoutSource: number;
  risksWithoutSource: number;
}

/** Deterministic provenance roll-up for a whole project (TASK 7). */
export interface ProjectProvenanceSummary {
  projectId: string;
  /** Counts keyed by the human-facing source types we can resolve. */
  bySourceType: Partial<Record<ProvenanceSourceType, ProvenanceCounts>>;
  /** Convenience totals across every AI-derived source (scribe + meeting). */
  totals: {
    tasksFromScribe: number;
    decisionsFromScribe: number;
    risksFromScribe: number;
    tasksFromVoiceNotes: number;
    decisionsFromMeetings: number;
    aiDerivedTotal: number;
  };
  traceabilityGaps: TraceabilityGaps;
  /** ISO timestamp the summary was computed (for "Updated …"). */
  generatedAt: string;
}

/** A single resolved source record behind one entity (TASK 5). */
export interface EntityProvenance {
  found: boolean;
  /** The created entity this provenance describes. */
  entity: { type: ProvenanceTargetType; id: string; title: string | null };
  sourceType: ProvenanceSourceType;
  /** The literal fragment that supports the entity, when a record preserved one. */
  sourceExcerpt: string | null;
  /** The source record (memory note / meeting) the entity was derived from. */
  sourceRecord: {
    kind: "memory_item" | "meeting" | null;
    id: string | null;
    title: string | null;
    /** In-app route to open the source, when one exists. */
    href: string | null;
  };
  /** Human review metadata captured at approval/creation time. */
  approval: {
    status: string | null; // suggested | approved | edited | rejected | saved
    approvedByName: string | null;
    approvedAt: string | null; // ISO
  };
  /** True when the entity looks AI-derived but the source could not be fully resolved. */
  provenanceIncomplete: boolean;
}

/** Result wrapper for the project-summary service (mirrors ProjectBriefingResult). */
export type ProjectProvenanceResult =
  | { ok: true; summary: ProjectProvenanceSummary }
  | { ok: false; reason: "no_project" | "not_authorized" | "unavailable" };

/** Result wrapper for the single-entity provenance service. */
export type EntityProvenanceResult =
  | { ok: true; provenance: EntityProvenance }
  | { ok: false; reason: "no_entity" | "not_authorized" | "unavailable" };
