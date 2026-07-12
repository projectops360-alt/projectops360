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
import { captureRiskRegisteredAtomic } from "@/lib/events/risk-events";
import type { Locale } from "@/types/database";
import { analyzeScribeCapture, type ScribeAnalysis } from "@/lib/scribe/ai";

async function ctx(projectId: string) {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" as const };
  }
  const supabase = createAdminClient();
  // Verify the project belongs to the caller's organization.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) return { error: "forbidden" as const };
  return { org, supabase };
}

const ALLOWED_SOURCE_TYPES = new Set([
  "manual_note", "pasted_transcript", "voice_dictation",
  "meeting_note", "field_update", "client_conversation", "status_update",
]);

// ── Analyze ───────────────────────────────────────────────────────────────────

export async function analyzeScribeAction(input: { projectId: string; text: string; locale: string }): Promise<{ error?: string; analysis?: ScribeAnalysis }> {
  const c = await ctx(input.projectId);
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

// ── Owner → project member matching ─────────────────────────────────────────────
// Maps an AI-extracted owner name ("Diego") to a real assignee so the created task
// is actually assigned, instead of only carrying the name in its description.
export interface OwnerMatch { teamMemberId: string | null; userId: string | null; displayName: string }

/** True when every token of the query appears as a token of the candidate name
 *  (so "Diego" matches "Diego Torres", and "Diego Torres" matches itself). */
function nameMatches(candidate: string, q: string): boolean {
  const c = candidate.toLowerCase().trim();
  if (!c) return false;
  if (c === q) return true;
  const cTokens = new Set(c.split(/\s+/));
  const qTokens = q.split(/\s+/).filter(Boolean);
  return qTokens.length > 0 && qTokens.every((t) => cTokens.has(t));
}

/** Load project people once and return a resolver from an owner name to an assignee. */
async function buildOwnerResolver(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  projectId: string,
): Promise<(owner: string | null) => OwnerMatch | null> {
  const [teamRes, profRes] = await Promise.all([
    supabase.from("project_team_members").select("id, display_name, user_id").eq("project_id", projectId).eq("organization_id", organizationId).neq("status", "removed"),
    supabase.from("profiles").select("id, display_name").eq("organization_id", organizationId),
  ]);
  const profiles = (profRes.data ?? []) as { id: string; display_name: string | null }[];
  const nameByUser = new Map(profiles.map((p) => [p.id, p.display_name || ""]));
  const members = ((teamRes.data ?? []) as { id: string; display_name: string | null; user_id: string | null }[])
    .map((m) => ({ teamMemberId: m.id, userId: m.user_id, name: (m.display_name || (m.user_id ? nameByUser.get(m.user_id) || "" : "")).trim() }))
    .filter((m) => m.name);

  return (owner: string | null): OwnerMatch | null => {
    const q = (owner ?? "").toLowerCase().trim();
    if (!q) return null;
    const tm = members.find((m) => nameMatches(m.name, q));
    if (tm) return { teamMemberId: tm.teamMemberId, userId: tm.userId, displayName: tm.name };
    const p = profiles.find((p) => nameMatches(p.display_name || "", q));
    if (p) return { teamMemberId: null, userId: p.id, displayName: p.display_name || owner! };
    return null;
  };
}

/** Create the real project entity for an approved item. Returns the entity ref. */
async function createEntityForItem(
  supabase: ReturnType<typeof createAdminClient>,
  org: { organizationId: string; userId: string },
  projectId: string,
  lang: string,
  it: ScribeItemInput,
  resolveOwner: (owner: string | null) => OwnerMatch | null,
  frameworkId: string | null,
  memoryItemId: string,
): Promise<{ type: string; id: string } | null> {
  const title = it.description.slice(0, 300);
  if (it.item_type === "action_item") {
    const match = resolveOwner(it.suggested_owner);
    // A captured action enters the Refinement stage as a work item (it is NOT a
    // task yet — it gets refined, then promoted to the Backlog/Workboard). Owner
    // and due date are stored on real columns (owner_id, due_date); the
    // description carries the AI detail so nothing captured is lost.
    const sourceLabel = lang === "es" ? "Origen (Scribe)" : "Source (Scribe)";
    const details = typeof it.extra?.details === "string" ? it.extra.details.trim() : "";
    const parts: string[] = [];
    if (details) parts.push(details);
    if (it.source_excerpt) parts.push(`${sourceLabel}: "${it.source_excerpt}"`);
    const PR = new Set(["High", "Medium", "Low"]);
    const rawPriority = typeof it.extra?.priority === "string" ? it.extra.priority.trim() : "";
    const priority = PR.has(rawPriority) ? rawPriority : "Medium";
    const { data } = await supabase.from("project_backlog_items").insert({
      organization_id: org.organizationId, project_id: projectId, framework_id: frameworkId,
      title, description: parts.length ? parts.join("\n\n") : null,
      item_type: "Task", priority,
      status: "backlog", refinement_status: "new",
      owner_id: match?.userId ?? null,
      due_date: it.suggested_due_date || null,
      source: "projectops_scribe",
      source_reference: it.source_excerpt ? it.source_excerpt.slice(0, 500) : null,
      // Reverse traceability: this work item points back to the Scribe note.
      source_memory_item_id: memoryItemId,
    }).select("id").single();
    return data ? { type: "work_item", id: String(data.id) } : null;
  }
  if (it.item_type === "decision") {
    const match = resolveOwner(it.suggested_owner);
    const { data } = await supabase.from("decisions").insert({
      organization_id: org.organizationId, project_id: projectId,
      title_i18n: { [lang]: title }, status: "proposed",
      decision_maker: match?.displayName || it.suggested_owner || null,
      source_type: "manual", created_by: org.userId,
    }).select("id").single();
    return data ? { type: "decision", id: String(data.id) } : null;
  }
  if (it.item_type === "risk") {
    const riskFields = {
      organization_id: org.organizationId, project_id: projectId,
      title, category: "other",
      probability: lvl(it.extra?.probability, PROBABILITY, "medium"),
      impact: lvl(it.extra?.impact, SEVERITY, "medium"),
      severity: lvl(it.extra?.impact, SEVERITY, "medium"),
      status: "open", origin: "ai_suggested",
      confidence_score: it.confidence ?? null, needs_review: true,
    };
    // P2-T2 remediation (PD-018): with the pilot flag ON, the risk + its
    // risk_registered event + object_refs are written in ONE PostgreSQL
    // transaction (capture_risk_registered RPC) — a failed event can never
    // leave a risk without its registration evidence (no fire-and-forget). With
    // the flag OFF the helper returns flag_off BEFORE any DB call and we fall
    // back to the pre-P2-T2 direct INSERT (byte-identical: same fields, same
    // DDL defaults, no event). Scribe is REG-009 — behavior preserved.
    const captured = await captureRiskRegisteredAtomic({
      riskFields,
      actor: { actorType: "human", actorId: org.userId },
      captureMethod: "direct",
      origin: "ai_suggested",
      sourceModule: "scribe",
      title,
      evidenceRef: { type: "project_memory_item", id: memoryItemId },
      extraProvenance: it.source_excerpt ? { source_excerpt: it.source_excerpt.slice(0, 500) } : undefined,
      // Stable per memory item (REG-009): a Scribe retry of the SAME item dedupes
      // to the first risk + event, never a second Risk.
      operationId: `scribe:${memoryItemId}`,
    });
    if (captured.ok && captured.riskId) return { type: "risk", id: captured.riskId };
    if (captured.error === "flag_off") {
      // flag OFF → pre-P2-T2 behavior: direct INSERT, no event.
      const { data } = await supabase.from("risks").insert(riskFields).select("id").single();
      return data ? { type: "risk", id: String(data.id) } : null;
    }
    // Atomic capture failed (flag ON, validation/DB error) → the risk was NOT
    // created (rolled back with the event). Fail loudly — no silent divergence.
    console.error("[scribe] atomic risk_registered capture failed:", captured.error, captured.errors ?? "");
    return null;
  }
  return null; // issue/blocker/dependency/project_impact/open_question/follow_up → memory-only in MVP
}

// ── Generated Artifacts (for the Project Memory detail view) ────────────────

export interface MemoryArtifact {
  scribeItemId: string;
  itemType: string;            // action_item | decision | risk | ...
  entityType: string | null;   // work_item | decision | risk | null
  entityId: string | null;
  title: string;
  status: string | null;
  owner: string | null;
  dueDate: string | null;
  priority: string | null;
  confidence: number | null;
  sourceExcerpt: string | null;
  href: string | null;
}

/** Returns the artifacts a ProjectOps Scribe note generated (work items,
 *  decisions, risks) plus any extractions that stayed memory-only. */
export async function getMemoryArtifactsAction(input: { memoryItemId: string; projectId: string; locale: string }): Promise<{ artifacts: MemoryArtifact[] }> {
  const c = await ctx(input.projectId);
  if ("error" in c) return { artifacts: [] };
  const { org, supabase } = c;
  const base = input.locale === "es" ? "/es" : "";

  const { data: items } = await supabase
    .from("project_scribe_items")
    .select("id, item_type, description, status, confidence_score, source_excerpt, suggested_owner, suggested_due_date, created_entity_type, created_entity_id")
    .eq("memory_item_id", input.memoryItemId)
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: true });
  const rows = (items ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return { artifacts: [] };

  const workIds = rows.filter((r) => r.created_entity_type === "work_item").map((r) => String(r.created_entity_id));
  const decisionIds = rows.filter((r) => r.created_entity_type === "decision").map((r) => String(r.created_entity_id));
  const riskIds = rows.filter((r) => r.created_entity_type === "risk").map((r) => String(r.created_entity_id));

  const [workRes, decRes, riskRes, profRes] = await Promise.all([
    workIds.length ? supabase.from("project_backlog_items").select("id, title, status, priority, owner_id, due_date").in("id", workIds).eq("organization_id", org.organizationId) : Promise.resolve({ data: [] }),
    decisionIds.length ? supabase.from("decisions").select("id, title_i18n, status").in("id", decisionIds).eq("organization_id", org.organizationId) : Promise.resolve({ data: [] }),
    riskIds.length ? supabase.from("risks").select("id, title, severity, status").in("id", riskIds).eq("organization_id", org.organizationId) : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, display_name").eq("organization_id", org.organizationId),
  ]);
  const work = new Map((workRes.data ?? []).map((r) => [String((r as Record<string, unknown>).id), r as Record<string, unknown>]));
  const dec = new Map((decRes.data ?? []).map((r) => [String((r as Record<string, unknown>).id), r as Record<string, unknown>]));
  const risk = new Map((riskRes.data ?? []).map((r) => [String((r as Record<string, unknown>).id), r as Record<string, unknown>]));
  const nameByUser = new Map((profRes.data ?? []).map((r) => [String((r as Record<string, unknown>).id), String((r as Record<string, unknown>).display_name ?? "")]));
  const i18n = (f: unknown): string => {
    if (f && typeof f === "object") { const o = f as Record<string, string>; return o[input.locale] || o.en || o.es || ""; }
    return "";
  };

  const artifacts: MemoryArtifact[] = rows.map((r) => {
    const et = (r.created_entity_type as string) ?? null;
    const eid = r.created_entity_id ? String(r.created_entity_id) : null;
    let title = String(r.description ?? "").slice(0, 200);
    let status: string | null = null, owner: string | null = (r.suggested_owner as string) ?? null;
    let dueDate: string | null = (r.suggested_due_date as string) ?? null, priority: string | null = null, href: string | null = null;
    if (et === "work_item" && eid && work.has(eid)) {
      const w = work.get(eid)!;
      title = String(w.title ?? title); status = (w.status as string) ?? null;
      priority = (w.priority as string) ?? null;
      owner = w.owner_id ? (nameByUser.get(String(w.owner_id)) || owner) : owner;
      dueDate = (w.due_date as string) ?? dueDate;
      href = `${base}/projects/${input.projectId}/delivery`;
    } else if (et === "decision" && eid && dec.has(eid)) {
      const d = dec.get(eid)!;
      title = i18n(d.title_i18n) || title; status = (d.status as string) ?? null;
      href = `${base}/projects/${input.projectId}/decisions/${eid}`;
    } else if (et === "risk" && eid && risk.has(eid)) {
      const rk = risk.get(eid)!;
      title = String(rk.title ?? title); status = (rk.status as string) ?? null;
      priority = (rk.severity as string) ?? null;
      href = `${base}/projects/${input.projectId}`;
    }
    return {
      scribeItemId: String(r.id), itemType: String(r.item_type), entityType: et, entityId: eid,
      title, status, owner, dueDate, priority,
      confidence: typeof r.confidence_score === "number" ? r.confidence_score : null,
      sourceExcerpt: (r.source_excerpt as string) ?? null, href,
    };
  });

  return { artifacts };
}

// ── Admin / debug: index status + re-index ──────────────────────────────────

export interface MemoryIndexStatus {
  indexStatus: string;
  hasEmbedding: boolean;
  indexedAt: string | null;
  embeddingModel: string | null;
  contentHash: string | null;
  linkedEntities: number;     // traceability_links touching this memory item
  generatedArtifacts: number; // scribe extractions that created an entity
  totalExtractions: number;   // all scribe extractions for this note
}

export async function getMemoryIndexStatusAction(input: { memoryItemId: string; projectId: string }): Promise<{ status?: MemoryIndexStatus; error?: string }> {
  const c = await ctx(input.projectId);
  if ("error" in c) return { error: c.error };
  const { org, supabase } = c;

  const { data: item } = await supabase
    .from("project_memory_items")
    .select("index_status, embedding, indexed_at, embedding_model, content_hash")
    .eq("id", input.memoryItemId).eq("organization_id", org.organizationId).maybeSingle();
  if (!item) return { error: "not_found" };

  const [linkRes, scribeRes] = await Promise.all([
    supabase.from("traceability_links").select("id", { count: "exact", head: true })
      .eq("organization_id", org.organizationId)
      .or(`and(source_type.eq.memory,source_id.eq.${input.memoryItemId}),and(target_type.eq.memory,target_id.eq.${input.memoryItemId})`),
    supabase.from("project_scribe_items").select("created_entity_id")
      .eq("memory_item_id", input.memoryItemId).eq("organization_id", org.organizationId),
  ]);
  const scribeRows = (scribeRes.data ?? []) as Array<{ created_entity_id: string | null }>;

  return {
    status: {
      indexStatus: String((item as Record<string, unknown>).index_status ?? "pending"),
      hasEmbedding: (item as Record<string, unknown>).embedding != null,
      indexedAt: ((item as Record<string, unknown>).indexed_at as string) ?? null,
      embeddingModel: ((item as Record<string, unknown>).embedding_model as string) ?? null,
      contentHash: ((item as Record<string, unknown>).content_hash as string) ?? null,
      linkedEntities: linkRes.count ?? 0,
      generatedArtifacts: scribeRows.filter((r) => r.created_entity_id).length,
      totalExtractions: scribeRows.length,
    },
  };
}

/** Re-generate the embedding for a memory item (admin "re-index" action). */
export async function reindexMemoryItemAction(input: { memoryItemId: string; projectId: string; locale: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if ("error" in c) return { error: c.error };
  const { org, supabase } = c;
  const { data: item } = await supabase.from("project_memory_items")
    .select("id").eq("id", input.memoryItemId).eq("organization_id", org.organizationId).maybeSingle();
  if (!item) return { error: "not_found" };
  const { processMemoryItem } = await import("@/lib/memory/service");
  await processMemoryItem(org, input.memoryItemId, { runClassification: false, locale: (input.locale === "es" ? "es" : "en") as Locale });
  return {};
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
}): Promise<{ error?: string; memoryItemId?: string; created?: { workItems: number; decisions: number; risks: number } }> {
  const c = await ctx(input.projectId);
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

  const created = { workItems: 0, decisions: 0, risks: 0 };

  // Resolve owner names → real assignees once (only needed when creating entities).
  const resolveOwner = input.createApproved
    ? await buildOwnerResolver(supabase, org.organizationId, input.projectId)
    : () => null;

  // The project's delivery framework (if configured) — new work items are tagged
  // with it so they show under Delivery → Refinement.
  let frameworkId: string | null = null;
  if (input.createApproved) {
    const { data: fw } = await supabase.from("project_delivery_frameworks")
      .select("id").eq("project_id", input.projectId).eq("organization_id", org.organizationId)
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    frameworkId = fw ? String(fw.id) : null;
  }

  // traceability_links only allows certain target types (work_item is not one);
  // work-item provenance is kept on the backlog row's source/source_reference.
  const LINKABLE = new Set(["decision", "risk", "task", "milestone"]);

  // 2. Persist every extracted item (rejected ones too, for audit).
  for (const it of input.items) {
    let createdRef: { type: string; id: string } | null = null;
    const approved = it.status === "approved" || it.status === "edited";
    if (input.createApproved && approved) {
      createdRef = await createEntityForItem(supabase, org, input.projectId, lang, it, resolveOwner, frameworkId, memoryItemId);
      if (createdRef) {
        if (createdRef.type === "work_item") created.workItems++;
        else if (createdRef.type === "decision") created.decisions++;
        else if (createdRef.type === "risk") created.risks++;
        // Traceability: memory entry → created entity (where the link type allows).
        if (LINKABLE.has(createdRef.type)) {
          await supabase.from("traceability_links").insert({
            organization_id: org.organizationId,
            source_type: "memory", source_id: memoryItemId,
            target_type: createdRef.type, target_id: createdRef.id,
            link_type: "derived_from", created_by: org.userId,
          });
        }
      }
    }
    const { data: scribeRow } = await supabase.from("project_scribe_items").insert({
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
    }).select("id").single();

    // Complete the reverse link + vectorize the generated work item so it is
    // findable from Project Memory semantic search.
    if (createdRef?.type === "work_item") {
      if (scribeRow) {
        await supabase.from("project_backlog_items")
          .update({ source_scribe_item_id: String(scribeRow.id) })
          .eq("id", createdRef.id).eq("organization_id", org.organizationId);
      }
      const workItemId = createdRef.id;
      void import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) =>
        generateAndStoreEmbedding("project_backlog_items", workItemId, {
          title: it.description.slice(0, 300),
          description: it.proposed_action || it.description,
          source_reference: it.source_excerpt || "",
        }).catch(() => {}),
      );
    }
  }

  // 3. Vectorize the entry for semantic search (fire-and-forget).
  void import("@/lib/memory/service").then(({ processMemoryItem }) =>
    processMemoryItem(org, memoryItemId, { runClassification: false, locale: lang as Locale }).catch(() => {}),
  );

  await logAudit({ org, projectId: input.projectId, action: "create", entityType: "project_memory_items", entityId: memoryItemId, metadata: { scribe: true, source_type: sourceType, created } });
  return { memoryItemId, created };
}
