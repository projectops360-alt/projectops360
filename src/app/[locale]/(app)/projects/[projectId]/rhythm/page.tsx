import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, I18nField, AgendaSection } from "@/types/database";
import { RhythmClient } from "./rhythm-client";
import type { EventView, MeetingView, StakeholderOption } from "./types";

export const dynamic = "force-dynamic";

export default async function RhythmPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const lang = locale as Locale;
  const { guardProjectTab } = await import("@/lib/auth/project-guard");
  await guardProjectTab(projectId, "rhythm");

  const org = await getOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects").select("id").eq("id", projectId)
    .eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!project) notFound();

  const [eventsRes, meetingsRes, attendeesRes, decisionsRes, actionsRes, memoryRes, stakeholdersRes] = await Promise.all([
    supabase.from("project_events")
      .select("id, title, description, event_type, start_datetime, end_datetime, status, priority")
      .eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null)
      .order("start_datetime", { ascending: true }).limit(500),
    supabase.from("meetings")
      .select("id, event_id, meeting_type, objective, expected_outcome, agenda_json, notes_i18n, summary_i18n, meeting_status, meeting_link")
      .eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null)
      .not("event_id", "is", null),
    supabase.from("meeting_attendees")
      .select("id, meeting_id, name, stakeholder_id, role, attendance_status")
      .eq("organization_id", org.organizationId),
    supabase.from("decisions")
      .select("id, meeting_id, title_i18n, impact_area")
      .eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null)
      .not("meeting_id", "is", null),
    supabase.from("action_items")
      .select("id, meeting_id, title_i18n, description_i18n, due_date, priority, status")
      .eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null)
      .not("meeting_id", "is", null),
    supabase.from("project_memory_items")
      .select("metadata")
      .eq("project_id", projectId).eq("organization_id", org.organizationId)
      .eq("source_system", "rhythm_center").is("deleted_at", null),
    supabase.from("stakeholders")
      .select("id, name").eq("project_id", projectId).eq("organization_id", org.organizationId)
      .is("deleted_at", null).limit(200),
  ]);

  // Index helpers
  const attendeesByMeeting = new Map<string, MeetingView["attendees"]>();
  for (const a of attendeesRes.data ?? []) {
    const arr = attendeesByMeeting.get(a.meeting_id) ?? [];
    arr.push({ id: a.id, name: a.name, stakeholderId: a.stakeholder_id, role: a.role, attendanceStatus: a.attendance_status });
    attendeesByMeeting.set(a.meeting_id, arr);
  }
  const decisionsByMeeting = new Map<string, MeetingView["decisions"]>();
  for (const d of decisionsRes.data ?? []) {
    if (!d.meeting_id) continue;
    const arr = decisionsByMeeting.get(d.meeting_id) ?? [];
    arr.push({ id: d.id, title: getI18nValue(d.title_i18n as I18nField, lang) || "Decision", impactArea: d.impact_area ?? null });
    decisionsByMeeting.set(d.meeting_id, arr);
  }
  const actionsByMeeting = new Map<string, MeetingView["actionItems"]>();
  for (const a of actionsRes.data ?? []) {
    if (!a.meeting_id) continue;
    const arr = actionsByMeeting.get(a.meeting_id) ?? [];
    arr.push({
      id: a.id, title: getI18nValue(a.title_i18n as I18nField, lang) || "Action",
      description: getI18nValue(a.description_i18n as I18nField, lang) || null,
      dueDate: a.due_date, priority: a.priority ?? "medium", status: a.status ?? "pending",
    });
    actionsByMeeting.set(a.meeting_id, arr);
  }
  const syncedMeetingIds = new Set<string>();
  for (const m of memoryRes.data ?? []) {
    const mid = (m.metadata as Record<string, unknown> | null)?.meeting_id;
    if (typeof mid === "string") syncedMeetingIds.add(mid);
  }

  const meetingByEvent = new Map<string, MeetingView>();
  for (const m of meetingsRes.data ?? []) {
    if (!m.event_id) continue;
    meetingByEvent.set(m.event_id, {
      id: m.id,
      meetingType: m.meeting_type,
      objective: m.objective,
      expectedOutcome: m.expected_outcome,
      agenda: (m.agenda_json ?? []) as AgendaSection[],
      notes: getI18nValue(m.notes_i18n as I18nField, lang) || "",
      summary: getI18nValue(m.summary_i18n as I18nField, lang) || "",
      meetingStatus: m.meeting_status,
      meetingLink: m.meeting_link ?? null,
      attendees: attendeesByMeeting.get(m.id) ?? [],
      decisions: decisionsByMeeting.get(m.id) ?? [],
      actionItems: actionsByMeeting.get(m.id) ?? [],
      memorySynced: syncedMeetingIds.has(m.id),
    });
  }

  const events: EventView[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id, title: e.title, description: e.description, eventType: e.event_type,
    startDatetime: e.start_datetime, endDatetime: e.end_datetime, status: e.status, priority: e.priority,
    meeting: meetingByEvent.get(e.id) ?? null,
  }));

  const stakeholders: StakeholderOption[] = (stakeholdersRes.data ?? []).map((s) => ({ id: s.id, name: s.name || "—" }));

  return <RhythmClient locale={locale} projectId={projectId} events={events} stakeholders={stakeholders} />;
}
