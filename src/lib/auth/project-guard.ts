import { notFound } from "next/navigation";
import { getOrgContext } from "./org-context";
import { getProjectAccess, canAccessProjectTab, type ProjectTab } from "./permissions";

/**
 * Server guard for a project tab/page. Renders 404 when the current user's
 * access level may not open this tab (e.g. a contributor opening the Team or
 * Charter tab via a direct URL). Returns { org, access } for reuse.
 */
export async function guardProjectTab(projectId: string, tab: ProjectTab) {
  const org = await getOrgContext();
  const access = await getProjectAccess(org, projectId);
  if (!canAccessProjectTab(access, tab)) notFound();
  return { org, access };
}
