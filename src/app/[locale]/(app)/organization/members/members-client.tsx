"use client";

// ============================================================================
// Members & Seats — internal org members and their billing seat types.
// ============================================================================

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Loader2, Mail, KeyRound, Wand2, Copy, Check, Pencil, X } from "lucide-react";
import { SEAT_TYPES, WORKSPACE_ROLES, MEMBER_STATUSES } from "@/lib/billing/config";
import { updateMemberSeatAction, inviteMemberAction, createMemberWithPasswordAction, renameWorkspaceUserAction } from "./actions";

/** Generate a readable temporary password (no ambiguous chars). */
function genTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 12; i++) s += chars[buf[i] % chars.length];
  return s;
}

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

  // Create-login-with-temp-password (no SMTP) state.
  const [clEmail, setClEmail] = useState("");
  const [clName, setClName] = useState("");
  const [clPwd, setClPwd] = useState("");
  const [clSeat, setClSeat] = useState("full_seat");
  const [clErr, setClErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const CL_ERR: Record<string, { en: string; es: string }> = {
    not_allowed: { en: "Not allowed.", es: "No autorizado." },
    invalid_email: { en: "Invalid email.", es: "Correo inválido." },
    weak_password: { en: "Password must be at least 12 characters.", es: "La contraseña debe tener al menos 12 caracteres." },
    account_exists_invite_required: { en: "That account already exists and must accept a verified invitation.", es: "Esa cuenta ya existe y debe aceptar una invitación verificada." },
    create_failed: { en: "Could not create the login.", es: "No se pudo crear el acceso." },
  };

  const createLogin = () => {
    setClErr(null); setCreated(null);
    const e = clEmail.trim();
    if (!e) return setClErr("invalid_email");
    if (clPwd.length < 12) return setClErr("weak_password");
    start(async () => {
      const r = await createMemberWithPasswordAction({ email: e, password: clPwd, displayName: clName, billingSeatType: clSeat });
      if (r.error) return setClErr(r.error);
      setCreated({ email: e, password: clPwd });
      setClEmail(""); setClName(""); setClPwd("");
      router.refresh();
    });
  };

  const billableCount = members.filter((m) => m.billable).length;
  const freeCount = members.filter((m) => !m.billable && m.status === "active").length;
  const pendingCount = members.filter((m) => m.status === "invited").length;

  const filtered = useMemo(() => members.filter((m) => {
    if (filter === "billable") return m.billable;
    if (filter === "free") return !m.billable && m.status === "active";
    if (filter === "invited") return m.status === "invited";
    return true;
  }), [members, filter]);

  // Rename a collaborator (display name).
  const [editUser, setEditUser] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const saveName = (userId: string) => start(async () => {
    const name = editName.trim();
    if (name) await renameWorkspaceUserAction({ userId, name });
    setEditUser(null);
    router.refresh();
  });

  const update = (id: string, patch: Omit<Parameters<typeof updateMemberSeatAction>[0], "memberId">) => start(async () => { await updateMemberSeatAction({ ...patch, memberId: id }); router.refresh(); });
  const invite = () => { if (!email.trim()) return; start(async () => { const r = await inviteMemberAction({ email, billingSeatType: inviteSeat }); setMsg(r.error === "account_exists_invite_required" ? (isEs ? "La cuenta ya existe y debe aceptar una invitación verificada." : "The account already exists and must accept a verified invitation.") : r.error ? (isEs ? "No se pudo enviar la invitación." : "Couldn't send the invite.") : (isEs ? "Invitación enviada" : "Invite sent")); setEmail(""); router.refresh(); }); };

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

      {/* Create login with a temporary password (no SMTP needed) */}
      {canManage && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
            <KeyRound className="h-4 w-4" />{isEs ? "Crear acceso con clave temporal" : "Create login with a temporary password"}
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            {isEs
              ? "Crea un miembro que puede entrar de inmediato. Deberá cambiar la clave en su primer ingreso. Útil cuando el correo (SMTP) aún no está configurado."
              : "Creates a member who can sign in immediately. They must change the password on first login. Useful while email (SMTP) isn't configured yet."}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{isEs ? "Nombre" : "Name"}</label>
              <input className={`${inp} w-full !py-1.5 text-sm`} placeholder={isEs ? "Nombre del miembro" : "Member name"} value={clName} onChange={(e) => setClName(e.target.value)} />
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{isEs ? "Correo" : "Email"}</label>
              <input className={`${inp} w-full !py-1.5 text-sm`} placeholder="email@empresa.com" value={clEmail} onChange={(e) => setClEmail(e.target.value)} />
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{isEs ? "Clave temporal" : "Temporary password"}</label>
              <div className="flex items-center gap-1">
                <input className={`${inp} w-full !py-1.5 text-sm`} placeholder={isEs ? "Mín. 12 caracteres" : "Min. 12 characters"} value={clPwd} onChange={(e) => setClPwd(e.target.value)} />
                <button type="button" title={isEs ? "Generar" : "Generate"} onClick={() => setClPwd(genTempPassword())} className="inline-flex items-center rounded-lg border border-border px-2 py-1.5 text-muted-foreground hover:bg-muted"><Wand2 className="h-4 w-4" /></button>
              </div>
            </div>
            <select className={`${inp} !py-1.5 text-sm`} value={clSeat} onChange={(e) => setClSeat(e.target.value)}>{SEAT_TYPES.map((s) => <option key={s.value} value={s.value}>{isEs ? s.es : s.en}</option>)}</select>
            <button onClick={createLogin} disabled={pending || clPwd.length < 12} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{isEs ? "Crear acceso" : "Create login"}</button>
          </div>
          {clErr && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{CL_ERR[clErr]?.[isEs ? "es" : "en"] ?? clErr}</p>}
          {created && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-foreground">{isEs ? "Acceso creado. Comparte estas credenciales:" : "Login created. Share these credentials:"}</span>
              <code className="rounded bg-background px-1.5 py-0.5 text-foreground">{created.email}</code>
              <code className="rounded bg-background px-1.5 py-0.5 text-foreground">{created.password}</code>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(`${created.email} / ${created.password}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{isEs ? "Copiar" : "Copy"}
              </button>
            </div>
          )}
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
                <td className="px-3 py-2">
                  {editUser === m.userId ? (
                    <div className="flex items-center gap-1">
                      <input autoFocus className={inp} value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveName(m.userId); if (e.key === "Escape") setEditUser(null); }} />
                      <button onClick={() => saveName(m.userId)} disabled={pending} className="rounded p-1 text-green-600 hover:bg-muted"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditUser(null)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{m.name}</span>
                      {canManage && (
                        <button title={isEs ? "Renombrar" : "Rename"} onClick={() => { setEditUser(m.userId); setEditName(m.name); }} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                      )}
                    </div>
                  )}
                  {m.email && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Mail className="h-3 w-3" />{m.email}</div>}
                </td>
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
