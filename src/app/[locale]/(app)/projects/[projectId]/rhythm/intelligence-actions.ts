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
import { getMeetingTranscript } from "@/lib/rythm/transcription-service";
import type { Locale } from "@/types/database";
import type { RythmIntelligence } from "@/lib/rythm/types";

const PRIORITY_TO_ROADMAP: Record<string, string> = { high: "p1", medium: "p2", low: "p3" };

/** Normalised dedup key shared by bulk apply + individual promotes. */
function dedupKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
}

/** True if this meeting already produced an entity of targetType with this key. */
async function meetingLinkExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  meetingId: string,
  targetType: string,
  key: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("traceability_links")
    .select("context_i18n")
    .eq("organization_id", orgId)
    .eq("source_type", "meeting")
    .eq("source_id", meetingId)
    .eq("target_type", targetType);
  for (const l of data ?? []) {
    if ((l.context_i18n as Record<string, unknown> | null)?.key === key) return true;
  }
  return false;
}

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
  context?: Record<string, unknown>,
) {
  await supabase.from("traceability_links").insert({
    organization_id: orgId,
    source_type: "meeting",
    source_id: meetingId,
    target_type: targetType,
    target_id: targetId,
    link_type: "derived_from",
    context_i18n: context ?? {},
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
    // Idempotent: if this meeting already created this task, don't duplicate.
    if (await meetingLinkExists(supabase, org.organizationId, parsed.data.meetingId, "task", dedupKey(parsed.data.task))) {
      return {};
    }
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

    await linkMeeting(supabase, org.organizationId, org.userId, parsed.data.meetingId, "task", task.id, {
      source: "rythm_intelligence",
      key: dedupKey(parsed.data.task),
    });
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
    if (await meetingLinkExists(supabase, org.organizationId, parsed.data.meetingId, "decision", dedupKey(parsed.data.title))) {
      return {};
    }
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

    await linkMeeting(supabase, org.organizationId, org.userId, parsed.data.meetingId, "decision", decision.id, {
      source: "rythm_intelligence",
      key: dedupKey(parsed.data.title),
    });
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
    if (await meetingLinkExists(supabase, org.organizationId, parsed.data.meetingId, "risk", dedupKey(parsed.data.description.slice(0, 200)))) {
      return {};
    }
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

    await linkMeeting(supabase, org.organizationId, org.userId, parsed.data.meetingId, "risk", risk.id, {
      source: "rythm_intelligence",
      key: dedupKey(parsed.data.description.slice(0, 200)),
    });
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

// ── updateItemOwnerAction (manual owner review) ───────────────────────────────

const CATEGORY_COLUMN: Record<string, string> = {
  decisions: "decisions",
  actionItems: "action_items",
  risks: "risks",
  commitments: "commitments",
  dependencies: "dependencies",
  milestones: "milestones",
  blockers: "blockers",
  assumptions: "assumptions",
};

export async function updateItemOwnerAction(input: {
  projectId: string;
  meetingId: string;
  category: string;
  index: number;
  owner: string;
}): Promise<{ ok?: boolean; error?: string }> {
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
      category: z.enum(Object.keys(CATEGORY_COLUMN) as [string, ...string[]]),
      index: z.number().int().min(0),
      owner: z.string().max(200).transform((s) => s.trim()),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const column = CATEGORY_COLUMN[parsed.data.category];
  const supabase = await createClient();
  try {
    const { data: row, error } = await supabase
      .from("project_rythm_intelligence")
      .select(`id, ${column}`)
      .eq("organization_id", org.organizationId)
      .eq("meeting_id", parsed.data.meetingId)
      .maybeSingle();
    if (error || !row) return { error: "no_intelligence" };

    const items = ((row as unknown as Record<string, unknown>)[column] ?? []) as Record<string, unknown>[];
    if (!Array.isArray(items) || parsed.data.index >= items.length) return { error: "invalid_input" };

    items[parsed.data.index] = {
      ...items[parsed.data.index],
      owner: parsed.data.owner,
      owner_attribution: "manual",
    };

    const { error: updErr } = await supabase
      .from("project_rythm_intelligence")
      .update({ [column]: items })
      .eq("organization_id", org.organizationId)
      .eq("meeting_id", parsed.data.meetingId);
    if (updErr) return { error: "update_failed" };

    await logRythmActivity(supabase, org.organizationId, {
      projectId: parsed.data.projectId,
      meetingId: parsed.data.meetingId,
      action: "owner_corrected",
      details: { category: parsed.data.category, index: parsed.data.index, owner: parsed.data.owner },
      userId: org.userId,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { ok: true };
  } catch (err) {
    console.error("updateItemOwnerAction failed:", err);
    return { error: "update_failed" };
  }
}

// ── deleteIntelligenceItemAction (dismiss one extracted item) ─────────────────

export async function deleteIntelligenceItemAction(input: {
  projectId: string;
  meetingId: string;
  category: string;
  index: number;
}): Promise<{ ok?: boolean; error?: string }> {
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
      category: z.enum(Object.keys(CATEGORY_COLUMN) as [string, ...string[]]),
      index: z.number().int().min(0),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const column = CATEGORY_COLUMN[parsed.data.category];
  const supabase = await createClient();
  try {
    const { data: row, error } = await supabase
      .from("project_rythm_intelligence")
      .select(`id, ${column}`)
      .eq("organization_id", org.organizationId)
      .eq("meeting_id", parsed.data.meetingId)
      .maybeSingle();
    if (error || !row) return { error: "no_intelligence" };

    const items = ((row as unknown as Record<string, unknown>)[column] ?? []) as unknown[];
    if (!Array.isArray(items) || parsed.data.index >= items.length) return { error: "invalid_input" };
    items.splice(parsed.data.index, 1);

    const { error: updErr } = await supabase
      .from("project_rythm_intelligence")
      .update({ [column]: items })
      .eq("organization_id", org.organizationId)
      .eq("meeting_id", parsed.data.meetingId);
    if (updErr) return { error: "delete_failed" };

    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { ok: true };
  } catch (err) {
    console.error("deleteIntelligenceItemAction failed:", err);
    return { error: "delete_failed" };
  }
}

// ── deleteMeetingIntelligenceAction (clear all) ───────────────────────────────

export async function deleteMeetingIntelligenceAction(input: {
  projectId: string;
  meetingId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z.object({ projectId: z.string().uuid(), meetingId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("project_rythm_intelligence")
      .delete()
      .eq("organization_id", org.organizationId)
      .eq("meeting_id", parsed.data.meetingId);
    if (error) return { error: "delete_failed" };
    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { ok: true };
  } catch (err) {
    console.error("deleteMeetingIntelligenceAction failed:", err);
    return { error: "delete_failed" };
  }
}

// ── applyIntelligenceToProjectAction (bulk) ───────────────────────────────────
// Creates project tasks / decisions / risks / milestones / dependency memory
// items from the meeting intelligence, each with mandatory traceability back to
// the meeting, transcript, timestamp, speaker (owner) and confidence.

export interface ApplyCounts {
  actionItems: number;
  decisions: number;
  risks: number;
  milestones: number;
  dependencies: number;
}

export async function applyIntelligenceToProjectAction(input: {
  projectId: string;
  meetingId: string;
  locale: string;
}): Promise<{ counts?: ApplyCounts; error?: string }> {
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
  const { projectId, meetingId, locale } = parsed.data;

  try {
    const intel = await getMeetingIntelligence(supabase, org.organizationId, meetingId);
    if (!intel) return { error: "no_intelligence" };
    if (intel.appliedAt) return { error: "already_applied" };

    const transcript = await getMeetingTranscript(supabase, org.organizationId, meetingId);
    const transcriptId = transcript?.id ?? null;
    const trace = (owner: string, confidence: number, itemType: string, key: string) => ({
      source: "rythm_intelligence",
      item_type: itemType,
      meeting_id: meetingId,
      transcript_id: transcriptId,
      timestamp: intel.generatedAt,
      speaker: owner || null,
      confidence,
      key,
    });

    // Idempotency: skip anything already created from THIS meeting (so an
    // accidental Regenerate → Apply does not duplicate tasks/risks/milestones/…).
    const normKey = dedupKey;
    const { data: existingLinks } = await supabase
      .from("traceability_links")
      .select("target_type, context_i18n")
      .eq("organization_id", org.organizationId)
      .eq("source_type", "meeting")
      .eq("source_id", meetingId);
    const appliedKeys = new Set<string>();
    for (const l of existingLinks ?? []) {
      const k = (l.context_i18n as Record<string, unknown> | null)?.key;
      if (typeof k === "string") appliedKeys.add(`${l.target_type}|${k}`);
    }
    const seen = (targetType: string, key: string) => {
      const sig = `${targetType}|${key}`;
      if (appliedKeys.has(sig)) return true;
      appliedKeys.add(sig);
      return false;
    };

    const counts: ApplyCounts = { actionItems: 0, decisions: 0, risks: 0, milestones: 0, dependencies: 0 };

    // Action items → roadmap_tasks
    for (const a of intel.actionItems) {
      const key = normKey(a.task);
      if (!a.task.trim() || seen("task", key)) continue;
      const notes = [a.owner ? `Owner: ${a.owner}` : "", a.due_date ? `Due: ${a.due_date}` : "", "From Rythm meeting intelligence"]
        .filter(Boolean)
        .join(" · ");
      const { data: task } = await supabase
        .from("roadmap_tasks")
        .insert({
          organization_id: org.organizationId,
          project_id: projectId,
          title: a.task,
          description: notes,
          status: "not_started",
          priority: PRIORITY_TO_ROADMAP[a.priority] ?? "p2",
          order_index: 0,
          created_by: org.userId,
        })
        .select("id")
        .single();
      if (task) {
        await linkMeeting(supabase, org.organizationId, org.userId, meetingId, "task", task.id, trace(a.owner, a.confidence, "action_item", key));
        counts.actionItems++;
      }
    }

    // Decisions → decisions register
    for (const d of intel.decisions) {
      const key = normKey(d.title);
      if (!d.title.trim() || seen("decision", key)) continue;
      const { data: dec } = await supabase
        .from("decisions")
        .insert({
          organization_id: org.organizationId,
          project_id: projectId,
          title_i18n: { [locale]: d.title },
          description_i18n: d.description ? { [locale]: d.description } : {},
          decision_maker: d.owner || null,
          source_type: "meeting",
          source_record_id: meetingId,
          status: "proposed",
          created_by: org.userId,
        })
        .select("id")
        .single();
      if (dec) {
        await linkMeeting(supabase, org.organizationId, org.userId, meetingId, "decision", dec.id, trace(d.owner, d.confidence, "decision", key));
        counts.decisions++;
      }
    }

    // Risks → risk register
    for (const r of intel.risks) {
      const key = normKey(r.description.slice(0, 200));
      if (!r.description.trim() || seen("risk", key)) continue;
      const { data: risk } = await supabase
        .from("risks")
        .insert({
          organization_id: org.organizationId,
          project_id: projectId,
          title: r.description.slice(0, 200),
          description: r.impact ? `Impact: ${r.impact}` : null,
          origin: "ai_suggested",
          confidence_score: r.confidence,
          needs_review: true,
          evidence_json: { source: "rythm_meeting_intelligence", meeting_id: meetingId },
        })
        .select("id")
        .single();
      if (risk) {
        await linkMeeting(supabase, org.organizationId, org.userId, meetingId, "risk", risk.id, trace(r.owner, r.confidence, "risk", key));
        counts.risks++;
      }
    }

    // Milestones → milestones
    for (const m of intel.milestones) {
      const title = m.title || m.description;
      if (!title) continue;
      const key = normKey(title);
      if (seen("milestone", key)) continue;
      const { data: ms } = await supabase
        .from("milestones")
        .insert({
          organization_id: org.organizationId,
          project_id: projectId,
          title: title.slice(0, 200),
          description: m.description && m.description !== title ? m.description : null,
          status: "planned",
          target_date: m.due_date ?? null,
          order_index: 0,
          created_by: org.userId,
        })
        .select("id")
        .single();
      if (ms) {
        await linkMeeting(supabase, org.organizationId, org.userId, meetingId, "milestone", ms.id, trace(m.owner ?? "", m.confidence ?? 0.5, "milestone", key));
        counts.milestones++;
      }
    }

    // Dependencies → project memory items (no dedicated register)
    for (const dep of intel.dependencies) {
      const title = dep.title || dep.description;
      if (!title) continue;
      const key = normKey(title);
      if (seen("memory", key)) continue;
      const { data: mem } = await supabase
        .from("project_memory_items")
        .insert({
          organization_id: org.organizationId,
          project_id: projectId,
          title: title.slice(0, 200),
          content: dep.description ?? null,
          source_type: "system_event",
          source_system: "rythm",
          importance_level: "medium",
          tags: ["dependency", "rythm"],
          ai_status: "skipped",
          index_status: "skipped",
          created_by: org.userId,
        })
        .select("id")
        .single();
      if (mem) {
        await linkMeeting(supabase, org.organizationId, org.userId, meetingId, "memory", mem.id, trace(dep.owner ?? "", dep.confidence ?? 0.5, "dependency", key));
        counts.dependencies++;
      }
    }

    await supabase
      .from("project_rythm_intelligence")
      .update({ applied_at: new Date().toISOString() })
      .eq("organization_id", org.organizationId)
      .eq("meeting_id", meetingId);

    await logRythmActivity(supabase, org.organizationId, {
      projectId,
      meetingId,
      action: "intelligence_applied",
      details: { ...counts, transcript_id: transcriptId },
      userId: org.userId,
    });

    revalidatePath(`/projects/${projectId}/rhythm`);
    return { counts };
  } catch (err) {
    console.error("applyIntelligenceToProjectAction failed:", err);
    return { error: "apply_failed" };
  }
}
