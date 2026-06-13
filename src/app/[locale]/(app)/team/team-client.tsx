"use client";

// ============================================================================
// Team — interactive directory (client)
// ============================================================================
// Workspace users (read-only) + project people/crews/vendors with management:
// add, edit, merge duplicates, archive, and invite a person as a user.
// ============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserRound, HardHat, Building2, Wrench, ShieldCheck, Plus, Pencil, Merge,
  Archive, Mail, X, Loader2,
} from "lucide-react";
import type { Locale } from "@/types/database";
import {
  createTeamResourceAction, updateTeamResourceAction, mergeTeamResourcesAction,
  archiveTeamResourceAction, inviteResourceAsUserAction,
} from "./actions";

export interface TeamMember { role: string; name: string; isYou: boolean }
export interface TeamProject { id: string; name: string }
export interface TeamResource {
  id: string; name: string; resourceType: string; trade: string | null;
  projectName: string | null; status: string; costRate: number | null;
  costUnit: string | null; linkedUserId: string | null;
}

const TYPE_META: Record<string, { icon: typeof UserRound; en: string; es: string }> = {
  person: { icon: UserRound, en: "Person", es: "Persona" },
  crew: { icon: HardHat, en: "Crew", es: "Cuadrilla" },
  team: { icon: Users, en: "Team", es: "Equipo" },
  role: { icon: ShieldCheck, en: "Role", es: "Rol" },
  vendor: { icon: Building2, en: "Vendor", es: "Proveedor" },
  subcontractor: { icon: Wrench, en: "Subcontractor", es: "Subcontratista" },
};
const TYPES = ["person", "crew", "team", "role", "vendor", "subcontractor"];

function normName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

interface Group {
  name: string;
  ids: string[];
  primary: TeamResource;
  types: Set<string>;
  trades: Set<string>;
  projects: Set<string>;
}

export function TeamClient({ locale, members, resources, projects, canManage }: {
  locale: Locale; members: TeamMember[]; resources: TeamResource[]; projects: TeamProject[]; canManage: boolean;
}) {
  const isEs = locale === "es";
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamResource | null>(null);
  const [inviting, setInviting] = useState<TeamResource | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const tt = (en: string, es: string) => (isEs ? es : en);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }
  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }

  // Group resources by normalized name.
  const groups: Group[] = [];
  const byName = new Map<string, Group>();
  for (const r of resources) {
    const k = normName(r.name);
    if (!byName.has(k)) {
      const g: Group = { name: r.name, ids: [], primary: r, types: new Set(), trades: new Set(), projects: new Set() };
      byName.set(k, g);
      groups.push(g);
    }
    const g = byName.get(k)!;
    g.ids.push(r.id);
    g.types.add(r.resourceType);
    if (r.trade) g.trades.add(r.trade);
    if (r.projectName) g.projects.add(r.projectName);
    if (r.linkedUserId) g.primary = r; // prefer the linked one as primary
  }
  groups.sort((a, b) => a.name.localeCompare(b.name));

  const roleLabel = (role: string) =>
    isEs
      ? ({ owner: "Propietario", admin: "Administrador", member: "Miembro", viewer: "Lector" } as Record<string, string>)[role] ?? role
      : role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Users className="h-6 w-6 text-brand-500" />
            {tt("Team", "Equipo")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tt("Workspace users plus the people, crews, and vendors working across your projects.",
              "Usuarios del workspace y las personas, cuadrillas y proveedores que participan en tus proyectos.")}
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />{tt("Add person", "Agregar persona")}
          </button>
        )}
      </div>

      {/* Workspace users */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tt("Workspace users", "Usuarios del workspace")} <span className="font-normal text-muted-foreground/70">({members.length})</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{m.name.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{m.name}{m.isYou && <span className="ml-1 text-xs text-muted-foreground">({tt("you", "tú")})</span>}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(m.role)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* People, crews & vendors */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tt("People, crews & vendors", "Personas, cuadrillas y proveedores")} <span className="font-normal text-muted-foreground/70">({groups.length})</span>
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {tt("Created when assigning tasks or importing projects. Reused across projects.",
            "Creados al asignar tareas o al importar proyectos. Se reutilizan entre proyectos.")}
        </p>

        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {tt("No people or crews yet.", "Aún no hay personas ni cuadrillas.")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{tt("Name", "Nombre")}</th>
                  <th className="px-4 py-2 font-medium">{tt("Type", "Tipo")}</th>
                  <th className="px-4 py-2 font-medium">{tt("Trade", "Oficio")}</th>
                  <th className="px-4 py-2 font-medium">{tt("Projects", "Proyectos")}</th>
                  {canManage && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const meta = TYPE_META[g.primary.resourceType] ?? TYPE_META.person;
                  const Icon = meta.icon;
                  const dup = g.ids.length > 1;
                  const isPerson = g.primary.resourceType === "person";
                  return (
                    <tr key={g.name} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {g.name}
                        {dup && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{g.ids.length}× {tt("duplicates", "duplicados")}</span>}
                        {g.primary.linkedUserId && <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">{tt("user", "usuario")}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"><Icon className="h-3.5 w-3.5 text-brand-500" />{isEs ? meta.es : meta.en}</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{g.trades.size > 0 ? [...g.trades].join(", ") : "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">{[...g.projects].map((p) => <span key={p} className="max-w-[160px] truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" title={p}>{p}</span>)}</div>
                      </td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            {dup ? (
                              <button type="button" disabled={busy !== null} title={tt("Merge duplicates", "Fusionar duplicados")}
                                onClick={() => withBusy(g.name, async () => { const r = await mergeTeamResourcesAction({ resourceIds: g.ids }); if (!r.error) { flash(tt("Merged", "Fusionado")); router.refresh(); } })}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300">
                                {busy === g.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}{tt("Merge", "Fusionar")}
                              </button>
                            ) : (
                              <>
                                <button type="button" title={tt("Edit", "Editar")} onClick={() => setEditing(g.primary)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                                {isPerson && !g.primary.linkedUserId && (
                                  <button type="button" title={tt("Invite as user", "Invitar como usuario")} onClick={() => setInviting(g.primary)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-brand-600"><Mail className="h-4 w-4" /></button>
                                )}
                              </>
                            )}
                            <button type="button" title={tt("Archive", "Archivar")} disabled={busy !== null}
                              onClick={() => { if (confirm(tt("Archive this entry?", "¿Archivar este registro?"))) withBusy(g.name + ":a", async () => { for (const id of g.ids) await archiveTeamResourceAction({ resourceId: id }); flash(tt("Archived", "Archivado")); router.refresh(); }); }}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"><Archive className="h-4 w-4" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adding && <AddDialog tt={tt} projects={projects} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); flash(tt("Added", "Agregado")); router.refresh(); }} />}
      {editing && <EditDialog tt={tt} resource={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); flash(tt("Saved", "Guardado")); router.refresh(); }} />}
      {inviting && <InviteDialog tt={tt} resource={inviting} onClose={() => setInviting(null)} onResult={(msg) => { setInviting(null); flash(msg); router.refresh(); }} />}

      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">{toast} ✓</div>}
    </div>
  );
}

type TT = (en: string, es: string) => string;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium text-foreground">{label}</label>{children}</div>;
}
const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TypeSelect({ tt, value, onChange }: { tt: TT; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {TYPES.map((t) => <option key={t} value={t}>{tt(TYPE_META[t].en, TYPE_META[t].es)}</option>)}
    </select>
  );
}

function AddDialog({ tt, projects, onClose, onSaved }: { tt: TT; projects: TeamProject[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(""); const [type, setType] = useState("person");
  const [trade, setTrade] = useState(""); const [projectId, setProjectId] = useState(""); const [saving, setSaving] = useState(false);
  return (
    <Dialog title={tt("Add person / crew", "Agregar persona / cuadrilla")} onClose={onClose}>
      <div className="space-y-3">
        <Field label={tt("Name", "Nombre")}><input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={inputCls} /></Field>
        <Field label={tt("Type", "Tipo")}><TypeSelect tt={tt} value={type} onChange={setType} /></Field>
        <Field label={tt("Trade (optional)", "Oficio (opcional)")}><input value={trade} onChange={(e) => setTrade(e.target.value)} maxLength={80} className={inputCls} /></Field>
        <Field label={tt("Project (optional)", "Proyecto (opcional)")}>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
            <option value="">{tt("Organization-wide", "Toda la organización")}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">{tt("Cancel", "Cancelar")}</button>
        <button type="button" disabled={!name.trim() || saving}
          onClick={async () => { setSaving(true); const r = await createTeamResourceAction({ name, resourceType: type, trade, projectId: projectId || null }); if (r.error) setSaving(false); else onSaved(); }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{tt("Add", "Agregar")}
        </button>
      </div>
    </Dialog>
  );
}

function EditDialog({ tt, resource, onClose, onSaved }: { tt: TT; resource: TeamResource; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(resource.name); const [type, setType] = useState(resource.resourceType);
  const [trade, setTrade] = useState(resource.trade ?? ""); const [costRate, setCostRate] = useState(resource.costRate != null ? String(resource.costRate) : "");
  const [costUnit, setCostUnit] = useState(resource.costUnit ?? "hour"); const [status, setStatus] = useState(resource.status); const [saving, setSaving] = useState(false);
  return (
    <Dialog title={tt("Edit", "Editar")} onClose={onClose}>
      <div className="space-y-3">
        <Field label={tt("Name", "Nombre")}><input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tt("Type", "Tipo")}><TypeSelect tt={tt} value={type} onChange={setType} /></Field>
          <Field label={tt("Status", "Estado")}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="active">{tt("Active", "Activo")}</option>
              <option value="inactive">{tt("Inactive", "Inactivo")}</option>
              <option value="unavailable">{tt("Unavailable", "No disponible")}</option>
              <option value="retired">{tt("Retired", "Retirado")}</option>
            </select>
          </Field>
        </div>
        <Field label={tt("Trade (optional)", "Oficio (opcional)")}><input value={trade} onChange={(e) => setTrade(e.target.value)} maxLength={80} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tt("Cost rate (optional)", "Tarifa (opcional)")}><input type="number" min="0" step="0.01" value={costRate} onChange={(e) => setCostRate(e.target.value)} className={inputCls} /></Field>
          <Field label={tt("Per", "Por")}>
            <select value={costUnit} onChange={(e) => setCostUnit(e.target.value)} className={inputCls}>
              {["hour", "day", "week", "month", "unit", "fixed"].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">{tt("Cancel", "Cancelar")}</button>
        <button type="button" disabled={!name.trim() || saving}
          onClick={async () => { setSaving(true); const r = await updateTeamResourceAction({ resourceId: resource.id, name, resourceType: type, trade, costRate: costRate ? parseFloat(costRate) : null, costUnit, status }); if (r.error) setSaving(false); else onSaved(); }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{tt("Save", "Guardar")}
        </button>
      </div>
    </Dialog>
  );
}

function InviteDialog({ tt, resource, onClose, onResult }: { tt: TT; resource: TeamResource; onClose: () => void; onResult: (msg: string) => void }) {
  const [email, setEmail] = useState(""); const [role, setRole] = useState("member"); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title={tt("Invite as user", "Invitar como usuario")} onClose={onClose}>
      <p className="mb-3 text-sm text-muted-foreground">
        {tt(`Give "${resource.name}" a login by inviting them with their email.`, `Dale acceso a "${resource.name}" invitándolo con su correo.`)}
      </p>
      <div className="space-y-3">
        <Field label={tt("Email", "Correo")}><input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className={inputCls} placeholder="persona@empresa.com" /></Field>
        <Field label={tt("Role", "Rol")}>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="member">{tt("Member", "Miembro")}</option>
            <option value="admin">{tt("Admin", "Administrador")}</option>
            <option value="viewer">{tt("Viewer", "Lector")}</option>
          </select>
        </Field>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">{tt("Cancel", "Cancelar")}</button>
        <button type="button" disabled={!email.trim() || saving}
          onClick={async () => {
            setSaving(true); setError(null);
            const r = await inviteResourceAsUserAction({ resourceId: resource.id, email, role });
            if (r.error) {
              setSaving(false);
              setError(r.error === "email_not_configured"
                ? tt("Email delivery isn't configured yet. The invite is prepared; configure SMTP to send it.", "El envío de correo aún no está configurado. La invitación quedó preparada; configura SMTP para enviarla.")
                : r.error === "not_allowed" ? tt("Only owners/admins can invite.", "Solo propietarios/administradores pueden invitar.")
                : tt("Could not send the invite.", "No se pudo enviar la invitación."));
            } else {
              onResult(r.status === "linked" ? tt("Linked to existing user", "Vinculado a usuario existente") : tt("Invite sent", "Invitación enviada"));
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{tt("Send invite", "Enviar invitación")}
        </button>
      </div>
    </Dialog>
  );
}
