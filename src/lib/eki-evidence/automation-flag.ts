import "server-only";

/**
 * Feature gate for automated evidence evaluation.
 *
 * Default OFF. With the flag unset the endpoint answers 404 and nothing is
 * evaluated on a schedule; the manual and post-mutation paths are unaffected, so
 * turning it off degrades the system to exactly the Macrophase 2 behaviour
 * rather than to a broken one. Rollback = unset the variable. No migration.
 */
export function isAutomatedEvaluationEnabled(): boolean {
  return (process.env.EKI_AUTOMATED_EVALUATION_ENABLED ?? "").toLowerCase() === "true";
}

/**
 * The shared secret the scheduler must present.
 *
 * Without it the endpoint refuses (503) rather than running unauthenticated.
 * An evaluation endpoint open to the internet is a way to make somebody else's
 * controls flap, and the honest answer to "no secret configured" is a refusal,
 * never a silent accept.
 */
export function evaluatorSecret(): string | null {
  const configured = process.env.EKI_EVALUATOR_SECRET ?? process.env.CRON_SECRET ?? "";
  return configured.length >= 16 ? configured : null;
}

/**
 * Constant-time-ish comparison.
 *
 * The token is long and random enough that timing analysis is not the realistic
 * attack, but comparing lengths first and never logging the provided value costs
 * nothing.
 */
export function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Bearer prefix accepted because that is what Vercel Cron sends. */
export function extractSecret(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  return headers.get("x-eki-evaluator-secret");
}
