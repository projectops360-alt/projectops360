"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, requireProjectManager } from "@/lib/auth";
import type { Locale } from "@/types/database";

// ── Zod Schemas ──────────────────────────────────────────────────────────────────

const createStakeholderSchema = z.object({
  name: z
    .string()
    .min(1, "nameRequired")
    .max(200, "nameTooLong")
    .transform((s) => s.trim()),
  role: z
    .string()
    .max(200, "roleTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  email: z
    .string()
    .email("invalidEmail")
    .optional()
    .or(z.literal("")),
  influence: z.enum(["high", "medium", "low"]).optional(),
  interest: z.enum(["high", "medium", "low"]).optional(),
  notes: z
    .string()
    .max(2000, "notesTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  languagePreference: z.enum(["en", "es"]).default("en"),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

const updateStakeholderSchema = z.object({
  stakeholderId: z.string().uuid(),
  name: z
    .string()
    .min(1, "nameRequired")
    .max(200, "nameTooLong")
    .transform((s) => s.trim()),
  role: z
    .string()
    .max(200, "roleTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  email: z
    .string()
    .email("invalidEmail")
    .optional()
    .or(z.literal("")),
  influence: z.enum(["high", "medium", "low"]).optional(),
  interest: z.enum(["high", "medium", "low"]).optional(),
  notes: z
    .string()
    .max(2000, "notesTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  languagePreference: z.enum(["en", "es"]).default("en"),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Server Actions ────────────────────────────────────────────────────────────────

export async function createStakeholderAction(input: {
  name: string;
  role?: string;
  email?: string;
  influence?: "high" | "medium" | "low";
  interest?: "high" | "medium" | "low";
  notes?: string;
  languagePreference: string;
  projectId: string;
  locale: string;
}): Promise<{ error?: string; stakeholderId?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  const __g = await requireProjectManager(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  // ── Validate ─────────────────────────────────────────────────────────────
  const parsed = createStakeholderSchema.safeParse({
    name: input.name,
    role: input.role,
    email: input.email,
    influence: input.influence,
    interest: input.interest,
    notes: input.notes,
    languagePreference: input.languagePreference,
    projectId: input.projectId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  // ── Build i18n fields ────────────────────────────────────────────────────
  const lang = data.locale as Locale;
  const roleI18n = data.role ? { [lang]: data.role } : {};
  const notesI18n = data.notes ? { [lang]: data.notes } : {};

  // ── Insert stakeholder ──────────────────────────────────────────────────
  const supabase = createAdminClient();

  const { data: stakeholder, error: insertError } = await supabase
    .from("stakeholders")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      name: data.name,
      role_i18n: roleI18n,
      email: data.email || null,
      influence: data.influence ?? null,
      interest: data.interest ?? null,
      notes_i18n: notesI18n,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to create stakeholder:", insertError);
    return { error: "unexpected" };
  }

  return { stakeholderId: stakeholder.id };
}

export async function updateStakeholderAction(input: {
  stakeholderId: string;
  name: string;
  role?: string;
  email?: string;
  influence?: "high" | "medium" | "low";
  interest?: "high" | "medium" | "low";
  notes?: string;
  languagePreference: string;
  projectId: string;
  locale: string;
}): Promise<{ error?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  const __g = await requireProjectManager(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  // ── Validate ─────────────────────────────────────────────────────────────
  const parsed = updateStakeholderSchema.safeParse({
    stakeholderId: input.stakeholderId,
    name: input.name,
    role: input.role,
    email: input.email,
    influence: input.influence,
    interest: input.interest,
    notes: input.notes,
    languagePreference: input.languagePreference,
    projectId: input.projectId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  // ── Build i18n fields ────────────────────────────────────────────────────
  const lang = data.locale as Locale;
  const roleI18n = data.role ? { [lang]: data.role } : {};
  const notesI18n = data.notes ? { [lang]: data.notes } : {};

  // ── Update stakeholder ──────────────────────────────────────────────────
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("stakeholders")
    .update({
      name: data.name,
      role_i18n: roleI18n,
      email: data.email || null,
      influence: data.influence ?? null,
      interest: data.interest ?? null,
      notes_i18n: notesI18n,
    })
    .eq("id", data.stakeholderId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update stakeholder:", updateError);
    return { error: "unexpected" };
  }

  return {};
}

export async function archiveStakeholderAction(
  stakeholderId: string,
): Promise<{ error?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  // ── Soft delete ─────────────────────────────────────────────────────────
  const supabase = createAdminClient();

  const { data: __row } = await supabase
    .from("stakeholders").select("project_id")
    .eq("id", stakeholderId).eq("organization_id", org.organizationId).maybeSingle();
  if (!__row?.project_id) return { error: "not_found" };
  const __g = await requireProjectManager(__row.project_id as string);
  if (!__g.ok) return { error: __g.error };

  const { error: deleteError } = await supabase
    .from("stakeholders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", stakeholderId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Failed to archive stakeholder:", deleteError);
    return { error: "unexpected" };
  }

  return {};
}