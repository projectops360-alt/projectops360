"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Plus, Trash2, Loader2, ChevronDown } from "lucide-react";
import {
  getCapacityEditorDataAction, saveAllocationAction, removeAllocationAction,
  type AllocationRow, type TeamOption,
} from "./actions";

const inp = "w-16 rounded border border-border bg-background px-1.5 py-1 text-right text-sm text-foreground focus:border-brand-500 focus:outline-none";

export function CapacityEditor({ projectId, locale }: { projectId: string; locale: string }) {
  const es = locale === "es";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [addPick, setAddPick] = useState("");
  const [busy, startTransition] = useTransition();

  async function load() {
    const res = await getCapacityEditorDataAction({ projectId });
    if (!res.error) {
      setCanManage(!!res.canManage);
      setRows(res.allocations ?? []);
      setTeamOptions(res.teamOptions ?? []);
    }
    setLoaded(true);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  function patchLocal(id: string, patch: Partial<AllocationRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function saveRow(r: AllocationRow) {
    startTransition(async () => {
      await saveAllocationAction({
        projectId, id: r.id,
        weeklyCapacityHours: r.weeklyCapacityHours, availabilityPercent: r.availabilityPercent,
        overheadPercent: r.overheadPercent, projectRole: r.projectRole, displayName: r.displayName,
      });
      router.refresh(); // recompute the cards/table/graph above
    });
  }

  function addResource() {
    const opt = teamOptions.find((o) => o.teamMemberId === addPick);
    if (!opt) return;
    startTransition(async () => {
      await saveAllocationAction({
        projectId, projectTeamMemberId: opt.teamMemberId, userId: opt.userId,
        displayName: opt.name, projectRole: opt.role,
        weeklyCapacityHours: 40, availabilityPercent: 100, overheadPercent: 0,
      });
      setAddPick("");
      await load();
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeAllocationAction({ projectId, id });
      await load();
      router.refresh();
    });
  }

  const num = (v: number | null) => (v == null ? "" : String(v));
  const parse = (s: string): number | null => { const n = Number(s); return s.trim() === "" || Number.isNaN(n) ? null : n; };

  if (!loaded) return null;

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left"
      >
        <SlidersHorizontal className="h-4 w-4 text-brand-500" />
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {es ? "Gestionar capacidad por recurso" : "Manage resource capacity"}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {rows.length} {es ? "definidos" : "set"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          {!canManage && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {es ? "Solo lectura: no tienes permiso para editar la capacidad de este proyecto." : "Read-only: you don't have permission to edit this project's capacity."}
            </p>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {es ? "Aún no hay capacidad definida. Agrega recursos del equipo abajo." : "No capacity defined yet. Add team resources below."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                    <th className="py-2 pr-3">{es ? "Recurso" : "Resource"}</th>
                    <th className="px-2">{es ? "Rol" : "Role"}</th>
                    <th className="px-2 text-right">{es ? "Horas/sem" : "Hrs/wk"}</th>
                    <th className="px-2 text-right">{es ? "Disp. %" : "Avail. %"}</th>
                    <th className="px-2 text-right">{es ? "Overhead %" : "Overhead %"}</th>
                    <th className="px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-1.5 pr-3 font-medium text-foreground">{r.displayName}</td>
                      <td className="px-2">
                        <input
                          type="text" disabled={!canManage || busy} defaultValue={r.projectRole ?? ""}
                          onBlur={(e) => { patchLocal(r.id, { projectRole: e.target.value }); saveRow({ ...r, projectRole: e.target.value }); }}
                          className="w-28 rounded border border-border bg-background px-1.5 py-1 text-sm text-foreground focus:border-brand-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 text-right">
                        <input type="number" min={0} max={168} step={1} disabled={!canManage || busy} defaultValue={num(r.weeklyCapacityHours)}
                          onBlur={(e) => { const v = parse(e.target.value); patchLocal(r.id, { weeklyCapacityHours: v }); saveRow({ ...r, weeklyCapacityHours: v }); }}
                          className={inp} />
                      </td>
                      <td className="px-2 text-right">
                        <input type="number" min={0} max={100} step={1} disabled={!canManage || busy} defaultValue={num(r.availabilityPercent)}
                          onBlur={(e) => { const v = parse(e.target.value); patchLocal(r.id, { availabilityPercent: v }); saveRow({ ...r, availabilityPercent: v }); }}
                          className={inp} />
                      </td>
                      <td className="px-2 text-right">
                        <input type="number" min={0} max={100} step={1} disabled={!canManage || busy} defaultValue={num(r.overheadPercent)}
                          onBlur={(e) => { const v = parse(e.target.value); patchLocal(r.id, { overheadPercent: v }); saveRow({ ...r, overheadPercent: v }); }}
                          className={inp} />
                      </td>
                      <td className="px-2 text-right">
                        {canManage && (
                          <button type="button" onClick={() => remove(r.id)} disabled={busy}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-500 disabled:opacity-50" title={es ? "Quitar" : "Remove"}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add from team */}
          {canManage && teamOptions.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <select value={addPick} onChange={(e) => setAddPick(e.target.value)} disabled={busy}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none">
                <option value="">{es ? "Agregar del equipo…" : "Add from team…"}</option>
                {teamOptions.map((o) => <option key={o.teamMemberId} value={o.teamMemberId}>{o.name}{o.role ? ` — ${o.role}` : ""}</option>)}
              </select>
              <button type="button" onClick={addResource} disabled={busy || !addPick}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {es ? "Agregar" : "Add"}
              </button>
              <span className="text-[11px] text-muted-foreground">{es ? "Por defecto 40h · 100% · 0% (editable)" : "Defaults 40h · 100% · 0% (editable)"}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
