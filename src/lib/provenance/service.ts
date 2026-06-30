// ============================================================================
// ProjectOps360° — Evidence Provenance service (server-only, PD-012)
// ============================================================================
// Resolves real, org+project-scoped provenance from the canonical source-chain
// records and hands the PURE engine normalized rows. No fabricated sources —
// every number traces to a real row; missing links become honest gaps.
//
// Access control: org + role come from the trusted session (getOrgContext); the
// project/entity must belong to the caller's organization or the service refuses.
// Source excerpts are sensitive (raw notes/transcripts): external viewers never
// receive them (TASK 13 — RBAC).
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, type OrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { I18nField, Locale } from "@/types/database";
import {
  buildProvenanceSummary,
  classifyScribeSource,
  scribeItemTypeToTarget,
  type ScribeDerivedRow,
} from "./engine";
import type {
  EntityProvenance,
  EntityProvenanceResult,
  ProjectProvenanceResult,
  ProvenanceSourceType,
  ProvenanceTargetType,
} from "./types";

/** External viewers must never see raw note/transcript excerpts. */
function canSeeExcerpts(role: OrgContext["role"]): boolean {
  return role !== "viewer";
}

async function authorizeProject(
  projectId: string,
): Promise<
  | { ok: true; org: OrgContext; supabase: ReturnType<typeof createAdminClient> }
  | { ok: false; reason: "no_project" | "not_authorized" | "unavailable" }
> {
  if (!projectId) return { ok: false, reason: "no_project" };
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, reason: "not_authorized" };
  }
  const supabase = createAdminClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, reason: "unavailable" };
  if (!project) return { ok: false, reason: "no_project" };
  return { ok: true, org, supabase };
}

// ── Project summary (TASK 7) ─────────────────────────────────────────────────

/**
 * Deterministic provenance roll-up for a project. Counts AI-derived entities by
 * their resolved source (Scribe voice/note, meetings) and flags traceability
 * gaps (entities that look AI-derived but whose source link is broken/missing).
 */
export async function getProjectProvenanceSummary(
  projectId: string,
): Promise<ProjectProvenanceResult> {
  const auth = await authorizeProject(projectId);
  if (!auth.ok) return auth;
  const { org, supabase } = auth;
  const orgId = org.organizationId;

  const [scribeRes, memoryRes, meetingDecRes, meetingLinkRes, backlogGapRes, decisionsRes, riskRes, riskLinkRes, riskScribeRes] =
    await Promise.all([
      // Every Scribe extraction for the project (forward provenance record).
      supabase
        .from("project_scribe_items")
        .select("id, item_type, status, created_entity_type, created_entity_id, memory_item_id")
        .eq("project_id", projectId)
        .eq("organization_id", orgId),
      // The memory items behind those extractions → voice vs note classification.
      supabase
        .from("project_memory_items")
        .select("id, source_type, source_system")
        .eq("project_id", projectId)
        .eq("organization_id", orgId)
        .is("deleted_at", null),
      // Meeting-derived decisions (decisions.source_type = 'meeting').
      supabase
        .from("decisions")
        .select("id")
        .eq("project_id", projectId)
        .eq("organization_id", orgId)
        .eq("source_type", "meeting")
        .is("deleted_at", null),
      // Meeting → decision traceability links (covers decisions w/o source_type set).
      supabase
        .from("traceability_links")
        .select("target_id")
        .eq("organization_id", orgId)
        .eq("source_type", "meeting")
        .eq("target_type", "decision"),
      // Gap: Scribe-sourced work items whose reverse link is missing.
      supabase
        .from("project_backlog_items")
        .select("id")
        .eq("project_id", projectId)
        .eq("organization_id", orgId)
        .eq("source", "projectops_scribe")
        .is("source_memory_item_id", null)
        .is("deleted_at", null),
      // Gap: decisions whose origin was never recorded.
      supabase
        .from("decisions")
        .select("id")
        .eq("project_id", projectId)
        .eq("organization_id", orgId)
        .is("source_type", null)
        .is("deleted_at", null),
      // Gap input: AI-suggested risks.
      supabase
        .from("risks")
        .select("id")
        .eq("project_id", projectId)
        .eq("organization_id", orgId)
        .eq("origin", "ai_suggested"),
      // Risks that DO have a traceability link (so they are not gaps).
      supabase
        .from("traceability_links")
        .select("target_id")
        .eq("organization_id", orgId)
        .eq("target_type", "risk"),
      // Risks created by Scribe (created_entity_type='risk') — not gaps either.
      supabase
        .from("project_scribe_items")
        .select("created_entity_id")
        .eq("project_id", projectId)
        .eq("organization_id", orgId)
        .eq("created_entity_type", "risk"),
    ]);

  // Build a memory-item → source classification map.
  const memSource = new Map<string, ProvenanceSourceType>();
  for (const m of (memoryRes.data ?? []) as Array<Record<string, unknown>>) {
    memSource.set(
      String(m.id),
      classifyScribeSource(m.source_type as string | null, m.source_system as string | null),
    );
  }

  const scribeRows: ScribeDerivedRow[] = [];
  for (const s of (scribeRes.data ?? []) as Array<Record<string, unknown>>) {
    const target = scribeItemTypeToTarget(String(s.item_type));
    if (!target) continue;
    const sourceType = memSource.get(String(s.memory_item_id)) ?? "scribe_note";
    scribeRows.push({
      sourceType,
      targetType: target,
      createdEntityId: s.created_entity_id ? String(s.created_entity_id) : null,
      status: String(s.status ?? "suggested"),
    });
  }

  // Meeting-derived decision ids (union of source_type + trace links).
  const meetingDecisionIds = new Set<string>();
  for (const d of (meetingDecRes.data ?? []) as Array<{ id: string }>) meetingDecisionIds.add(String(d.id));
  for (const l of (meetingLinkRes.data ?? []) as Array<{ target_id: string }>) meetingDecisionIds.add(String(l.target_id));

  // Risk gaps: AI-suggested risks that have neither a trace link nor a Scribe link.
  const linkedRiskIds = new Set<string>();
  for (const l of (riskLinkRes.data ?? []) as Array<{ target_id: string }>) linkedRiskIds.add(String(l.target_id));
  for (const s of (riskScribeRes.data ?? []) as Array<{ created_entity_id: string | null }>) {
    if (s.created_entity_id) linkedRiskIds.add(String(s.created_entity_id));
  }
  const aiRiskIds = ((riskRes.data ?? []) as Array<{ id: string }>).map((r) => String(r.id));
  const risksWithoutSource = aiRiskIds.filter((id) => !linkedRiskIds.has(id)).length;

  const summary = buildProvenanceSummary({
    projectId,
    scribe: scribeRows,
    meeting: { tasks: 0, decisions: meetingDecisionIds.size, risks: 0, followUps: 0 },
    gaps: {
      tasksWithoutSource: ((backlogGapRes.data ?? []) as unknown[]).length,
      decisionsWithoutSource: ((decisionsRes.data ?? []) as unknown[]).length,
      risksWithoutSource,
    },
  });

  return { ok: true, summary };
}

// ── Single-entity provenance (TASK 5) ────────────────────────────────────────

function emptyProvenance(
  type: ProvenanceTargetType,
  id: string,
  title: string | null,
  sourceType: ProvenanceSourceType,
  incomplete: boolean,
): EntityProvenance {
  return {
    found: sourceType !== "unknown",
    entity: { type, id, title },
    sourceType,
    sourceExcerpt: null,
    sourceRecord: { kind: null, id: null, title: null, href: null },
    approval: { status: null, approvedByName: null, approvedAt: null },
    provenanceIncomplete: incomplete,
  };
}

/**
 * Resolve the source chain behind ONE entity (task/work_item, decision, risk).
 * Returns a record-backed answer or an honest "unknown source" — never inferred.
 */
export async function getEntityProvenance(
  entityType: string,
  entityId: string,
  projectId: string,
  locale: Locale,
): Promise<EntityProvenanceResult> {
  const auth = await authorizeProject(projectId);
  if (!auth.ok) {
    return { ok: false, reason: auth.reason === "no_project" ? "no_entity" : auth.reason };
  }
  const { org, supabase } = auth;
  const orgId = org.organizationId;
  const lang = locale === "es" ? "es" : "en";
  const base = locale === "es" ? "/es" : "";
  const showExcerpt = canSeeExcerpts(org.role);

  const target: ProvenanceTargetType =
    entityType === "decision" ? "decision" : entityType === "risk" ? "risk" : "task";

  // Resolve approver display name + memory item details + scribe excerpt.
  const resolveFromScribe = async (
    title: string | null,
  ): Promise<EntityProvenance | null> => {
    const { data: scribe } = await supabase
      .from("project_scribe_items")
      .select("id, status, source_excerpt, created_by, created_at, memory_item_id, item_type")
      .eq("organization_id", orgId)
      .eq("project_id", projectId)
      .eq("created_entity_type", target === "task" ? "work_item" : target)
      .eq("created_entity_id", entityId)
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (!scribe) return null;
    const row = scribe as Record<string, unknown>;
    const memoryItemId = row.memory_item_id ? String(row.memory_item_id) : null;

    let sourceType: ProvenanceSourceType = "scribe_note";
    let memTitle: string | null = null;
    if (memoryItemId) {
      const { data: mem } = await supabase
        .from("project_memory_items")
        .select("title, source_type, source_system")
        .eq("id", memoryItemId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (mem) {
        const m = mem as Record<string, unknown>;
        sourceType = classifyScribeSource(m.source_type as string | null, m.source_system as string | null);
        memTitle = (m.title as string | null) ?? null;
      }
    }

    let approverName: string | null = null;
    if (row.created_by) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", String(row.created_by))
        .maybeSingle();
      approverName = (prof?.display_name as string | null) ?? null;
    }

    return {
      found: true,
      entity: { type: target, id: entityId, title },
      sourceType,
      sourceExcerpt: showExcerpt ? ((row.source_excerpt as string | null) ?? null) : null,
      sourceRecord: {
        kind: "memory_item",
        id: memoryItemId,
        title: memTitle,
        href: memoryItemId ? `${base}/projects/${projectId}/memory` : null,
      },
      approval: {
        status: (row.status as string | null) ?? null,
        approvedByName: approverName,
        approvedAt: (row.created_at as string | null) ?? null,
      },
      provenanceIncomplete: !memoryItemId,
    };
  };

  if (target === "task") {
    const { data: item } = await supabase
      .from("project_backlog_items")
      .select("id, title, source, source_reference, source_memory_item_id, source_scribe_item_id")
      .eq("id", entityId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!item) return { ok: false, reason: "no_entity" };
    const row = item as Record<string, unknown>;
    const title = (row.title as string | null) ?? null;
    const memoryItemId = row.source_memory_item_id ? String(row.source_memory_item_id) : null;

    if (memoryItemId || row.source_scribe_item_id) {
      const fromScribe = await resolveFromScribe(title);
      if (fromScribe) {
        // Fall back to the work-item's own preserved excerpt if the scribe row lost it.
        if (!fromScribe.sourceExcerpt && showExcerpt && typeof row.source_reference === "string") {
          fromScribe.sourceExcerpt = row.source_reference;
        }
        return { ok: true, provenance: fromScribe };
      }
      // Reverse link exists but the scribe row is gone → incomplete provenance.
      return {
        ok: true,
        provenance: {
          ...emptyProvenance(target, entityId, title, "scribe_note", true),
          sourceExcerpt: showExcerpt ? ((row.source_reference as string | null) ?? null) : null,
          sourceRecord: {
            kind: "memory_item",
            id: memoryItemId,
            title: null,
            href: memoryItemId ? `${base}/projects/${projectId}/memory` : null,
          },
        },
      };
    }

    const source = String(row.source ?? "");
    const sourceType: ProvenanceSourceType =
      source === "import" ? "import" : source === "manual" || source === "" ? "manual" : "manual";
    const known = source === "manual" || source === "import";
    return { ok: true, provenance: emptyProvenance(target, entityId, title, known ? sourceType : "unknown", !known) };
  }

  // decision / risk — title + try Scribe, then meeting (decisions), then unknown.
  let title: string | null = null;
  if (target === "decision") {
    const { data: d } = await supabase
      .from("decisions")
      .select("id, title_i18n, source_type, source_record_id")
      .eq("id", entityId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!d) return { ok: false, reason: "no_entity" };
    const row = d as Record<string, unknown>;
    title = getI18nValue(row.title_i18n as I18nField, lang) || null;

    const fromScribe = await resolveFromScribe(title);
    if (fromScribe) return { ok: true, provenance: fromScribe };

    if (String(row.source_type ?? "") === "meeting") {
      const meetingId = row.source_record_id ? String(row.source_record_id) : null;
      let meetingTitle: string | null = null;
      if (meetingId) {
        const { data: m } = await supabase
          .from("meetings")
          .select("title_i18n")
          .eq("id", meetingId)
          .eq("organization_id", orgId)
          .maybeSingle();
        if (m) meetingTitle = getI18nValue((m as Record<string, unknown>).title_i18n as I18nField, lang) || null;
      }
      return {
        ok: true,
        provenance: {
          found: true,
          entity: { type: target, id: entityId, title },
          sourceType: "meeting",
          sourceExcerpt: null,
          sourceRecord: {
            kind: "meeting",
            id: meetingId,
            title: meetingTitle,
            href: meetingId ? `${base}/projects/${projectId}/meetings/${meetingId}` : null,
          },
          approval: { status: null, approvedByName: null, approvedAt: null },
          provenanceIncomplete: !meetingId,
        },
      };
    }
    const known = row.source_type === "manual";
    return { ok: true, provenance: emptyProvenance(target, entityId, title, known ? "manual" : "unknown", !known) };
  }

  // risk
  const { data: r } = await supabase
    .from("risks")
    .select("id, title, origin")
    .eq("id", entityId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!r) return { ok: false, reason: "no_entity" };
  const row = r as Record<string, unknown>;
  title = (row.title as string | null) ?? null;
  const fromScribe = await resolveFromScribe(title);
  if (fromScribe) return { ok: true, provenance: fromScribe };
  const aiOrigin = String(row.origin ?? "") === "ai_suggested";
  return { ok: true, provenance: emptyProvenance(target, entityId, title, aiOrigin ? "unknown" : "manual", aiOrigin) };
}
