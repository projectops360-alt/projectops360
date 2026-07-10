// ============================================================================
// ProjectOps360° — Isabella Executive Brief · shared types (pure)
// ============================================================================
// REG-023 / ISABELLA-EXECUTIVE-BRIEF
//
// The composite, decision-oriented view a PM asks for by voice or text:
// project summary + risk outlook. Everything is record-backed and reuses the
// REG-013 briefing engine; REGISTERED risks are always kept separate from
// DETECTED operational signals, and unevaluable sources surface as dataGaps —
// inference is never presented as a stored fact.
// ============================================================================

import type { ProjectBriefing } from "@/lib/project-briefing/types";

/** A formally registered risk record (risks table, org+project scoped). */
export interface RegisteredRisk {
  title: string;
  category: string;
  probability: string;
  impact: string;
  severity: string;
  status: string;
}

/** An operational risk SIGNAL detected from live execution data (not a record). */
export interface RiskSignal {
  key: "active_blockers" | "overdue" | "at_risk_milestones" | "unassigned_active" | "unresolved_actions";
  count: number;
}

export interface ExecutiveBriefData {
  briefing: ProjectBriefing;
  /** Open/mitigating registered risks (top by severity). Null = source unreadable. */
  registeredRisks: RegisteredRisk[] | null;
}

export type ExecutiveBriefResult =
  | { ok: true; data: ExecutiveBriefData }
  | { ok: false; reason: "no_project" | "not_authorized" | "unavailable" };
