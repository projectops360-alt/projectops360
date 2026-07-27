/**
 * Feature gate for Enterprise Trust reasoning.
 *
 * Default OFF, and it must be, because the router's subject gate is broad by
 * necessity: it matches "control", "controls", "controles", "governance",
 * "compliance", "evidence", "finding". Questions like "how do I add quality
 * controls to my project?" match it too.
 *
 * With the route always on, every such question would be pulled away from
 * retrieval and answered from the Enterprise Trust context — which is empty in
 * any environment where the EKI migrations have not been applied. The user would
 * get "there is no Enterprise Trust context" instead of the product answer they
 * get today: a silent degradation, not an error, and therefore one nobody
 * reports.
 *
 * Off, the route is never taken and Isabella behaves exactly as before.
 * Rollback = unset the variable. No migration.
 */
export function isEnterpriseTrustReasoningEnabled(): boolean {
  return (process.env.EKI_TRUST_REASONING_ENABLED ?? "").toLowerCase() === "true";
}
