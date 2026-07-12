"use server";

// ============================================================================
// ProjectOps360° — KPI Engine · custom KPI definition server actions (F3.2)
// ============================================================================
// Every call: trusted session (getOrgContext) → zod validation → pure
// allow-list validation (validateCustomKpiInput — an expression outside the
// sandbox allow-list is NEVER persisted) → role guard (viewers cannot write;
// delete requires creator or org owner/admin) → org-scoped write through the
// RLS client. Guarded by KPI-ENGINE-CUSTOM-DEFINITIONS.
// ============================================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { validateCustomKpiInput, type CustomKpiDefinition, type KpiTargetDirection } from "./custom";

export interface CustomKpiActionResult {
  ok: boolean;
  error?: string;
}

const createSchema = z.object({
  projectId: z.string().uuid(),
  nameEn: z.string().min(1).max(200),
  nameEs: z.string().min(1).max(200),
  expression: z.string().min(1).max(500),
  unit: z.string().max(20).optional(),
  precision: z.number().int().min(0).max(4).optional(),
  target: z.number().finite().nullable().optional(),
  targetDirection: z.enum(["at_or_above", "at_or_below"]).nullable().optional(),
  nlSource: z.string().max(1000).optional(),
});

export async function createCustomKpi(input: z.infer<typeof createSchema>): Promise<CustomKpiActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, error: "Unauthorized." };
  }
  if (org.role === "viewer") return { ok: false, error: "Viewers cannot create KPIs." };

  const validation = validateCustomKpiInput(parsed.data);
  if (!validation.valid) return { ok: false, error: validation.error };
  const n = validation.normalized;

  const supabase = await createClient();

  // The project must belong to the caller's org (deny-by-default).
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", parsed.data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) return { ok: false, error: "Unauthorized." };

  const { error } = await supabase.from("kpi_definitions").insert({
    organization_id: org.organizationId,
    project_id: parsed.data.projectId,
    slug: n.slug,
    name_en: n.nameEn,
    name_es: n.nameEs,
    description_en: n.descriptionEn || null,
    description_es: n.descriptionEs || null,
    expression: n.expression,
    unit: n.unit || null,
    precision: n.precision,
    target: n.target,
    target_direction: n.targetDirection,
    nl_source: n.nlSource || null,
    created_by: org.userId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: `A KPI with slug "${n.slug}" already exists.` };
    console.error("createCustomKpi failed:", error);
    return { ok: false, error: "Could not save the KPI." };
  }

  revalidatePath(`/projects/${parsed.data.projectId}/execution-map/kpis`);
  return { ok: true };
}

export async function deleteCustomKpi(input: { projectId: string; kpiId: string }): Promise<CustomKpiActionResult> {
  const parsed = z.object({ projectId: z.string().uuid(), kpiId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("kpi_definitions")
    .select("id, created_by")
    .eq("id", parsed.data.kpiId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!row) return { ok: false, error: "Not found." };

  const mayDelete = org.role === "owner" || org.role === "admin" || row.created_by === org.userId;
  if (!mayDelete) return { ok: false, error: "Only the creator or an org admin can delete this KPI." };

  const { error } = await supabase
    .from("kpi_definitions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.kpiId)
    .eq("organization_id", org.organizationId);
  if (error) {
    console.error("deleteCustomKpi failed:", error);
    return { ok: false, error: "Could not delete the KPI." };
  }

  revalidatePath(`/projects/${parsed.data.projectId}/execution-map/kpis`);
  return { ok: true };
}

interface KpiDefinitionRow {
  id: string;
  slug: string;
  name_en: string;
  name_es: string;
  description_en: string | null;
  description_es: string | null;
  expression: string;
  unit: string | null;
  precision: number;
  target: number | null;
  target_direction: KpiTargetDirection | null;
  nl_source: string | null;
  version: number;
  project_id: string | null;
}

/** Custom KPI definitions visible for a project (project-scoped + org-wide). */
export async function listCustomKpiDefinitions(projectId: string): Promise<CustomKpiDefinition[]> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return [];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_definitions")
    .select(
      "id, slug, name_en, name_es, description_en, description_es, expression, unit, precision, target, target_direction, nl_source, version, project_id",
    )
    .eq("organization_id", org.organizationId)
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  return (data as KpiDefinitionRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameEs: row.name_es,
    descriptionEn: row.description_en,
    descriptionEs: row.description_es,
    expression: row.expression,
    unit: row.unit,
    precision: row.precision,
    target: row.target === null ? null : Number(row.target),
    targetDirection: row.target_direction,
    nlSource: row.nl_source,
    version: row.version,
    projectId: row.project_id,
  }));
}
