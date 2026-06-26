"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectContributor } from "@/lib/auth";
import { runAi } from "@/lib/ai";
import type { Locale, I18nField } from "@/types/database";
import { getI18nValue } from "@/types/database";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface SourceRecordRef {
  id: string;
  type: "communication" | "decision";
  title: string;
}

export interface KeyPoint {
  point: string;
  source_ids: string[];
}

export interface CommSummaryResult {
  summary: string;
  keyPoints: KeyPoint[];
  openItems: string | null;
  recordCount: { communications: number; decisions: number };
  sourceRecords: SourceRecordRef[];
  aiRunId: string;
  error?: string;
}

// ── Server Action ────────────────────────────────────────────────────────────────

export async function summarizeCommunicationHistoryAction(input: {
  projectId: string;
  locale: string;
}): Promise<CommSummaryResult> {
  const gate = await requireProjectContributor(input.projectId);
  if (!gate.ok) return emptyResult("forbidden");
  const org = gate.org;

  const supabase = createAdminClient();
  const lang = input.locale as Locale;

  // Fetch recent communications (limit 20)
  const { data: communications } = await supabase
    .from("communication_items")
    .select("id, title_i18n, summary_i18n, content_i18n, source_type, item_date")
    .eq("project_id", input.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("item_date", { ascending: false })
    .limit(20);

  // Fetch recent decisions (limit 20)
  const { data: decisions } = await supabase
    .from("decisions")
    .select("id, title_i18n, description_i18n, status, decision_date")
    .eq("project_id", input.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("decision_date", { ascending: false })
    .limit(20);

  const comms = communications ?? [];
  const decs = decisions ?? [];

  if (comms.length === 0 && decs.length === 0) {
    return emptyResult("noRecords");
  }

  // Build text representation for the AI
  const commLines = comms.map((c) => {
    const title = getI18nValue(c.title_i18n as I18nField, lang) || "Untitled";
    const content =
      getI18nValue(c.content_i18n as I18nField, lang) ||
      getI18nValue(c.summary_i18n as I18nField, lang) ||
      "";
    return `[ID: ${c.id}] ${title} (${c.source_type}, ${c.item_date ?? "no date"}): ${content}`.slice(0, 500);
  });

  const decLines = decs.map((d) => {
    const title = getI18nValue(d.title_i18n as I18nField, lang) || "Untitled";
    const desc = getI18nValue(d.description_i18n as I18nField, lang) || "";
    return `[ID: ${d.id}] ${title} (status: ${d.status}, ${d.decision_date ?? "no date"}): ${desc}`.slice(0, 500);
  });

  const communicationsText = commLines.join("\n") || "(none)";
  const decisionsText = decLines.join("\n") || "(none)";

  // Call AI
  try {
    const result = await runAi(org, {
      promptType: "communication_history_summary",
      templateVars: { communications: communicationsText, decisions: decisionsText, language: lang === "es" ? "Spanish" : "English" },
      sourceType: "project",
      sourceId: input.projectId,
    });

    if (result.status === "failed") {
      return emptyResult("aiFailed", result.runId);
    }

    const raw = result.parsedJson;
    if (!raw) {
      return emptyResult("aiFailed", result.runId);
    }

    // Parse the structured output
    const summary = typeof raw.summary === "string" ? raw.summary : "";
    const keyPoints: KeyPoint[] = Array.isArray(raw.key_points)
      ? (raw.key_points as Record<string, unknown>[])
          .filter((kp) => typeof kp.point === "string")
          .map((kp) => ({
            point: String(kp.point),
            source_ids: Array.isArray(kp.source_ids)
              ? kp.source_ids.filter((id: unknown) => typeof id === "string") as string[]
              : [],
          }))
      : [];
    const openItems = typeof raw.open_items === "string" ? raw.open_items : null;
    const recordCount = {
      communications: comms.length,
      decisions: decs.length,
    };

    // Build source records lookup for the UI
    const sourceRecords: SourceRecordRef[] = [];

    // Collect all IDs referenced in key_points
    const allReferencedIds = new Set<string>();
    for (const kp of keyPoints) {
      for (const id of kp.source_ids) {
        allReferencedIds.add(id);
      }
    }

    // Map communications
    for (const c of comms) {
      if (allReferencedIds.has(c.id)) {
        sourceRecords.push({
          id: c.id,
          type: "communication",
          title: getI18nValue(c.title_i18n as I18nField, lang) || "Untitled",
        });
      }
    }

    // Map decisions
    for (const d of decs) {
      if (allReferencedIds.has(d.id)) {
        sourceRecords.push({
          id: d.id,
          type: "decision",
          title: getI18nValue(d.title_i18n as I18nField, lang) || "Untitled",
        });
      }
    }

    return {
      summary,
      keyPoints,
      openItems,
      recordCount,
      sourceRecords,
      aiRunId: result.runId,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("OPENAI_API_KEY")) {
      return emptyResult("noApiKey");
    }
    console.error("Communication history summary failed:", err);
    return emptyResult("unexpected");
  }
}

// ── Helper ──────────────────────────────────────────────────────────────────────

function emptyResult(error: string, aiRunId = ""): CommSummaryResult {
  return {
    summary: "",
    keyPoints: [],
    openItems: null,
    recordCount: { communications: 0, decisions: 0 },
    sourceRecords: [],
    aiRunId,
    error,
  };
}