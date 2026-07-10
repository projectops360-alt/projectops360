// ============================================================================
// ProjectOps360° — Isabella Executive Brief · gateway (server-only)
// ============================================================================
// REG-023 / ISABELLA-EXECUTIVE-BRIEF
//
// The routing entry `askLivingGuideAction` calls FIRST for PM-level project
// questions ("project summary", "today's risks", multi-intent combinations).
// Deterministic before generative: when the goals are detected AND a project
// is in scope, the answer comes from the REG-013 briefing engine + the risk
// register — never from the LLM, never from RAG. Anything else returns null
// and the existing pipeline continues byte-for-byte unchanged.
//
// Voice reuses this automatically: the Isabella Voice Context Bridge calls the
// same askLivingGuideAction — one brain for text and voice.
// Observability: one compact ai_runs row per run (goals, tools, status,
// latency, record counts, gaps). Best-effort, never breaks the answer.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { AskGuideInput, GuideAnswer } from "@/lib/knowledge-os/types";
import type { Locale } from "@/types/database";
import { detectExecutiveIntents, hasExecutiveIntent, intentGoals } from "./intent";
import { getExecutiveBriefData } from "./service";
import { collectRiskSignals, formatExecutiveBriefAnswer } from "./formatter";
import type { ExecutiveBriefResult } from "./types";

interface ExpertInfo {
  key: string;
  displayName: string;
  title: string;
}

export interface ExecutiveBriefDeps {
  /** Injected for tests; production default is the real service. */
  loadBrief: (org: OrgContext, projectId: string, locale: Locale) => Promise<ExecutiveBriefResult>;
}

const DEFAULT_DEPS: ExecutiveBriefDeps = { loadBrief: getExecutiveBriefData };

/** Compact structured audit (no free text, no secrets). Best-effort. */
async function persistExecutiveAudit(
  org: OrgContext,
  input: {
    goals: string[];
    projectId: string | null;
    screen: string;
    locale: string;
  },
  output: {
    status: "answered" | "no_project" | "not_authorized" | "unavailable";
    tools: string[];
    registeredRisks: number;
    signals: number;
    dataGaps: number;
    executionMs: number;
  },
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("ai_runs").insert({
      organization_id: org.organizationId,
      user_id: org.userId,
      model: "isabella-executive-brief",
      prompt_type: "guide_coaching",
      input_snapshot: {
        executiveBrief: true,
        detectedGoals: input.goals,
        projectId: input.projectId ? "provided" : "none",
        screenContext: input.screen,
        locale: input.locale,
      },
      output_snapshot: { executiveBrief: output },
      status: output.status === "answered" ? "completed" : "failed",
    });
  } catch {
    // Audit is best-effort — never break the answer flow.
  }
}

/**
 * Answer a PM-level project question deterministically, or return null so the
 * existing pipeline (query engine → PI → provenance → RAG) continues unchanged.
 * Never throws.
 */
export async function maybeAnswerWithExecutiveBrief(
  org: OrgContext,
  input: AskGuideInput,
  expert: ExpertInfo,
  deps: ExecutiveBriefDeps = DEFAULT_DEPS,
): Promise<GuideAnswer | null> {
  const intents = detectExecutiveIntents(input.query ?? "");
  if (!hasExecutiveIntent(intents)) return null;

  const locale: Locale = ((input.answerLanguage ?? input.locale) === "es" ? "es" : "en") as Locale;
  const projectId = input.context.projectId;
  const goals = intentGoals(intents);
  const screen = input.context.pageTitle ?? input.context.screen ?? input.context.module ?? "";
  const start = Date.now();

  // No project in scope → this gateway does not guess. The question falls
  // through to the existing pipeline (portfolio briefing / PI / RAG own it).
  if (!projectId) return null;

  let result: ExecutiveBriefResult;
  try {
    result = await deps.loadBrief(org, projectId, locale);
  } catch {
    result = { ok: false, reason: "unavailable" };
  }

  const tools = [
    ...(intents.projectSummary ? ["get_project_executive_brief"] : []),
    ...(intents.riskOutlook ? ["get_project_risk_outlook"] : []),
  ];

  if (!result.ok) {
    await persistExecutiveAudit(
      org,
      { goals, projectId, screen, locale },
      { status: result.reason === "no_project" ? "no_project" : result.reason, tools, registeredRisks: 0, signals: 0, dataGaps: 0, executionMs: Date.now() - start },
    );
    // Permission is the only failure the user must hear about explicitly; other
    // failures fall through so RAG/PI can still help (never a dead end).
    if (result.reason === "not_authorized") {
      const es = locale === "es";
      return {
        answerId: null,
        grounded: true,
        answer: es
          ? "No tienes acceso a los datos de ese proyecto, así que no puedo darte su resumen ni sus riesgos."
          : "You don't have access to that project's data, so I can't give you its summary or risks.",
        steps: [],
        followups: [],
        tier: "verified",
        confidenceScore: 1,
        language: locale,
        sources: [],
        expert,
      };
    }
    return null;
  }

  const answer = formatExecutiveBriefAnswer(result.data, intents, locale, expert);
  await persistExecutiveAudit(
    org,
    { goals, projectId, screen, locale },
    {
      status: "answered",
      tools,
      registeredRisks: result.data.registeredRisks?.length ?? 0,
      signals: collectRiskSignals(result.data.briefing).length,
      dataGaps: result.data.briefing.dataGaps.length,
      executionMs: Date.now() - start,
    },
  );
  return answer;
}
