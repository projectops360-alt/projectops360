"use server";

// ============================================================================
// ProjectOps Scribe — server actions (inside Project Memory)
// ============================================================================
// analyzeScribeAction: capture text → structured AI intelligence (no DB writes).
// saveScribeEntryAction: persist the capture as a project_memory_items entry +
// project_scribe_items, and — only for items the user approved — create the
// task/decision/risk and a traceability link. Human approval is required; the
// AI never creates entities on its own.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Locale } from "@/types/database";
import { analyzeScribeCapture, type ScribeAnalysis } from "@/lib/scribe/ai";

async function ctx() {
  try {
    const org = await getOrgContext();
    if (org.role === "viewer") return { error: "not_allowed" as const };
    return { org, supabase: createAdminClient() };
  } catch { return { error: "not_authenticated" as const }; }
}

const ALLOWED_SOURCE_TYPES = new Set([
  "manual_note", "pasted_transcript", "voice_dictation",
  "meeting_note", "field_update", "client_conversation", "status_update",
]);

// ── Analyze ───────────────────────────────────────────────────────────────────

export async function analyzeScribeAction(input: { projectId: string; text: string; locale: string }): Promise<{ error?: string; analysis?: ScribeAnalysis }> {
  const c = await ctx();
  if ("error" in c) return { error: c.error };
  if (!input.text?.trim()) return { error: "empty" };
  const analysis = await analyzeScribeCapture(c.org, input.projectId, input.text, (input.locale === "es" ? "es" : "en") as Locale);
  if (!analysis.summary && analysis.items.length === 0) return { error: "ai_failed" };
  return { analysis };
}

// ── Save ──────────────────────────────────────────────────────────────────────

export interface ScribeItemInput {
  item_type: string;
  description: string;
  suggested_owner: string | null;
  suggested_due_date: string | null;
  confidence: number | null;
  source_excerpt: string;
  proposed_action: string;
  status: string; // suggested | approved | edited | rejected
  needs_review?: boolean;
  extra?: Record<string, unknown>;
}

const PROBABILITY = new Set(["low", "medium", "high"]);
const SEVERITY = new Set(["low", "medium", "high", "critical"]);
const lvl = (v: unknown, set: Set<string>, dflt: string) => {
  const s = String(v ?? "").toLowerCase().trim();
  return set.has(s) ? s : dflt;
};

/** Create the real project entity for an approved item. Returns the entity ref. */
async function createEntityForItem(
  supabase: ReturnType<typeof createAdminClient>,
  org: { organizationId: string; userId: string },
  projectId: string,
  lang: string,
  it: ScribeItemInput,
): Promise<{ type: string; id: string } | null> {
  const title = it.description.slice(0, 300);
  if (it.item_type === "action_item") {
    const { data } = await supabase.from("roadmap_tasks").insert({
      organization_id: org.organizationId, project_id: projectId,
      title, status: "not_started", priority: "p2", order_index: 0,
      end_date: it.suggested_due_date || null,
      description: it.suggested_owner ? `Owner: ${it.suggested_owner}` : null,
    }).select("id").single();
    return data ? { type: "task", id: String(data.id) } : null;
  }
  if (it.item_type === "decision") {
    const { data } = await supabase.from("decisions").insert({
      organization_id: org.organizationId, project_id: projectId,
      title_i18n: { [lang]: title }, status: "proposed",
      decision_maker: it.suggested_owner || null,
      source_type: "manual", created_by: org.userId,
    }).select("id").single();
    return data ? { type: "decision", id: String(data.id) } : null;
  }
  if (it.item_type === "risk") {
    const { data } = await supabase.from("risks").insert({
      organization_id: org.organizationId, project_id: projectId,
      title, category: "other",
      probability: lvl(it.extra?.probability, PROBABILITY, "medium"),
      impact: lvl(it.extra?.impact, SEVERITY, "medium"),
      severity: lvl(it.extra?.impact, SEVERITY, "medium"),
      status: "open", origin: "ai_suggested",
      confidence_score: it.confidence ?? null, needs_review: true,
    }).select("id").single();
    return data ? { type: "risk", id: String(data.id) } : null;
  }
  return null; // issue/blocker/dependency/project_impact/open_question/follow_up → memory-only in MVP
}

export async function saveScribeEntryAction(input: {
  projectId: string;
  sourceType: string;
  title: string;
  content: string;
  summary: string;
  detectedLanguage?: string;
  captureMethod?: string;
  items: ScribeItemInput[];
  createApproved: boolean;
  locale: string;
}): Promise<{ error?: string; memoryItemId?: string; created?: { tasks: number; decisions: number; risks: number } }> {
  const c = await ctx();
  if ("error" in c) return { error: c.error };
  const { org, supabase } = c;
  const lang = input.locale === "es" ? "es" : "en";
  const sourceType = ALLOWED_SOURCE_TYPES.has(input.sourceType) ? input.sourceType : "manual_note";
  const title = (input.title?.trim() || input.content.trim().slice(0, 80) || "ProjectOps Scribe").slice(0, 200);

  // 1. The capture entry → a Project Memory item (vectorized via processMemoryItem).
  const { data: entry, error: entryErr } = await supabase.from("project_memory_items").insert({
    organization_id: org.organizationId, project_id: input.projectId,
    title, content: input.content || null, summary: input.summary || null,
    source_type: sourceType, source_system: "projectops_scribe",
    importance_level: "medium", visibility: "project",
    occurred_at: new Date().toISOString(),
    ai_status: "skipped", index_status: "pending",
    metadata: {
      scribe: true,
      capture_method: input.captureMethod || sourceType,
      detected_language: input.detectedLanguage || lang,
      item_count: input.items.length,
    },
    created_by: org.userId,
  }).select("id").single();
  if (entryErr || !entry) return { error: "unexpected" };
  const memoryItemId = String(entry.id);

  const created = { tasks: 0, decisions: 0, risks: 0 };

  // 2. Persist every extracted item (rejected ones too, for audit).
  for (const it of input.items) {
    let createdRef: { type: string; id: string } | null = null;
    const approved = it.status === "approved" || it.status === "edited";
    if (input.createApproved && approved) {
      createdRef = await createEntityForItem(supabase, org, input.projectId, lang, it);
      if (createdRef) {
        if (createdRef.type === "task") created.tasks++;
        else if (createdRef.type === "decision") created.decisions++;
        else if (createdRef.type === "risk") created.risks++;
        // Traceability: memory entry → created entity.
        await supabase.from("traceability_links").insert({
          organization_id: org.organizationId,
          source_type: "memory", source_id: memoryItemId,
          target_type: createdRef.type, target_id: createdRef.id,
          link_type: "derived_from", created_by: org.userId,
        });
      }
    }
    await supabase.from("project_scribe_items").insert({
      organization_id: org.organizationId, project_id: input.projectId,
      memory_item_id: memoryItemId, item_type: it.item_type,
      description: it.description, suggested_owner: it.suggested_owner || null,
      suggested_due_date: it.suggested_due_date || null,
      confidence_score: it.confidence ?? null, source_excerpt: it.source_excerpt || null,
      proposed_action: it.proposed_action || null,
      status: createdRef ? "saved" : (it.status || "suggested"),
      created_entity_type: createdRef?.type ?? null,
      created_entity_id: createdRef?.id ?? null,
      metadata: { ...(it.extra ?? {}), needs_review: it.needs_review ?? null },
      created_by: org.userId,
    });
  }

  // 3. Vectorize the entry for semantic search (fire-and-forget).
  void import("@/lib/memory/service").then(({ processMemoryItem }) =>
    processMemoryItem(org, memoryItemId, { runClassification: false, locale: lang as Locale }).catch(() => {}),
  );

  await logAudit({ org, projectId: input.projectId, action: "create", entityType: "project_memory_items", entityId: memoryItemId, metadata: { scribe: true, source_type: sourceType, created } });
  return { memoryItemId, created };
}
