"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectContributor } from "@/lib/auth";
import { runAi } from "@/lib/ai";
import type { Locale, ImpactArea } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { logAudit } from "@/lib/audit";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ExtractedDecision {
  title: string;
  description: string;
  decision_maker: string | null;
  decision_date: string | null;
  impact_area: ImpactArea | null;
  confidence: number;
  source_excerpt: string;
}

export interface ExtractionResult {
  suggestions: ExtractedDecision[];
  aiRunId: string;
  error?: string;
}

export interface ApprovalResult {
  decisionId?: string;
  linkId?: string;
  error?: string;
}

// ── Zod Schemas ──────────────────────────────────────────────────────────────────

const impactAreaValues: ImpactArea[] = [
  "scope", "schedule", "budget", "risk",
  "quality", "communication", "document", "other",
];

const approveDecisionSchema = z.object({
  meetingId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200).transform((s) => s.trim()),
  description: z.string().max(2000).transform((s) => s.trim()).optional().default(""),
  decisionMaker: z.string().max(200).transform((s) => s.trim()).optional().default(""),
  decisionDate: z.string().optional(),
  impactArea: z.enum(impactAreaValues).optional(),
  aiRunId: z.string().min(1),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Server Action: Extract Decisions ────────────────────────────────────────────

export async function extractDecisionsFromMeetingAction(input: {
  meetingId: string;
  projectId: string;
  locale: string;
}): Promise<ExtractionResult> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { suggestions: [], aiRunId: "", error: "forbidden" };
  const org = __g.org;

  const supabase = createAdminClient();

  // Fetch the meeting to get its notes
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
      promptType: "decision_analysis",
      templateVars: { title, content, language: lang === "es" ? "Spanish" : "English" },
      sourceType: "meeting",
      sourceId: input.meetingId,
    });

    if (result.status === "failed") {
      return { suggestions: [], aiRunId: result.runId, error: "aiFailed" };
    }

    // Parse the decisions from the AI output
    const raw = result.parsedJson;
    if (!raw || !Array.isArray(raw.decisions)) {
      return { suggestions: [], aiRunId: result.runId, error: "aiFailed" };
    }

    const suggestions: ExtractedDecision[] = (raw.decisions as Record<string, unknown>[])
      .filter((d) => typeof d.title === "string" && d.title.trim().length > 0)
      .map((d) => ({
        title: String(d.title).trim(),
        description: typeof d.description === "string" ? d.description.trim() : "",
        decision_maker: typeof d.decision_maker === "string" ? d.decision_maker.trim() : null,
        decision_date:
          typeof d.decision_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.decision_date)
            ? d.decision_date
            : null,
        impact_area:
          typeof d.impact_area === "string" && impactAreaValues.includes(d.impact_area as ImpactArea)
            ? (d.impact_area as ImpactArea)
            : null,
        confidence:
          typeof d.confidence === "number"
            ? Math.min(1, Math.max(0, d.confidence))
            : 0.5,
        source_excerpt: typeof d.source_excerpt === "string" ? d.source_excerpt.trim() : "",
      }));

    return { suggestions, aiRunId: result.runId };
  } catch (err: unknown) {
    // OpenAI API key not configured
    if (err instanceof Error && err.message.includes("OPENAI_API_KEY")) {
      return { suggestions: [], aiRunId: "", error: "noApiKey" };
    }
    console.error("AI extraction failed:", err);
    return { suggestions: [], aiRunId: "", error: "unexpected" };
  }
}

// ── Server Action: Approve Extracted Decision ──────────────────────────────────

export async function approveExtractedDecisionAction(input: {
  meetingId: string;
  projectId: string;
  title: string;
  description?: string;
  decisionMaker?: string;
  decisionDate?: string;
  impactArea?: string;
  aiRunId: string;
  locale: string;
}): Promise<ApprovalResult> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: "forbidden" };
  const org = __g.org;

  const parsed = approveDecisionSchema.safeParse({
    meetingId: input.meetingId,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    decisionMaker: input.decisionMaker,
    decisionDate: input.decisionDate,
    impactArea: input.impactArea,
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

  // 1. Create the decision with source_type = "meeting"
  const { data: decision, error: insertError } = await supabase
    .from("decisions")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
      decision_date: data.decisionDate || null,
      decision_maker: data.decisionMaker || null,
      source_type: "meeting",
      source_record_id: data.meetingId,
      impact_area: data.impactArea ?? null,
      status: "proposed",
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (insertError || !decision) {
    console.error("Failed to create decision from AI extraction:", insertError);
    return { error: "approvalFailed" };
  }

  await logAudit({
    org,
    projectId: input.projectId,
    action: "create",
    entityType: "decisions",
    entityId: decision.id,
    metadata: { title: input.title, status: "proposed", source: "ai_extraction" },
  });

  // 2. Create traceability link: meeting → decision (derived_from)
  const contextI18n = lang === "en"
    ? { en: `AI-extracted decision from meeting (Run: ${data.aiRunId})` }
    : { es: `Decisión extraída por IA de la reunión (Ejecución: ${data.aiRunId})` };

  const { data: link, error: linkError } = await supabase
    .from("traceability_links")
    .insert({
      organization_id: org.organizationId,
      source_type: "meeting",
      source_id: data.meetingId,
      target_type: "decision",
      target_id: decision.id,
      link_type: "derived_from",
      context_i18n: contextI18n,
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (linkError) {
    // Decision was created but link failed — log but don't fail the operation
    console.error("Failed to create traceability link for AI-extracted decision:", linkError);
  }

  if (link) {
    await logAudit({
      org,
      projectId: input.projectId,
      action: "create",
      entityType: "traceability_links",
      entityId: link.id,
      metadata: { link_type: "derived_from", source_type: "meeting", target_type: "decision", source: "ai_extraction" },
    });
  }

  return { decisionId: decision.id, linkId: link?.id };
}