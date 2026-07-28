/**
 * Controlled rollout scope for Enterprise Trust.
 *
 * The three capability flags are booleans, so on their own they are all-or-
 * nothing: setting one to `true` would expose EKI to every organization on the
 * platform. This allowlist is what makes an internal-only rollout expressible,
 * and it follows the pattern the repository already uses for staged rollout
 * (`LIVING_GRAPH_EVENT_RELATIONSHIPS_PROJECT_IDS`, `FINANCIAL_PILOT_PROJECT_IDS`,
 * `PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS`).
 *
 * **Deny by default.** An empty or unset allowlist enables the capability for
 * NOBODY, even when the boolean flag is `true`. The alternative — treating empty
 * as "everyone" — means a single missing environment variable silently exposes
 * every tenant, which is precisely the failure this exists to prevent.
 */
export function ekiRolloutOrganizations(): ReadonlySet<string> {
  const raw = process.env.EKI_TRUST_ORGANIZATION_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter((id) => id.length > 0),
  );
}

/**
 * Whether Enterprise Trust is enabled for this organization.
 *
 * Both conditions must hold: the capability flag is on AND the organization is
 * on the allowlist. Either alone is not enough.
 */
export function isEkiRolloutOrganization(organizationId: string | null | undefined): boolean {
  if (!organizationId) return false;
  return ekiRolloutOrganizations().has(organizationId.trim().toLowerCase());
}

/** Whether any organization is in scope at all — used to skip work entirely. */
export function hasEkiRolloutScope(): boolean {
  return ekiRolloutOrganizations().size > 0;
}
