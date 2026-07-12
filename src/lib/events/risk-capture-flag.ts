// ============================================================================
// P2-T2 — Risk event capture pilot flag (PD-018; RISK-EVENT-CAPTURE)
// ============================================================================
// Per-project pilot flag, server-evaluated, DEFAULT OFF (Isabella Voice
// pattern). RISK_EVENT_CAPTURE_PROJECT_IDS is a comma-separated list of pilot
// project IDs; the literal "all" enables every project (local testing only —
// never set "all" in production). With the flag off, every risk writer behaves
// byte-identically to before P2-T2: no events, no affordances.
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
