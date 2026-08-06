"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getTemplateForType } from "@/lib/execution/templates";
import { instantiateTemplate } from "@/lib/execution/template-service";
import { createCharterForProject } from "@/lib/charter/service";
import type { Locale } from "@/types/database";

// ── Zod Schema ──────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "nameRequired")
    .max(200, "nameTooLong")
    .transform((s) => s.trim()),
  description: z
    .string()
    .max(2000, "descriptionTooLong")
    .transform((s) => s.trim())
    .default(""),
  status: z
    .enum(["planning", "active", "on_hold", "completed", "cancelled"])
    .default("planning"),
  projectType: z
    .enum([
      "software_development",
      "data_center_construction",
      "residential_construction",
      "commercial_construction",
      "infrastructure",
      "industrial",
      "general",
      "ai_native_execution",
    ])
    .default("general"),
  useTemplate: z.boolean().default(false),
  defaultLanguage: z.enum(["en", "es"]).default("en"),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Slug Generation ─────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80); // Limit slug length
}

// ── Server Action ────────────────────────────────────────────────────────────────

/**
 * Load what the create-project form may offer.
 *
 * Both lists come from the same predicate the command enforces, so the form
 * cannot show an organization or a unit that `create_project_v2` would then
 * refuse. A selector that offers an option the server rejects is worse than no
 * selector: the user learns the rule by hitting it.
 */
export async function loadProjectCreationScopeAction(): Promise<{
  state: "ACTIVE_ORGANIZATION" | "ORGANIZATION_SELECTION_REQUIRED" | "NO_ACTIVE_ORGANIZATION";
  organizations: { id: string; slug: string; name: unknown }[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("v2_creatable_organizations");
  if (error) return { state: "NO_ACTIVE_ORGANIZATION", organizations: [] };

  const organizations = (data ?? []).map(
    (r: { organization_id: string; slug: string; name_i18n: unknown }) => ({
      id: r.organization_id,
      slug: r.slug,
      name: r.name_i18n,
    }),
  );

  if (organizations.length === 0) return { state: "NO_ACTIVE_ORGANIZATION", organizations };
  if (organizations.length === 1) return { state: "ACTIVE_ORGANIZATION", organizations };
  return { state: "ORGANIZATION_SELECTION_REQUIRED", organizations };
}

export async function loadGovernanceUnitsAction(
  organizationId: string,
): Promise<{ units: { id: string; name: string; code: string; isDefault: boolean }[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("v2_creatable_units", {
    p_organization_id: organizationId,
  });
  if (error) return { units: [] };
  return {
    units: (data ?? []).map(
      (r: { unit_id: string; name: string; code: string; is_system_default: boolean }) => ({
        id: r.unit_id,
        name: r.name,
        code: r.code,
        isDefault: r.is_system_default,
      }),
    ),
  };
}

/**
 * Create a project.
 *
 * Every project created from the interface is now a governed V2 project: one
 * `projects` row, one active `multi_pmo_v2` contract and exactly one active
 * owner assignment, written by `create_project_v2` in a single transaction. If
 * any of the three fails, none of them exist.
 *
 * WHY THIS NO LONGER USES THE ADMIN CLIENT FOR THE INSERT
 * It used to `createAdminClient().from("projects").insert(...)`, which runs as
 * `service_role` and therefore bypasses RLS entirely. The organization came
 * from `getOrgContext()`, so it was not forgeable — but nothing in that path
 * asked whether the caller was ALLOWED to create a project, only which
 * organization they belonged to. The RPC runs on the session client and decides
 * with the capability resolver.
 *
 * The admin client is still used afterwards for the charter and the template.
 * Those are internal follow-up work on a project that already exists and whose
 * authorisation has already been settled.
 */
export async function createProjectAction(input: {
  name: string;
  description: string;
  status: string;
  projectType?: string;
  useTemplate?: boolean;
  defaultLanguage: string;
  locale: string;
  organizationId?: string;
  governanceUnitId?: string;
}): Promise<{ error?: string; projectId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = createProjectSchema.safeParse({
    name: input.name,
    description: input.description,
    status: input.status,
    projectType: input.projectType,
    useTemplate: input.useTemplate,
    defaultLanguage: input.defaultLanguage,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  // The client may propose an organization; it never decides one. The command
  // re-checks it against the session regardless of what arrives here.
  const organizationId = input.organizationId ?? org.organizationId;
  if (!organizationId) return { error: "no_active_organization" };

  const governanceUnitId = input.governanceUnitId;
  if (!governanceUnitId) return { error: "governance_unit_required" };

  const supabase = await createClient();

  // Slug uniqueness, read through the caller's own RLS rather than around it.
  const base = generateSlug(data.name);
  let finalSlug = base;
  let suffix = 0;
  while (suffix < 50) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("slug", finalSlug)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) break;
    suffix++;
    finalSlug = `${base}-${suffix}`;
  }

  const titleI18n = data.locale === "es" ? { es: data.name } : { en: data.name };
  const descriptionI18n = data.description
    ? data.locale === "es"
      ? { es: data.description }
      : { en: data.description }
    : {};

  const { data: created, error: rpcError } = await supabase
    .rpc("create_project_v2", {
      p_organization_id: organizationId,
      p_governance_unit_id: governanceUnitId,
      p_slug: finalSlug,
      p_title_i18n: titleI18n,
      p_description_i18n: descriptionI18n,
      p_project_type: data.projectType,
    })
    .single();

  if (rpcError || !created) {
    // The command speaks in SQLSTATEs. 42501 is every authorisation refusal it
    // makes — wrong organization, no capability, a unit from another tenant.
    if (rpcError?.code === "42501") return { error: "not_authorized" };
    if (rpcError?.code === "23505") return { error: "slug_exists" };
    console.error("create_project_v2 failed:", rpcError?.message);
    return { error: "unexpected" };
  }

  const projectId = (created as { project_id: string }).project_id;

  // Follow-up work on a project that exists and is already authorised.
  const admin = createAdminClient();
  try {
    await createCharterForProject(admin, organizationId, projectId, org.userId, data.name);
  } catch (e) {
    console.error("Charter creation failed:", e);
  }

  if (data.useTemplate) {
    const template = getTemplateForType(data.projectType);
    if (template) {
      try {
        await instantiateTemplate({
          organizationId,
          projectId,
          template,
          createdBy: org.userId,
        });
      } catch (e) {
        // The project itself exists; a template failure must not lose it.
        console.error("Template instantiation failed:", e);
      }
    }
  }

  return { projectId };
}

// ── Update Project ──────────────────────────────────────────────────────────────

const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z
    .string()
    .min(1, "nameRequired")
    .max(200, "nameTooLong")
    .transform((s) => s.trim()),
  description: z
    .string()
    .max(2000, "descriptionTooLong")
    .transform((s) => s.trim())
    .default(""),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
  projectType: z
    .enum([
      "software_development",
      "data_center_construction",
      "residential_construction",
      "commercial_construction",
      "infrastructure",
      "industrial",
      "general",
      "ai_native_execution",
    ])
    .optional(),
  startDate: z.string().optional(),
  targetEndDate: z.string().optional(),
  locale: z.enum(["en", "es"]).default("en"),
});

export async function updateProjectAction(input: {
  projectId: string;
  name: string;
  description?: string;
  status: string;
  projectType?: string;
  startDate?: string;
  targetEndDate?: string;
  locale: string;
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = updateProjectSchema.safeParse({
    projectId: input.projectId,
    name: input.name,
    description: input.description,
    status: input.status,
    projectType: input.projectType,
    startDate: input.startDate,
    targetEndDate: input.targetEndDate,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const lang = data.locale as Locale;

  const supabase = createAdminClient();

  // Preserve other locales: merge into the existing i18n maps instead of
  // replacing them, so editing in one language never wipes the other.
  const { data: existing } = await supabase
    .from("projects")
    .select("title_i18n, description_i18n")
    .eq("id", data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  const titleI18n = { ...((existing?.title_i18n as Record<string, string>) ?? {}), [lang]: data.name };
  const descriptionI18n = data.description
    ? { ...((existing?.description_i18n as Record<string, string>) ?? {}), [lang]: data.description }
    : ((existing?.description_i18n as Record<string, string>) ?? {});

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
      status: data.status,
      // Only change the type when explicitly provided (drives module visibility).
      ...(data.projectType ? { project_type: data.projectType } : {}),
      start_date: data.startDate || null,
      target_end_date: data.targetEndDate || null,
    })
    .eq("id", data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update project:", updateError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "projects",
    entityId: data.projectId,
    metadata: { title: data.name, status: data.status },
  });

  return {};
}

// ── Archive Project ──────────────────────────────────────────────────────────────

export async function archiveProjectAction(
  projectId: string,
): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();

  const { error: deleteError } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Failed to archive project:", deleteError);
    return { error: "unexpected" };
  }

  // Cascade the soft-delete to child records. Without this they stay alive and
  // keep surfacing in the PMO dashboard / search / reports, where clicking them
  // 404s because the parent project page is gone.
  const now = new Date().toISOString();
  const childTables = [
    "roadmap_tasks", "milestones", "risks", "material_requirements",
    "rfis", "budget_items", "decisions", "resources",
  ] as const;
  await Promise.all(
    childTables.map((table) =>
      supabase
        .from(table)
        .update({ deleted_at: now })
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null),
    ),
  );

  await logAudit({
    org,
    projectId,
    action: "delete",
    entityType: "projects",
    entityId: projectId,
    metadata: { soft_delete: true },
  });

  // Invalidate on the SERVER, precisely. Letting the client call
  // router.refresh() instead invalidates the whole router cache, so Next.js
  // re-fetches every prefetched route it holds — measured at ~35 requests
  // after one delete, including every sub-page of the project that no longer
  // exists. The delete itself takes 234 ms; the avalanche is what was felt.
  revalidatePath("/(app)/projects", "page");
  revalidatePath(`/(app)/projects/${projectId}`, "layout");

  return {};
}

// ── Permanently delete a project ────────────────────────────────────────────
// Archiving hides a project; this destroys it. Irreversible, so it is gated on
// an owner/admin role and, in the UI, on two separate confirmations.

export interface ProjectDeletionImpact {
  title: string;
  tasks: number;
  milestones: number;
  dependencies: number;
  events: number;
}

/** What would be destroyed. Read-only: it makes the confirmation concrete
 *  instead of asking the user to accept an abstraction. */
export async function getProjectDeletionImpactAction(
  projectId: string,
): Promise<{ impact?: ProjectDeletionImpact; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  if (org.role !== "owner" && org.role !== "admin") return { error: "forbidden" };

  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!project) return { error: "not_found" };

  const countOf = async (table: string) => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    return count ?? 0;
  };
  const [tasks, milestones, dependencies, events] = await Promise.all([
    countOf("roadmap_tasks"),
    countOf("milestones"),
    countOf("task_dependencies"),
    countOf("project_event_log"),
  ]);

  const titleI18n = (project.title_i18n ?? {}) as Record<string, string>;
  return {
    impact: {
      title: titleI18n.en ?? titleI18n.es ?? Object.values(titleI18n)[0] ?? "",
      tasks,
      milestones,
      dependencies,
      events,
    },
  };
}

/**
 * Destroy a project and everything cascading from it.
 *
 * The write is a single `delete_project_permanently` call: it records an act in
 * `compliance_archive.project_purges` before anything is destroyed, and it is
 * the only sanctioned way to remove append-only `project_event_log` rows
 * (recorded exception to the CAP-045 immutability contract). Deleting table by
 * table from here would leave a half-destroyed project the moment one
 * statement failed.
 */
export async function deleteProjectPermanentlyAction(
  projectId: string,
): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  // Irreversible and tenant-wide: members and viewers may never reach it.
  if (org.role !== "owner" && org.role !== "admin") return { error: "forbidden" };

  const supabase = createAdminClient();

  // Audit BEFORE the fact: afterwards there is no project row to reference,
  // and audit_logs.project_id is ON DELETE SET NULL.
  await logAudit({
    org,
    projectId,
    action: "delete",
    entityType: "projects",
    entityId: projectId,
    metadata: { permanent: true },
  });

  const { error } = await supabase.rpc("delete_project_permanently", {
    p_project_id: projectId,
    p_organization_id: org.organizationId,
    p_actor_id: org.userId,
    p_actor_email: org.email,
  });

  if (error) {
    console.error("Failed to permanently delete project:", error);
    return { error: error.message.includes("project_not_found") ? "not_found" : "unexpected" };
  }

  // Invalidate on the SERVER, precisely. Letting the client call
  // router.refresh() instead invalidates the whole router cache, so Next.js
  // re-fetches every prefetched route it holds — measured at ~35 requests
  // after one delete, including every sub-page of the project that no longer
  // exists. The delete itself takes 234 ms; the avalanche is what was felt.
  revalidatePath("/(app)/projects", "page");
  revalidatePath(`/(app)/projects/${projectId}`, "layout");

  return {};
}