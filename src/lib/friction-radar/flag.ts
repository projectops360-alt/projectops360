const TRUE = "true";

/**
 * Server-only controlled rollout. Both the global switch and a project pilot
 * entry are required. `all` is allowed outside Vercel production for preview
 * review, but production always requires explicit project UUIDs.
 */
export function isFrictionRadarEnabledForProject(projectId: string): boolean {
  if ((process.env.FRICTION_RADAR_ENABLED ?? "").toLowerCase() !== TRUE) return false;
  const pilots = (process.env.FRICTION_RADAR_PROJECT_IDS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const normalizedProjectId = projectId.trim().toLowerCase();
  if (pilots.includes(normalizedProjectId)) return true;
  return pilots.includes("all") && process.env.VERCEL_ENV !== "production";
}
