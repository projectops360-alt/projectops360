import type { RemediationCandidate, TrustChange, TrustSummary } from "@/lib/eki-trust-context/assembler";
import type { TrustControlView } from "@/lib/eki-trust-context/types";
import { assertNoProhibitedAssurance, draftProvenance, type AiProposalProvenance } from "./authorization";

/**
 * Enterprise Trust reasoning for Isabella.
 *
 * Pure. It receives a context that was already assembled under the caller's RLS
 * and returns claims, each carrying the layer it belongs to and the references
 * that support it. It performs no reads, so it cannot widen the scope it was
 * given, and it performs no writes, so it cannot become the reason a governance
 * statement is true.
 */

export const TRUST_QUESTIONS = [
  "operating_controls",
  "degraded_controls",
  "why_operating",
  "why_degraded",
  "open_findings",
  "approaching_stale",
  "control_owner",
  "evidence_provenance",
  "contradictions",
  "remediation_priority",
  "what_changed",
  "overview",
] as const;

export type TrustQuestion = (typeof TRUST_QUESTIONS)[number];

/**
 * How a claim is known.
 *
 * `verified_current` is the only value that means "the running system measured
 * this". Everything else must be labelled, because the difference between "the
 * evidence is fresh" and "we decided it should be checked quarterly" is the
 * difference between a control that works and a control that is described.
 */
export const CLAIM_KINDS = [
  "verified_current",
  "historical",
  "normative",
  "inferred",
  "recommendation",
] as const;

export type TrustClaimKind = (typeof CLAIM_KINDS)[number];

export interface TrustReference {
  kind: "control" | "binding" | "evaluation" | "finding" | "audit_event";
  id: string;
  label: string;
}

export interface TrustClaim {
  kind: TrustClaimKind;
  statement: string;
  references: TrustReference[];
}

export interface TrustAnswer {
  question: TrustQuestion;
  claims: TrustClaim[];
  /** Empty when nothing could be established. Never filled with a plausible guess. */
  unsupported: string[];
  proposals: TrustProposal[];
}

export interface TrustProposal {
  title: string;
  detail: string;
  provenance: AiProposalProvenance;
}

export interface TrustAnswerInput {
  question: TrustQuestion;
  views: readonly TrustControlView[];
  summary: TrustSummary;
  remediation: readonly RemediationCandidate[];
  changes?: readonly TrustChange[];
  controlObjectId?: string;
  unavailableLayers?: readonly string[];
}

function controlRef(view: TrustControlView): TrustReference {
  return { kind: "control", id: view.controlObjectId, label: view.title };
}

function evaluationRefs(view: TrustControlView): TrustReference[] {
  return view.latestEvaluations.map((evaluation) => ({
    kind: "evaluation" as const,
    id: evaluation.evaluationId,
    label: `${evaluation.outcome} · ${evaluation.reasonCode}`,
  }));
}

function findingRefs(view: TrustControlView): TrustReference[] {
  return view.openFindings.map((finding) => ({
    kind: "finding" as const,
    id: finding.findingObjectId,
    label: finding.conditionCode,
  }));
}

/**
 * Answer one question from the assembled context.
 *
 * Every branch either produces claims backed by references or records the
 * question in `unsupported`. There is no path that returns a confident sentence
 * with nothing behind it.
 */
export function answerTrustQuestion(input: TrustAnswerInput): TrustAnswer {
  const claims: TrustClaim[] = [];
  const unsupported: string[] = [];
  const proposals: TrustProposal[] = [];
  const target = input.controlObjectId
    ? input.views.find((v) => v.controlObjectId === input.controlObjectId)
    : undefined;

  switch (input.question) {
    case "operating_controls": {
      const operating = input.views.filter((v) => v.controlState === "operating");
      if (operating.length === 0) {
        unsupported.push("no_control_is_currently_operating");
      }
      for (const view of operating) {
        claims.push({
          kind: "verified_current",
          statement: `${view.title} is operating.`,
          references: [controlRef(view), ...evaluationRefs(view)],
        });
      }
      break;
    }

    case "degraded_controls": {
      const degraded = input.views.filter((v) => v.controlState === "degraded" || v.controlState === "ineffective");
      if (degraded.length === 0) unsupported.push("no_control_is_currently_degraded");
      for (const view of degraded) {
        claims.push({
          kind: "verified_current",
          statement: `${view.title} is ${view.controlState}: ${view.gateReasons.join(", ") || "no reason recorded"}.`,
          references: [controlRef(view), ...evaluationRefs(view), ...findingRefs(view)],
        });
      }
      break;
    }

    case "why_operating": {
      if (!target) { unsupported.push("control_not_found"); break; }
      if (target.controlState !== "operating") {
        unsupported.push("control_is_not_operating");
        break;
      }
      for (const evaluation of target.latestEvaluations) {
        claims.push({
          kind: "verified_current",
          statement:
            `${target.title} is operating because its binding returned ${evaluation.outcome} ` +
            `(${evaluation.reasonCode}) over ${evaluation.evidenceCount} records` +
            `${evaluation.sourceTable ? ` in ${evaluation.sourceTable}` : ""}.`,
          references: [controlRef(target), { kind: "evaluation", id: evaluation.evaluationId, label: evaluation.reasonCode }],
        });
      }
      if (target.latestEvaluations.length === 0) unsupported.push("no_evaluation_recorded");
      break;
    }

    case "why_degraded": {
      if (!target) { unsupported.push("control_not_found"); break; }
      if (target.gateReasons.length === 0 && target.openFindings.length === 0) {
        unsupported.push("no_recorded_reason_for_degradation");
        break;
      }
      for (const reason of target.gateReasons) {
        claims.push({
          kind: "verified_current",
          statement: `${target.title} does not meet the operating condition: ${reason}.`,
          references: [controlRef(target), ...evaluationRefs(target)],
        });
      }
      for (const finding of target.openFindings) {
        claims.push({
          kind: "verified_current",
          statement:
            `An open finding records ${finding.conditionCode}, first seen ${finding.openedAt}` +
            `${finding.occurrenceCount > 1 ? ` and repeated ${finding.occurrenceCount} times` : ""}.`,
          references: [controlRef(target), { kind: "finding", id: finding.findingObjectId, label: finding.conditionCode }],
        });
      }
      break;
    }

    case "open_findings": {
      const withFindings = input.views.filter((v) => v.openFindings.length > 0);
      if (withFindings.length === 0) unsupported.push("no_open_findings");
      for (const view of withFindings) {
        for (const finding of view.openFindings) {
          claims.push({
            kind: "verified_current",
            statement: `${view.title}: ${finding.conditionCode} (seen ${finding.occurrenceCount}×, last ${finding.lastSeenAt}).`,
            references: [controlRef(view), { kind: "finding", id: finding.findingObjectId, label: finding.conditionCode }],
          });
        }
      }
      break;
    }

    case "approaching_stale": {
      const ageing = input.views.filter((v) => v.latestEvaluations.some((e) => e.outcome === "approaching_stale"));
      if (ageing.length === 0) unsupported.push("no_evidence_is_approaching_stale");
      for (const view of ageing) {
        const evaluation = view.latestEvaluations.find((e) => e.outcome === "approaching_stale")!;
        claims.push({
          kind: "verified_current",
          statement:
            `${view.title} is inside its warning window: the evidence is still valid but will lapse ` +
            `unless it is renewed (${evaluation.reasonCode}).`,
          references: [controlRef(view), { kind: "evaluation", id: evaluation.evaluationId, label: evaluation.reasonCode }],
        });
      }
      break;
    }

    case "control_owner": {
      if (!target) { unsupported.push("control_not_found"); break; }
      if (!target.ownerUserId) {
        // Stated as a fact, not glossed over. An unowned control cannot operate,
        // and saying "the owner is unknown" would hide a real gate failure.
        claims.push({
          kind: "verified_current",
          statement: `${target.title} has no assigned owner, which is one of the conditions it must satisfy to operate.`,
          references: [controlRef(target)],
        });
        proposals.push({
          title: "Assign an owner",
          detail: `Nominate an accountable owner for ${target.title}. An authorized human must approve the assignment.`,
          provenance: draftProvenance([target.controlObjectId]),
        });
        break;
      }
      claims.push({
        kind: "verified_current",
        statement: `${target.title} is owned by ${target.ownerName ?? target.ownerUserId}.`,
        references: [controlRef(target)],
      });
      break;
    }

    case "evidence_provenance": {
      if (!target) { unsupported.push("control_not_found"); break; }
      if (target.latestEvaluations.length === 0) { unsupported.push("no_evaluation_recorded"); break; }
      for (const evaluation of target.latestEvaluations) {
        claims.push({
          kind: "verified_current",
          statement:
            `The evidence came from ${evaluation.sourceTable ?? "an unnamed source"}, ` +
            `${evaluation.evidenceCount} records, most recent ${evaluation.latestEvidenceAt ?? "unknown"}.`,
          references: [controlRef(target), { kind: "evaluation", id: evaluation.evaluationId, label: evaluation.reasonCode }],
        });
      }
      for (const audit of target.auditReferences.slice(0, 3)) {
        claims.push({
          kind: "historical",
          statement: `Governance action ${audit.eventType} (${audit.decision}) at ${audit.occurredAt}.`,
          references: [{ kind: "audit_event", id: audit.eventId, label: audit.eventType }],
        });
      }
      break;
    }

    case "contradictions": {
      const contradicted = input.views.filter((v) =>
        v.contradictoryRelations.some((r) => r.resolutionStatus === "unresolved"),
      );
      if (contradicted.length === 0) unsupported.push("no_unresolved_contradiction");
      for (const view of contradicted) {
        claims.push({
          kind: "verified_current",
          statement: `${view.title} has an unresolved contradiction, which blocks it from operating.`,
          references: [controlRef(view), ...evaluationRefs(view)],
        });
      }
      const withContradictoryEvidence = input.views.filter((v) =>
        v.latestEvaluations.some((e) => e.outcome === "contradictory"),
      );
      for (const view of withContradictoryEvidence) {
        const evaluation = view.latestEvaluations.find((e) => e.outcome === "contradictory")!;
        claims.push({
          kind: "verified_current",
          statement: `${view.title}: the evidence disagrees with itself (${evaluation.reasonCode}, ${evaluation.contradictionCount} conflicting records).`,
          references: [controlRef(view), { kind: "evaluation", id: evaluation.evaluationId, label: evaluation.reasonCode }],
        });
      }
      break;
    }

    case "remediation_priority": {
      if (input.remediation.length === 0) { unsupported.push("nothing_to_remediate"); break; }
      for (const candidate of input.remediation.slice(0, 5)) {
        claims.push({
          // A ranking is an inference over verified facts, not a verified fact.
          kind: "inferred",
          statement: `#${candidate.rank} ${candidate.title} — ${candidate.reasons.join(", ")}.`,
          references: [{ kind: "control", id: candidate.controlObjectId, label: candidate.title }],
        });
        proposals.push({
          title: `Remediate ${candidate.title}`,
          detail: `Address: ${candidate.reasons.join(", ")}. Isabella cannot resolve the finding; an authorized human must.`,
          provenance: draftProvenance([candidate.controlObjectId]),
        });
      }
      break;
    }

    case "what_changed": {
      const changes = input.changes ?? [];
      if (changes.length === 0) { unsupported.push("no_change_since_previous_evaluation"); break; }
      for (const change of changes) {
        const view = input.views.find((v) => v.controlObjectId === change.controlObjectId);
        claims.push({
          kind: "historical",
          statement:
            `${view?.title ?? change.controlObjectId}: ${change.kind} ` +
            `${change.from ?? "none"} → ${change.to ?? "none"}.`,
          references: view ? [controlRef(view)] : [],
        });
      }
      break;
    }

    case "overview": {
      claims.push({
        kind: "verified_current",
        statement:
          `${input.summary.total} controls: ${input.summary.byState.operating} operating, ` +
          `${input.summary.byState.degraded} degraded, ${input.summary.neverMeasured} never measured. ` +
          `${input.summary.openFindings} open findings.`,
        references: input.views.map(controlRef),
      });
      break;
    }
  }

  // A layer that could not be read is named. Silence about a layer reads as
  // "there is nothing there", which is a different and much worse answer.
  for (const layer of input.unavailableLayers ?? []) {
    unsupported.push(`layer_unavailable:${layer}`);
  }

  const answer: TrustAnswer = { question: input.question, claims, unsupported, proposals };
  assertNoProhibitedAssurance(claims.map((c) => c.statement).join(" "));
  return answer;
}

/**
 * Route a question to its kind.
 *
 * Deterministic and bilingual. An unmatched question returns null so the caller
 * falls through to the existing pipeline instead of guessing which trust
 * question was meant.
 */
export function classifyTrustQuestion(question: string): TrustQuestion | null {
  const q = question.toLowerCase();
  if (!/\b(control|controls|trust|confianza|evidence|evidencia|finding|hallazgo|governance|gobernanza|compliance|cumplimiento)\b/.test(q)) {
    return null;
  }
  if (/\bchang(ed|es)\b|\bcambi(ó|o|os|ado)\b|since the previous|desde la (última|anterior)/.test(q)) return "what_changed";
  if (/remediat|priorit|primero|first|prioridad/.test(q)) return "remediation_priority";
  if (/contradict|contradic/.test(q)) return "contradictions";
  if (/\bown(er|s)\b|responsable|due(ñ|n)o/.test(q)) return "control_owner";
  if (/approaching stale|por (vencer|caducar)|casi (vencida|obsoleta)|warning window/.test(q)) return "approaching_stale";
  if (/\bfinding|hallazgo/.test(q)) return "open_findings";
  if (/why .*(degrad|fail)|por qu(é|e) .*(degrad|fall)/.test(q)) return "why_degraded";
  if (/why .*operating|qu(é|e) evidencia|what evidence/.test(q)) return "why_operating";
  if (/provenance|procedencia|which governance action|qu(é|e) acci(ó|o)n/.test(q)) return "evidence_provenance";
  if (/degrad/.test(q)) return "degraded_controls";
  if (/operating|operando|en operaci(ó|o)n/.test(q)) return "operating_controls";
  return "overview";
}
