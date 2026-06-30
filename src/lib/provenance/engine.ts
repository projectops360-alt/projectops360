// ============================================================================
// ProjectOps360° — Evidence Provenance engine (PURE, no DB/server imports)
// ============================================================================
// Deterministic classification + aggregation. Everything here is unit-testable
// without a database: the service layer resolves real records and hands this
// engine normalized rows; the engine never invents a source.
// ============================================================================

import type {
  EntityProvenance,
  ProvenanceCounts,
  ProvenanceSourceType,
  ProvenanceTargetType,
  ProjectProvenanceSummary,
  TraceabilityGaps,
} from "./types";

/** project_memory_items.source_type values that mean "dictated / spoken". */
const VOICE_SOURCE_TYPES = new Set(["voice_dictation"]);

/**
 * Classify the human-facing provenance source from a memory item produced by
 * ProjectOps Scribe. Voice dictation → voice note; every other Scribe capture
 * method → a typed/pasted note. A non-Scribe memory item falls back to
 * `scribe_note` only when the system explicitly marks it as a Scribe capture.
 */
export function classifyScribeSource(
  memorySourceType: string | null | undefined,
  sourceSystem: string | null | undefined,
): ProvenanceSourceType {
  if (VOICE_SOURCE_TYPES.has(String(memorySourceType ?? ""))) return "scribe_voice_note";
  // Anything else captured through ProjectOps Scribe is a typed/pasted note.
  if (String(sourceSystem ?? "") === "projectops_scribe") return "scribe_note";
  // Captured into Project Memory but not via Scribe — still note-like.
  return "scribe_note";
}

/** Map a project_scribe_items.item_type to the project entity it represents. */
export function scribeItemTypeToTarget(itemType: string): ProvenanceTargetType | null {
  switch (itemType) {
    case "action_item":
      return "task";
    case "decision":
      return "decision";
    case "risk":
      return "risk";
    case "issue":
    case "blocker":
    case "dependency":
    case "project_impact":
    case "open_question":
    case "follow_up":
      return "follow_up";
    default:
      return null;
  }
}

const emptyCounts = (): ProvenanceCounts => ({ tasks: 0, decisions: 0, risks: 0, followUps: 0 });

function addToCounts(counts: ProvenanceCounts, target: ProvenanceTargetType): void {
  if (target === "task") counts.tasks += 1;
  else if (target === "decision") counts.decisions += 1;
  else if (target === "risk") counts.risks += 1;
  else if (target === "follow_up") counts.followUps += 1;
}

/** One normalized Scribe-derived entity the engine aggregates. */
export interface ScribeDerivedRow {
  sourceType: ProvenanceSourceType; // scribe_voice_note | scribe_note
  targetType: ProvenanceTargetType; // task | decision | risk | follow_up
  /** A created entity id, or null when the extraction stayed memory-only. */
  createdEntityId: string | null;
  /** Review status (approved/edited/saved counted as realized; rejected excluded). */
  status: string;
}

/** Meeting-derived counts (decisions/actions extracted from Rythm/Meetings). */
export interface MeetingDerivedCounts {
  tasks: number;
  decisions: number;
  risks: number;
  followUps: number;
}

export interface BuildSummaryInput {
  projectId: string;
  scribe: ScribeDerivedRow[];
  meeting: MeetingDerivedCounts;
  gaps: TraceabilityGaps;
  /** Injected for deterministic tests; defaults to now(). */
  now?: string;
}

const REALIZED = new Set(["approved", "edited", "saved"]);

/**
 * Build the deterministic project provenance summary. A Scribe row counts toward
 * a source only when it actually produced a project entity (`createdEntityId`);
 * rejected/never-created extractions never inflate the numbers.
 */
export function buildProvenanceSummary(input: BuildSummaryInput): ProjectProvenanceSummary {
  const bySourceType: Partial<Record<ProvenanceSourceType, ProvenanceCounts>> = {};

  for (const row of input.scribe) {
    if (!row.createdEntityId) continue; // memory-only extraction — not a derived entity
    if (!REALIZED.has(row.status)) continue; // rejected/suggested — not realized
    const bucket = (bySourceType[row.sourceType] ??= emptyCounts());
    addToCounts(bucket, row.targetType);
  }

  const meetingHasAny =
    input.meeting.tasks + input.meeting.decisions + input.meeting.risks + input.meeting.followUps > 0;
  if (meetingHasAny) {
    bySourceType.meeting = {
      tasks: input.meeting.tasks,
      decisions: input.meeting.decisions,
      risks: input.meeting.risks,
      followUps: input.meeting.followUps,
    };
  }

  const voice = bySourceType.scribe_voice_note ?? emptyCounts();
  const note = bySourceType.scribe_note ?? emptyCounts();
  const meeting = bySourceType.meeting ?? emptyCounts();

  const sum = (c: ProvenanceCounts) => c.tasks + c.decisions + c.risks + c.followUps;

  return {
    projectId: input.projectId,
    bySourceType,
    totals: {
      tasksFromScribe: voice.tasks + note.tasks,
      decisionsFromScribe: voice.decisions + note.decisions,
      risksFromScribe: voice.risks + note.risks,
      tasksFromVoiceNotes: voice.tasks,
      decisionsFromMeetings: meeting.decisions,
      aiDerivedTotal: sum(voice) + sum(note) + sum(meeting),
    },
    traceabilityGaps: input.gaps,
    generatedAt: input.now ?? new Date().toISOString(),
  };
}

/**
 * Render a compact, DETERMINISTIC provenance-facts block for Isabella's prompt.
 * Every line is record-backed. The model is instructed (via the provenance
 * Knowledge Package) to use these numbers verbatim and to say the source is
 * UNKNOWN when a fact is absent — it must never infer a source from text.
 */
export function formatProvenanceForPrompt(
  summary: ProjectProvenanceSummary | null,
  entity: EntityProvenance | null,
  locale: "en" | "es",
): string {
  const es = locale === "es";
  const lines: string[] = [];
  lines.push(
    es
      ? "DATOS DE PROCEDENCIA (deterministas, respaldados por registros — usa estos números exactos; nunca inventes una fuente):"
      : "PROVENANCE FACTS (deterministic, record-backed — use these exact numbers; never invent a source):",
  );

  if (summary) {
    const t = summary.totals;
    lines.push(
      es
        ? `- Tareas derivadas de notas de voz (ProjectOps Scribe): ${t.tasksFromVoiceNotes}`
        : `- Tasks derived from ProjectOps Scribe voice notes: ${t.tasksFromVoiceNotes}`,
    );
    lines.push(
      es
        ? `- Tareas derivadas de Scribe (voz + texto): ${t.tasksFromScribe}`
        : `- Tasks derived from Scribe (voice + typed): ${t.tasksFromScribe}`,
    );
    lines.push(
      es
        ? `- Decisiones derivadas de Scribe: ${t.decisionsFromScribe}`
        : `- Decisions derived from Scribe: ${t.decisionsFromScribe}`,
    );
    lines.push(
      es
        ? `- Riesgos derivados de Scribe: ${t.risksFromScribe}`
        : `- Risks derived from Scribe: ${t.risksFromScribe}`,
    );
    lines.push(
      es
        ? `- Decisiones derivadas de reuniones (Rythm): ${t.decisionsFromMeetings}`
        : `- Decisions derived from Rythm meetings: ${t.decisionsFromMeetings}`,
    );
    lines.push(
      es
        ? `- Total de entidades derivadas por IA: ${t.aiDerivedTotal}`
        : `- Total AI-derived entities: ${t.aiDerivedTotal}`,
    );
    const g = summary.traceabilityGaps;
    lines.push(
      es
        ? `- Brechas de trazabilidad: ${g.tasksWithoutSource} tareas, ${g.decisionsWithoutSource} decisiones, ${g.risksWithoutSource} riesgos sin fuente resoluble.`
        : `- Traceability gaps: ${g.tasksWithoutSource} tasks, ${g.decisionsWithoutSource} decisions, ${g.risksWithoutSource} risks without a resolvable source.`,
    );
  }

  if (entity) {
    lines.push("");
    if (!entity.found || entity.sourceType === "unknown") {
      lines.push(
        es
          ? `- El ítem seleccionado (${entity.entity.type}) NO tiene un registro de fuente vinculado — di que el origen es desconocido y márcalo como brecha de trazabilidad. No infieras la fuente.`
          : `- The selected item (${entity.entity.type}) has NO linked source record — say the source is unknown and flag it as a traceability gap. Do not infer the source.`,
      );
    } else {
      const src = sourceTypeLabel(entity.sourceType, locale);
      const parts: string[] = [];
      parts.push(
        es
          ? `- El ${entity.entity.type} seleccionado${entity.entity.title ? ` "${entity.entity.title}"` : ""} se derivó de: ${src}.`
          : `- The selected ${entity.entity.type}${entity.entity.title ? ` "${entity.entity.title}"` : ""} was derived from: ${src}.`,
      );
      if (entity.sourceRecord.title) {
        parts.push(es ? `Registro fuente: "${entity.sourceRecord.title}".` : `Source record: "${entity.sourceRecord.title}".`);
      }
      if (entity.approval.approvedByName) {
        parts.push(
          es
            ? `Aprobado por ${entity.approval.approvedByName}${entity.approval.approvedAt ? ` el ${entity.approval.approvedAt.slice(0, 10)}` : ""}.`
            : `Approved by ${entity.approval.approvedByName}${entity.approval.approvedAt ? ` on ${entity.approval.approvedAt.slice(0, 10)}` : ""}.`,
        );
      }
      if (entity.sourceExcerpt) {
        parts.push(es ? `Extracto de la fuente: "${entity.sourceExcerpt}".` : `Source excerpt: "${entity.sourceExcerpt}".`);
      }
      if (entity.provenanceIncomplete) {
        parts.push(
          es
            ? `(Procedencia incompleta: parte del registro de fuente no pudo resolverse.)`
            : `(Provenance incomplete: part of the source record could not be resolved.)`,
        );
      }
      lines.push(parts.join(" "));
    }
  }

  return lines.join("\n");
}

/** Human-facing label for a source type, bilingual. */
export function sourceTypeLabel(source: ProvenanceSourceType, locale: "en" | "es"): string {
  const es = locale === "es";
  switch (source) {
    case "scribe_voice_note":
      return es ? "Nota de voz (ProjectOps Scribe)" : "ProjectOps Scribe voice note";
    case "scribe_note":
      return es ? "Nota de ProjectOps Scribe" : "ProjectOps Scribe note";
    case "meeting":
      return es ? "Reunión (Rythm)" : "Meeting (Rythm)";
    case "manual":
      return es ? "Creado manualmente" : "Created manually";
    case "import":
      return es ? "Importado" : "Imported";
    case "unknown":
    default:
      return es ? "Origen desconocido" : "Unknown source";
  }
}
