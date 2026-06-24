"use client";

// ============================================================================
// Project Team & Roles Center — members, permissions, RACI, stakeholder access.
// Project teams are operational; adding people here never creates a paid seat.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserPlus, Loader2, Trash2, Sparkles, ShieldCheck, Eye, Plus, X,
  AlertTriangle, Building2, Mail, UserCog, Pencil, Check,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  MEMBER_TYPES, PERMISSION_LEVELS, PROJECT_ROLES, DELIVERY_ROLES, GOVERNANCE_ROLES,
  RACI_ROLES, ACCESS_LEVELS, PERMISSION_FLAG_LABELS, labelOf, type PermissionFlag,
} from "@/lib/team-roles/config";
import {
  addProjectMemberAction, addCompanyTeamToProjectAction, addStakeholderViewerAction,
  revokeStakeholderAccessAction, updateProjectMemberAction, removeProjectMemberAction, renameProjectMemberAction,
  recommendRolesAction, addRecommendedRolesAction, addRaciAction, deleteRaciAction, generateRaciDraftAction,
} from "./actions";

type Row = Record<string, unknown>;
const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

interface Props {
  locale: string; projectId: string; projectName: string;
  team: Row[]; raci: Row[]; stakeholders: Row[];
  directory: { userId: string; name: string; email: string | null; seatType: string | null; workspaceRole: string | null; status: string }[];
  companyTeams: Row[]; externals: Row[]; milestones: Row[];
  completeness: { score: number; hasPM: boolean; hasApprover: boolean; missingCritical: string[]; totalMembers: number };
}

const TABS = [
  { key: "members", es: "Miembros y roles", en: "Members & roles" },
  { key: "raci", es: "RACI", en: "RACI" },
  { key: "stakeholders", es: "Acceso de stakeholders", en: "Stakeholder access" },
];

export function TeamClient(p: Props) {
  const isEs = p.locale === "es";
  const [tab, setTab] = useState("members");
  const comp = p.completeness;
  const scoreTone = comp.score >= 80 ? "text-green-600 dark:text-green-400" : comp.score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-5">
      {/* Header + completeness */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400"><Users className="h-4 w-4" />{isEs ? "Equipo y roles" : "Team & roles"}</div>
            <h1 className="mt-1 text-xl font-bold text-foreground">{p.projectName}</h1>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{isEs ? "Completitud del equipo" : "Team completeness"}</p>
            <p className={`text-2xl font-bold ${scoreTone}`}>{comp.score}%</p>
            <p className="text-[11px] text-muted-foreground">{comp.totalMembers} {isEs ? "miembros" : "members"}</p>
          </div>
        </div>
        {(comp.missingCritical.length > 0 || !comp.hasApprover) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {comp.missingCritical.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />{isEs ? "Falta rol" : "Missing role"}: {r}</span>
            ))}
            {!comp.hasApprover && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"><AlertTriangle className="h-3 w-3" />{isEs ? "Gobernanza de aprobación incompleta" : "Approval governance incomplete"}</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {isEs ? t.es : t.en}
          </button>
        ))}
      </div>

      {tab === "members" && <MembersTab p={p} isEs={isEs} />}
      {tab === "raci" && <RaciTab p={p} isEs={isEs} />}
      {tab === "stakeholders" && <StakeholdersTab p={p} isEs={isEs} />}
    </div>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────

function MembersTab({ p, isEs }: { p: Props; isEs: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"directory" | "team" | "external" | "invite" | "manual">("directory");
  const [recs, setRecs] = useState<{ project_role: string; delivery_role: string; governance_role: string; permission_level: string; rationale: string }[] | null>(null);

  // form state
  const [dirUser, setDirUser] = useState("");
  const [teamId, setTeamId] = useState("");
  const [extId, setExtId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [delivery, setDelivery] = useState("");
  const [governance, setGovernance] = useState("");
  const [perm, setPerm] = useState("contributor");

  const refresh = () => router.refresh();
  const onProjRole = p.team; // alias

  const addDirectory = () => { const u = p.directory.find((d) => d.userId === dirUser); if (!u) return; start(async () => { await addProjectMemberAction({ projectId: p.projectId, locale: p.locale, member: { member_type: "internal_user", user_id: u.userId, display_name: u.name, project_role: role, delivery_role: delivery, governance_role: governance, permission_level: perm } }); setDirUser(""); setRole(""); refresh(); }); };
  const addTeam = () => { if (!teamId) return; start(async () => { await addCompanyTeamToProjectAction({ projectId: p.projectId, teamId, locale: p.locale }); setTeamId(""); refresh(); }); };
  const addExternal = () => { const e = p.externals.find((x) => String(x.id) === extId); if (!e) return; start(async () => { await addProjectMemberAction({ projectId: p.projectId, locale: p.locale, member: { member_type: e.contact_type === "vendor" ? "vendor" : "external_contact", external_contact_id: extId, display_name: String(e.name), project_role: role, delivery_role: delivery, governance_role: governance, permission_level: perm || "external_contributor" } }); setExtId(""); setRole(""); refresh(); }); };
  const addInvite = () => { if (!email.trim()) return; start(async () => { await addProjectMemberAction({ projectId: p.projectId, locale: p.locale, member: { member_type: "external_contact", display_name: email.trim(), project_role: role, permission_level: perm || "external_viewer", responsibility: isEs ? "Invitado por correo (pendiente)" : "Invited by email (pending)" } }); setEmail(""); refresh(); }); };
  const addManual = () => { if (!role.trim()) return; start(async () => { await addProjectMemberAction({ projectId: p.projectId, locale: p.locale, member: { member_type: "internal_user", display_name: null, project_role: role, delivery_role: delivery, governance_role: governance, permission_level: perm } }); setRole(""); setDelivery(""); setGovernance(""); refresh(); }); };

  const recommend = () => start(async () => { const r = await recommendRolesAction({ projectId: p.projectId, locale: p.locale }); if ("roles" in r) setRecs(r.roles); });
  const addAllRecs = () => { if (!recs) return; start(async () => { await addRecommendedRolesAction({ projectId: p.projectId, locale: p.locale, roles: recs }); setRecs(null); refresh(); }); };

  const updatePerm = (id: string, level: string) => start(async () => { await updateProjectMemberAction({ projectId: p.projectId, id, patch: { permission_level: level, applyPreset: true } }); refresh(); });
  const toggleFlag = (id: string, flag: PermissionFlag, current: boolean) => start(async () => { await updateProjectMemberAction({ projectId: p.projectId, id, patch: { flags: { [flag]: !current } } }); refresh(); });
  const remove = (id: string) => start(async () => { await removeProjectMemberAction({ projectId: p.projectId, id }); refresh(); });
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const beginEdit = (id: string, current: string) => { setEditId(id); setEditName(current); };
  const saveName = (id: string) => { if (!editName.trim()) return; start(async () => { await renameProjectMemberAction({ projectId: p.projectId, id, name: editName.trim() }); setEditId(null); refresh(); }); };

  const QUICK_FLAGS: PermissionFlag[] = ["can_approve_changes", "can_view_budget", "can_access_memory", "can_manage_tasks"];

  return (
    <div className="space-y-4">
      {/* Add bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><UserPlus className="h-4 w-4 text-brand-500" />{isEs ? "¿Quién participa en este proyecto?" : "Who participates in this project?"}</h3>
          <button onClick={recommend} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Recomendar roles con IA" : "AI role recommendation"}
          </button>
        </div>

        {/* AI recommendations preview */}
        {recs && (
          <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900 dark:bg-brand-950/20">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">{isEs ? `${recs.length} roles sugeridos` : `${recs.length} suggested roles`}</p>
              <div className="flex gap-2">
                <button onClick={addAllRecs} disabled={pending} className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{isEs ? "Agregar todos" : "Add all"}</button>
                <button onClick={() => setRecs(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <ul className="space-y-1">
              {recs.map((r, i) => <li key={i} className="text-xs text-foreground">• <span className="font-medium">{r.project_role}</span> <span className="text-muted-foreground">— {r.rationale}</span></li>)}
            </ul>
          </div>
        )}

        {/* Mode selector */}
        <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
          {([["directory", isEs ? "Directorio" : "Directory", UserCog], ["team", isEs ? "Equipo de empresa" : "Company team", Building2], ["external", isEs ? "Contacto externo" : "External contact", Users], ["invite", isEs ? "Invitar por correo" : "Invite by email", Mail], ["manual", isEs ? "Rol manual" : "Manual role", Plus]] as const).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${mode === m ? "bg-brand-600 text-white" : "border border-border text-muted-foreground hover:bg-muted"}`}><Icon className="h-3.5 w-3.5" />{label}</button>
          ))}
        </div>

        {/* Mode forms */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {mode === "directory" && (
            <select className={inp} value={dirUser} onChange={(e) => setDirUser(e.target.value)}>
              <option value="">{isEs ? "Selecciona usuario…" : "Select user…"}</option>
              {p.directory.map((d) => <option key={d.userId} value={d.userId}>{d.name}{d.email ? ` (${d.email})` : ""}</option>)}
            </select>
          )}
          {mode === "team" && (
            <select className={inp} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{isEs ? "Selecciona equipo…" : "Select team…"}</option>
              {p.companyTeams.map((t) => <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>)}
            </select>
          )}
          {mode === "external" && (
            <select className={inp} value={extId} onChange={(e) => setExtId(e.target.value)}>
              <option value="">{isEs ? "Selecciona contacto…" : "Select contact…"}</option>
              {p.externals.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}{x.company_name ? ` — ${String(x.company_name)}` : ""}</option>)}
            </select>
          )}
          {mode === "invite" && <input className={inp} placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />}

          {mode !== "team" && (
            <>
              <input className={inp} list="proj-roles" placeholder={isEs ? "Rol de proyecto" : "Project role"} value={role} onChange={(e) => setRole(e.target.value)} />
              {mode === "manual" && <input className={inp} list="deliv-roles" placeholder={isEs ? "Rol de entrega" : "Delivery role"} value={delivery} onChange={(e) => setDelivery(e.target.value)} />}
              {mode === "manual" && <input className={inp} list="gov-roles" placeholder={isEs ? "Rol de gobernanza" : "Governance role"} value={governance} onChange={(e) => setGovernance(e.target.value)} />}
              <select className={inp} value={perm} onChange={(e) => setPerm(e.target.value)}>{PERMISSION_LEVELS.map((l) => <option key={l.value} value={l.value}>{isEs ? l.es : l.en}</option>)}</select>
            </>
          )}

          <button
            onClick={mode === "directory" ? addDirectory : mode === "team" ? addTeam : mode === "external" ? addExternal : mode === "invite" ? addInvite : addManual}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isEs ? "Agregar" : "Add"}
          </button>
        </div>
        <datalist id="proj-roles">{PROJECT_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
        <datalist id="deliv-roles">{DELIVERY_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
        <datalist id="gov-roles">{GOVERNANCE_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
        <p className="mt-2 text-[11px] text-muted-foreground">{isEs ? "Stakeholders/observadores no consumen asiento facturable. Gestiona contactos y equipos en " : "Stakeholders/viewers don't consume a billable seat. Manage contacts and teams in "}<Link href="/organization/teams" className="text-brand-600 hover:underline dark:text-brand-400">{isEs ? "Equipos" : "Teams"}</Link> / <Link href="/organization/external-contacts" className="text-brand-600 hover:underline dark:text-brand-400">{isEs ? "Contactos" : "Contacts"}</Link>.</p>
      </div>

      {/* Members table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{isEs ? "Miembro" : "Member"}</th>
              <th className="px-3 py-2 text-left">{isEs ? "Tipo" : "Type"}</th>
              <th className="px-3 py-2 text-left">{isEs ? "Rol / Entrega / Gobernanza" : "Role / Delivery / Governance"}</th>
              <th className="px-3 py-2 text-left">{isEs ? "Permiso" : "Permission"}</th>
              <th className="px-3 py-2 text-left">{isEs ? "Accesos" : "Access"}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {onProjRole.map((m) => {
              const id = String(m.id);
              const unassigned = !m.display_name && !m.user_id && !m.external_contact_id;
              return (
                <tr key={id} className="border-t border-border/50 align-top">
                  <td className="px-3 py-2">
                    {editId === id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveName(id); if (e.key === "Escape") setEditId(null); }} className="w-40 rounded border border-border bg-background px-1.5 py-1 text-sm focus:border-brand-500 focus:outline-none" placeholder={isEs ? "Nombre" : "Name"} />
                        <button onClick={() => saveName(id)} disabled={pending} title={isEs ? "Guardar" : "Save"} className="text-green-600 hover:opacity-80"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditId(null)} title={isEs ? "Cancelar" : "Cancel"} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{m.display_name ? String(m.display_name) : <span className="italic text-amber-600 dark:text-amber-400">{isEs ? "Sin asignar" : "Unassigned"}</span>}</span>
                        {!unassigned && <button onClick={() => beginEdit(id, m.display_name ? String(m.display_name) : "")} title={isEs ? "Editar nombre" : "Edit name"} className="shrink-0 text-muted-foreground hover:text-brand-600 dark:hover:text-brand-400"><Pencil className="h-3.5 w-3.5" /></button>}
                      </div>
                    )}
                    {unassigned && <div className="text-[10px] text-muted-foreground">{isEs ? "Rol pendiente de asignar persona" : "Role missing assignment"}</div>}
                    {editId === id && m.user_id ? <div className="mt-0.5 text-[10px] text-muted-foreground">{isEs ? "Actualiza el nombre de la cuenta" : "Updates the account name"}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{labelOf(MEMBER_TYPES, String(m.member_type), isEs)}</td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{String(m.project_role ?? "—")}</div>
                    <div className="text-[11px] text-muted-foreground">{[m.delivery_role, m.governance_role].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select value={String(m.permission_level)} onChange={(e) => updatePerm(id, e.target.value)} disabled={pending} className="rounded border border-border bg-background px-1.5 py-1 text-xs">
                      {PERMISSION_LEVELS.map((l) => <option key={l.value} value={l.value}>{isEs ? l.es : l.en}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {QUICK_FLAGS.map((f) => {
                        const on = m[f] === true;
                        return <button key={f} onClick={() => toggleFlag(id, f, on)} disabled={pending} title={isEs ? PERMISSION_FLAG_LABELS[f].es : PERMISSION_FLAG_LABELS[f].en} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${on ? "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" : "bg-muted text-muted-foreground"}`}>{(isEs ? PERMISSION_FLAG_LABELS[f].es : PERMISSION_FLAG_LABELS[f].en).split(" ")[0]}</button>;
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right"><button onClick={() => remove(id)} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
            {p.team.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">{isEs ? "Sin miembros. Agrega del directorio, un equipo, contactos externos o deja que la IA recomiende roles." : "No members. Add from the directory, a team, external contacts, or let AI recommend roles."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── RACI ────────────────────────────────────────────────────────────────────

function RaciTab({ p, isEs }: { p: Props; isEs: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [entity, setEntity] = useState("");
  const [memberId, setMemberId] = useState("");
  const [raci, setRaci] = useState("responsible");
  const assignable = p.team.filter((m) => String(m.status) !== "removed");

  const memberLabel = (id: unknown) => { const m = p.team.find((x) => String(x.id) === String(id)); return m ? (m.display_name ? String(m.display_name) : String(m.project_role ?? "—")) : "—"; };
  const add = () => { if (!entity.trim() || !memberId) return; start(async () => { await addRaciAction({ projectId: p.projectId, entityType: "milestone", entityLabel: entity, memberId, raciRole: raci }); setEntity(""); router.refresh(); }); };
  const del = (id: string) => start(async () => { await deleteRaciAction({ projectId: p.projectId, id }); router.refresh(); });
  const draft = () => start(async () => { await generateRaciDraftAction({ projectId: p.projectId, locale: p.locale }); router.refresh(); });

  // group by entity_label
  const byEntity = new Map<string, Row[]>();
  for (const r of p.raci) { const k = String(r.entity_label ?? "—"); if (!byEntity.has(k)) byEntity.set(k, []); byEntity.get(k)!.push(r); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{isEs ? "Asigna R/A/C/I sobre hitos y entregables a los miembros del equipo." : "Assign R/A/C/I over milestones and deliverables to team members."}</p>
        <button onClick={draft} disabled={pending || assignable.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Borrador RACI con IA" : "AI RACI draft"}
        </button>
      </div>

      {/* Add form */}
      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={`${inp} lg:col-span-2`} list="ms-list" placeholder={isEs ? "Entregable / hito" : "Deliverable / milestone"} value={entity} onChange={(e) => setEntity(e.target.value)} />
        <datalist id="ms-list">{p.milestones.map((m) => <option key={String(m.id)} value={String(m.title)} />)}</datalist>
        <select className={inp} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">{isEs ? "Miembro…" : "Member…"}</option>
          {assignable.map((m) => <option key={String(m.id)} value={String(m.id)}>{m.display_name ? String(m.display_name) : String(m.project_role ?? "—")}</option>)}
        </select>
        <div className="flex gap-2">
          <select className={inp} value={raci} onChange={(e) => setRaci(e.target.value)}>{RACI_ROLES.map((r) => <option key={r.value} value={r.value}>{r.letter} — {isEs ? r.es : r.en}</option>)}</select>
          <button onClick={add} disabled={pending} className="inline-flex items-center rounded-lg bg-brand-600 px-3 text-white hover:bg-brand-700 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Matrix */}
      <div className="space-y-2">
        {[...byEntity.entries()].map(([label, rows]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3">
            <p className="mb-1.5 text-sm font-semibold text-foreground">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((r) => {
                const meta = RACI_ROLES.find((x) => x.value === String(r.raci_role));
                return (
                  <span key={String(r.id)} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${meta?.tone}`}>
                    <span className="font-bold">{meta?.letter}</span>{memberLabel(r.project_team_member_id)}
                    <button onClick={() => del(String(r.id))} className="ml-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {p.raci.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{isEs ? "Sin asignaciones RACI. Agrega manualmente o genera un borrador con IA." : "No RACI assignments. Add manually or generate an AI draft."}</p>}
      </div>
    </div>
  );
}

// ── Stakeholders ────────────────────────────────────────────────────────────

function StakeholdersTab({ p, isEs }: { p: Props; isEs: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("viewer");
  const [canApprove, setCanApprove] = useState(false);
  const [canComment, setCanComment] = useState(false);

  const add = () => { if (!name.trim()) return; start(async () => { await addStakeholderViewerAction({ projectId: p.projectId, name, accessLevel: level, canApprove, canComment, locale: p.locale }); setName(""); setCanApprove(false); setCanComment(false); router.refresh(); }); };
  const revoke = (id: string) => start(async () => { await revokeStakeholderAccessAction({ projectId: p.projectId, id }); router.refresh(); });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{isEs ? "Acceso ligero/gratuito para observadores, ejecutivos y aprobadores externos. No consume asiento facturable." : "Light/free access for viewers, executives and external approvers. Doesn't consume a billable seat."}</p>

      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={inp} placeholder={isEs ? "Nombre del stakeholder" : "Stakeholder name"} value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inp} value={level} onChange={(e) => setLevel(e.target.value)}>{ACCESS_LEVELS.map((l) => <option key={l.value} value={l.value}>{isEs ? l.es : l.en}</option>)}</select>
        <div className="flex items-center gap-3 text-xs text-foreground">
          <label className="flex items-center gap-1"><input type="checkbox" checked={canComment} onChange={(e) => setCanComment(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />{isEs ? "Comentar" : "Comment"}</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={canApprove} onChange={(e) => setCanApprove(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />{isEs ? "Aprobar" : "Approve"}</label>
        </div>
        <button onClick={add} disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{isEs ? "Dar acceso" : "Grant access"}</button>
      </div>

      <div className="space-y-1.5">
        {p.stakeholders.map((s) => {
          const meta = ACCESS_LEVELS.find((l) => l.value === String(s.access_level));
          return (
            <div key={String(s.id)} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-500" /><span className="font-medium text-foreground">{String(s.display_name ?? "—")}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{isEs ? meta?.es : meta?.en}</span>{s.can_approve === true && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700 dark:bg-green-950/40 dark:text-green-300">{isEs ? "aprueba" : "approves"}</span>}</span>
              <button onClick={() => revoke(String(s.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
        {p.stakeholders.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{isEs ? "Sin accesos de stakeholders todavía." : "No stakeholder access yet."}</p>}
      </div>
    </div>
  );
}
