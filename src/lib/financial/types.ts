export type FinancialQuality =
  | "available"
  | "provisional"
  | "incomplete"
  | "insufficient_inputs"
  | "invalid";

export type MetricResult =
  | { status: "available"; value: number }
  | { status: "unavailable"; value: null; reason: string };

export interface EvmSnapshotInput {
  bac: number | null;
  pv: number | null;
  ev: number | null;
  ac: number | null;
}

export interface EvmSnapshotResult {
  cv: MetricResult;
  sv: MetricResult;
  cpi: MetricResult;
  spi: MetricResult;
  quality: FinancialQuality;
  limitations: string[];
}

export interface DeterministicForecastInput extends EvmSnapshotInput {
  bottomUpEtc?: number | null;
  pmEtc?: number | null;
}

export interface DeterministicForecastResult {
  bottomUpEac: MetricResult;
  cpiEtc: MetricResult;
  cpiEac: MetricResult;
  cpiSpiEtc: MetricResult;
  cpiSpiEac: MetricResult;
  pmEac: MetricResult;
}

export interface WeightedOutcome {
  probability: number;
  eac: number;
}

export type FinancialCapability =
  | "financial.view"
  | "financial.prepare"
  | "financial.approve"
  | "financial.post"
  | "financial.reconcile"
  | "financial.period.manage"
  | "financial.funding.authorize"
  | "financial.reserve.release"
  | "financial.payment.release"
  | "financial.audit.read";

export interface FinancialDelegation {
  capability: FinancialCapability;
  projectId: string;
  maximumAmount?: number;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface FinancialActor {
  actorType: "human" | "system" | "ai" | "external";
  userId: string | null;
  organizationId: string;
  projectIds: string[];
  capabilities: FinancialCapability[];
  delegations?: FinancialDelegation[];
}

export interface FinancialAuthorizationRequest {
  organizationId: string;
  projectId: string;
  capability: FinancialCapability;
  amount?: number;
  occurredAt: string;
  requesterId?: string | null;
  approverId?: string | null;
  posterId?: string | null;
  reconcilerId?: string | null;
}

export type AuthorizationResult =
  | { allowed: true; source: "direct" | "delegation" }
  | { allowed: false; reason: string };

export interface ReconciliationResult {
  status: "reconciled" | "within_tolerance" | "exception";
  expected: number;
  actual: number;
  difference: number;
  tolerance: number;
}
