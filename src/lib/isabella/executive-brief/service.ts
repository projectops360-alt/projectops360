// ============================================================================
// ProjectOps360° — Isabella Executive Brief · data service (server-only)
// ============================================================================
// REG-023 / ISABELLA-EXECUTIVE-BRIEF
//
// Loads the composite executive view by REUSING approved layers — no duplicated
// business logic, no new RBAC rules:
//   • Project summary/health/signals → getProjectBriefing (REG-013: identity
//     from the trusted session, org+project gate, role-scoped, dataGaps).
//   • Registered risks detail → the same org+project-scoped read the briefing
//     already performs, extended with display fields (title/severity/…).
// Read-only. Never throws. No SQL from any model — this is an approved layer.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getProjectBriefing } from "@/lib/project-briefing/service";
import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import type { ExecutiveBriefResult, RegisteredRisk } from "./types";

const OPEN_RISK_STATUSES = ["open", "mitigating"];
const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const MAX_REGISTERED_RISKS = 10;

/**
 * Load the executive brief data for a project. The briefing call re-validates
 * org membership + project ownership from the trusted session (REG-013);
 * risks detail runs only after that gate passed.
 */
export async function getExecutiveBriefData(
  org: OrgContext,
  projectId: string,
  locale: Locale,
): Promise<ExecutiveBriefResult> {
  const briefingRes = await getProjectBriefing(projectId, locale);
  if (!briefingRes.ok) return { ok: false, reason: briefingRes.reason };

  // Registered risks detail — tenant + project scoped (defense in depth on top
  // of the briefing's own org gate).
  let registeredRisks: RegisteredRisk[] | null = null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("risks")
      .select("title, category, probability, impact, severity, status")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .in("status", OPEN_RISK_STATUSES)
      .limit(50);

    if (!error) {
      registeredRisks = (data ?? [])
        .map((r) => ({
          title: String(r.title ?? "").slice(0, 160) || "Risk",
          category: String(r.category ?? "other"),
          probability: String(r.probability ?? "medium"),
          impact: String(r.impact ?? "medium"),
          severity: String(r.severity ?? "medium"),
          status: String(r.status ?? "open"),
        }))
        .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
        .slice(0, MAX_REGISTERED_RISKS);
    }
  } catch {
    registeredRisks = null; // reported as a data gap, never invented
  }

  return { ok: true, data: { briefing: briefingRes.briefing, registeredRisks } };
}
