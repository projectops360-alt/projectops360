"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { logRythmActivity } from "@/lib/rythm/activity-log";
import { setMeetingRythmStatus } from "@/lib/rythm/processing-service";
import {
  getMeetingIntelligenceContext,
  extractIntelligence,
  upsertIntelligence,
  getMeetingIntelligence,
  intelligenceExists,
} from "@/lib/rythm/intelligence-service";
import type { Locale } from "@/types/database";
import type { RythmIntelligence } from "@/lib/rythm/types";

const PRIORITY_TO_ROADMAP: Record<string, string> = { high: "p1", medium: "p2", low: "p3" };

// ── generateMeetingIntelligenceAction ───────────────────────────────────────────

export async function generateMeetingIntelligenceAction(input: {
  projectId: string;
  meetingId: string;
  locale: string;
}): Promise<{ intelligence?: RythmIntelligence | null; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z
    .object({ projectId: z.string().uuid(), meetingId: z.string().uuid(), locale: z.enum(["en", "es"]).default("en") })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const ctx = await getMeetingIntelligenceContext(
      supabase,
      org.organizationId,
      parsed.data.projectId,
      parsed.data.meetingId,
      parsed.data.locale as Locale,
    );
    if (!ctx) return { error: "meeting_not_found" };
    if (!ctx.hasTranscript) return { error: "no_transcript" };

    const existed = await intelligenceExists(supabase, org.organizationId, parsed.data.meetingId);

    let data;
    try {
      data = await extractIntelligence(ctx);
    } catch (err) {
      if (err instanceof Error && err.message.includes("OPENAI_API_KEY")) return { error: "noApiKey" };
      console.error("extractIntelligence failed:", err);
      return { error: "ai_failed" };
    }

    await upsertIntelligence(supabase, org.organizationId, org.userId, ctx, data);
    await setMeetingRythmStatus(supabase, org.organizationId, parsed.data.meetingId, "summary_ready");

    await logRythmActivity(supabase, org.organizationId, {
      projectId: parsed.data.projectId,
      meetingId: parsed.data.meetingId,
      action: existed ? "meeting_intelligence_regenerated" : "meeting_intelligence_generated",
      details: { confidence: data.confidenceScore, model: data.model },
      userId: org.userId,
    });

    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    const intelligence = await getMeetingIntelligence(supabase, org.organizationId, parsed.data.meetingId);
    return { intelligence };
  } catch (err) {
    console.error("generateMeetingIntelligenceAction failed:", err);
    return { error: "ai_failed" };
  }
}

// ── getMeetingIntelligenceAction ─────────────────────────────────────────────

export async function getMeetingIntelligenceAction(input: {
  meetingId: string;
}): Promise<{ intelligence?: RythmIntelligence | null; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z.object({ meetingId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const intelligence = await getMeetingIntelligence(supabase, org.organizationId, parsed.data.meetingId);
    return { intelligence };
  } catch (err) {
    console.error("getMeetingIntelligenceAction failed:", err);
    return { error: "list_failed" };
  }
}

// ── Promotion helper ─────────────────────────────────────────────────────────

async function linkMeeting(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string | null,
  meetingId: string,
  targetType: string,
  targetId: string,
) {
  await supabase.from("traceability_links").insert({
    organization_id: orgId,
    source_type: "meeting",
    source_id: meetingId,
    target_type: targetType,
    target_id: targetId,
    link_type: "derived_from",
    created_by: userId,
  });
}

// ── promoteActionItemToTaskAction ────────────────────────────────────────────

export async function promoteActionItemToTaskAction(input: {
  projectId: string;
  meetingId: string;
  task: string;
  owner?: string;
  priority?: string;
  dueDate?: string | null;
}): Promise<{ taskId?: string; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      meetingId: z.string().uuid(),
      task: z.string().min(1).max(300).transform((s) => s.trim()),
      owner: z.string().max(200).optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
      dueDate: z.string().optional().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const notes: string[] = [];
    if (parsed.data.owner) notes.push(`Owner: ${parsed.data.owner}`);
    if (parsed.data.dueDate) notes.push(`Due: ${parsed.data.dueDate}`);
    notes.push("Promoted from Rythm meeting intelligence");

    const { data: task, error } = await supabase
      .from("roadmap_tasks")
      .insert({
        organization_id: org.organizationId,
        project_id: parsed.data.projectId,
        title: parsed.data.task,
        description: notes.join(" · "),
        status: "not_started",
        priority: PRIORITY_TO_ROADMAP[parsed.data.priority ?? "medium"] ?? "p2",
        order_index: 0,
        created_by: org.userId,
      })
      .select("id")
      .single();
    if (error || !task) return { error: "promote_failed" };

    await linkMeeting(supabase, org.organizationId, org.userId, parsed.data.meetingId, "task", task.id);
    await logRythmActivity(supabase, org.organizationId, {
      projectId: parsed.data.projectId,
      meetingId: parsed.data.meetingId,
      action: "action_item_promoted",
      details: { task_id: task.id, task: parsed.data.task },
      userId: org.userId,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { taskId: task.id };
  } catch (err) {
    console.error("promoteActionItemToTaskAction failed:", err);
    return { error: "promote_failed" };
  }
}

// ── promoteDecisionAction ─────────────────────────────────────────────────────

export async function promoteDecisionAction(input: {
  projectId: string;
  meetingId: string;
  locale: string;
  title: string;
  description?: string;
  owner?: string;
}): Promise<{ decisionId?: string; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      meetingId: z.string().uuid(),
      locale: z.enum(["en", "es"]).default("en"),
      title: z.string().min(1).max(300).transform((s) => s.trim()),
      description: z.string().max(2000).optional(),
      owner: z.string().max(200).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const lang = parsed.data.locale;
    const { data: decision, error } = await supabase
      .from("decisions")
      .insert({
        organization_id: org.organizationId,
        project_id: parsed.data.projectId,
        title_i18n: { [lang]: parsed.data.title },
        description_i18n: parsed.data.description ? { [lang]: parsed.data.description } : {},
        decision_maker: parsed.data.owner || null,
        source_type: "meeting",
        source_record_id: parsed.data.meetingId,
        status: "proposed",
        created_by: org.userId,
      })
      .select("id")
      .single();
    if (error || !decision) return { error: "promote_failed" };

    await linkMeeting(supabase, org.organizationId, org.userId, parsed.data.meetingId, "decision", decision.id);
    await logRythmActivity(supabase, org.organizationId, {
      projectId: parsed.data.projectId,
      meetingId: parsed.data.meetingId,
      action: "decision_promoted",
      details: { decision_id: decision.id, title: parsed.data.title },
      userId: org.userId,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { decisionId: decision.id };
  } catch (err) {
    console.error("promoteDecisionAction failed:", err);
    return { error: "promote_failed" };
  }
}

// ── promoteRiskAction ─────────────────────────────────────────────────────────

export async function promoteRiskAction(input: {
  projectId: string;
  meetingId: string;
  description: string;
  impact?: string;
  owner?: string;
  confidence?: number;
}): Promise<{ riskId?: string; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      meetingId: z.string().uuid(),
      description: z.string().min(1).max(400).transform((s) => s.trim()),
      impact: z.string().max(400).optional(),
      owner: z.string().max(200).optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const title = parsed.data.description.slice(0, 200);
    const descParts: string[] = [];
    if (parsed.data.description.length > 200) descParts.push(parsed.data.description);
    if (parsed.data.impact) descParts.push(`Impact: ${parsed.data.impact}`);
    if (parsed.data.owner) descParts.push(`Owner: ${parsed.data.owner}`);

    const { data: risk, error } = await supabase
      .from("risks")
      .insert({
        organization_id: org.organizationId,
        project_id: parsed.data.projectId,
        title,
        description: descParts.length ? descParts.join("\n") : null,
        origin: "ai_suggested",
        confidence_score: parsed.data.confidence ?? null,
        needs_review: true,
        evidence_json: { source: "rythm_meeting_intelligence", meeting_id: parsed.data.meetingId },
      })
      .select("id")
      .single();
    if (error || !risk) return { error: "promote_failed" };

    await linkMeeting(supabase, org.organizationId, org.userId, parsed.data.meetingId, "risk", risk.id);
    await logRythmActivity(supabase, org.organizationId, {
      projectId: parsed.data.projectId,
      meetingId: parsed.data.meetingId,
      action: "risk_promoted",
      details: { risk_id: risk.id },
      userId: org.userId,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { riskId: risk.id };
  } catch (err) {
    console.error("promoteRiskAction failed:", err);
    return { error: "promote_failed" };
  }
}
