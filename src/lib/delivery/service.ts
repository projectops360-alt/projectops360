// ============================================================================
// ProjectOps360° — Delivery Framework service (server-only)
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import { DELIVERY_METHODS, label, GOVERNANCE, UNCERTAINTY, CADENCE, type DeliveryMethod } from "./config";

type Supabase = ReturnType<typeof createAdminClient>;

export interface DeliveryFramework {
  id: string; organization_id: string; project_id: string;
  project_type: string | null; delivery_method: string | null;
  governance_level: string | null; uncertainty_level: string | null;
  execution_cadence: string | null; review_cadence: string | null;
  stakeholder_feedback_frequency: string | null; documentation_level: string | null;
  change_control_required: string | null; vendor_dependency_level: string | null;
  regulatory_requirement: boolean; ai_recommended: boolean;
  recommendation_confidence: number | null; recommendation_reason: string | null;
  status: string; created_at: string; updated_at: string;
}

/** Map the project's project_type to the framework project-type vocabulary. */
export function mapProjectType(projectType: string | null | undefined): string {
  switch (projectType) {
    case "software_development": return "software";
    case "data_center_construction":
    case "residential_construction":
    case "commercial_construction":
    case "infrastructure":
    case "industrial": return "construction";
    default: return "general";
  }
}

export async function getFrameworkByProject(
  supabase: Supabase, organizationId: string, projectId: string,
): Promise<DeliveryFramework | null> {
  const { data } = await supabase
    .from("project_delivery_frameworks").select("*")
    .eq("project_id", projectId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle();
  return (data as DeliveryFramework | null) ?? null;
}

export async function createFrameworkForProject(
  supabase: Supabase, organizationId: string, projectId: string, userId: string, projectType: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("project_delivery_frameworks")
    .insert({ organization_id: organizationId, project_id: projectId, project_type: mapProjectType(projectType), status: "draft", selected_by: userId })
    .select("id").maybeSingle();
  if (error) {
    const { data: existing } = await supabase.from("project_delivery_frameworks").select("id").eq("project_id", projectId).eq("organization_id", organizationId).maybeSingle();
    return existing?.id ?? null;
  }
  return data?.id ?? null;
}

export async function saveFrameworkEvent(
  supabase: Supabase, org: OrgContext, projectId: string, frameworkId: string | null,
  eventType: string, summary: string, payload: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from("project_framework_events").insert({
    organization_id: org.organizationId, project_id: projectId, framework_id: frameworkId,
    event_type: eventType, event_summary: summary, event_payload: payload, created_by: org.userId,
  });
}

/** Persist the framework configuration into Project Memory (best-effort). */
export async function syncFrameworkToMemory(
  org: OrgContext, projectId: string, locale: Locale,
): Promise<void> {
  const supabase = createAdminClient();
  const fw = await getFrameworkByProject(supabase, org.organizationId, projectId);
  if (!fw || !fw.delivery_method) return;
  const isEs = locale === "es";
  const m = DELIVERY_METHODS[fw.delivery_method as DeliveryMethod];

  await supabase.from("project_memory_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", org.organizationId).eq("project_id", projectId)
    .contains("metadata", { kind: "delivery_framework" }).is("deleted_at", null);

  const content = [
    `${isEs ? "Método de entrega" : "Delivery method"}: ${isEs ? m.es : m.en}`,
    `${isEs ? "Gobernanza" : "Governance"}: ${label(GOVERNANCE, fw.governance_level, isEs)}`,
    `${isEs ? "Incertidumbre" : "Uncertainty"}: ${label(UNCERTAINTY, fw.uncertainty_level, isEs)}`,
    `${isEs ? "Cadencia" : "Cadence"}: ${label(CADENCE, fw.execution_cadence, isEs)}`,
    fw.recommendation_reason ? `${isEs ? "Razón" : "Reason"}: ${fw.recommendation_reason}` : "",
  ].filter(Boolean).join("\n");

  const { data: mem } = await supabase.from("project_memory_items").insert({
    organization_id: org.organizationId, project_id: projectId,
    title: isEs ? "Marco de entrega del proyecto" : "Project delivery framework",
    content, summary: content.slice(0, 280),
    source_type: "document", source_system: "delivery_framework", importance_level: "high",
    author_name: org.displayName ?? null, visibility: "project", ai_status: "skipped", index_status: "pending",
    created_by: org.userId, metadata: { kind: "delivery_framework", method: fw.delivery_method },
  }).select("id").single();

  if (mem) void import("@/lib/memory/service").then(({ processMemoryItem }) => processMemoryItem(org, mem.id, { runClassification: false }).catch(() => {}));
}
