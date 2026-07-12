// ============================================================================
// P2-T2 — Risk event capture pilot flag (PD-018; RISK-EVENT-CAPTURE)
// ============================================================================
// Per-project pilot flag, server-evaluated, DEFAULT OFF (Isabella Voice
// pattern). RISK_EVENT_CAPTURE_PROJECT_IDS is a comma-separated list of pilot
// project IDs; the literal "all" enables every project (local testing only —
// never set "all" in production). With the flag off, every risk writer behaves
// byte-identically to before P2-T2: no events, no affordances.
//
// P2-T2 remediation (Fase 5) — a SECOND, independent flag gates the Closeout
// affordance UI (Assess / Materialize / Reopen). Turning the capture flag ON
// records events but does NOT auto-show the affordance controls; the affordances
// flag must also be ON. Both are server-evaluated and default OFF.
// ============================================================================

/** Pure gate (unit-tested): is capture enabled for this project given the raw env value? */
export function isRiskEventCaptureEnabledFor(
  projectId: string,
  rawEnvValue: string | undefined | null,
): boolean {
  const raw = (rawEnvValue ?? "").trim();
  if (!raw || !projectId) return false;
  if (raw === "all") return true;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(projectId);
}

/** Server-side gate reading the environment (default OFF). */
export function isRiskEventCaptureEnabled(projectId: string): boolean {
  return isRiskEventCaptureEnabledFor(projectId, process.env.RISK_EVENT_CAPTURE_PROJECT_IDS);
}

/**
 * Pure gate for the Closeout affordance UI (Assess / Materialize / Reopen).
 * Independent from the capture flag: capture ON alone does NOT show the UI.
 * Same CSV/"all" semantics. Default OFF.
 */
export function isRiskEventCaptureAffordancesEnabledFor(
  projectId: string,
  rawEnvValue: string | undefined | null,
): boolean {
  return isRiskEventCaptureEnabledFor(projectId, rawEnvValue);
}

/** Server-side affordance-UI gate reading the environment (default OFF). */
export function isRiskEventCaptureAffordancesEnabled(projectId: string): boolean {
  return isRiskEventCaptureAffordancesEnabledFor(projectId, process.env.RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS);
}
