import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence";
import { runIsabellaProcessIntelligence } from "@/lib/isabella/process-intelligence-runtime";
import { discoverProcess } from "@/lib/process-mining/discovery";
import type {
  HistoryValidationCheck,
  KnownHistoryScenario,
  KnownHistoryValidationReport,
} from "./types";

function check(id: string, expected: unknown, actual: unknown): HistoryValidationCheck {
  return { id, expected, actual, passed: Object.is(expected, actual) };
}

function evidencePacket(scenario: KnownHistoryScenario, index: number): IsabellaEvidencePacket {
  const event = scenario.events[index];
  return {
    evidenceId: `event:${event.eventId}`,
    evidenceType: "event_summary",
    sourceKind: "project_event_graph",
    sourceId: `event:${event.eventId}`,
    projectId: scenario.projectId,
    organizationId: scenario.organizationId,
    title: event.eventType,
    summary: `${event.eventType} in case ${event.caseId}.`,
    citationLabel: "Known canonical history",
    citationRef: `event:${event.eventId}`,
    occurredAt: event.occurredAt,
    confidence: "verified",
    visibility: "project",
    allowedClaims: ["factual_project_data", "status_summary", "assumption_or_inference"],
    disallowedClaims: ["root_cause_claim"],
  };
}

function validationContext(
  scenario: KnownHistoryScenario,
  discovery: ReturnType<typeof discoverProcess>,
): IsabellaProcessContext {
  const occurred = scenario.events.map((event) => event.occurredAt).filter((value): value is string => !!value).sort();
  const finalEvent = [...scenario.events].sort((left, right) => right.sequenceNumber - left.sequenceNumber)[0];
  const activeBlocker = scenario.expected.activeExplicitBlocker && finalEvent?.eventType === "TaskBlocked";
  const blockerPacket: IsabellaEvidencePacket | null = activeBlocker
    ? {
        ...evidencePacket(scenario, scenario.events.indexOf(finalEvent)),
        evidenceType: "blocker" as const,
        summary: "Explicit active blocker recorded in the canonical history.",
        allowedClaims: ["blocker_claim", "recommendation_claim"],
        disallowedClaims: [],
      }
    : null;
  return {
    scope: { organizationId: scenario.organizationId, projectId: scenario.projectId, userId: "known-history-validator", locale: "en" },
    project: { projectId: scenario.projectId, name: scenario.title, citationRef: `project:${scenario.projectId}` },
    snapshotAt: "2026-07-15T00:00:00.000Z",
    included: ["project", "process_mining_summary"],
    evidencePackets: scenario.events.map((_, index) => evidencePacket(scenario, index)),
    citations: scenario.events.map((event) => ({
      sourceLabel: "Known canonical history",
      entityType: "event_summary" as const,
      entityTitle: event.eventType,
      safeRef: `event:${event.eventId}`,
      occurredAt: event.occurredAt,
      confidence: "verified" as const,
    })),
    taskContext: {
      totalVisibleTasks: 1,
      tasks: [{
        taskId: finalEvent.caseId,
        title: scenario.title,
        status: activeBlocker ? "blocked" : "done",
        priority: "high",
        milestoneId: "known-milestone",
        ownerId: "known-owner",
        blockedReason: activeBlocker ? "Explicit active blocker recorded in canonical history." : null,
        citationRef: `task:${finalEvent.caseId}`,
      }],
      subtasks: [],
      byStatus: { [activeBlocker ? "blocked" : "done"]: 1 },
      byPriority: { high: 1 },
      withoutMilestoneCount: 0,
      withoutOwnerCount: 0,
      overdueCount: 0,
      blockedCount: activeBlocker ? 1 : 0,
    },
    processSignals: {
      blockedCount: activeBlocker ? 1 : 0,
      advancedFindingsAvailable: false,
      packets: blockerPacket ? [blockerPacket] : [],
      eventHistoryAvailable: true,
      transitionCount: discovery.directFollow.length,
    },
    processMiningContext: {
      status: "ready",
      eventCount: discovery.quality.usedEvents,
      caseCount: discovery.quality.cases,
      taskEventCount: discovery.quality.usedEvents,
      milestoneEventCount: 0,
      dependencyEventCount: 0,
      transitionCount: discovery.directFollow.length,
      directFollowCount: discovery.directFollow.length,
      variantCount: discovery.variants.length,
      temporallyMeasuredCaseCount: discovery.temporalMetrics.filter((item) => item.cycleTimeMs !== null).length,
      unknownActivityCount: discovery.quality.unknownActivities,
      delayFindingCount: 0,
      blockerFindingCount: 0,
      reworkFindingCount: discovery.variants.filter((variant) => variant.reworkRate > 0).length,
      bottleneckFindingCount: 0,
      dataQualityFlagCount: 0,
      firstOccurredAt: occurred[0] ?? null,
      lastOccurredAt: occurred.at(-1) ?? null,
      eventsTruncated: false,
      integrityValid: true,
      integrityIssueCount: 0,
      engineVersion: "known-history-validation-1.0.0",
    },
    limitations: [],
    status: "ready",
  };
}

function hasUnsupportedCausalAssertion(answer: string): boolean {
  return /\b(was caused by|therefore caused|fue causado por|por lo tanto caus[oó])\b/i.test(answer);
}

export async function validateKnownHistory(
  scenario: KnownHistoryScenario,
): Promise<KnownHistoryValidationReport> {
  const discovery = discoverProcess(scenario.events, scenario.organizationId, scenario.projectId);
  const context = validationContext(scenario, discovery);
  const buildContext = async () => context;
  const [english, spanish] = await Promise.all([
    runIsabellaProcessIntelligence({
      question: "Summarize the Process Mining events, cases, transitions and variants.",
      locale: "en",
      projectId: scenario.projectId,
    }, { buildContext }),
    runIsabellaProcessIntelligence({
      question: "Resume los eventos, casos, transiciones y variantes de Process Mining.",
      locale: "es",
      projectId: scenario.projectId,
    }, { buildContext }),
  ]);
  const [rootCause, recommendation] = await Promise.all([
    runIsabellaProcessIntelligence({
      question: "Why is execution blocked?",
      locale: "en",
      projectId: scenario.projectId,
    }, { buildContext }),
    runIsabellaProcessIntelligence({
      question: "What should I do next?",
      locale: "en",
      projectId: scenario.projectId,
    }, { buildContext }),
  ]);

  const checks: HistoryValidationCheck[] = [
    check("case_count", scenario.expected.caseCount, discovery.quality.cases),
    check("direct_follow_count", scenario.expected.directFollowCount, discovery.directFollow.length),
    check("variant_count", scenario.expected.variantCount, discovery.variants.length),
    check("unknown_activity_count", scenario.expected.unknownActivityCount, discovery.quality.unknownActivities),
    check("has_rework", scenario.expected.hasRework, discovery.variants.some((variant) => variant.reworkRate > 0)),
  ];

  for (const metrics of discovery.temporalMetrics) {
    checks.push(check(`cycle_time:${metrics.caseId}`, scenario.expected.cycleTimeByCaseMs[metrics.caseId], metrics.cycleTimeMs));
    checks.push(check(`explicit_waiting:${metrics.caseId}`, scenario.expected.explicitWaitingByCaseMs[metrics.caseId], metrics.explicitWaitingTimeMs));
  }

  const expectedDirectFollowText = `**${scenario.expected.directFollowCount}** direct-follow relations`;
  const expectedSpanishText = `**${scenario.expected.directFollowCount}** relaciones direct-follow`;
  checks.push(
    check("english_answered", "answered", english.status),
    check("spanish_answered", "answered", spanish.status),
    check("english_exact_direct_follow", true, english.answer.includes(expectedDirectFollowText)),
    check("spanish_exact_direct_follow", true, spanish.answer.includes(expectedSpanishText)),
    check("english_grounded_trace", true, english.reasoningTrace?.findings.some((finding) => finding.status === "accepted") ?? false),
    check("spanish_grounded_trace", true, spanish.reasoningTrace?.findings.some((finding) => finding.status === "accepted") ?? false),
    check("english_evidence_refs", true, (english.evidenceRefs?.length ?? 0) > 0),
    check("spanish_evidence_refs", true, (spanish.evidenceRefs?.length ?? 0) > 0),
    check("no_unsupported_causal_assertion_en", false, hasUnsupportedCausalAssertion(english.answer)),
    check("no_unsupported_causal_assertion_es", false, hasUnsupportedCausalAssertion(spanish.answer)),
  );
  if (scenario.expected.activeExplicitBlocker) {
    checks.push(
      check("explicit_blocker_confirmed", true, rootCause.answer.includes("Confirmed cause")),
      check("root_cause_grounded", true, rootCause.reasoningTrace?.findings.some((finding) => finding.id.startsWith("root:") && finding.status === "accepted") ?? false),
      check("grounded_recommendation", true, (recommendation.reasoningTrace?.recommendationCount ?? 0) > 0),
      check("human_approval_required", true, recommendation.answer.toLowerCase().includes("requires human approval")),
      check("not_auto_executed", true, recommendation.answer.toLowerCase().includes("not executed automatically")),
    );
  } else {
    checks.push(
      check("no_invented_confirmed_cause", false, rootCause.answer.includes("Confirmed cause")),
      check("no_invented_recommendation", 0, recommendation.reasoningTrace?.recommendationCount ?? 0),
    );
  }

  return {
    validationVersion: "1.0.0",
    scenarioId: scenario.id,
    passed: checks.every((item) => item.passed),
    checks,
    englishAnswer: english.answer,
    spanishAnswer: spanish.answer,
    rootCauseAnswer: rootCause.answer,
    recommendationAnswer: recommendation.answer,
    evidenceRefs: [...new Set([...(english.evidenceRefs ?? []), ...(spanish.evidenceRefs ?? [])])],
    limitations: [...new Set([...(english.limitations ?? []), ...(spanish.limitations ?? [])])],
  };
}

export async function validateAllKnownHistories(
  scenarios: readonly KnownHistoryScenario[],
): Promise<KnownHistoryValidationReport[]> {
  return Promise.all(scenarios.map(validateKnownHistory));
}
