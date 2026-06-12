"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { emitAndAutoLink } from "@/lib/graph/emit-event";
import type { Locale } from "@/types/database";
import { revalidatePath } from "next/cache";

// ── Zod Schemas ──────────────────────────────────────────────────────────────────

const statusValues = ["scheduled", "in_progress", "completed", "cancelled"] as const;

const createMeetingSchema = z.object({
  title: z
    .string()
    .min(1, "titleRequired")
    .max(200, "titleTooLong")
    .transform((s) => s.trim()),
  agenda: z
    .string()
    .max(2000, "agendaTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  notes: z
    .string()
    .max(5000, "notesTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  summary: z
    .string()
    .max(2000, "summaryTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  meetingDate: z.string().optional(),
  durationMinutes: z
    .number()
    .int()
    .positive("durationInvalid")
    .optional()
    .or(z.nan().transform(() => undefined)),
  location: z
    .string()
    .max(200, "locationTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  attendees: z
    .string()
    .max(500, "attendeesTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  status: z.enum(statusValues).default("scheduled"),
  linkedStakeholderIds: z.array(z.string().uuid()).optional().default([]),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

const updateMeetingSchema = z.object({
  meetingId: z.string().uuid(),
  title: z
    .string()
    .min(1, "titleRequired")
    .max(200, "titleTooLong")
    .transform((s) => s.trim()),
  agenda: z
    .string()
    .max(2000, "agendaTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  notes: z
    .string()
    .max(5000, "notesTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  summary: z
    .string()
    .max(2000, "summaryTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  meetingDate: z.string().optional(),
  durationMinutes: z
    .number()
    .int()
    .positive("durationInvalid")
    .optional()
    .or(z.nan().transform(() => undefined)),
  location: z
    .string()
    .max(200, "locationTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  attendees: z
    .string()
    .max(500, "attendeesTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  status: z.enum(statusValues).default("scheduled"),
  linkedStakeholderIds: z.array(z.string().uuid()).optional().default([]),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Server Actions ────────────────────────────────────────────────────────────────

export async function createMeetingAction(input: {
  title: string;
  agenda?: string;
  notes?: string;
  summary?: string;
  meetingDate?: string;
  durationMinutes?: number;
  location?: string;
  attendees?: string;
  status: string;
  linkedStakeholderIds?: string[];
  projectId: string;
  locale: string;
}): Promise<{ error?: string; meetingId?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const parsed = createMeetingSchema.safeParse({
    title: input.title,
    agenda: input.agenda,
    notes: input.notes,
    summary: input.summary,
    meetingDate: input.meetingDate,
    durationMinutes: input.durationMinutes,
    location: input.location,
    attendees: input.attendees,
    status: input.status,
    linkedStakeholderIds: input.linkedStakeholderIds,
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
  const titleI18n = { [lang]: data.title };
  const agendaI18n = data.agenda ? { [lang]: data.agenda } : {};
  const notesI18n = data.notes ? { [lang]: data.notes } : {};
  const summaryI18n = data.summary ? { [lang]: data.summary } : {};

  // ── Insert meeting ────────────────────────────────────────────────────────
  const supabase = createAdminClient();

  const { data: meeting, error: insertError } = await supabase
    .from("meetings")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      title_i18n: titleI18n,
      agenda_i18n: agendaI18n,
      notes_i18n: notesI18n,
      summary_i18n: summaryI18n,
      meeting_date: data.meetingDate || null,
      duration_minutes: data.durationMinutes ?? null,
      location: data.location || null,
      attendees: data.attendees || null,
      status: data.status,
      linked_stakeholder_ids: data.linkedStakeholderIds,
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to create meeting:", insertError);
    return { error: "unexpected" };
  }

  // Fire-and-forget: generate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("meetings", meeting.id, {
      title_i18n: titleI18n,
      summary_i18n: summaryI18n,
      agenda_i18n: agendaI18n,
      notes_i18n: notesI18n,
    }).catch(() => {});
  });

  // Fire-and-forget: emit Living Graph event for meeting
  emitAndAutoLink({
    organizationId: org.organizationId,
    projectId: data.projectId,
    nodeType: "communication_flow",
    sourceEntityType: "meetings",
    sourceEntityId: meeting.id,
    title: data.title,
    metadata: {
      meeting_date: data.meetingDate ?? null,
      status: data.status,
    },
  });

  revalidatePath(`/${data.locale}/projects/${data.projectId}`, "layout");

  return { meetingId: meeting.id };
}

export async function updateMeetingAction(input: {
  meetingId: string;
  title: string;
  agenda?: string;
  notes?: string;
  summary?: string;
  meetingDate?: string;
  durationMinutes?: number;
  location?: string;
  attendees?: string;
  status: string;
  linkedStakeholderIds?: string[];
  projectId: string;
  locale: string;
}): Promise<{ error?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const parsed = updateMeetingSchema.safeParse({
    meetingId: input.meetingId,
    title: input.title,
    agenda: input.agenda,
    notes: input.notes,
    summary: input.summary,
    meetingDate: input.meetingDate,
    durationMinutes: input.durationMinutes,
    location: input.location,
    attendees: input.attendees,
    status: input.status,
    linkedStakeholderIds: input.linkedStakeholderIds,
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
  const titleI18n = { [lang]: data.title };
  const agendaI18n = data.agenda ? { [lang]: data.agenda } : {};
  const notesI18n = data.notes ? { [lang]: data.notes } : {};
  const summaryI18n = data.summary ? { [lang]: data.summary } : {};

  // ── Update meeting ───────────────────────────────────────────────────────
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("meetings")
    .update({
      title_i18n: titleI18n,
      agenda_i18n: agendaI18n,
      notes_i18n: notesI18n,
      summary_i18n: summaryI18n,
      meeting_date: data.meetingDate || null,
      duration_minutes: data.durationMinutes ?? null,
      location: data.location || null,
      attendees: data.attendees || null,
      status: data.status,
      linked_stakeholder_ids: data.linkedStakeholderIds,
    })
    .eq("id", data.meetingId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update meeting:", updateError);
    return { error: "unexpected" };
  }

  // Fire-and-forget: regenerate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("meetings", data.meetingId, {
      title_i18n: titleI18n,
      summary_i18n: summaryI18n,
      agenda_i18n: agendaI18n,
      notes_i18n: notesI18n,
    }).catch(() => {});
  });

  revalidatePath(`/${data.locale}/projects/${data.projectId}`, "layout");

  return {};
}

export async function archiveMeetingAction(
  meetingId: string,
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

  const { error: deleteError } = await supabase
    .from("meetings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", meetingId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Failed to archive meeting:", deleteError);
    return { error: "unexpected" };
  }

  return {};
}