"use client";

// ============================================================================
// ProjectOps360° — Team & Roles · Role Assignment Board (dnd-kit)
// ============================================================================
// Directory (palette) → drag a person → drop into a Role bucket. Chips move
// between buckets; the × removes with an Undo toast. Optimistic UI over the
// lifted `team` state (Board and List share it), persisted via the dedicated
// server actions (server-side dedup too). Keyboard + touch + screen-reader via
// dnd-kit + fallback menus + an aria-live region. No new tables. Bilingual.
// ============================================================================

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Plus, X, MoreVertical, Users } from "lucide-react";
import {
  buildBuckets, reduceAssign, reduceMove, reduceRemove, personKey,
  type Row, type PersonRef,
} from "@/lib/team-roles/board-model";
import { PROJECT_ROLES } from "@/lib/team-roles/config";
import {
  assignPersonToRoleAction, movePersonRoleAction, removeAssignmentAction,
  restoreAssignmentAction, addProjectMemberAction,
} from "./actions";

interface RoleBoardProps {
  projectId: string;
  locale: string;
  isEs: boolean;
  team: Row[];
  setTeam: (updater: (prev: Row[]) => Row[]) => void;
  directory: { userId: string; name: string; email: string | null }[];
  externals: Row[];
  requiredRoles: string[];
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}
let tmpSeq = 0;
const newTempId = () => `tmp-${Date.now()}-${++tmpSeq}`;

type Toast = { text: string; undo?: () => void } | null;

export function RoleBoard({ projectId, locale, isEs, team, setTeam, directory, externals, requiredRoles }: RoleBoardProps) {
  const router = useRouter();
  const [, startTx] = useTransition();
  const [active, setActive] = useState<{ label: string } | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [live, setLive] = useState("");
  const [newRole, setNewRole] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const people: PersonRef[] = useMemo(() => [
    ...directory.map((d) => ({ kind: "user" as const, id: d.userId, name: d.name })),
    ...externals.map((x) => ({ kind: "ext" as const, id: String(x.id), name: String(x.name) })),
  ], [directory, externals]);
  const buckets = useMemo(() => buildBuckets(team, requiredRoles), [team, requiredRoles]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const say = (msg: string) => setLive(msg);
  const showToast = (t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (t) toastTimer.current = setTimeout(() => setToast(null), 6000);
  };
  const T = (en: string, es: string) => (isEs ? es : en);

  // ── Operations (optimistic → persist → reconcile / revert) ────────────────

  const doAssign = (role: string, person: PersonRef) => {
    const res = reduceAssign(team, role, person, newTempId);
    if (res.duplicate) { showToast({ text: T("Already assigned to this role", "Ya está asignado a este rol") }); return; }
    if (!res.op) return;
    const snapshot = team;
    setTeam(() => res.rows);
    say(T(`${person.name} assigned to ${role}`, `${person.name} asignado a ${role}`));
    startTx(async () => {
      const r = await assignPersonToRoleAction({ projectId, role, person, locale });
      if (r.duplicate) { setTeam(() => snapshot); showToast({ text: T("Already assigned to this role", "Ya está asignado a este rol") }); return; }
      if (r.error) { setTeam(() => snapshot); showToast({ text: T("Could not save assignment", "No se pudo guardar la asignación") }); return; }
      router.refresh();
    });
  };

  const doMove = (rowId: string, toRole: string) => {
    const res = reduceMove(team, rowId, toRole);
    if (res.duplicate) { showToast({ text: T("Already assigned to this role", "Ya está asignado a este rol") }); return; }
    if (!res.op) return;
    const snapshot = team;
    const moved = team.find((r) => String(r.id) === rowId);
    const who = String(moved?.display_name ?? "");
    const from = String(moved?.project_role ?? "");
    setTeam(() => res.rows);
    say(T(`${who} moved from ${from} to ${toRole}`, `${who} movido de ${from} a ${toRole}`));
    startTx(async () => {
      const r = await movePersonRoleAction({ projectId, id: rowId, toRole });
      if (r.duplicate) { setTeam(() => snapshot); showToast({ text: T("Already assigned to this role", "Ya está asignado a este rol") }); return; }
      if (r.error) { setTeam(() => snapshot); showToast({ text: T("Could not save assignment", "No se pudo guardar la asignación") }); return; }
      router.refresh();
    });
  };

  const doRemove = (rowId: string) => {
    const target = team.find((r) => String(r.id) === rowId);
    if (!target) return;
    const person: PersonRef = { kind: target.user_id ? "user" : "ext", id: String(target.user_id ?? target.external_contact_id ?? ""), name: String(target.display_name ?? "") };
    const role = String(target.project_role ?? "");
    const res = reduceRemove(team, rowId);
    if (!res.op) return;
    const snapshot = team;
    setTeam(() => res.rows);
    say(T(`${person.name} removed from ${role}`, `${person.name} removido de ${role}`));
    startTx(async () => {
      const r = await removeAssignmentAction({ projectId, id: rowId });
      if (r.error) { setTeam(() => snapshot); showToast({ text: T("Could not save assignment", "No se pudo guardar la asignación") }); return; }
      const mode = r.mode;
      router.refresh();
      showToast({
        text: T("Assignment removed", "Asignación eliminada"),
        undo: () => {
          setTeam(() => snapshot);
          startTx(async () => {
            if (mode === "removed") await restoreAssignmentAction({ projectId, id: rowId });
            else await assignPersonToRoleAction({ projectId, role, person, locale });
            say(T("Assignment restored", "Asignación restaurada"));
            router.refresh();
          });
          showToast(null);
        },
      });
    });
  };

  const addRole = (role: string) => {
    const r = role.trim();
    if (!r) return;
    startTx(async () => {
      await addProjectMemberAction({ projectId, locale, member: { member_type: "internal_user", project_role: r, permission_level: "contributor" } });
      setNewRole("");
      router.refresh();
    });
  };

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { label?: string } | undefined;
    setActive({ label: d?.label ?? "" });
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const over = e.over?.data.current as { type?: string; role?: string } | undefined;
    const a = e.active.data.current as { type?: string; person?: PersonRef; rowId?: string } | undefined;
    if (!over || over.type !== "bucket" || !over.role) return;
    if (a?.type === "person" && a.person) doAssign(over.role, a.person);
    else if (a?.type === "chip" && a.rowId) doMove(a.rowId, over.role);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div aria-live="polite" className="sr-only">{live}</div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Directory palette */}
        <div className="rounded-xl border border-border bg-card p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Users className="h-4 w-4 text-brand-500" />{T("Directory", "Directorio")}</h3>
          <p className="mb-3 mt-1 text-[11px] text-muted-foreground">{T("Drag a person onto a role →", "Arrastra una persona a un rol →")}</p>
          <div className="max-h-[62vh] space-y-1.5 overflow-y-auto pr-1">
            {people.length === 0 && <p className="text-xs text-muted-foreground">{T("No people in the directory.", "No hay personas en el directorio.")}</p>}
            {people.map((person) => (
              <PersonCard key={personKey(person)} person={person} isEs={isEs} buckets={buckets.map((b) => b.role)} onAssign={(role) => doAssign(role, person)} />
            ))}
          </div>
        </div>

        {/* Add-role toolbar + buckets */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{T("Create role:", "Crear rol:")}</span>
              {requiredRoles.filter((req) => !buckets.some((b) => b.role.toLowerCase() === req.toLowerCase())).map((role) => (
                <button key={role} onClick={() => addRole(role)} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"><Plus className="h-3 w-3" />{role}</button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input list="board-roles" value={newRole} onChange={(e) => setNewRole(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRole(newRole); } }} placeholder={T("Role name (e.g. Project Manager)", "Nombre del rol (ej. Project Manager)")} className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm" />
              <datalist id="board-roles">{PROJECT_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
              <button onClick={() => addRole(newRole)} disabled={!newRole.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><Plus className="h-4 w-4" />{T("Add role", "Agregar rol")}</button>
            </div>
          </div>

          <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {buckets.length === 0 && (
              <p className="col-span-full rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                {T("No roles yet. Create one above, then drag a person.", "Aún no hay roles. Crea uno arriba y luego arrastra una persona.")}
              </p>
            )}
            {buckets.map((b) => (
              <RoleBucketCard
                key={b.role}
                role={b.role}
                count={b.count}
                missing={b.missing}
                isRequired={b.isRequired}
                assignments={b.assignments}
                otherRoles={buckets.map((x) => x.role).filter((r) => r !== b.role)}
                isEs={isEs}
                menuFor={menuFor}
                setMenuFor={setMenuFor}
                onRemove={doRemove}
                onMove={doMove}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {active ? (
          <div className="flex items-center gap-2 rounded-lg border border-brand-400 bg-card px-2 py-1.5 shadow-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">{initialsOf(active.label)}</span>
            <span className="text-xs font-medium text-foreground">{active.label}</span>
          </div>
        ) : null}
      </DragOverlay>

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-lg">
          <span className="text-foreground">{toast.text}</span>
          {toast.undo && <button onClick={toast.undo} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">{T("Undo", "Deshacer")}</button>}
        </div>
      )}
    </DndContext>
  );
}

// ── Directory person card (draggable + "Assign to role" fallback menu) ──────

function PersonCard({ person, isEs, buckets, onAssign }: { person: PersonRef; isEs: boolean; buckets: string[]; onAssign: (role: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `person:${personKey(person)}`, data: { type: "person", person, label: person.name } });
  const [menu, setMenu] = useState(false);
  const T = (en: string, es: string) => (isEs ? es : en);
  return (
    <div className={`group relative flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 ${isDragging ? "opacity-40" : ""} hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-950/20`}>
      <button ref={setNodeRef} {...listeners} {...attributes} aria-label={T(`Drag ${person.name}`, `Arrastrar ${person.name}`)} className="flex flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">{initialsOf(person.name)}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{person.name}</span>
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-100" />
      </button>
      <button onClick={() => setMenu((v) => !v)} aria-label={T("Assign to role", "Asignar a rol")} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreVertical className="h-3.5 w-3.5" /></button>
      {menu && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-48 w-48 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">{T("Assign to role", "Asignar a rol")}</p>
          {buckets.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">—</p>}
          {buckets.map((role) => (
            <button key={role} onClick={() => { onAssign(role); setMenu(false); }} className="block w-full rounded px-2 py-1 text-left text-xs text-foreground hover:bg-muted">{role}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Role bucket (droppable) with chips ──────────────────────────────────────

function RoleBucketCard({ role, count, missing, isRequired, assignments, otherRoles, isEs, menuFor, setMenuFor, onRemove, onMove }: {
  role: string; count: number; missing: boolean; isRequired: boolean;
  assignments: { rowId: string; personKey: string; name: string }[];
  otherRoles: string[]; isEs: boolean; menuFor: string | null; setMenuFor: (v: string | null) => void;
  onRemove: (rowId: string) => void; onMove: (rowId: string, toRole: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `bucket:${role}`, data: { type: "bucket", role } });
  const T = (en: string, es: string) => (isEs ? es : en);
  const missingRequired = missing && isRequired;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-3 transition-all ${isOver ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 dark:bg-brand-950/30" : missingRequired ? "border-dashed border-amber-400 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/10" : missing ? "border-dashed border-border bg-muted/30" : "border-border bg-card"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {role}{missingRequired && <span className="ml-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">· {T("missing", "faltante")}</span>}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground" title={T("Assigned", "Asignados")}>{count}</span>
      </div>

      {assignments.length === 0 ? (
        <div className={`flex items-center justify-center rounded-lg border border-dashed px-2 py-3 text-center text-[11px] ${isOver ? "border-brand-500 font-medium text-brand-600 dark:text-brand-300" : "border-border text-muted-foreground"}`}>
          {isOver ? T("Drop to assign", "Suelta para asignar") : T("Drop here", "Suelta aquí")}
        </div>
      ) : (
        <div className="space-y-1.5">
          {assignments.map((a) => (
            <Chip key={a.rowId} rowId={a.rowId} name={a.name} role={role} otherRoles={otherRoles} isEs={isEs} open={menuFor === a.rowId} setOpen={(v) => setMenuFor(v ? a.rowId : null)} onRemove={() => onRemove(a.rowId)} onMove={(to) => onMove(a.rowId, to)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ rowId, name, role, otherRoles, isEs, open, setOpen, onRemove, onMove }: {
  rowId: string; name: string; role: string; otherRoles: string[]; isEs: boolean;
  open: boolean; setOpen: (v: boolean) => void; onRemove: () => void; onMove: (to: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `chip:${rowId}`, data: { type: "chip", rowId, role, label: name } });
  const T = (en: string, es: string) => (isEs ? es : en);
  return (
    <div className={`relative flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 ${isDragging ? "opacity-40" : ""}`}>
      <button ref={setNodeRef} {...listeners} {...attributes} aria-label={T(`Move ${name}`, `Mover ${name}`)} className="flex flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{initialsOf(name)}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{name}</span>
      </button>
      <button onClick={() => setOpen(!open)} aria-label={T("Options", "Opciones")} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreVertical className="h-3.5 w-3.5" /></button>
      <button onClick={onRemove} aria-label={T("Remove", "Quitar")} title={T("Remove", "Quitar")} className="rounded p-0.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">{T("Move to", "Mover a")}</p>
          {otherRoles.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">—</p>}
          {otherRoles.map((r) => (
            <button key={r} onClick={() => { onMove(r); setOpen(false); }} className="block w-full rounded px-2 py-1 text-left text-xs text-foreground hover:bg-muted">{r}</button>
          ))}
          <button onClick={() => { onRemove(); setOpen(false); }} className="mt-1 block w-full rounded px-2 py-1 text-left text-xs font-medium text-red-600 hover:bg-red-500/10">{T("Remove", "Quitar")}</button>
        </div>
      )}
    </div>
  );
}
