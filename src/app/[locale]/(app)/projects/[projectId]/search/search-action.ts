"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, I18nField } from "@/types/database";
import { env } from "@/lib/env";

// ── Types ───────────────────────────────────────────────────────────────────────

export type SearchEntityType = "communication" | "meeting" | "decision" | "document" | "task" | "memory";

export type MatchType = "semantic" | "keyword";

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  date: string | null;
  snippet: string;
  href: string;
  matchType: MatchType;
  similarity?: number | null;
}

export interface SearchTranslations {
  communication: string;
  meeting: string;
  decision: string;
  document: string;
  task: string;
  memory: string;
}

interface SearchActionInput {
  projectId: string;
  locale: string;
  keyword: string;
  typeFilter?: SearchEntityType;
}

// ── Server Action ────────────────────────────────────────────────────────────────

export async function searchProjectAction(
  input: SearchActionInput,
): Promise<SearchResult[]> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return [];
  }

  const keyword = input.keyword.trim();
  if (!keyword) return [];

  const keywordLower = keyword.toLowerCase();
  const supabase = createAdminClient();
  const lang = input.locale as Locale;
  const { projectId, typeFilter } = input;

  const results: SearchResult[] = [];

  // Helper: check if any text field contains the keyword
  const matches = (text: string | null | undefined): boolean =>
    !!text && text.toLowerCase().includes(keywordLower);

  // Helper: generate snippet around first keyword match
  const snippet = (...texts: (string | null | undefined)[]): string => {
    const allText = texts.filter(Boolean).join(" ");
    const idx = allText.toLowerCase().indexOf(keywordLower);
    if (idx === -1) return allText.slice(0, 150);

    const start = Math.max(0, idx - 60);
    const end = Math.min(allText.length, idx + keyword.length + 90);
    let s = allText.slice(start, end);
    if (start > 0) s = "…" + s;
    if (end < allText.length) s += "…";
    return s;
  };

  // ── Communications ────────────────────────────────────────────────────────────

  if (!typeFilter || typeFilter === "communication") {
    const { data: comms } = await supabase
      .from("communication_items")
      .select("id, title_i18n, summary_i18n, content_i18n, item_date")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("item_date", { ascending: false })
      .limit(200);

    for (const c of comms ?? []) {
      const title = getI18nValue(c.title_i18n as I18nField, lang) || "";
      const summary = getI18nValue(c.summary_i18n as I18nField, lang) || "";
      const content = getI18nValue(c.content_i18n as I18nField, lang) || "";

      if (matches(title) || matches(summary) || matches(content)) {
        results.push({
          id: c.id,
          type: "communication",
          title: title || "Untitled",
          date: c.item_date,
          snippet: snippet(summary || content, title),
          href: `/${input.locale}/projects/${projectId}/communications`,
          matchType: "keyword" as const,
        });
      }
    }
  }

  // ── Meetings ──────────────────────────────────────────────────────────────────

  if (!typeFilter || typeFilter === "meeting") {
    const { data: meetings } = await supabase
      .from("meetings")
      .select("id, title_i18n, agenda_i18n, notes_i18n, summary_i18n, meeting_date")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("meeting_date", { ascending: false })
      .limit(200);

    for (const m of meetings ?? []) {
      const title = getI18nValue(m.title_i18n as I18nField, lang) || "";
      const agenda = getI18nValue(m.agenda_i18n as I18nField, lang) || "";
      const notes = getI18nValue(m.notes_i18n as I18nField, lang) || "";
      const summary = getI18nValue(m.summary_i18n as I18nField, lang) || "";

      if (matches(title) || matches(agenda) || matches(notes) || matches(summary)) {
        results.push({
          id: m.id,
          type: "meeting",
          title: title || "Untitled",
          date: m.meeting_date,
          snippet: snippet(summary || agenda || notes, title),
          href: `/${input.locale}/projects/${projectId}/meetings/${m.id}`,
          matchType: "keyword" as const,
        });
      }
    }
  }

  // ── Decisions ────────────────────────────────────────────────────────────────

  if (!typeFilter || typeFilter === "decision") {
    const { data: decisions } = await supabase
      .from("decisions")
      .select("id, title_i18n, description_i18n, rationale_i18n, decision_date")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("decision_date", { ascending: false })
      .limit(200);

    for (const d of decisions ?? []) {
      const title = getI18nValue(d.title_i18n as I18nField, lang) || "";
      const desc = getI18nValue(d.description_i18n as I18nField, lang) || "";
      const rationale = getI18nValue(d.rationale_i18n as I18nField, lang) || "";

      if (matches(title) || matches(desc) || matches(rationale)) {
        results.push({
          id: d.id,
          type: "decision",
          title: title || "Untitled",
          date: d.decision_date,
          snippet: snippet(desc || rationale, title),
          href: `/${input.locale}/projects/${projectId}/decisions/${d.id}`,
          matchType: "keyword" as const,
        });
      }
    }
  }

  // ── Documents ─────────────────────────────────────────────────────────────────

  if (!typeFilter || typeFilter === "document") {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, title_i18n, description_i18n, created_at")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    for (const doc of docs ?? []) {
      const title = getI18nValue(doc.title_i18n as I18nField, lang) || "";
      const desc = getI18nValue(doc.description_i18n as I18nField, lang) || "";

      if (matches(title) || matches(desc)) {
        results.push({
          id: doc.id,
          type: "document",
          title: title || "Untitled",
          date: doc.created_at,
          snippet: snippet(desc, title),
          href: `/${input.locale}/projects/${projectId}/documents/${doc.id}`,
          matchType: "keyword" as const,
        });
      }
    }
  }

  // ── Tasks (roadmap_tasks) ──────────────────────────────────────────────────────

  if (!typeFilter || typeFilter === "task") {
    const { data: tasks } = await supabase
      .from("roadmap_tasks")
      .select("id, title, description, dependency_notes, acceptance_criteria, sprint_name, external_key, execution_notes, prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes, blocker_reason, updated_at")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);

    for (const t of tasks ?? []) {
      // Search across all 13 text columns
      const textColumns = [
        t.title, t.description, t.dependency_notes, t.acceptance_criteria,
        t.sprint_name, t.external_key, t.execution_notes, t.prompt_body,
        t.prompt_context, t.ai_tool_target, t.implementation_notes,
        t.test_notes, t.blocker_reason,
      ];

      if (textColumns.some(matches)) {
        results.push({
          id: t.id,
          type: "task",
          title: t.title || "Untitled",
          date: t.updated_at,
          snippet: snippet(t.description || t.acceptance_criteria || t.dependency_notes, t.title),
          href: `/${input.locale}/projects/${projectId}/execution-map`,
          matchType: "keyword" as const,
        });
      }
    }
  }

  // ── Project Memory Items ─────────────────────────────────────────────────────

  if (!typeFilter || typeFilter === "memory") {
    const { data: memory } = await supabase
      .from("project_memory_items")
      .select("id, title, summary, content, occurred_at, tags")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .limit(200);

    for (const it of memory ?? []) {
      const tags = Array.isArray(it.tags) ? (it.tags as string[]).join(" ") : "";
      if (matches(it.title) || matches(it.summary) || matches(it.content) || matches(tags)) {
        results.push({
          id: it.id,
          type: "memory",
          title: it.title || "Untitled",
          date: it.occurred_at,
          snippet: snippet(it.summary || it.content, it.title),
          href: `/${input.locale}/projects/${projectId}/memory?item=${it.id}`,
          matchType: "keyword" as const,
        });
      }
    }
  }

  // ── Semantic Search (pgvector) ──────────────────────────────────────────────────
  // Try semantic search via match_documents RPC. Non-fatal: falls back to keyword-only.

  const semanticResults: SearchResult[] = [];
  const semanticIds = new Set<string>(); // for dedup against keyword results

  if (env.OPENAI_API_KEY) {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

      const embedResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: keyword,
        dimensions: 1536,
      });

      const queryEmbedding = embedResponse.data[0]?.embedding;

      if (queryEmbedding) {
        const { data: matches } = await supabase.rpc("match_documents", {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 20,
          filter_organization_id: org.organizationId,
          filter_project_id: projectId,
        });

        for (const match of (matches ?? []) as Array<{
          id: string;
          entity_type: string;
          title: string;
          content: string;
          similarity: number;
        }>) {
          const type = match.entity_type as SearchEntityType;
          // Skip if type filter is active and doesn't match
          if (typeFilter && typeFilter !== type) continue;

          semanticIds.add(`${type}-${match.id}`);

          // Build href based on entity type
          const hrefMap: Record<string, string> = {
            communication: `/${input.locale}/projects/${projectId}/communications`,
            meeting: `/${input.locale}/projects/${projectId}/meetings/${match.id}`,
            decision: `/${input.locale}/projects/${projectId}/decisions/${match.id}`,
            document: `/${input.locale}/projects/${projectId}/documents/${match.id}`,
            task: `/${input.locale}/projects/${projectId}/execution-map`,
            memory: `/${input.locale}/projects/${projectId}/memory?item=${match.id}`,
          };

          semanticResults.push({
            id: match.id,
            type,
            title: match.title || "Untitled",
            date: null,
            snippet: match.content?.slice(0, 150) || "",
            href: hrefMap[type] || `/${input.locale}/projects/${projectId}`,
            matchType: "semantic",
            similarity: match.similarity,
          });
        }
      }
    } catch (err) {
      // Semantic search failure is non-fatal — fall back to keyword only
      console.error("Semantic search failed, falling back to keyword-only:", err);
    }
  }

  // ── Merge & Dedup ───────────────────────────────────────────────────────────────

  // Remove keyword results that already appear in semantic results
  const keywordResults = results.filter(
    (r) => !semanticIds.has(`${r.type}-${r.id}`)
  );

  // Merge: semantic first (sorted by similarity), then keyword (sorted by date)
  const semanticSorted = semanticResults.sort(
    (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)
  );

  // Sort keyword results by date descending
  keywordResults.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return [...semanticSorted, ...keywordResults];
}