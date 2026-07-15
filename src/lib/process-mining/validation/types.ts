import type { DiscoveryEvent } from "@/lib/process-mining/discovery";

export interface KnownHistoryExpectation {
  caseCount: number;
  directFollowCount: number;
  variantCount: number;
  unknownActivityCount: number;
  explicitWaitingByCaseMs: Record<string, number | null>;
  cycleTimeByCaseMs: Record<string, number | null>;
  hasRework: boolean;
  activeExplicitBlocker: boolean;
}

export interface KnownHistoryScenario {
  id: string;
  title: string;
  organizationId: string;
  projectId: string;
  events: DiscoveryEvent[];
  expected: KnownHistoryExpectation;
}

export interface HistoryValidationCheck {
  id: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
}

export interface KnownHistoryValidationReport {
  validationVersion: "1.0.0";
  scenarioId: string;
  passed: boolean;
  checks: HistoryValidationCheck[];
  englishAnswer: string;
  spanishAnswer: string;
  rootCauseAnswer: string;
  recommendationAnswer: string;
  evidenceRefs: string[];
  limitations: string[];
}
