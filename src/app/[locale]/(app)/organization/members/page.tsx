import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { isBillableSeat } from "@/lib/billing/config";
import { MembersClient } from "./members-client";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function MembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const org = await getOrgContext();
  // This section is restricted to PM and PMO roles (plus legacy owner/admin).
  const isPmOrPmo = org.isPmoLevel || org.orgRole === "PROJECT_MANAGER" || org.role === "owner" || org.role === "admin";
  if (!isPmOrPmo) notFound();
  const admin = createAdminClient();
  const canManage = isPmOrPmo;

  const { data: memberRows } = await admin.from("organization_members")
    .select("id, user_id, role, billing_seat_type, workspace_role, status, department, job_title")
    .eq("organization_id", org.organizationId);
  const members = (memberRows ?? []) as Row[];
  const ids = members.map((m) => String(m.user_id));

  const [{ data: profiles }, projectCounts] = await Promise.all([
    ids.length ? admin.from("profiles").select("id, display_name").in("id", ids) : Promise.resolve({ data: [] as Row[] }),
    admin.from("project_team_members").select("user_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).eq("organization_id", org.organizationId).eq("status", "active"),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [String((p as Row).id), String((p as Row).display_name ?? "")]));
  const countById = new Map<string, number>();
  for (const r of (projectCounts.data ?? []) as Row[]) { const k = String(r.user_id); countById.set(k, (countById.get(k) ?? 0) + 1); }

  // Emails (best-effort).
  const emailById = new Map<string, string>();
  try { const { data: list } = await admin.auth.admin.listUsers(); for (const u of list?.users ?? []) if (u.email) emailById.set(u.id, u.email); } catch { /* ignore */ }

  const view = members.map((m) => {
    const uid = String(m.user_id);
    return {
      id: String(m.id), userId: uid,
      name: nameById.get(uid) || emailById.get(uid)?.split("@")[0] || "—",
      email: emailById.get(uid) ?? null,
      seatType: (m.billing_seat_type as string) ?? null,
      workspaceRole: (m.workspace_role as string) ?? null,
      status: (m.status as string) ?? "active",
      department: (m.department as string) ?? null,
      jobTitle: (m.job_title as string) ?? null,
      activeProjects: countById.get(uid) ?? 0,
      billable: isBillableSeat((m.billing_seat_type as string) ?? null) && (m.status as string) === "active",
    };
  });

  return <MembersClient locale={locale} members={view} canManage={canManage} />;
}
