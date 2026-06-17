// ============================================================================
// ProjectOps360° — Project Charter service (server-only)
// ============================================================================
// Creates the empty charter on project creation, snapshots versions on
// approval, and pushes approved charter content into Project Memory (reusing
// project_memory_items + processMemoryItem vector indexing).
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import { CHARTER_SECTIONS, type CharterFieldKey } from "./fields";

type Supabase = ReturnType<typeof createAdminClient>;

export interface ProjectCharter {
  id: string;
  organization_id: string;
  project_id: string;
  title: string | null;
  version: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown; // the many text section columns
}

/** Idempotently create an empty draft charter for a project. Returns the id.
 *  Race-safe: uses an upsert that ignores duplicates (UNIQUE project_id), so
 *  concurrent requests (e.g. Next prefetch + real navigation) never collide. */
export async function createCharterForProject(
  supabase: Supabase, organizationId: string, projectId: string, userId: string, title: string | null,
): Promise<string | null> {
  await supabase
    .from("project_charters")
    .upsert(
      { organization_id: organizationId, project_id: projectId, title, version: 1, status: "draft", created_by: userId },
      { onConflict: "project_id", ignoreDuplicates: true },
    );

  const { data } = await supabase
    .from("project_charters").select("id")
    .eq("project_id", projectId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle();
  return data?.id ?? null;
}

export async function getCharterByProject(
  supabase: Supabase, organizationId: string, projectId: string,
): Promise<ProjectCharter | null> {
  const { data } = await supabase
    .from("project_charters").select("*")
    .eq("project_id", projectId).eq("organization_id", organizationId).is("deleted_at", null)
    .maybeSingle();
  return (data as ProjectCharter | null) ?? null;
}

/** Snapshot the current charter content into the version history. */
export async function snapshotCharterVersion(
  supabase: Supabase, charter: ProjectCharter, changeReason: string, userId: string,
): Promise<void> {
  await supabase.from("project_charter_versions").insert({
    organization_id: charter.organization_id,
    charter_id: charter.id,
    version: charter.version,
    snapshot_json: charter,
    change_reason: changeReason,
    created_by: userId,
  });
}

// ── Project Memory sync (on approval) ───────────────────────────────────────

/**
 * Persist the approved charter's sections into Project Memory and index them
 * for vector search / AI Q&A. Idempotent: previous charter memory items are
 * superseded. Best-effort (never throws).
 */
export async function syncCharterToMemory(
  org: OrgContext, projectId: string, locale: Locale,
): Promise<{ created: number }> {
  const supabase = createAdminClient();
  const charter = await getCharterByProject(supabase, org.organizationId, projectId);
  if (!charter) return { created: 0 };

  // Clear previous charter-sourced memory items.
  await supabase
    .from("project_memory_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .contains("metadata", { charter_id: charter.id })
    .is("deleted_at", null);

  const isEs = locale === "es";
  const items: Record<string, unknown>[] = [];
  const base = {
    organization_id: org.organizationId,
    project_id: projectId,
    author_name: org.displayName ?? null,
    visibility: "project",
    ai_status: "skipped",
    index_status: "pending",
    importance_level: "high",
    source_type: "document",
    source_system: "charter",
    created_by: org.userId,
  };

  for (const section of CHARTER_SECTIONS) {
    const lines = section.fields
      .map((f) => {
        const v = charter[f.key as CharterFieldKey];
        return v && String(v).trim() ? `${isEs ? f.es : f.en}: ${String(v).trim()}` : null;
      })
      .filter(Boolean);
    if (lines.length === 0) continue;
    const content = lines.join("\n");
    items.push({
      ...base,
      title: `${isEs ? "Charter" : "Charter"} — ${isEs ? section.es : section.en}`,
      content,
      summary: content.slice(0, 280),
      metadata: { charter_id: charter.id, kind: `project_${section.key}`, charter_version: charter.version },
    });
  }

  if (items.length === 0) return { created: 0 };

  const { data: inserted } = await supabase
    .from("project_memory_items").insert(items).select("id");

  void import("@/lib/memory/service").then(({ processMemoryItem }) => {
    for (const row of inserted ?? []) {
      processMemoryItem(org, row.id, { runClassification: false }).catch(() => {});
    }
  });

  return { created: inserted?.length ?? 0 };
}
