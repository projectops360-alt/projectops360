"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function createProjectAction(input: {
  name: string;
  description: string;
  status: string;
  projectType?: string;
  useTemplate?: boolean;
  defaultLanguage: string;
  locale: string;
}): Promise<{ error?: string; projectId?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  // ── Validate ─────────────────────────────────────────────────────────────
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

  // ── Generate slug ───────────────────────────────────────────────────────
  const slug = generateSlug(data.name);

  // ── Insert project ──────────────────────────────────────────────────────
  const supabase = createAdminClient();

  // Check for slug uniqueness within the org
  let suffix = 0;
  let finalSlug = slug;

  while (true) {
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("organization_id", org.organizationId)
      .eq("slug", finalSlug)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existing) break;

    suffix++;
    finalSlug = `${slug}-${suffix}`;
  }

  // Build i18n fields — put the name/description in the selected language
  const titleI18n =
    data.locale === "es"
      ? { es: data.name }
      : { en: data.name };

  const descriptionI18n =
    data.locale === "es"
      ? { es: data.description || undefined }
      : { en: data.description || undefined };

  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({
      organization_id: org.organizationId,
      slug: finalSlug,
      title_i18n: titleI18n,
      description_i18n: descriptionI18n || {},
      status: data.status,
      project_type: data.projectType,
      created_by: org.userId,
      // The creator is the responsible PM by default (so they retain access and
      // appear as the project's manager under the project-scoped model).
      project_manager_id: org.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    // Handle unique constraint violation
    if (insertError.code === "23505") {
      return { error: "slug_exists" };
    }
    return { error: "unexpected" };
  }

  // ── Create the empty Project Charter (the official foundation step) ───────
  // The user is redirected here right after creation to define the charter
  // before real execution begins.
  try {
    await createCharterForProject(supabase, org.organizationId, project.id, org.userId, data.name);
  } catch (e) {
    console.error("Charter creation failed:", e);
  }

  // ── Instantiate template (milestones, tasks, dependencies, resources,
  //    budget placeholders, risk placeholders) ─────────────────────────────
  if (data.useTemplate) {
    const template = getTemplateForType(data.projectType);
    if (template) {
      try {
        await instantiateTemplate({
          organizationId: org.organizationId,
          projectId: project.id,
          template,
          createdBy: org.userId,
        });
      } catch (e) {
        // The project itself was created; a template failure should not lose it.
        console.error("Template instantiation failed:", e);
      }
    }
  }

  return { projectId: project.id };
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

  return {};
}