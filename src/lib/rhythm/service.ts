// ============================================================================
// ProjectOps360° — Rhythm Center service (server-only)
// ============================================================================
// AI summary + Project Memory sync for meetings. Reuses existing infra:
//   • runAi('summary') for the AI meeting summary.
//   • project_memory_items + processMemoryItem (classification + vector index).
// No new AI prompt or vector system — pure reuse.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { AgendaSection, I18nField, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";

type Supabase = ReturnType<typeof createAdminClient>;

// ── Gather a meeting's full text (agenda + notes) ───────────────────────────

function agendaToText(agenda: AgendaSection[]): string {
  return (agenda ?? [])
    .filter((s) => s.content?.trim())
    .map((s) => `## ${s.title}\n${s.content.trim()}`)
    .join("\n\n");
}

async function loadMeeting(supabase: Supabase, organizationId: string, meetingId: string) {
  const { data } = await supabase
    .from("meetings")
    .select("id, project_id, title_i18n, notes_i18n, agenda_json, meeting_date, attendees")
    .eq("id", meetingId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single();
  return data;
}

// ── AI summary (reuses the existing 'summary' prompt) ───────────────────────

export async function generateMeetingSummary(
  org: OrgContext,
  meetingId: string,
  locale: Locale,
): Promise<{ ok: boolean; summary?: string }> {
  const supabase = createAdminClient();
  const meeting = await loadMeeting(supabase, org.organizationId, meetingId);
  if (!meeting) return { ok: false };

  const title = getI18nValue(meeting.title_i18n as I18nField, locale) || "Meeting";
  const notes = getI18nValue(meeting.notes_i18n as I18nField, locale) || "";
  const agenda = agendaToText((meeting.agenda_json ?? []) as AgendaSection[]);
  const content = [agenda, notes].filter(Boolean).join("\n\n");
  if (!content.trim()) return { ok: false };

  try {
    const { runAi } = await import("@/lib/ai/service");
    const result = await runAi(org, {
      promptType: "summary",
      templateVars: { title, content: content.slice(0, 12000) },
      sourceType: "meeting",
      sourceId: meetingId,
    });
    if (result.status !== "completed") return { ok: false };

    const parsed = (result.parsedJson ?? {}) as Record<string, unknown>;
    const summary = typeof parsed.summary === "string" ? parsed.summary : result.content;

    await supabase
      .from("meetings")
      .update({
        summary_i18n: summary ? { [locale]: summary } : {},
        ai_summary: parsed,
      })
      .eq("id", meetingId)
      .eq("organization_id", org.organizationId);

    return { ok: true, summary };
  } catch (err) {
    console.error("[rhythm] meeting summary failed:", err);
    return { ok: false };
  }
}

// ── Project Memory sync ─────────────────────────────────────────────────────

/**
 * Persist a meeting's summary, decisions and action items into Project Memory
 * and index them into vector search. Idempotent: previous memory items for this
 * meeting are replaced. Never throws (best-effort).
 */
export async function syncMeetingToMemory(
  org: OrgContext,
  meetingId: string,
  locale: Locale,
): Promise<{ created: number }> {
  const supabase = createAdminClient();
  const meeting = await loadMeeting(supabase, org.organizationId, meetingId);
  if (!meeting || !meeting.project_id) return { created: 0 };

  const projectId = meeting.project_id as string;
  const title = getI18nValue(meeting.title_i18n as I18nField, locale) || "Meeting";
  const notes = getI18nValue(meeting.notes_i18n as I18nField, locale) || "";
  const summary = getI18nValue(
    ((await supabase.from("meetings").select("summary_i18n").eq("id", meetingId).single()).data?.summary_i18n) as I18nField,
    locale,
  ) || "";
  const occurredAt = meeting.meeting_date as string | null;
  const participants = typeof meeting.attendees === "string" && meeting.attendees
    ? meeting.attendees.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Idempotency: clear previous memory items sourced from this meeting.
  await supabase
    .from("project_memory_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .contains("metadata", { meeting_id: meetingId })
    .is("deleted_at", null);

  const [decisionsRes, actionsRes] = await Promise.all([
    supabase.from("decisions").select("title_i18n, description_i18n, rationale_i18n, impact_area")
      .eq("meeting_id", meetingId).eq("organization_id", org.organizationId).is("deleted_at", null),
    supabase.from("action_items").select("title_i18n, description_i18n, priority, due_date")
      .eq("meeting_id", meetingId).eq("organization_id", org.organizationId).is("deleted_at", null),
  ]);

  const items: Record<string, unknown>[] = [];
  const base = {
    organization_id: org.organizationId,
    project_id: projectId,
    occurred_at: occurredAt,
    participants,
    author_name: org.displayName ?? null,
    visibility: "project",
    ai_status: "pending",
    index_status: "pending",
    created_by: org.userId,
  };

  // 1. Meeting summary + notes
  const meetingContent = [summary && `Summary: ${summary}`, notes && `Notes: ${notes}`].filter(Boolean).join("\n\n");
  if (meetingContent.trim()) {
    items.push({
      ...base, title: `Meeting: ${title}`, content: meetingContent, summary: summary || null,
      source_type: "meeting_note", source_system: "rhythm_center",
      metadata: { meeting_id: meetingId, kind: "meeting_summary" },
    });
  }
  // 2. Decisions
  for (const d of decisionsRes.data ?? []) {
    const dt = getI18nValue(d.title_i18n as I18nField, locale) || "Decision";
    const dd = [getI18nValue(d.description_i18n as I18nField, locale), getI18nValue(d.rationale_i18n as I18nField, locale)].filter(Boolean).join("\n");
    items.push({
      ...base, title: `Decision: ${dt}`, content: dd || dt, source_type: "decision",
      source_system: "rhythm_center", importance_level: "high",
      metadata: { meeting_id: meetingId, kind: "decision", impact_area: d.impact_area ?? null },
    });
  }
  // 3. Action items
  for (const a of actionsRes.data ?? []) {
    const at = getI18nValue(a.title_i18n as I18nField, locale) || "Action item";
    const ad = getI18nValue(a.description_i18n as I18nField, locale);
    items.push({
      ...base, title: `Action: ${at}`, content: ad || at, source_type: "action_item",
      source_system: "rhythm_center",
      metadata: { meeting_id: meetingId, kind: "action_item", priority: a.priority, due_date: a.due_date },
    });
  }

  if (items.length === 0) return { created: 0 };

  const { data: inserted } = await supabase
    .from("project_memory_items")
    .insert(items)
    .select("id");

  // Fire-and-forget: classify + vector-index each new memory item.
  void import("@/lib/memory/service").then(({ processMemoryItem }) => {
    for (const row of inserted ?? []) {
      processMemoryItem(org, row.id, { runClassification: true }).catch(() => {});
    }
  });

  return { created: inserted?.length ?? 0 };
}

/** Complete a meeting: AI summary → memory sync → set statuses. */
export async function completeMeeting(
  org: OrgContext,
  meetingId: string,
  locale: Locale,
): Promise<{ ok: boolean; memoryItems: number }> {
  const supabase = createAdminClient();

  await generateMeetingSummary(org, meetingId, locale);
  const { created } = await syncMeetingToMemory(org, meetingId, locale);

  // Mark meeting + its event completed.
  await supabase
    .from("meetings")
    .update({ meeting_status: "completed", status: "completed" })
    .eq("id", meetingId)
    .eq("organization_id", org.organizationId);

  const { data: m } = await supabase
    .from("meetings").select("event_id, project_id, meeting_type, ai_summary").eq("id", meetingId).single();
  if (m?.event_id) {
    await supabase.from("project_events")
      .update({ status: created > 0 ? "completed" : "follow_up_pending" })
      .eq("id", m.event_id).eq("organization_id", org.organizationId);
  }

  // Closing meeting → auto-generate the Project Closeout Report (metrics + AI
  // executive summary), store it on the meeting and save it to Project Memory.
  if (m?.meeting_type === "closing" && m.project_id) {
    try {
      const { generateCloseoutReport } = await import("./closeout");
      const report = await generateCloseoutReport(org, m.project_id, locale);
      await supabase.from("meetings")
        .update({ ai_summary: { ...((m.ai_summary as Record<string, unknown>) ?? {}), closeout: report } })
        .eq("id", meetingId).eq("organization_id", org.organizationId);

      if (report.executiveSummary) {
        const { data: mem } = await supabase.from("project_memory_items").insert({
          organization_id: org.organizationId, project_id: m.project_id,
          title: locale === "es" ? "Reporte de Cierre del Proyecto" : "Project Closeout Report",
          content: report.executiveSummary, summary: report.executiveSummary,
          source_type: "document", source_system: "rhythm_center", importance_level: "high",
          author_name: org.displayName ?? null, visibility: "project", ai_status: "skipped", index_status: "pending",
          created_by: org.userId, metadata: { meeting_id: meetingId, kind: "closeout_report" },
        }).select("id").single();
        if (mem) void import("@/lib/memory/service").then(({ processMemoryItem }) => processMemoryItem(org, mem.id, { runClassification: false }).catch(() => {}));
      }
    } catch (err) {
      console.error("[rhythm] closeout report failed:", err);
    }
  }

  return { ok: true, memoryItems: created };
}
