"use client";

// ============================================================================
// Members & Seats — internal org members and their billing seat types.
// ============================================================================

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Loader2, Mail } from "lucide-react";
import { SEAT_TYPES, WORKSPACE_ROLES, MEMBER_STATUSES } from "@/lib/billing/config";
import { updateMemberSeatAction, inviteMemberAction } from "./actions";

interface MemberView {
  id: string; userId: string; name: string; email: string | null;
  seatType: string | null; workspaceRole: string | null; status: string;
  department: string | null; jobTitle: string | null; activeProjects: number; billable: boolean;
}
const inp = "rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground focus:border-brand-500 focus:outline-none";

const STATUS_TONE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  invited: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  suspended: "bg-muted text-muted-foreground", removed: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function MembersClient({ locale, members, canManage }: { locale: string; members: MemberView[]; canManage: boolean }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<"all" | "billable" | "free" | "invited">("all");
  const [email, setEmail] = useState("");
  const [inviteSeat, setInviteSeat] = useState("full_seat");
  const [msg, setMsg] = useState<string | null>(null);

  const billableCount = members.filter((m) => m.billable).length;
  const freeCount = members.filter((m) => !m.billable && m.status === "active").length;
  const pendingCount = members.filter((m) => m.status === "invited").length;

  const filtered = useMemo(() => members.filter((m) => {
    if (filter === "billable") return m.billable;
    if (filter === "free") return !m.billable && m.status === "active";
    if (filter === "invited") return m.status === "invited";
    return true;
  }), [members, filter]);

  const update = (id: string, patch: Omit<Parameters<typeof updateMemberSeatAction>[0], "memberId">) => start(async () => { await updateMemberSeatAction({ ...patch, memberId: id }); router.refresh(); });
  const invite = () => { if (!email.trim()) return; start(async () => { const r = await inviteMemberAction({ email, billingSeatType: inviteSeat }); setMsg(r.error ? (isEs ? "No se pudo invitar (¿email configurado?)" : "Couldn't invite (email configured?)") : r.status === "linked" ? (isEs ? "Usuario vinculado" : "User linked") : (isEs ? "Invitación enviada" : "Invite sent")); setEmail(""); router.refresh(); }); };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400"><Users className="h-4 w-4" />{isEs ? "Miembros y asientos" : "Members & seats"}</div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{isEs ? "Miembros de la organización" : "Organization members"}</h1>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={isEs ? "Asientos facturables" : "Billable seats"} value={billableCount} tone="text-brand-600 dark:text-brand-400" />
        <Stat label={isEs ? "Gratis (observadores/externos)" : "Free (viewers/external)"} value={freeCount} />
        <Stat label={isEs ? "Invitaciones pendientes" : "Pending invites"} value={pendingCount} />
      </div>

      {/* Invite */}
      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{isEs ? "Invitar por correo" : "Invite by email"}</label>
            <input className={`${inp} w-full !py-1.5 text-sm`} placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <select className={`${inp} !py-1.5 text-sm`} value={inviteSeat} onChange={(e) => setInviteSeat(e.target.value)}>{SEAT_TYPES.map((s) => <option key={s.value} value={s.value}>{isEs ? s.es : s.en}</option>)}</select>
          <button onClick={invite} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{isEs ? "Invitar" : "Invite"}</button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5 text-xs">
        {([["all", isEs ? "Todos" : "All"], ["billable", isEs ? "Facturables" : "Billable"], ["free", isEs ? "Gratis" : "Free"], ["invited", isEs ? "Pendientes" : "Pending"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-md px-2.5 py-1 ${filter === k ? "bg-brand-600 text-white" : "border border-border text-muted-foreground hover:bg-muted"}`}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">{isEs ? "Miembro" : "Member"}</th><th className="px-3 py-2 text-left">{isEs ? "Asiento" : "Seat"}</th><th className="px-3 py-2 text-left">{isEs ? "Rol" : "Role"}</th><th className="px-3 py-2 text-left">{isEs ? "Estado" : "Status"}</th><th className="px-3 py-2 text-left">{isEs ? "Proyectos" : "Projects"}</th><th className="px-3 py-2 text-left">{isEs ? "Facturable" : "Billable"}</th></tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-border/50">
                <td className="px-3 py-2"><div className="font-medium text-foreground">{m.name}</div>{m.email && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Mail className="h-3 w-3" />{m.email}</div>}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select className={inp} value={m.seatType ?? "full_seat"} onChange={(e) => update(m.id, { billingSeatType: e.target.value })} disabled={pending}>
                      {SEAT_TYPES.map((s) => <option key={s.value} value={s.value}>{isEs ? s.es : s.en}</option>)}
                    </select>
                  ) : <span className="text-muted-foreground">{m.seatType ?? "—"}</span>}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select className={inp} value={m.workspaceRole ?? ""} onChange={(e) => update(m.id, { workspaceRole: e.target.value })} disabled={pending}>
                      <option value="">—</option>
                      {WORKSPACE_ROLES.map((r) => <option key={r.value} value={r.value}>{isEs ? r.es : r.en}</option>)}
                    </select>
                  ) : <span className="text-muted-foreground">{m.workspaceRole ?? "—"}</span>}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <select className={`${inp} ${STATUS_TONE[m.status] ?? ""}`} value={m.status} onChange={(e) => update(m.id, { status: e.target.value })} disabled={pending}>
                      {MEMBER_STATUSES.map((s) => <option key={s.value} value={s.value}>{isEs ? s.es : s.en}</option>)}
                    </select>
                  ) : <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_TONE[m.status] ?? ""}`}>{m.status}</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{m.activeProjects}</td>
                <td className="px-3 py-2">{m.billable ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">{isEs ? "Sí" : "Yes"}</span> : <span className="text-[11px] text-muted-foreground">{isEs ? "No" : "No"}</span>}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">{isEs ? "Sin miembros para este filtro." : "No members for this filter."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">{isEs ? "Solo los asientos facturables (Propietario/Admin/Completo/Colaborador) cuentan para el límite del plan. Observadores y externos son gratis." : "Only billable seats (Owner/Admin/Full/Contributor) count toward the plan limit. Viewers and external are free."}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
