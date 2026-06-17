"use client";

// ============================================================================
// Delivery Framework tabs: Project Backlog · Execution Cycles · Board · AI.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Loader2, Sparkles, Play, CheckCircle2, AlertTriangle, XCircle, Lightbulb,
  MessageSquareText, Activity, Send,
} from "lucide-react";
import { BACKLOG_ITEM_TYPES } from "@/lib/delivery/config";
import {
  saveBacklogItemAction, deleteBacklogItemAction, promoteBacklogItemsAction,
  saveCycleAction, setCycleStatusAction, deleteCycleAction,
  resolveScopeAlertAction, generateBacklogAction, scopeCheckAction,
  deliveryStakeholderSummaryAction, cycleLessonsAction, frameworkHealthAction,
} from "./actions";

const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const PRIORITIES = ["High", "Medium", "Low"];
const PR_CLS: Record<string, string> = { High: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300", Medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", Low: "bg-muted text-muted-foreground" };

// ── Backlog ─────────────────────────────────────────────────────────────────

export function BacklogTab({ projectId, locale, items, milestones, risks }: { projectId: string; locale: string; items: Record<string, unknown>[]; milestones: Record<string, unknown>[]; risks: Record<string, unknown>[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const empty = { title: "", description: "", item_type: "Task", priority: "Medium", linked_charter_objective: "", linked_milestone_id: "", linked_risk_id: "" };
  const [f, setF] = useState(empty);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const pending_ids = items.filter((it) => String(it.status) !== "promoted").map((it) => String(it.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = pending_ids.length > 0 && pending_ids.every((id) => sel.has(id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(pending_ids));

  const add = () => { if (!f.title.trim()) return; start(async () => { await saveBacklogItemAction({ projectId, item: { ...f, linked_milestone_id: f.linked_milestone_id || null, linked_risk_id: f.linked_risk_id || null } }); setF(empty); router.refresh(); }); };
  const del = (id: string) => start(async () => { await deleteBacklogItemAction({ projectId, id }); router.refresh(); });
  const promoteSelected = () => start(async () => { await promoteBacklogItemsAction({ projectId, ids: [...sel] }); setSel(new Set()); router.refresh(); });
  const promoteAll = () => start(async () => { await promoteBacklogItemsAction({ projectId }); setSel(new Set()); router.refresh(); });
  const gen = () => start(async () => { await generateBacklogAction({ projectId, locale }); router.refresh(); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{isEs ? "Backlog de planeación: define el trabajo (alineado al charter) y promuévelo a tarea para ejecutarlo en el Workboard." : "Planning backlog: define the work (aligned to the charter) and promote it to a task to execute it on the Workboard."}</p>
        <button onClick={gen} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Generar con IA" : "Generate with AI"}
        </button>
      </div>

      {/* Bulk action bar */}
      {pending_ids.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 dark:border-brand-900 dark:bg-brand-950/20">
          <span className="text-xs text-brand-700 dark:text-brand-300">
            {sel.size > 0 ? (isEs ? `${sel.size} seleccionada(s)` : `${sel.size} selected`) : (isEs ? "Selecciona items para enviarlos al Workboard" : "Select items to send to the Workboard")}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={promoteSelected} disabled={pending || sel.size === 0} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{isEs ? `Enviar seleccionadas` : `Send selected`}
            </button>
            <button onClick={promoteAll} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              {isEs ? "Enviar todas" : "Send all"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={isEs ? "Seleccionar todas" : "Select all"} className="h-3.5 w-3.5 accent-brand-600" /></th>
              <th className="px-3 py-2 text-left">{isEs ? "Item" : "Item"}</th><th className="px-3 py-2 text-left">{isEs ? "Tipo" : "Type"}</th><th className="px-3 py-2 text-left">{isEs ? "Prioridad" : "Priority"}</th><th className="px-3 py-2 text-left">{isEs ? "Estado" : "Status"}</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const promoted = String(it.status) === "promoted";
              return (
              <tr key={String(it.id)} className={`border-t border-border/50 align-top ${promoted ? "opacity-60" : ""}`}>
                <td className="px-3 py-2">{!promoted && <input type="checkbox" checked={sel.has(String(it.id))} onChange={() => toggle(String(it.id))} className="h-3.5 w-3.5 accent-brand-600" />}</td>
                <td className="px-3 py-2"><div className="font-medium text-foreground">{String(it.title)}</div>{it.linked_charter_objective ? <div className="text-[11px] text-muted-foreground">↳ {String(it.linked_charter_objective)}</div> : null}</td>
                <td className="px-3 py-2 text-muted-foreground">{String(it.item_type ?? "—")}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PR_CLS[String(it.priority)] ?? "bg-muted text-muted-foreground"}`}>{String(it.priority ?? "—")}</span></td>
                <td className="px-3 py-2 text-muted-foreground">{promoted ? <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />{isEs ? "En Workboard" : "On Workboard"}</span> : String(it.status ?? "—")}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => del(String(it.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">{isEs ? "Backlog vacío. Agrega items o genéralos con IA." : "Empty backlog. Add items or generate with AI."}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={`${inp} sm:col-span-2`} placeholder={isEs ? "Título del item" : "Item title"} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select className={inp} value={f.item_type} onChange={(e) => setF({ ...f, item_type: e.target.value })}>{BACKLOG_ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select className={inp} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map((t) => <option key={t}>{t}</option>)}</select>
        <input className={`${inp} sm:col-span-2`} placeholder={isEs ? "Objetivo del charter (alineación)" : "Charter objective (alignment)"} value={f.linked_charter_objective} onChange={(e) => setF({ ...f, linked_charter_objective: e.target.value })} />
        <select className={inp} value={f.linked_milestone_id} onChange={(e) => setF({ ...f, linked_milestone_id: e.target.value })}><option value="">{isEs ? "Hito…" : "Milestone…"}</option>{milestones.map((m) => <option key={String(m.id)} value={String(m.id)}>{String(m.title)}</option>)}</select>
        <select className={inp} value={f.linked_risk_id} onChange={(e) => setF({ ...f, linked_risk_id: e.target.value })}><option value="">{isEs ? "Riesgo…" : "Risk…"}</option>{risks.map((r) => <option key={String(r.id)} value={String(r.id)}>{String(r.title)}</option>)}</select>
        <button onClick={add} disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isEs ? "Agregar" : "Add"}</button>
      </div>
    </div>
  );
}

// ── Cycles ──────────────────────────────────────────────────────────────────

export function CyclesTab({ projectId, locale, cycles }: { projectId: string; locale: string; cycles: Record<string, unknown>[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const empty = { name: "", cycle_type: "iteration", goal: "", start_date: "", end_date: "" };
  const [f, setF] = useState(empty);

  const add = () => { if (!f.name.trim()) return; start(async () => { await saveCycleAction({ projectId, cycle: f }); setF(empty); router.refresh(); }); };
  const setStatus = (id: string, status: string) => start(async () => { await setCycleStatusAction({ projectId, id, status }); router.refresh(); });
  const del = (id: string) => start(async () => { await deleteCycleAction({ projectId, id }); router.refresh(); });
  const lessons = (id: string) => start(async () => { await cycleLessonsAction({ projectId, cycleId: id, locale }); router.refresh(); });

  const ST_CLS: Record<string, string> = { planned: "bg-muted text-muted-foreground", active: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", review: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", completed: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300", canceled: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{isEs ? "Ciclos de ejecución: las iteraciones/fases en que se entrega el trabajo." : "Execution cycles: the iterations/phases in which work is delivered."}</p>
      <div className="space-y-2">
        {cycles.map((c) => {
          const status = String(c.status);
          return (
            <div key={String(c.id)} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="font-semibold text-foreground">{String(c.name)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ST_CLS[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span></div>
                  {c.goal ? <p className="mt-0.5 text-xs text-muted-foreground">{String(c.goal)}</p> : null}
                  {c.lessons_learned_notes ? <p className="mt-1 whitespace-pre-line rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">{String(c.lessons_learned_notes)}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {status === "planned" && <button onClick={() => setStatus(String(c.id), "active")} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"><Play className="h-3 w-3" />{isEs ? "Iniciar" : "Start"}</button>}
                  {status === "active" && <button onClick={() => setStatus(String(c.id), "completed")} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"><CheckCircle2 className="h-3 w-3" />{isEs ? "Completar" : "Complete"}</button>}
                  <button onClick={() => lessons(String(c.id))} disabled={pending} title={isEs ? "Lecciones aprendidas con IA" : "AI lessons learned"} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"><Lightbulb className="h-3 w-3" /></button>
                  <button onClick={() => del(String(c.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
        {cycles.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{isEs ? "Sin ciclos. Crea el primero abajo." : "No cycles yet. Create the first below."}</p>}
      </div>

      <div className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className={inp} placeholder={isEs ? "Nombre del ciclo" : "Cycle name"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={`${inp} lg:col-span-2`} placeholder={isEs ? "Meta del ciclo" : "Cycle goal"} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
        <input type="date" className={inp} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
        <button onClick={add} disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isEs ? "Crear ciclo" : "Create cycle"}</button>
      </div>
    </div>
  );
}

// ── AI & Health ─────────────────────────────────────────────────────────────

export function AiHealthTab({ projectId, locale, alerts }: { projectId: string; locale: string; alerts: Record<string, unknown>[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [health, setHealth] = useState<string | null>(null);

  const scope = () => start(async () => { await scopeCheckAction({ projectId, locale }); router.refresh(); });
  const sum = () => start(async () => { const r = await deliveryStakeholderSummaryAction({ projectId, locale }); setSummary(r.summary || ""); });
  const hp = () => start(async () => { const r = await frameworkHealthAction({ projectId, locale }); setHealth(r.recommendation || ""); });
  const resolve = (id: string, status: "resolved" | "dismissed") => start(async () => { await resolveScopeAlertAction({ projectId, id, status }); router.refresh(); });

  const SEV: Record<string, string> = { high: "text-red-500", medium: "text-amber-500", low: "text-muted-foreground" };

  return (
    <div className="space-y-5">
      {/* Scope creep */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-amber-500" />{isEs ? "Detección de scope creep (IA)" : "Scope creep detection (AI)"}</h3>
          <button onClick={scope} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Revisar backlog" : "Check backlog"}</button>
        </div>
        {alerts.length === 0 ? <p className="text-xs text-green-600 dark:text-green-400">{isEs ? "Sin alertas abiertas. El backlog se alinea con el charter." : "No open alerts. The backlog aligns with the charter."}</p> : (
          <ul className="space-y-1.5">
            {alerts.map((a) => (
              <li key={String(a.id)} className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/20">
                <span className="flex items-start gap-2"><AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${SEV[String(a.severity)] ?? "text-amber-500"}`} /><span><span className="text-foreground">{String(a.detection_reason)}</span>{a.recommendation ? <span className="block text-[11px] text-muted-foreground">→ {String(a.recommendation)}</span> : null}</span></span>
                <span className="flex shrink-0 gap-1">
                  <button onClick={() => resolve(String(a.id), "resolved")} disabled={pending} title={isEs ? "Resolver" : "Resolve"} className="text-green-600 hover:opacity-80"><CheckCircle2 className="h-4 w-4" /></button>
                  <button onClick={() => resolve(String(a.id), "dismissed")} disabled={pending} title={isEs ? "Descartar" : "Dismiss"} className="text-muted-foreground hover:text-red-500"><XCircle className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stakeholder summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><MessageSquareText className="h-4 w-4 text-brand-500" />{isEs ? "Resumen para stakeholders (IA)" : "Stakeholder summary (AI)"}</h3>
          <button onClick={sum} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Generar" : "Generate"}</button>
        </div>
        {summary ? <p className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">{summary}</p> : <p className="text-xs text-muted-foreground">{isEs ? "Explica el estado del proyecto en lenguaje de negocio." : "Explains project status in business language."}</p>}
      </div>

      {/* Framework health */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Activity className="h-4 w-4 text-brand-500" />{isEs ? "Salud del marco (IA)" : "Framework health (AI)"}</h3>
          <button onClick={hp} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Evaluar" : "Assess"}</button>
        </div>
        {health ? <p className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">{health}</p> : <p className="text-xs text-muted-foreground">{isEs ? "Recomienda ajustes al modelo de entrega si el proyecto no va bien." : "Recommends adjustments to the delivery model if the project is off track."}</p>}
      </div>
    </div>
  );
}
