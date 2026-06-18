"use client";

// ============================================================================
// Company Teams / Groups — reusable groups that can be added to projects.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users2, Plus, Loader2, Trash2, UserPlus, X } from "lucide-react";
import { TEAM_TYPES, PROJECT_ROLES, labelOf } from "@/lib/team-roles/config";
import { createTeamAction, deleteTeamAction, addTeamMemberAction, removeTeamMemberAction } from "./actions";

type Row = Record<string, unknown>;
const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

interface Props {
  locale: string; teams: Row[]; membersByTeam: Record<string, Row[]>;
  directory: { userId: string; name: string; email: string | null }[]; externals: Row[];
}

export function TeamsClient(p: Props) {
  const isEs = p.locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState("development");

  const create = () => { if (!name.trim()) return; start(async () => { await createTeamAction({ name, teamType: type }); setName(""); router.refresh(); }); };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400"><Users2 className="h-4 w-4" />{isEs ? "Equipos de empresa" : "Company teams"}</div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{isEs ? "Equipos y grupos" : "Teams & groups"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{isEs ? "Grupos reutilizables (desarrollo, QA, comité directivo…) que puedes agregar completos a un proyecto." : "Reusable groups (development, QA, steering committee…) you can add wholesale to a project."}</p>
      </div>

      {/* Create */}
      <div className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-3">
        <input className={inp} placeholder={isEs ? "Nombre del equipo" : "Team name"} value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inp} value={type} onChange={(e) => setType(e.target.value)}>{TEAM_TYPES.map((t) => <option key={t.value} value={t.value}>{isEs ? t.es : t.en}</option>)}</select>
        <button onClick={create} disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isEs ? "Crear equipo" : "Create team"}</button>
      </div>

      {/* Teams */}
      <div className="space-y-3">
        {p.teams.map((t) => <TeamCard key={String(t.id)} team={t} members={p.membersByTeam[String(t.id)] ?? []} directory={p.directory} externals={p.externals} isEs={isEs} />)}
        {p.teams.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{isEs ? "Sin equipos. Crea el primero arriba." : "No teams yet. Create the first above."}</p>}
      </div>
    </div>
  );
}

function TeamCard({ team, members, directory, externals, isEs }: { team: Row; members: Row[]; directory: { userId: string; name: string }[]; externals: Row[]; isEs: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [extId, setExtId] = useState("");
  const [role, setRole] = useState("");

  const nameOfUser = (id: unknown) => directory.find((d) => d.userId === String(id))?.name;
  const nameOfExt = (id: unknown) => { const e = externals.find((x) => String(x.id) === String(id)); return e ? String(e.name) : undefined; };

  const addUser = () => { if (!userId) return; start(async () => { await addTeamMemberAction({ teamId: String(team.id), userId, defaultProjectRole: role }); setUserId(""); setRole(""); router.refresh(); }); };
  const addExt = () => { if (!extId) return; start(async () => { await addTeamMemberAction({ teamId: String(team.id), externalContactId: extId, defaultProjectRole: role }); setExtId(""); setRole(""); router.refresh(); }); };
  const removeMember = (id: string) => start(async () => { await removeTeamMemberAction({ id }); router.refresh(); });
  const del = () => start(async () => { await deleteTeamAction({ id: String(team.id) }); router.refresh(); });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{String(team.name)} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{labelOf(TEAM_TYPES, String(team.team_type), isEs)}</span></p>
          <p className="text-[11px] text-muted-foreground">{members.length} {isEs ? "miembros" : "members"}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted"><UserPlus className="h-3.5 w-3.5" />{isEs ? "Miembro" : "Member"}</button>
          <button onClick={del} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {members.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {members.map((m) => (
            <span key={String(m.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs text-foreground">
              {m.user_id ? (nameOfUser(m.user_id) ?? "—") : (nameOfExt(m.external_contact_id) ?? "—")}
              {m.default_project_role ? <span className="text-[10px] text-muted-foreground">· {String(m.default_project_role)}</span> : null}
              <button onClick={() => removeMember(String(m.id))} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 grid gap-2 rounded-lg border border-border bg-background/50 p-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inp} value={userId} onChange={(e) => { setUserId(e.target.value); setExtId(""); }}>
            <option value="">{isEs ? "Usuario interno…" : "Internal user…"}</option>
            {directory.map((d) => <option key={d.userId} value={d.userId}>{d.name}</option>)}
          </select>
          <select className={inp} value={extId} onChange={(e) => { setExtId(e.target.value); setUserId(""); }}>
            <option value="">{isEs ? "Contacto externo…" : "External contact…"}</option>
            {externals.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}
          </select>
          <input className={inp} list="team-roles" placeholder={isEs ? "Rol por defecto" : "Default role"} value={role} onChange={(e) => setRole(e.target.value)} />
          <datalist id="team-roles">{PROJECT_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
          <button onClick={userId ? addUser : addExt} disabled={pending || (!userId && !extId)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isEs ? "Agregar" : "Add"}</button>
        </div>
      )}
    </div>
  );
}
