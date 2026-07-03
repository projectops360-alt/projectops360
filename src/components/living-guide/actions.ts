"use server";

// ============================================================================
// Living Guide™ — server actions (API layer between widget and services)
// ============================================================================
// Access control: the real org + role come from the session via getOrgContext.
// The client-supplied context payload is for COACHING CONTEXT ONLY and is never
// trusted for authorization. Knowledge served is global product knowledge plus
// the caller's own org overlays — never another tenant's data.
// ============================================================================

import { getOrgContext } from "@/lib/auth";
import { askKnowledgeOs, recordGuideFeedback } from "@/lib/knowledge-os/service";
import { indexPendingKnowledge } from "@/lib/knowledge-os/indexer";
import type { AskGuideInput, GuideAnswer } from "@/lib/knowledge-os/types";
import { getProjectBriefing } from "@/lib/project-briefing/service";
import type { ProjectBriefingResult } from "@/lib/project-briefing/types";
import { getPortfolioBriefing } from "@/lib/portfolio-briefing/service";
import type { PortfolioBriefingResult } from "@/lib/portfolio-briefing/types";
import { getProjectProvenanceSummary, getEntityProvenance } from "@/lib/provenance/service";
import { formatProvenanceForPrompt } from "@/lib/provenance/engine";
import type { Locale } from "@/types/database";

// Lightweight (NON-authorization) hint that the user is asking about source /
// provenance / traceability — used only to decide whether to spend a few count
// queries enriching the prompt. Bilingual.
const PROVENANCE_HINT =
  /\b(source|sources|origin|provenance|trace|traceab|derived|came from|come from|created from|where did|voice note|dictat|scribe|rythm|evidence)\b|de d[oó]nde|procede|origen|fuente|trazab|deriva|nota de voz|dictad|evidencia/i;

/** Ask the Living Guide. Returns a fully-attributed answer. */
export async function askLivingGuideAction(input: AskGuideInput): Promise<GuideAnswer> {
  const org = await getOrgContext();
  // Re-stamp identity from the trusted session (ignore any client-claimed ids).
  const safeInput: AskGuideInput = {
    ...input,
    context: {
      ...input.context,
      userId: org.userId,
      organizationId: org.organizationId,
      role: org.role,
      // Never trust client-supplied server-stamped facts — only the server sets them.
      provenanceFacts: undefined,
      executionFacts: undefined,
    },
  };

  // ── Provenance intelligence (PD-012) ────────────────────────────────────────
  // When inside a project and the question (or a selected item) is about where
  // work came from, stamp DETERMINISTIC, record-backed facts into the context so
  // Isabella answers with real numbers/sources and never invents provenance.
  const projectId = input.context.projectId;
  const entity = input.context.currentEntity;
  const wantsProvenance = entity != null || PROVENANCE_HINT.test(input.query ?? "");
  if (projectId && wantsProvenance) {
    try {
      const lang: "en" | "es" = (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
      const [summaryRes, entityRes] = await Promise.all([
        getProjectProvenanceSummary(projectId),
        entity?.id && entity?.type
          ? getEntityProvenance(entity.type, entity.id, projectId, lang as Locale)
          : Promise.resolve(null),
      ]);
      const summary = summaryRes.ok ? summaryRes.summary : null;
      const entityProv = entityRes && entityRes.ok ? entityRes.provenance : null;
      if (summary || entityProv) {
        safeInput.context.provenanceFacts = formatProvenanceForPrompt(summary, entityProv, lang);
      }
    } catch {
      // Never break the answer flow over provenance enrichment.
    }
  }

  // ── Task Execution Map facts ────────────────────────────────────────────────
  // When the ask is about a task (or one of its subtasks), stamp DETERMINISTIC
  // subtask-execution facts (calculated progress, blockers, overdue, critical
  // path, recommended focus) so Isabella explains the map with real numbers.
  if (projectId && entity && (entity.type === "task" || entity.type === "subtask")) {
    try {
      const lang: "en" | "es" = (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
      const { getTaskExecutionFactsForIsabella } = await import("@/lib/subtasks/service");
      const facts = await getTaskExecutionFactsForIsabella({
        org,
        projectId,
        entityType: entity.type,
        entityId: entity.id,
        language: lang,
      });
      if (facts) safeInput.context.executionFacts = facts;
    } catch {
      // Never break the answer flow over execution enrichment.
    }
  }

  return askKnowledgeOs(org, safeInput);
}

/**
 * Generate Isabella's deterministic Project Health Briefing (REG-013). The
 * project is re-validated against the trusted session org inside the service;
 * the client-supplied projectId is only a lookup key, never an authorization.
 */
export async function getProjectBriefingAction(
  projectId: string,
  locale: Locale,
): Promise<ProjectBriefingResult> {
  return getProjectBriefing(projectId, locale);
}

/**
 * Generate Isabella's deterministic Portfolio Health Briefing for the PMO
 * (owner/admin only — enforced from the trusted session inside the service).
 * Shown when Isabella opens outside a project context.
 */
export async function getPortfolioBriefingAction(
  locale: Locale,
): Promise<PortfolioBriefingResult> {
  return getPortfolioBriefing(locale);
}

/** Record 👍/👎 feedback against a previously generated answer. */
export async function submitGuideFeedbackAction(
  answerId: string,
  helpful: boolean,
): Promise<{ ok: boolean }> {
  const org = await getOrgContext();
  await recordGuideFeedback(org, answerId, helpful);
  return { ok: true };
}

/**
 * Generate embeddings for pending knowledge chunks. Org admins/owners only.
 * Lets an admin "turn on" semantic search after seeding without a deploy.
 */
export async function indexLivingGuideAction(): Promise<{
  ok: boolean;
  processed?: number;
  embedded?: number;
  failed?: number;
  message?: string;
}> {
  const org = await getOrgContext();
  if (org.role !== "owner" && org.role !== "admin") {
    return { ok: false, message: "Not authorized" };
  }
  const res = await indexPendingKnowledge();
  return {
    ok: !res.error,
    processed: res.processed,
    embedded: res.embedded,
    failed: res.failed,
    message: res.skipped ? res.error : undefined,
  };
}
