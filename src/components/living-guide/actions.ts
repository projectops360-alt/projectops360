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
import { resolveExpert, buildPersonaOverlay } from "@/lib/knowledge-os/experts";
import type { AskGuideInput, GuideAnswer } from "@/lib/knowledge-os/types";
import { parseProjectDataQuery, answerTaskQuery } from "@/lib/isabella/query-engine";
import { maybeAnswerWithExecutiveBrief } from "@/lib/isabella/executive-brief/gateway";
import { isIsabellaToolUseEnabled } from "@/lib/isabella/tools/flag";
import { maybeAnswerWithTools } from "@/lib/isabella/tools/gateway";
import { maybeAnswerWithProcessIntelligence } from "@/lib/isabella/process-intelligence-runtime/wiring";
import { answerScreenHelp, isScreenExplanationIntent } from "@/lib/isabella/screen-help";
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

  // Screen explanations are deterministic help for the visible UI. They must
  // work even when the optional Process Intelligence engines are disabled, and
  // they must run before briefing/RAG so Isabella cannot describe another page.
  const screenLanguage: "en" | "es" = (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
  if (input.intent === "explain_screen" || isScreenExplanationIntent(input.query ?? "")) {
    const help = answerScreenHelp(
      input.query?.trim() || "explain_screen",
      {
        module: safeInput.context.module,
        screen: safeInput.context.screen,
        pathname: safeInput.context.pathname,
        tab: safeInput.context.tab,
      },
      screenLanguage,
    );
    const screenExpert = resolveExpert({ expertKey: input.expertKey, module: safeInput.context.module });
    return {
      answerId: null,
      grounded: help.confident,
      answer: help.answer,
      steps: [],
      followups: [],
      tier: help.confident ? "verified" : "best_practice",
      confidenceScore: help.confident ? 1 : 0.5,
      language: screenLanguage as Locale,
      sources: [],
      expert: {
        key: screenExpert.key,
        displayName: screenExpert.displayName,
        title: screenExpert.title[screenLanguage],
      },
      degraded: false,
    };
  }

  const projectId = input.context.projectId;

  // ── Executive Brief / Risk Outlook (REG-023, deterministic) ─────────────────
  // ISABELLA-EXECUTIVE-BRIEF. PM-level project questions ("project summary",
  // "today's risks", "can we finish on time", multi-intent combinations) are
  // answered FIRST from the REG-013 briefing engine + the risk register —
  // record-backed, RBAC-scoped, bilingual, with registered risks separated from
  // detected signals and honest data gaps. This runs BEFORE the generic query
  // engine because tokens like "riesgos"/"hitos" used to hijack these questions
  // into the task-only adapter and dead-end in "solo puedo generar reportes de
  // tareas" (REG-023). Detects nothing → the pipeline below is unchanged.
  {
    const ebLang: "en" | "es" = (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
    const ebExpert = resolveExpert({ expertKey: input.expertKey, module: input.context.module });
    const ebExpertInfo = { key: ebExpert.key, displayName: ebExpert.displayName, title: ebExpert.title[ebLang] };
    try {
      const ebAnswer = await maybeAnswerWithExecutiveBrief(org, safeInput, ebExpertInfo);
      if (ebAnswer) return ebAnswer;
    } catch {
      // Never break the answer flow — fall through to the existing pipeline.
    }
  }

  // ── Generic deterministic project-data query engine ─────────────────────────
  // ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE. A report/list/filter/sort/group
  // request about project data is DETERMINISTIC — parse it into a safe query plan
  // and execute via the RBAC-scoped adapter BEFORE the RAG corpus, so Isabella
  // never answers "no tengo una respuesta verificada" when the app has the data.
  // The LLM never filters or sorts rows. Generalizes the earlier task-report
  // short-circuit (ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA).
  const reportLang: "en" | "es" = (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
  const queryPlan = parseProjectDataQuery(input.query ?? "", { language: reportLang });
  // REG-023 — only TASK plans run the deterministic task adapter. A plan whose
  // entity is a future/unsupported one (risk, milestone, decision, approval,
  // subtask) used to dead-end here with "solo puedo generar reportes de tareas";
  // now it falls through to process intelligence / RAG, which CAN answer.
  if (queryPlan && queryPlan.entity === "task") {
    const expert = resolveExpert({ expertKey: input.expertKey, module: input.context.module });
    const expertInfo = { key: expert.key, displayName: expert.displayName, title: expert.title[reportLang] };

    // ISABELLA-TOOL-USE-RUNTIME-GATEWAY (Phase 5 · Task 2B) — flag-gated, default
    // OFF. When enabled, a data question is answered via the approved read-only
    // tool loop (LLM chooses tools; runtime executes the SAME approved layers).
    // Any miss falls through to the DETERMINISTIC report below (unchanged
    // behavior), so this is additive + rollback-safe.
    if (isIsabellaToolUseEnabled()) {
      try {
        const persona = buildPersonaOverlay(expert, reportLang as Locale);
        const toolAnswer = await maybeAnswerWithTools(org, safeInput, expertInfo, persona);
        if (toolAnswer) return toolAnswer;
      } catch {
        // Never break the answer flow — fall through to the deterministic report.
      }
    }

    try {
      return await answerTaskQuery({ org, projectId, plan: queryPlan, expert: expertInfo });
    } catch {
      // Never break the answer flow — fall through to the knowledge corpus.
    }
  }

  // ── Isabella Process Intelligence routing (Phase 5 · Task 6) ────────────────
  // ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION. Flag-gated,
  // default OFF. When enabled, "what's happening / what needs attention / why is
  // this blocked / what should I do next" route to the accepted Daily Diagnosis /
  // Root Cause / Recommendation engines (read-only, evidence-backed). RAG/help &
  // factual-data questions return null here → the existing pipeline is unchanged,
  // so this is additive + rollback-safe.
  {
    const piLang: "en" | "es" = (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
    const piExpert = resolveExpert({ expertKey: input.expertKey, module: input.context.module });
    const piExpertInfo = { key: piExpert.key, displayName: piExpert.displayName, title: piExpert.title[piLang] };
    try {
      const piAnswer = await maybeAnswerWithProcessIntelligence(org, safeInput, piExpertInfo);
      if (piAnswer) return piAnswer;
    } catch {
      // Never break the answer flow — fall through to provenance/RAG.
    }
  }

  // ── Provenance intelligence (PD-012) ────────────────────────────────────────
  // When inside a project and the question (or a selected item) is about where
  // work came from, stamp DETERMINISTIC, record-backed facts into the context so
  // Isabella answers with real numbers/sources and never invents provenance.
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
