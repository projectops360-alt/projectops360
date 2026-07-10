// ============================================================================
// ProjectOps360° — Isabella Executive Brief (REG-023) · public surface
// ============================================================================

export { detectExecutiveIntents, hasExecutiveIntent, intentGoals, type ExecutiveIntents } from "./intent";
export { getExecutiveBriefData } from "./service";
export { formatExecutiveBriefAnswer, collectRiskSignals, riskExposure } from "./formatter";
export { maybeAnswerWithExecutiveBrief, type ExecutiveBriefDeps } from "./gateway";
export type * from "./types";
