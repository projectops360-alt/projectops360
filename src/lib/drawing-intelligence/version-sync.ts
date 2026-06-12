// ============================================================================
// ProjectOps360° — Drawing Version Sync & Delta Detection (Prompt 5)
// ============================================================================
// When a file finishes processing, finds the previous version of the same
// drawing (project + drawing_number), builds a metadata/text-based delta,
// records drawing_versions, supersedes the old file, generates an
// evidence-backed version_change insight and links the Living Graph.
// Visual page diffing is deliberately out of scope (future).
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { emitProcessNode, emitProcessEdge } from "@/lib/graph/emit-event";

// ── Pure delta builder (testable) ─────────────────────────────────────────────

export interface VersionSnapshot {
  revision: string | null;
  totalPages: number | null;
  /** Note texts from the canonical extraction */
  noteTexts: string[];
}

export interface VersionDelta {
  changed: boolean;
  revisionChanged: boolean;
  pageCountDelta: number | null;
  newNotes: string[];
  removedNotes: string[];
  summary: string;
}

export function buildVersionDelta(previous: VersionSnapshot, current: VersionSnapshot): VersionDelta {
  const revisionChanged =
    (previous.revision ?? "") !== (current.revision ?? "") && current.revision != null;

  const pageCountDelta =
    previous.totalPages != null && current.totalPages != null
      ? current.totalPages - previous.totalPages
      : null;

  const previousSet = new Set(previous.noteTexts.map((n) => n.trim().toLowerCase()));
  const currentSet = new Set(current.noteTexts.map((n) => n.trim().toLowerCase()));
  const newNotes = current.noteTexts.filter((n) => !previousSet.has(n.trim().toLowerCase()));
  const removedNotes = previous.noteTexts.filter((n) => !currentSet.has(n.trim().toLowerCase()));

  const parts: string[] = [];
  if (revisionChanged) parts.push(`revision ${previous.revision ?? "—"} → ${current.revision}`);
  if (pageCountDelta) parts.push(`${pageCountDelta > 0 ? "+" : ""}${pageCountDelta} page(s)`);
  if (newNotes.length > 0) parts.push(`${newNotes.length} new note(s)`);
  if (removedNotes.length > 0) parts.push(`${removedNotes.length} removed note(s)`);

  return {
    changed: parts.length > 0,
    revisionChanged,
    pageCountDelta,
    newNotes: newNotes.slice(0, 50),
    removedNotes: removedNotes.slice(0, 50),
    summary: parts.join(", ") || "no metadata-level changes detected",
  };
}

// ── Snapshot extraction from drawing_files.metadata ───────────────────────────

interface CanonicalLike {
  pages?: { notes?: { text?: string }[] }[];
}

export function snapshotFromFile(file: {
  revision: string | null;
  metadata: Record<string, unknown>;
}): VersionSnapshot {
  const canonical = (file.metadata?.canonical_extraction ?? {}) as CanonicalLike;
  const noteTexts = (canonical.pages ?? [])
    .flatMap((page) => page.notes ?? [])
    .map((note) => String(note.text ?? ""))
    .filter((text) => text.length > 0);
  const totalPages =
    typeof file.metadata?.total_pages === "number" ? (file.metadata.total_pages as number) : null;
  return { revision: file.revision, totalPages, noteTexts };
}

// ── Version sync service ──────────────────────────────────────────────────────

export interface VersionSyncResult {
  versionRecorded: boolean;
  previousFileId: string | null;
  summary: string | null;
}

export async function syncDrawingVersion(input: {
  fileId: string;
  organizationId: string;
  projectId: string;
}): Promise<VersionSyncResult> {
  const supabase = createAdminClient();
  const { fileId, organizationId, projectId } = input;

  const { data: current } = await supabase
    .from("drawing_files")
    .select("*")
    .eq("id", fileId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single();
  if (!current?.drawing_number) {
    return { versionRecorded: false, previousFileId: null, summary: null };
  }

  // Previous version: same project + drawing number, older, still active
  const { data: previous } = await supabase
    .from("drawing_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("organization_id", organizationId)
    .eq("drawing_number", current.drawing_number)
    .eq("status", "active")
    .neq("id", fileId)
    .is("deleted_at", null)
    .lt("created_at", current.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!previous) {
    return { versionRecorded: false, previousFileId: null, summary: null };
  }

  const delta = buildVersionDelta(snapshotFromFile(previous), snapshotFromFile(current));

  // Idempotency: one drawing_versions record per (file, previous) pair
  const { data: existingVersion } = await supabase
    .from("drawing_versions")
    .select("id")
    .eq("drawing_file_id", fileId)
    .eq("previous_drawing_file_id", previous.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (!existingVersion) {
    await supabase.from("drawing_versions").insert({
      organization_id: organizationId,
      project_id: projectId,
      drawing_file_id: fileId,
      previous_drawing_file_id: previous.id,
      drawing_number: current.drawing_number,
      previous_revision: previous.revision,
      current_revision: current.revision,
      changed_pages_json: delta.pageCountDelta != null ? [{ page_count_delta: delta.pageCountDelta }] : [],
      detected_deltas_json: [
        ...(delta.revisionChanged ? [{ type: "revision_change", from: previous.revision, to: current.revision }] : []),
        ...delta.newNotes.map((text) => ({ type: "new_note", text })),
        ...delta.removedNotes.map((text) => ({ type: "removed_note", text })),
      ],
      summary: delta.summary,
    });
  }

  // Supersede the previous file
  await supabase.from("drawing_files").update({ status: "superseded" }).eq("id", previous.id);

  // Version-change insight (evidence-backed, needs review before field work)
  const insightTitle = `Drawing ${current.drawing_number} changed from ${previous.revision ?? "previous version"} to ${current.revision ?? "new version"}`;
  const { data: dupInsight } = await supabase
    .from("drawing_insights")
    .select("id")
    .eq("drawing_file_id", fileId)
    .eq("insight_type", "version_change")
    .eq("title", insightTitle)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (!dupInsight) {
    const { data: insight } = await supabase
      .from("drawing_insights")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        drawing_file_id: fileId,
        insight_type: "version_change",
        title: insightTitle,
        description: `${delta.summary}. Human review recommended before field execution${delta.newNotes.length > 0 ? `; ${delta.newNotes.length} new note(s) may affect active work` : ""}.`,
        severity: delta.newNotes.length > 0 ? "high" : "medium",
        confidence_score: 0.9, // metadata comparison is deterministic
        evidence_json: {
          evidence: [
            {
              page_number: 1,
              text_excerpt: `rev ${previous.revision ?? "—"} → ${current.revision ?? "—"}; ${delta.summary}`,
            },
          ],
          payload: {
            previous_file_id: previous.id,
            page_count_delta: delta.pageCountDelta,
            new_notes: delta.newNotes.slice(0, 10),
          },
        },
        recommended_action: "compare_against_previous_revision",
        status: "in_review",
      })
      .select("id")
      .single();

    // Living Graph: insight node + drawing → insight edge
    if (insight) {
      const drawingNodeId = await findDrawingNode(supabase, projectId, fileId);
      const insightNodeId = await emitProcessNode({
        organizationId,
        projectId,
        nodeType: "drawing_insight",
        sourceEntityType: "drawing_insights",
        sourceEntityId: insight.id,
        title: insightTitle.slice(0, 120),
        metadata: { insight_type: "version_change", severity: "high", risk_level: "high" },
      });
      if (drawingNodeId && insightNodeId) {
        await emitProcessEdge({
          organizationId,
          projectId,
          fromNodeId: drawingNodeId,
          toNodeId: insightNodeId,
          edgeType: "generated_insight",
          metadata: { relationship: "drawing_revision_impacts_work" },
        });
      }
    }
  }

  return { versionRecorded: true, previousFileId: previous.id, summary: delta.summary };
}

async function findDrawingNode(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  fileId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("process_nodes")
    .select("id")
    .eq("project_id", projectId)
    .eq("source_entity_type", "drawing_files")
    .eq("source_entity_id", fileId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
