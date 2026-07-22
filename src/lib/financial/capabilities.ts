import type { FinancialCapability } from "./types";

export interface FinancialAccessContext {
  organizationRole: "owner" | "admin" | "member" | "viewer";
  projectPermissionLevel?: string | null;
  projectRole?: string | null;
  permissionFlags?: Record<string, boolean> | null;
}

const ALL_CAPABILITIES: FinancialCapability[] = [
  "financial.view",
  "financial.prepare",
  "financial.approve",
  "financial.post",
  "financial.reconcile",
  "financial.period.manage",
  "financial.funding.authorize",
  "financial.reserve.release",
  "financial.payment.release",
  "financial.audit.read",
];

export function resolveFinancialCapabilities(
  context: FinancialAccessContext,
): FinancialCapability[] {
  if (context.organizationRole === "owner" || context.organizationRole === "admin") {
    return [...ALL_CAPABILITIES];
  }

  const capabilities = new Set<FinancialCapability>();
  const role = (context.projectRole ?? "").toLowerCase();
  const level = context.projectPermissionLevel ?? "";
  const flags = context.permissionFlags ?? {};

  if (flags.can_view_budget || ["project_owner", "project_manager", "approver"].includes(level)) {
    capabilities.add("financial.view");
  }
  if (level === "project_owner" || level === "project_manager" || role.includes("project control")) {
    capabilities.add("financial.prepare");
  }
  if (level === "approver" || flags.can_approve_changes) {
    capabilities.add("financial.approve");
  }
  if (role.includes("pmo") || role.includes("controller") || role.includes("budget owner")) {
    capabilities.add("financial.view");
    capabilities.add("financial.prepare");
    capabilities.add("financial.reconcile");
    capabilities.add("financial.audit.read");
  }
  if (role.includes("finance") || role.includes("controller")) {
    capabilities.add("financial.post");
    capabilities.add("financial.period.manage");
  }
  if (role.includes("funding") || role.includes("sponsor") || role.includes("budget owner")) {
    capabilities.add("financial.funding.authorize");
  }
  if (role.includes("treasury")) capabilities.add("financial.payment.release");
  if (role.includes("change control")) capabilities.add("financial.reserve.release");

  return [...capabilities];
}
