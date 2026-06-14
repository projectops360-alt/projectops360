"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { buildAgenda, getTemplate } from "@/lib/rhythm/templates";
import type { Locale, AgendaSection } from "@/types/database";

const EVENT_TYPES = [
  "kickoff_meeting","status_update","stakeholder_review","project_review","project_closing","milestone",
  "deliverable_deadline","risk_review","budget_review","change_review","vendor_followup",
  "resource_planning","action_followup","other",
] as const;
const EVENT_STATUSES = ["draft","scheduled","agenda_ready","in_progress","completed","follow_up_pending","closed","canceled"] as const;
const PRIORITIES = ["low","medium","high","critical"] as const;

function err(msg = "unexpected") { return { error: msg }; }
/** Normalize a pasted meeting link: trim, prepend https:// when no scheme. */
function normalizeLink(v?: string): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return `https://${s}`.slice(0, 500);
  return s.slice(0, 500);
}
async function auth() { try { return await getOrgContext(); } catch { return null; } }
function rv(locale: string, projectId: string) {
  revalidatePath(`/${locale}/projects/${projectId}/rhythm`, "page");
}

// ── Generic calendar event ────────────────────────────────────────────────────

export async function createEventAction(input: {
  projectId: string; title: string; description?: string; eventType: string;
  startDatetime: string; endDatetime?: string; priority?: string; status?: string;
  relatedMilestoneId?: string; relatedTaskId?: string; relatedRiskId?: string; locale: string;
}): Promise<{ error?: string; eventId?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  const schema = z.object({
    projectId: z.string().uuid(),
    title: z.string().min(1).max(300).transform((s) => s.trim()),
    description: z.string().max(4000).optional(),
    eventType: z.enum(EVENT_TYPES).default("other"),
    startDatetime: z.string().min(1),
    endDatetime: z.string().optional(),
    priority: z.enum(PRIORITIES).default("medium"),
    status: z.enum(EVENT_STATUSES).default("scheduled"),
    relatedMilestoneId: z.string().uuid().optional(),
    relatedTaskId: z.string().uuid().optional(),
    relatedRiskId: z.string().uuid().optional(),
  });
  const p = schema.safeParse(input);
  if (!p.success) return err(p.error.issues[0]?.message || "validation_error");
  const d = p.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("project_events").insert({
    organization_id: org.organizationId, project_id: d.projectId,
    title: d.title, description: d.description || null, event_type: d.eventType,
    start_datetime: d.startDatetime, end_datetime: d.endDatetime || null,
    status: d.status, priority: d.priority, source: "manual",
    related_milestone_id: d.relatedMilestoneId || null,
    related_task_id: d.relatedTaskId || null,
    related_risk_id: d.relatedRiskId || null,
    created_by: org.userId,
  }).select("id").single();
  if (error || !data) return err();
  await logAudit({ org, projectId: d.projectId, action: "create", entityType: "project_events", entityId: data.id, metadata: { event_type: d.eventType } });
  rv(input.locale, d.projectId);
  return { eventId: data.id };
}

export async function updateEventAction(input: {
  eventId: string; projectId: string; title?: string; description?: string;
  startDatetime?: string; endDatetime?: string; priority?: string; status?: string; locale: string;
}): Promise<{ error?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  if (!z.string().uuid().safeParse(input.eventId).success) return err("validation_error");
  const patch: Record<string, unknown> = {};
  if (input.title) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.startDatetime) patch.start_datetime = input.startDatetime;
  if (input.endDatetime !== undefined) patch.end_datetime = input.endDatetime || null;
  if (input.priority && PRIORITIES.includes(input.priority as never)) patch.priority = input.priority;
  if (input.status && EVENT_STATUSES.includes(input.status as never)) patch.status = input.status;
  const supabase = createAdminClient();
  const { error } = await supabase.from("project_events").update(patch)
    .eq("id", input.eventId).eq("organization_id", org.organizationId).is("deleted_at", null);
  if (error) return err();
  // Keep the meeting status in sync when the event status changes.
  if (patch.status) {
    await supabase.from("meetings").update({ meeting_status: patch.status })
      .eq("event_id", input.eventId).eq("organization_id", org.organizationId);
  }
  rv(input.locale, input.projectId);
  return {};
}

export async function deleteEventAction(input: { eventId: string; projectId: string; locale: string }): Promise<{ error?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  const supabase = createAdminClient();
  const { error } = await supabase.from("project_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.eventId).eq("organization_id", org.organizationId).is("deleted_at", null);
  if (error) return err();
  // Cascade soft-delete the linked meeting.
  await supabase.from("meetings").update({ deleted_at: new Date().toISOString() })
    .eq("event_id", input.eventId).eq("organization_id", org.organizationId);
  await logAudit({ org, projectId: input.projectId, action: "delete", entityType: "project_events", entityId: input.eventId, metadata: { soft_delete: true } });
  rv(input.locale, input.projectId);
  return {};
}

// ── Create meeting from template (event + meeting + agenda + organizer) ────────

export async function createMeetingFromTemplateAction(input: {
  projectId: string; meetingType: string; title?: string; startDatetime: string;
  endDatetime?: string; priority?: string; meetingLink?: string;
  attendees?: { name?: string; stakeholderId?: string; role?: string }[]; locale: string;
}): Promise<{ error?: string; eventId?: string; meetingId?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  const schema = z.object({
    projectId: z.string().uuid(),
    meetingType: z.enum(["kickoff","status_update","stakeholder_review","project_review","closing","other"]),
    title: z.string().max(300).optional(),
    startDatetime: z.string().min(1),
    endDatetime: z.string().optional(),
    priority: z.enum(PRIORITIES).default("medium"),
  });
  const p = schema.safeParse(input);
  if (!p.success) return err(p.error.issues[0]?.message || "validation_error");
  const d = p.data;
  const lang = (input.locale as Locale) ?? "en";
  const tpl = getTemplate(d.meetingType);
  const title = (d.title?.trim()) || (lang === "es" ? tpl.label.es : tpl.label.en);
  const agenda = buildAgenda(d.meetingType, lang);

  const supabase = createAdminClient();
  // 1. Event
  const { data: ev, error: evErr } = await supabase.from("project_events").insert({
    organization_id: org.organizationId, project_id: d.projectId, title,
    event_type: tpl.eventType, start_datetime: d.startDatetime, end_datetime: d.endDatetime || null,
    status: "agenda_ready", priority: d.priority, source: "template", created_by: org.userId,
  }).select("id").single();
  if (evErr || !ev) return err();

  // 2. Meeting (extends the event); reuse meetings table
  const { data: mt, error: mtErr } = await supabase.from("meetings").insert({
    organization_id: org.organizationId, project_id: d.projectId, event_id: ev.id,
    title_i18n: { [lang]: title }, meeting_type: d.meetingType,
    objective: lang === "es" ? tpl.objective.es : tpl.objective.en,
    expected_outcome: lang === "es" ? tpl.expectedOutcome.es : tpl.expectedOutcome.en,
    agenda_json: agenda, meeting_status: "agenda_ready", meeting_link: normalizeLink(input.meetingLink),
    meeting_date: d.startDatetime, status: "scheduled", created_by: org.userId,
  }).select("id").single();
  if (mtErr || !mt) return err();

  // 3. Organizer + attendees
  const attendeeRows = [
    { organization_id: org.organizationId, meeting_id: mt.id, user_id: org.userId, name: org.displayName ?? null, role: "organizer", attendance_status: "accepted" },
    ...(input.attendees ?? []).filter((a) => a.name?.trim() || a.stakeholderId).map((a) => ({
      organization_id: org.organizationId, meeting_id: mt.id,
      stakeholder_id: a.stakeholderId || null, name: a.name?.trim() || null,
      role: ["organizer","presenter","required","optional"].includes(a.role ?? "") ? a.role : "required",
      attendance_status: "invited",
    })),
  ];
  await supabase.from("meeting_attendees").insert(attendeeRows);

  await logAudit({ org, projectId: d.projectId, action: "create", entityType: "meetings", entityId: mt.id, metadata: { meeting_type: d.meetingType, via: "template" } });
  rv(input.locale, d.projectId);
  return { eventId: ev.id, meetingId: mt.id };
}

// ── Meeting agenda / notes ─────────────────────────────────────────────────────

export async function updateMeetingAction(input: {
  meetingId: string; projectId: string; locale: string;
  agenda?: AgendaSection[]; notes?: string; objective?: string; expectedOutcome?: string; meetingLink?: string;
}): Promise<{ error?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  const lang = (input.locale as Locale) ?? "en";
  const patch: Record<string, unknown> = {};
  if (input.agenda) patch.agenda_json = input.agenda.slice(0, 40).map((s) => ({ key: String(s.key), title: String(s.title).slice(0, 200), content: String(s.content ?? "").slice(0, 8000) }));
  if (input.notes !== undefined) patch.notes_i18n = input.notes ? { [lang]: input.notes } : {};
  if (input.objective !== undefined) patch.objective = input.objective || null;
  if (input.expectedOutcome !== undefined) patch.expected_outcome = input.expectedOutcome || null;
  if (input.meetingLink !== undefined) patch.meeting_link = normalizeLink(input.meetingLink);
  const supabase = createAdminClient();
  const { error } = await supabase.from("meetings").update(patch)
    .eq("id", input.meetingId).eq("organization_id", org.organizationId).is("deleted_at", null);
  if (error) return err();
  rv(input.locale, input.projectId);
  return {};
}

// ── Attendees ──────────────────────────────────────────────────────────────────

export async function addAttendeeAction(input: {
  meetingId: string; projectId: string; name?: string; stakeholderId?: string; role?: string; locale: string;
}): Promise<{ error?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  if (!input.name?.trim() && !input.stakeholderId) return err("validation_error");
  const supabase = createAdminClient();
  const { error } = await supabase.from("meeting_attendees").insert({
    organization_id: org.organizationId, meeting_id: input.meetingId,
    stakeholder_id: input.stakeholderId || null, name: input.name?.trim() || null,
    role: ["organizer","presenter","required","optional"].includes(input.role ?? "") ? input.role : "required",
    attendance_status: "invited",
  });
  if (error) return err();
  rv(input.locale, input.projectId);
  return {};
}

export async function updateAttendeeAction(input: {
  attendeeId: string; projectId: string; attendanceStatus?: string; role?: string; locale: string;
}): Promise<{ error?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  const patch: Record<string, unknown> = {};
  if (input.attendanceStatus && ["invited","accepted","declined","tentative","attended","absent"].includes(input.attendanceStatus)) patch.attendance_status = input.attendanceStatus;
  if (input.role && ["organizer","presenter","required","optional"].includes(input.role)) patch.role = input.role;
  const supabase = createAdminClient();
  const { error } = await supabase.from("meeting_attendees").update(patch)
    .eq("id", input.attendeeId).eq("organization_id", org.organizationId);
  if (error) return err();
  rv(input.locale, input.projectId);
  return {};
}

export async function removeAttendeeAction(input: { attendeeId: string; projectId: string; locale: string }): Promise<{ error?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  const supabase = createAdminClient();
  const { error } = await supabase.from("meeting_attendees").delete()
    .eq("id", input.attendeeId).eq("organization_id", org.organizationId);
  if (error) return err();
  rv(input.locale, input.projectId);
  return {};
}

// ── Decisions & action items (reuse decisions / action_items) ──────────────────

export async function addMeetingDecisionAction(input: {
  meetingId: string; projectId: string; decision: string; impactArea?: string; locale: string;
}): Promise<{ error?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  if (!input.decision?.trim()) return err("validation_error");
  const lang = (input.locale as Locale) ?? "en";
  const supabase = createAdminClient();
  const { error } = await supabase.from("decisions").insert({
    organization_id: org.organizationId, project_id: input.projectId, meeting_id: input.meetingId,
    title_i18n: { [lang]: input.decision.trim().slice(0, 200) },
    description_i18n: { [lang]: input.decision.trim() },
    status: "accepted", decision_date: new Date().toISOString().slice(0, 10),
    impact_area: input.impactArea || null, source_type: "meeting", source_record_id: input.meetingId,
    created_by: org.userId,
  });
  if (error) return err();
  rv(input.locale, input.projectId);
  return {};
}

export async function addMeetingActionItemAction(input: {
  meetingId: string; projectId: string; title: string; description?: string;
  dueDate?: string; priority?: string; relatedTaskId?: string; locale: string;
}): Promise<{ error?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  if (!input.title?.trim()) return err("validation_error");
  const lang = (input.locale as Locale) ?? "en";
  const supabase = createAdminClient();
  const { error } = await supabase.from("action_items").insert({
    organization_id: org.organizationId, project_id: input.projectId, meeting_id: input.meetingId,
    title_i18n: { [lang]: input.title.trim() },
    description_i18n: input.description ? { [lang]: input.description.trim() } : {},
    status: "pending",
    priority: ["low","medium","high","critical"].includes(input.priority ?? "") ? input.priority : "medium",
    due_date: input.dueDate || null,
    related_task_id: input.relatedTaskId || null,
    created_by: org.userId,
  });
  if (error) return err();
  rv(input.locale, input.projectId);
  return {};
}

// ── Summary + complete (AI + Project Memory) ───────────────────────────────────

export async function generateSummaryAction(input: { meetingId: string; projectId: string; locale: string }): Promise<{ error?: string; summary?: string }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  const { generateMeetingSummary } = await import("@/lib/rhythm/service");
  const res = await generateMeetingSummary(org, input.meetingId, (input.locale as Locale) ?? "en");
  rv(input.locale, input.projectId);
  if (!res.ok) return err("no_content");
  return { summary: res.summary };
}

export async function completeMeetingAction(input: { meetingId: string; projectId: string; locale: string }): Promise<{ error?: string; memoryItems?: number }> {
  const org = await auth(); if (!org) return err("not_authenticated");
  const { completeMeeting } = await import("@/lib/rhythm/service");
  const res = await completeMeeting(org, input.meetingId, (input.locale as Locale) ?? "en");
  await logAudit({ org, projectId: input.projectId, action: "update", entityType: "meetings", entityId: input.meetingId, metadata: { completed: true, memory_items: res.memoryItems } });
  rv(input.locale, input.projectId);
  return { memoryItems: res.memoryItems };
}
