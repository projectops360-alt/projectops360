"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { runAi } from "@/lib/ai";
import type { Locale, ActionItemPriority } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { logAudit } from "@/lib/audit";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ExtractedActionItem {
  title: string;
  description: string;
  owner_name: string | null;
  due_date: string | null;
  priority: ActionItemPriority;
  confidence: number;
  source_excerpt: string;
}

export interface ActionExtractionResult {
  suggestions: ExtractedActionItem[];
  aiRunId: string;
  error?: string;
}

export interface ActionApprovalResult {
  actionItemId?: string;
  error?: string;
}

// ── Zod Schemas ──────────────────────────────────────────────────────────────────

const priorityValues: ActionItemPriority[] = ["low", "medium", "high", "critical"];

const approveActionItemSchema = z.object({
  meetingId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).transform((s) => s.trim()).optional().default(""),
  ownerName: z.string().max(200).transform((s) => s.trim()).optional().default(""),
  dueDate: z.string().optional(),
  priority: z.enum(priorityValues).default("medium"),
  aiRunId: z.string().min(1),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Server Action: Extract Action Items ─────────────────────────────────────────

export async function extractActionItemsAction(input: {
  meetingId: string;
  projectId: string;
  locale: string;
}): Promise<ActionExtractionResult> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { suggestions: [], aiRunId: "", error: "not_authenticated" };
  }

  const supabase = createAdminClient();

  // Fetch the meeting to get its text
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title_i18n, agenda_i18n, summary_i18n, notes_i18n")
    .eq("id", input.meetingId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!meeting) {
    return { suggestions: [], aiRunId: "", error: "not_found" };
  }

  const lang = input.locale as Locale;
  const title = getI18nValue(meeting.title_i18n, lang) || "";
  const agenda = getI18nValue(meeting.agenda_i18n, lang) || "";
  const summary = getI18nValue(meeting.summary_i18n, lang) || "";
  const notes = getI18nValue(meeting.notes_i18n, lang) || "";

  // Compose content from all meeting text fields
  const parts: string[] = [];
  if (agenda) parts.push(`AGENDA:\n${agenda}`);
  if (summary) parts.push(`SUMMARY:\n${summary}`);
  if (notes) parts.push(`NOTES:\n${notes}`);

  const content = parts.join("\n\n");

  if (!content.trim()) {
    return { suggestions: [], aiRunId: "", error: "noContent" };
  }

  // Call the AI service
  try {
    const result = await runAi(org, {
      promptType: "action_extraction",
      templateVars: { title, content, language: lang === "es" ? "Spanish" : "English" },
      sourceType: "meeting",
      sourceId: input.meetingId,
    });

    if (result.status === "failed") {
      return { suggestions: [], aiRunId: result.runId, error: "aiFailed" };
    }

    // Parse the action items from the AI output
    const raw = result.parsedJson;
    if (!raw || !Array.isArray(raw.action_items)) {
      return { suggestions: [], aiRunId: result.runId, error: "aiFailed" };
    }

    const suggestions: ExtractedActionItem[] = (raw.action_items as Record<string, unknown>[])
      .filter((item) => typeof item.title === "string" && item.title.trim().length > 0)
      .map((item) => ({
        title: String(item.title).trim(),
        description: typeof item.description === "string" ? item.description.trim() : "",
        owner_name: typeof item.owner_name === "string" ? item.owner_name.trim() : null,
        due_date:
          typeof item.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.due_date)
            ? item.due_date
            : null,
        priority:
          typeof item.priority === "string" && priorityValues.includes(item.priority as ActionItemPriority)
            ? (item.priority as ActionItemPriority)
            : "medium",
        confidence:
          typeof item.confidence === "number"
            ? Math.min(1, Math.max(0, item.confidence))
            : 0.5,
        source_excerpt: typeof item.source_excerpt === "string" ? item.source_excerpt.trim() : "",
      }));

    return { suggestions, aiRunId: result.runId };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("OPENAI_API_KEY")) {
      return { suggestions: [], aiRunId: "", error: "noApiKey" };
    }
    console.error("AI action item extraction failed:", err);
    return { suggestions: [], aiRunId: "", error: "unexpected" };
  }
}

// ── Server Action: Approve Extracted Action Item ────────────────────────────────

export async function approveExtractedActionItemAction(input: {
  meetingId: string;
  projectId: string;
  title: string;
  description?: string;
  ownerName?: string;
  dueDate?: string;
  priority?: string;
  aiRunId: string;
  locale: string;
}): Promise<ActionApprovalResult> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = approveActionItemSchema.safeParse({
    meetingId: input.meetingId,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    ownerName: input.ownerName,
    dueDate: input.dueDate,
    priority: input.priority,
    aiRunId: input.aiRunId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const lang = data.locale as Locale;

  const titleI18n = { [lang]: data.title };
  const descriptionI18n = data.description ? { [lang]: data.description } : {};

  const supabase = createAdminClient();

  // Create the action item linked to the meeting and AI run
  const { data: actionItem, error: insertError } = await supabase
    .from("action_items")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      meeting_id: data.meetingId,
      ai_run_id: data.aiRunId,
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
      status: "pending",
      priority: data.priority,
      due_date: data.dueDate || null,
      assigned_to: null, // owner_name is stored as text; assigned_to is a user FK
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (insertError || !actionItem) {
    console.error("Failed to create action item from AI extraction:", insertError);
    return { error: "approvalFailed" };
  }

  await logAudit({
    org,
    projectId: input.projectId,
    action: "create",
    entityType: "action_items",
    entityId: actionItem.id,
    metadata: { title: input.title, priority: input.priority, source: "ai_extraction" },
  });

  // Create traceability link: meeting → action_item (derived_from)
  const contextI18n = lang === "en"
    ? { en: `AI-extracted action item from meeting (Run: ${data.aiRunId})` }
    : { es: `Item de acción extraído por IA de la reunión (Ejecución: ${data.aiRunId})` };

  const { data: newLink, error: linkError } = await supabase
    .from("traceability_links")
    .insert({
      organization_id: org.organizationId,
      source_type: "meeting",
      source_id: data.meetingId,
      target_type: "action_item",
      target_id: actionItem.id,
      link_type: "derived_from",
      context_i18n: contextI18n,
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (linkError) {
    console.error("Failed to create traceability link for AI-extracted action item:", linkError);
  }

  if (newLink) {
    await logAudit({
      org,
      projectId: input.projectId,
      action: "create",
      entityType: "traceability_links",
      entityId: newLink.id,
      metadata: { link_type: "derived_from", source_type: "meeting", target_type: "action_item", source: "ai_extraction" },
    });
  }

  return { actionItemId: actionItem.id };
}