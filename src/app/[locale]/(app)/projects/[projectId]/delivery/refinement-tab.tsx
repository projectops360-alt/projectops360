"use client";

// ============================================================================
// Work Refinement Center — adaptive 3-panel refinement experience.
// Left: work item list + filters + readiness. Center: detail editor (criteria,
// Definition of Ready, estimation, owner, risk, dependencies, destination).
// Right: AI Refinement Assistant (facts / assumptions / recommendations).
// Operates on project_backlog_items (the Work Item); template adapts to the
// project's delivery method + type.
// ============================================================================

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Loader2, CheckCircle2, AlertTriangle, GitBranch, Trash2, Send, Gauge,
  Lightbulb, ClipboardCheck, HelpCircle, ShieldAlert, Scissors, Plus, Wand2,
  Link2, LayoutGrid, Users2, BarChart3, X,
} from "lucide-react";
import {
  WORK_ITEM_TYPES, REFINEMENT_STATUS_META, REFINABLE_STATUSES, ESTIMATION_METHODS,
  PRIORITIES, RISK_LEVELS, PLANNING_DESTINATIONS, templateFor, labelOf, bandForScore,
  READINESS_BANDS,
} from "@/lib/refinement/templates";
import { computeReadiness, type WorkItemLike } from "@/lib/refinement/readiness";
import { detectRefinementRisks, topSeverity, type RefinementRisk } from "@/lib/refinement/risk";
import type { DeliveryMethod } from "@/lib/delivery/config";
import {
  saveRefinementAction, setRefinementStatusAction, aiRefineItemAction,
  saveWorkItemDependencyAction, deleteWorkItemDependencyAction, moveToPlanningAction,
  splitWorkItemAction, linkWorkItemAction, unlinkWorkItemAction, setGovernanceAction,
  saveBacklogItemAction, generateBacklogAction, aiSuggestFieldAction, deleteBacklogItemAction,
  type RefinementInput,
} from "./actions";
import { SessionsPanel } from "./refinement-session";
import { Link } from "@/i18n/navigation";

const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const TONE: Record<string, string> = {
  gray: "bg-muted text-muted-foreground",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};
const RESOLVED = new Set(["ready_for_planning", "planned", "in_execution", "done"]);
const numOrNull = (v: string): number | null => { const n = Number(v); return v.trim() === "" || Number.isNaN(n) ? null : n; };

interface DorItemState { key: string; label: string; checked: boolean }

interface FormState {
  description: string; acceptance_criteria: string; completion_criteria: string;
  item_type: string; priority: string; risk_level: string; owner_id: string;
  business_value: string; stakeholders: string; source_reference: string;
  estimation_method: string; estimate_value: string; estimate_unit: string;
  estimate_optimistic: string; estimate_most_likely: string; estimate_pessimistic: string;
  due_date: string;
  definition_of_ready: DorItemState[];
  target_planning_destination: string;
}

interface Props {
  projectId: string; locale: string;
  items: Record<string, unknown>[];
  dependencies: Record<string, unknown>[];
  members: Record<string, unknown>[];
  method: string | null;
  projectType: string | null;
  sessions: Record<string, unknown>[];
  sessionItems: Record<string, unknown>[];
  links: Record<string, unknown>[];
  linkTargets: { decision: { id: string; title: string }[]; meeting: { id: string; title: string }[]; communication: { id: string; title: string }[] };
  constructionSignals: { openRfis: number; pendingMaterials: number; pendingPermits: number; pendingInspections: number };
}

export function RefinementTab(p: Props) {
  const isEs = p.locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const tpl = useMemo(() => templateFor(p.method as DeliveryMethod | null, p.projectType), [p.method, p.projectType]);
  const [mode, setMode] = useState<"workbench" | "sessions" | "summary">("workbench");

  // Only non-promoted items are refinable.
  const refinable = useMemo(() => p.items.filter((it) => String(it.status) !== "promoted"), [p.items]);
  const statusOf = useMemo(() => new Map(p.items.map((it) => [String(it.id), String(it.refinement_status ?? "new")])), [p.items]);

  // Predictive refinement-risk per item (deterministic, explainable).
  const RESOLVED_SET = useMemo(() => new Set(["ready_for_planning", "planned", "in_execution", "done"]), []);
  const itemRisks = useMemo(() => {
    return refinable.map((it) => {
      const unresolved = p.dependencies
        .filter((d) => String(d.backlog_item_id) === String(it.id))
        .filter((d) => !RESOLVED_SET.has(statusOf.get(String(d.depends_on_item_id)) ?? "new")).length;
      return { item: it, risks: detectRefinementRisks(it as never, unresolved) };
    }).filter((r) => r.risks.length > 0);
  }, [refinable, p.dependencies, statusOf, RESOLVED_SET]);
  const riskById = useMemo(() => new Map(itemRisks.map((r) => [String(r.item.id), r.risks])), [itemRisks]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [fStatus, setFStatus] = useState("");
  const [fType, setFType] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fRisk, setFRisk] = useState("");
  const [fBand, setFBand] = useState("");

  // ── Capture (intake): new work enters here, unrefined, before the Backlog ───
  const [newTitle, setNewTitle] = useState("");
  const captureItem = () => {
    if (!newTitle.trim()) return;
    start(async () => { await saveBacklogItemAction({ projectId: p.projectId, item: { title: newTitle.trim() } }); setNewTitle(""); router.refresh(); });
  };
  const generateItems = () => start(async () => { await generateBacklogAction({ projectId: p.projectId, locale: p.locale }); router.refresh(); });

  const filtered = refinable.filter((it) => {
    if (fStatus && String(it.refinement_status ?? "new") !== fStatus) return false;
    if (fType && String(it.item_type ?? "") !== fType) return false;
    if (fPriority && String(it.priority ?? "") !== fPriority) return false;
    if (fRisk && String(it.risk_level ?? "") !== fRisk) return false;
    if (fBand) { const s = Number(it.readiness_score ?? 0); if (bandForScore(s).key !== fBand) return false; }
    return true;
  });

  const [selectedId, setSelectedId] = useState<string | null>(refinable[0] ? String(refinable[0].id) : null);
  const selected = useMemo(() => refinable.find((it) => String(it.id) === selectedId) ?? null, [refinable, selectedId]);

  // ── Form state, hydrated from the selected item during render ───────────────
  // (React's "you might not need an effect" pattern: rehydrate when the
  //  selection or template changes, without a setState-in-effect.)
  const hydrate = (it: Record<string, unknown> | null): FormState | null => {
    if (!it) return null;
    const stored = Array.isArray(it.definition_of_ready) ? (it.definition_of_ready as { key?: string; checked?: boolean }[]) : [];
    const checkedByKey = new Map(stored.map((d) => [String(d.key ?? ""), !!d.checked]));
    const dor: DorItemState[] = tpl.definitionOfReady.map((d) => ({ key: d.key, label: isEs ? d.es : d.en, checked: checkedByKey.get(d.key) ?? false }));
    return {
      description: String(it.description ?? ""),
      acceptance_criteria: String(it.acceptance_criteria ?? ""),
      completion_criteria: String(it.completion_criteria ?? ""),
      item_type: String(it.item_type ?? "task"),
      priority: String(it.priority ?? ""),
      risk_level: String(it.risk_level ?? ""),
      owner_id: String(it.owner_id ?? ""),
      business_value: it.business_value != null ? String(it.business_value) : "",
      stakeholders: String(it.stakeholders ?? ""),
      source_reference: String(it.source_reference ?? ""),
      estimation_method: String(it.estimation_method ?? "story_points"),
      estimate_value: it.estimate_value != null ? String(it.estimate_value) : "",
      estimate_unit: String(it.estimate_unit ?? ""),
      estimate_optimistic: it.estimate_optimistic != null ? String(it.estimate_optimistic) : "",
      estimate_most_likely: it.estimate_most_likely != null ? String(it.estimate_most_likely) : "",
      estimate_pessimistic: it.estimate_pessimistic != null ? String(it.estimate_pessimistic) : "",
      due_date: String(it.due_date ?? ""),
      definition_of_ready: dor,
      target_planning_destination: String(it.target_planning_destination ?? ""),
    };
  };
  const aiRecOf = (it: Record<string, unknown> | null): Record<string, unknown> | null =>
    (it && it.ai_recommendations && typeof it.ai_recommendations === "object" && Object.keys(it.ai_recommendations).length > 0) ? (it.ai_recommendations as Record<string, unknown>) : null;

  const hydKey = `${selectedId ?? ""}|${tpl.key}`;
  const [hydratedFor, setHydratedFor] = useState<string>("");
  const [f, setF] = useState<FormState | null>(() => hydrate(selected));
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(() => aiRecOf(selected));
  if (hydKey !== hydratedFor) {
    setHydratedFor(hydKey);
    setF(hydrate(selected));
    setAiResult(aiRecOf(selected));
  }

  // ── Live readiness ──────────────────────────────────────────────────────────
  const unresolvedDeps = useMemo(() => {
    if (!selected) return 0;
    return p.dependencies
      .filter((d) => String(d.backlog_item_id) === String(selected.id))
      .filter((d) => !RESOLVED.has(statusOf.get(String(d.depends_on_item_id)) ?? "new")).length;
  }, [p.dependencies, selected, statusOf]);

  const liveReadiness = useMemo(() => {
    if (!f) return null;
    const item: WorkItemLike = {
      description: f.description, acceptance_criteria: f.acceptance_criteria, completion_criteria: f.completion_criteria,
      definition_of_ready: f.definition_of_ready, estimation_method: f.estimation_method,
      estimate_value: numOrNull(f.estimate_value), estimate_unit: f.estimate_unit,
      estimate_optimistic: numOrNull(f.estimate_optimistic), estimate_most_likely: numOrNull(f.estimate_most_likely), estimate_pessimistic: numOrNull(f.estimate_pessimistic),
      owner_id: f.owner_id || null, priority: f.priority, risk_level: f.risk_level, business_value: numOrNull(f.business_value),
    };
    return computeReadiness(item, tpl, unresolvedDeps);
  }, [f, tpl, unresolvedDeps]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const buildInput = (): RefinementInput | null => {
    if (!selected || !f) return null;
    const m = ESTIMATION_METHODS.find((e) => e.value === f.estimation_method);
    const discrete = !!m && m.scale.length > 0 && !m.scale.every((v) => /^\d+$/.test(v)); // tshirt
    return {
      id: String(selected.id),
      description: f.description, acceptance_criteria: f.acceptance_criteria, completion_criteria: f.completion_criteria,
      item_type: f.item_type, priority: f.priority || null, risk_level: f.risk_level || null, owner_id: f.owner_id || null,
      business_value: numOrNull(f.business_value), stakeholders: f.stakeholders, source_reference: f.source_reference,
      estimation_method: f.estimation_method,
      estimate_value: m?.threePoint || m?.range || discrete ? null : numOrNull(f.estimate_value),
      estimate_unit: f.estimate_unit || null,
      estimate_optimistic: numOrNull(f.estimate_optimistic), estimate_most_likely: numOrNull(f.estimate_most_likely), estimate_pessimistic: numOrNull(f.estimate_pessimistic),
      due_date: f.due_date || null,
      definition_of_ready: f.definition_of_ready,
      target_planning_destination: f.target_planning_destination || null,
    };
  };

  const save = (after?: () => void) => {
    const item = buildInput(); if (!item) return;
    start(async () => { await saveRefinementAction({ projectId: p.projectId, item }); after?.(); router.refresh(); });
  };
  const setStatus = (status: string) => { const item = buildInput(); start(async () => { if (item) await saveRefinementAction({ projectId: p.projectId, item }); await setRefinementStatusAction({ projectId: p.projectId, id: String(selected!.id), status }); router.refresh(); }); };
  const [moveErr, setMoveErr] = useState<string | null>(null);
  const move = () => start(async () => { setMoveErr(null); const r = await moveToPlanningAction({ projectId: p.projectId, id: String(selected!.id), destination: f?.target_planning_destination || undefined }); if (r.error === "governance_required") { setMoveErr(isEs ? "Requiere aprobación de gobernanza antes de planear." : "Requires governance approval before planning."); return; } if (!r.error) { setSelectedId(null); } router.refresh(); });
  const del = () => {
    if (!selected) return;
    if (!window.confirm(isEs ? `¿Eliminar "${String(selected.title)}"? Esta acción no se puede deshacer.` : `Delete "${String(selected.title)}"? This cannot be undone.`)) return;
    start(async () => { await deleteBacklogItemAction({ projectId: p.projectId, id: String(selected.id) }); setSelectedId(null); router.refresh(); });
  };
  const setGov = (status: string) => start(async () => { await setGovernanceAction({ projectId: p.projectId, id: String(selected!.id), status }); router.refresh(); });
  const runAi = () => start(async () => { const r = await aiRefineItemAction({ projectId: p.projectId, id: String(selected!.id), locale: p.locale }); if (r.result) setAiResult(r.result as unknown as Record<string, unknown>); router.refresh(); });
  const addDep = (dependsOnId: string) => { if (!dependsOnId) return; start(async () => { await saveWorkItemDependencyAction({ projectId: p.projectId, itemId: String(selected!.id), dependsOnId }); router.refresh(); }); };
  const removeDep = (id: string) => start(async () => { await deleteWorkItemDependencyAction({ projectId: p.projectId, id }); router.refresh(); });

  // Split
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitText, setSplitText] = useState("");
  const doSplit = () => {
    const titles = splitText.split("\n").map((t) => t.trim()).filter(Boolean);
    if (titles.length < 2) return;
    start(async () => { await splitWorkItemAction({ projectId: p.projectId, id: String(selected!.id), childTitles: titles }); setSplitOpen(false); setSplitText(""); router.refresh(); });
  };

  // Links
  const addLink = (entityType: string, entityId: string, label: string) => { if (!entityId) return; start(async () => { await linkWorkItemAction({ projectId: p.projectId, itemId: String(selected!.id), entityType, entityId, label }); router.refresh(); }); };
  const removeLink = (id: string) => start(async () => { await unlinkWorkItemAction({ projectId: p.projectId, id }); router.refresh(); });
  const selLinks = selected ? p.links.filter((l) => String(l.backlog_item_id) === String(selected.id)) : [];

  const upd = (patch: Partial<FormState>) => setF((s) => (s ? { ...s, ...patch } : s));
  const toggleDor = (key: string) => setF((s) => (s ? { ...s, definition_of_ready: s.definition_of_ready.map((d) => (d.key === key ? { ...d, checked: !d.checked } : d)) } : s));

  // Inline AI assistant for a single criteria field (uses the on-screen draft).
  const [aiField, setAiField] = useState<string | null>(null);
  const suggestField = (field: "acceptance_criteria" | "completion_criteria") => {
    if (!selected || !f) return;
    setAiField(field);
    start(async () => {
      const r = await aiSuggestFieldAction({ projectId: p.projectId, field, locale: p.locale, title: String(selected.title), description: f.description, itemType: f.item_type, acceptanceCriteria: f.acceptance_criteria });
      if (r.text) upd({ [field]: r.text } as Partial<FormState>);
      setAiField(null);
    });
  };

  const selDeps = selected ? p.dependencies.filter((d) => String(d.backlog_item_id) === String(selected.id)) : [];
  const itemTitle = (id: unknown) => { const x = p.items.find((it) => String(it.id) === String(id)); return x ? String(x.title) : "—"; };
  const method = ESTIMATION_METHODS.find((e) => e.value === f?.estimation_method);
  const numericScale = !!method && method.scale.length > 0 && method.scale.every((v) => /^\d+$/.test(v));

  // Historical estimation comparison: peers of the same type + method.
  const benchmark = (() => {
    if (!f || !selected || !method) return null;
    const peers = p.items.filter((it) => String(it.id) !== String(selected.id)
      && String(it.item_type ?? "") === f.item_type
      && String(it.estimation_method ?? "") === f.estimation_method);
    if (peers.length === 0) return null;
    if (method.threePoint) {
      const vals = peers.map((it) => Number(it.estimate_most_likely)).filter((n) => !Number.isNaN(n) && n > 0);
      if (vals.length === 0) return { count: peers.length, label: null as string | null };
      return { count: vals.length, label: `~${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}` };
    }
    if (method.scale.length > 0 && !numericScale) { // t-shirt: mode of estimate_unit
      const counts: Record<string, number> = {};
      peers.forEach((it) => { const u = String(it.estimate_unit ?? ""); if (u) counts[u] = (counts[u] ?? 0) + 1; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return { count: peers.length, label: top ? (isEs ? `mayoría ${top[0]}` : `mostly ${top[0]}`) : null };
    }
    if (method.range) return { count: peers.length, label: null };
    const vals = peers.map((it) => Number(it.estimate_value)).filter((n) => !Number.isNaN(n) && n > 0);
    if (vals.length === 0) return { count: peers.length, label: null };
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const unit = method.scale.length > 0 ? "" : ` ${isEs ? method.unitEs ?? "" : method.unitEn ?? ""}`;
    return { count: vals.length, label: `~${avg % 1 === 0 ? avg : avg.toFixed(1)}${unit}` };
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{isEs ? tpl.secondaryLabel.es : tpl.secondaryLabel.en}</p>
          <p className="text-[11px] text-muted-foreground">{isEs ? tpl.terminology.es : tpl.terminology.en}</p>
        </div>
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          {([["workbench", LayoutGrid, isEs ? "Banco de trabajo" : "Workbench"], ["sessions", Users2, isEs ? "Sesiones" : "Sessions"], ["summary", BarChart3, isEs ? "Resumen" : "Summary"]] as const).map(([k, Icon, lbl]) => (
            <button key={k} onClick={() => setMode(k)} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium ${mode === k ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />{lbl}
            </button>
          ))}
        </div>
      </div>

      {mode === "summary" && <SummaryPanel isEs={isEs} refinable={refinable} sessions={p.sessions} itemRisks={itemRisks} onOpenItem={(id) => { setMode("workbench"); setSelectedId(id); }} />}
      {mode === "sessions" && <SessionsPanel projectId={p.projectId} locale={p.locale} items={p.items} refinable={refinable} sessions={p.sessions} sessionItems={p.sessionItems} />}

      {mode === "workbench" && (
      <div className="grid gap-3 lg:grid-cols-[280px_1fr_330px]">
        {/* ── LEFT: capture + list + filters ── */}
        <div className="space-y-2">
          {/* Capture (intake): new work enters the Refinement stage first */}
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-2">
            <div className="flex gap-1.5">
              <input
                className={inp}
                placeholder={isEs ? "Capturar nuevo trabajo…" : "Capture new work…"}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") captureItem(); }}
              />
              <button onClick={captureItem} disabled={pending || !newTitle.trim()} title={isEs ? "Agregar" : "Add"} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button onClick={generateItems} disabled={pending} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{isEs ? "Generar con IA desde el charter" : "Generate with AI from charter"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select className={inp} value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{isEs ? "Estado" : "Status"}</option>{Object.entries(REFINEMENT_STATUS_META).map(([k, v]) => <option key={k} value={k}>{isEs ? v.es : v.en}</option>)}</select>
            <select className={inp} value={fType} onChange={(e) => setFType(e.target.value)}><option value="">{isEs ? "Tipo" : "Type"}</option>{WORK_ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{isEs ? t.es : t.en}</option>)}</select>
            <select className={inp} value={fPriority} onChange={(e) => setFPriority(e.target.value)}><option value="">{isEs ? "Prioridad" : "Priority"}</option>{PRIORITIES.map((t) => <option key={t.value} value={t.value}>{isEs ? t.es : t.en}</option>)}</select>
            <select className={inp} value={fRisk} onChange={(e) => setFRisk(e.target.value)}><option value="">{isEs ? "Riesgo" : "Risk"}</option>{RISK_LEVELS.map((t) => <option key={t.value} value={t.value}>{isEs ? t.es : t.en}</option>)}</select>
            <select className={`${inp} col-span-2`} value={fBand} onChange={(e) => setFBand(e.target.value)}><option value="">{isEs ? "Readiness (todos)" : "Readiness (all)"}</option><option value="ready">{isEs ? "Listo (85+)" : "Ready (85+)"}</option><option value="almost_ready">{isEs ? "Casi (70-84)" : "Almost (70-84)"}</option><option value="needs_clarification">{isEs ? "Aclaración (40-69)" : "Clarify (40-69)"}</option><option value="not_ready">{isEs ? "No listo (<40)" : "Not ready (<40)"}</option></select>
          </div>
          <div className="max-h-[640px] space-y-1.5 overflow-y-auto pr-0.5">
            {filtered.map((it) => {
              const sc = Number(it.readiness_score ?? 0);
              const band = bandForScore(sc);
              const st = REFINEMENT_STATUS_META[String(it.refinement_status ?? "new")] ?? REFINEMENT_STATUS_META.new;
              const active = String(it.id) === selectedId;
              return (
                <button key={String(it.id)} onClick={() => setSelectedId(String(it.id))} className={`w-full rounded-lg border p-2.5 text-left transition-colors ${active ? "border-brand-400 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30" : "border-border bg-card hover:bg-muted/50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-medium text-foreground">{String(it.title)}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${TONE[band.tone]}`}>{it.readiness_score != null ? sc : "—"}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${TONE[st.tone]}`}>{isEs ? st.es : st.en}</span>
                    <span className="text-[10px] text-muted-foreground">{labelOf(WORK_ITEM_TYPES, String(it.item_type ?? ""), isEs)}</span>
                    {(() => { const rk = riskById.get(String(it.id)); const sev = rk ? topSeverity(rk) : null; return sev ? <span title={isEs ? "En riesgo" : "At risk"} className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${sev === "high" ? "text-red-500" : sev === "medium" ? "text-amber-500" : "text-muted-foreground"}`}><AlertTriangle className="h-3 w-3" />{rk!.length}</span> : null; })()}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{isEs ? "Sin ítems. Captura trabajo arriba o genéralo con IA para empezar a refinar." : "No items. Capture work above or generate it with AI to start refining."}</p>}
          </div>
        </div>

        {/* ── CENTER: detail editor ── */}
        {!selected || !f ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-10 text-sm text-muted-foreground">{isEs ? "Selecciona un ítem para refinarlo." : "Select an item to refine it."}</div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-base font-bold text-foreground">{String(selected.title)}</h3>

            {/* Readiness banner */}
            {liveReadiness && (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${TONE[liveReadiness.band.tone]}`}>
                <Gauge className="h-4 w-4" />
                <span className="text-sm font-semibold">{liveReadiness.score}/100 · {isEs ? liveReadiness.band.es : liveReadiness.band.en}</span>
                {liveReadiness.missing.length > 0 && <span className="text-[11px] opacity-80">· {liveReadiness.missing.length} {isEs ? "pendientes" : "missing"}</span>}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={isEs ? "Tipo" : "Type"}><select className={inp} value={f.item_type} onChange={(e) => upd({ item_type: e.target.value })}>{WORK_ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{isEs ? t.es : t.en}</option>)}</select></Field>
              <Field label={isEs ? "Prioridad" : "Priority"}><select className={inp} value={f.priority} onChange={(e) => upd({ priority: e.target.value })}><option value="">—</option>{PRIORITIES.map((t) => <option key={t.value} value={t.value}>{isEs ? t.es : t.en}</option>)}</select></Field>
              <Field label={isEs ? "Riesgo" : "Risk"}><select className={inp} value={f.risk_level} onChange={(e) => upd({ risk_level: e.target.value })}><option value="">—</option>{RISK_LEVELS.map((t) => <option key={t.value} value={t.value}>{isEs ? t.es : t.en}</option>)}</select></Field>
            </div>

            <Field label={isEs ? "Descripción" : "Description"}><textarea className={inp} rows={2} value={f.description} onChange={(e) => upd({ description: e.target.value })} /></Field>
            <Field label={isEs ? "Criterios de aceptación" : "Acceptance criteria"} action={<AiFillButton loading={aiField === "acceptance_criteria"} disabled={pending} onClick={() => suggestField("acceptance_criteria")} isEs={isEs} />}>
              <textarea className={inp} rows={2} value={f.acceptance_criteria} onChange={(e) => upd({ acceptance_criteria: e.target.value })} />
            </Field>
            <Field label={isEs ? "Criterios de terminación" : "Completion criteria"} action={<AiFillButton loading={aiField === "completion_criteria"} disabled={pending} onClick={() => suggestField("completion_criteria")} isEs={isEs} />}>
              <textarea className={inp} rows={2} value={f.completion_criteria} onChange={(e) => upd({ completion_criteria: e.target.value })} />
            </Field>

            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={isEs ? "Owner" : "Owner"}>
                <select className={inp} value={f.owner_id} onChange={(e) => upd({ owner_id: e.target.value })}>
                  <option value="">{isEs ? "— Sin asignar —" : "— Unassigned —"}</option>
                  {p.members.map((m) => <option key={String(m.user_id)} value={String(m.user_id)}>{String(m.display_name ?? m.user_id)}</option>)}
                </select>
              </Field>
              <Field label={isEs ? "Fecha de entrega" : "Due date"}><input type="date" className={inp} value={f.due_date} onChange={(e) => upd({ due_date: e.target.value })} /></Field>
              <Field label={isEs ? "Stakeholders" : "Stakeholders"}><input className={inp} value={f.stakeholders} onChange={(e) => upd({ stakeholders: e.target.value })} /></Field>
            </div>

            {/* Definition of Ready */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><ClipboardCheck className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Definition of Ready" : "Definition of Ready"}</p>
              <div className="space-y-1">
                {f.definition_of_ready.map((d) => (
                  <label key={d.key} className="flex items-start gap-2 text-xs text-foreground">
                    <input type="checkbox" checked={d.checked} onChange={() => toggleDor(d.key)} className="mt-0.5 h-3.5 w-3.5 accent-brand-600" />
                    <span className={d.checked ? "text-foreground" : "text-muted-foreground"}>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Estimation */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><Gauge className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Estimación" : "Estimation"}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select className={inp} value={f.estimation_method} onChange={(e) => upd({ estimation_method: e.target.value, estimate_value: "", estimate_unit: "" })}>{ESTIMATION_METHODS.map((m) => <option key={m.value} value={m.value}>{isEs ? m.es : m.en}</option>)}</select>
                {method?.threePoint ? (
                  <div className="grid grid-cols-3 gap-1">
                    <input className={inp} type="number" placeholder={isEs ? "Opt." : "Opt."} value={f.estimate_optimistic} onChange={(e) => upd({ estimate_optimistic: e.target.value })} />
                    <input className={inp} type="number" placeholder={isEs ? "Prob." : "Likely"} value={f.estimate_most_likely} onChange={(e) => upd({ estimate_most_likely: e.target.value })} />
                    <input className={inp} type="number" placeholder={isEs ? "Pes." : "Pess."} value={f.estimate_pessimistic} onChange={(e) => upd({ estimate_pessimistic: e.target.value })} />
                  </div>
                ) : method?.range ? (
                  <input className={inp} placeholder={isEs ? "Rango (ej. $10k–$20k)" : "Range (e.g. $10k–$20k)"} value={f.estimate_unit} onChange={(e) => upd({ estimate_unit: e.target.value })} />
                ) : numericScale ? (
                  <select className={inp} value={f.estimate_value} onChange={(e) => upd({ estimate_value: e.target.value })}><option value="">—</option>{method!.scale.map((v) => <option key={v} value={v}>{v}</option>)}</select>
                ) : method && method.scale.length > 0 ? (
                  <select className={inp} value={f.estimate_unit} onChange={(e) => upd({ estimate_unit: e.target.value })}><option value="">—</option>{method.scale.map((v) => <option key={v} value={v}>{v}</option>)}</select>
                ) : (
                  <div className="flex gap-1">
                    <input className={inp} type="number" placeholder={isEs ? "Valor" : "Value"} value={f.estimate_value} onChange={(e) => upd({ estimate_value: e.target.value })} />
                    <input className={`${inp} w-20`} placeholder={isEs ? method?.unitEs ?? "u" : method?.unitEn ?? "u"} value={f.estimate_unit} onChange={(e) => upd({ estimate_unit: e.target.value })} />
                  </div>
                )}
              </div>
              {method && <p className="mt-1.5 text-[10px] text-muted-foreground">{isEs ? `Recomendado para: ${method.recEs}` : `Recommended for: ${method.recEn}`}</p>}
              {benchmark && (
                <p className="mt-1 flex items-center gap-1.5 text-[10px] text-brand-600 dark:text-brand-400">
                  <BarChart3 className="h-3 w-3" />
                  {isEs
                    ? `Histórico: ${benchmark.count} ítem(s) similar(es)${benchmark.label ? ` · estimaron ${benchmark.label}` : ""}`
                    : `History: ${benchmark.count} similar item(s)${benchmark.label ? ` · estimated ${benchmark.label}` : ""}`}
                </p>
              )}
            </div>

            {/* Dependencies */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><GitBranch className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Dependencias" : "Dependencies"}</p>
              <div className="space-y-1">
                {selDeps.map((d) => (
                  <div key={String(d.id)} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1 text-xs">
                    <span className="flex items-center gap-1.5 truncate text-foreground">{RESOLVED.has(statusOf.get(String(d.depends_on_item_id)) ?? "new") ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertTriangle className="h-3 w-3 text-amber-500" />}{itemTitle(d.depends_on_item_id)}</span>
                    <button onClick={() => removeDep(String(d.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <select disabled={pending} value="" onChange={(e) => addDep(e.target.value)} className="w-full rounded-lg border border-dashed border-border bg-background px-2 py-1.5 text-xs text-muted-foreground focus:border-brand-500 focus:outline-none">
                  <option value="">{isEs ? "+ Depende de…" : "+ Depends on…"}</option>
                  {refinable.filter((it) => String(it.id) !== selectedId && !selDeps.some((d) => String(d.depends_on_item_id) === String(it.id))).map((it) => <option key={String(it.id)} value={String(it.id)}>{String(it.title)}</option>)}
                </select>
              </div>
            </div>

            {/* Related links: decisions / meetings / communications */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><Link2 className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Relacionado con" : "Related to"}</p>
              <div className="space-y-1">
                {selLinks.map((l) => (
                  <div key={String(l.id)} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-2 py-1 text-xs">
                    <span className="truncate text-foreground"><span className="text-[10px] uppercase text-muted-foreground">{String(l.entity_type)}</span> · {String(l.label || l.entity_id)}</span>
                    <button onClick={() => removeLink(String(l.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-1">
                  {([["decision", isEs ? "Decisión…" : "Decision…"], ["meeting", isEs ? "Reunión…" : "Meeting…"], ["communication", isEs ? "Comunicación…" : "Comm…"]] as const).map(([et, ph]) => {
                    const opts = p.linkTargets[et] ?? [];
                    const used = new Set(selLinks.filter((l) => String(l.entity_type) === et).map((l) => String(l.entity_id)));
                    return (
                      <select key={et} disabled={pending} value="" onChange={(e) => { const o = opts.find((x) => x.id === e.target.value); if (o) addLink(et, o.id, o.title); }} className="rounded-lg border border-dashed border-border bg-background px-1.5 py-1.5 text-[11px] text-muted-foreground focus:border-brand-500 focus:outline-none">
                        <option value="">{ph}</option>
                        {opts.filter((o) => !used.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                      </select>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Split */}
            {splitOpen && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                <div className="mb-1 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Scissors className="h-3.5 w-3.5 text-amber-600" />{isEs ? "Dividir en sub-ítems (uno por línea, mínimo 2)" : "Split into sub-items (one per line, min 2)"}</p>
                  <button onClick={() => setSplitOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
                <textarea className={inp} rows={3} placeholder={isEs ? "Sub-ítem 1\nSub-ítem 2" : "Sub-item 1\nSub-item 2"} value={splitText} onChange={(e) => setSplitText(e.target.value)} />
                <button onClick={doSplit} disabled={pending || splitText.split("\n").map((t) => t.trim()).filter(Boolean).length < 2} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scissors className="h-3.5 w-3.5" />}{isEs ? "Dividir" : "Split"}</button>
              </div>
            )}

            {/* Construction context (work readiness from project RFIs / materials / permits / inspections) */}
            {tpl.key === "construction" && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-2 flex items-center justify-between gap-1.5 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />{isEs ? "Contexto de obra (proyecto)" : "Field context (project)"}</span>
                  <Link href={`/projects/${p.projectId}/labor-capacity/lookahead`} className="text-[10px] font-normal text-brand-600 hover:underline dark:text-brand-400">{isEs ? "Lookahead →" : "Lookahead →"}</Link>
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {([["openRfis", isEs ? "RFIs abiertos" : "Open RFIs"], ["pendingMaterials", isEs ? "Materiales pend." : "Materials pend."], ["pendingPermits", isEs ? "Permisos pend." : "Permits pend."], ["pendingInspections", isEs ? "Inspecc. pend." : "Inspections pend."]] as const).map(([k, lbl]) => {
                    const n = p.constructionSignals[k];
                    return <div key={k} className={`rounded-md border px-2 py-1.5 text-center ${n > 0 ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20" : "border-border bg-background"}`}><div className={`text-base font-bold ${n > 0 ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{n}</div><div className="text-[10px] text-muted-foreground">{lbl}</div></div>;
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">{isEs ? "Señales del proyecto a revisar al confirmar el Definition of Ready de este paquete." : "Project-level signals to review when confirming this package's Definition of Ready."}</p>
              </div>
            )}

            {/* PMO governance approval gate */}
            {tpl.key === "pmo" && (() => {
              const gs = String(selected.governance_status ?? "not_required");
              const GS: Record<string, { es: string; en: string; tone: string }> = {
                not_required: { es: "No requerida", en: "Not required", tone: TONE.gray },
                pending: { es: "Pendiente", en: "Pending", tone: TONE.amber },
                approved: { es: "Aprobada", en: "Approved", tone: TONE.green },
                rejected: { es: "Rechazada", en: "Rejected", tone: TONE.red },
              };
              const m = GS[gs] ?? GS.not_required;
              return (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="mb-2 flex items-center justify-between gap-1.5 text-xs font-semibold text-foreground">
                    <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Aprobación de gobernanza" : "Governance approval"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.tone}`}>{isEs ? m.es : m.en}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setGov("pending")} disabled={pending} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">{isEs ? "Solicitar" : "Request"}</button>
                    <button onClick={() => setGov("approved")} disabled={pending} className="inline-flex items-center gap-1 rounded-lg border border-green-300 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/30"><CheckCircle2 className="h-3.5 w-3.5" />{isEs ? "Aprobar" : "Approve"}</button>
                    <button onClick={() => setGov("rejected")} disabled={pending} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30">{isEs ? "Rechazar" : "Reject"}</button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{isEs ? "Las iniciativas PMO requieren aprobación antes de mover a planeación." : "PMO initiatives require approval before moving to planning."}</p>
                </div>
              );
            })()}

            {/* Destination + status actions */}
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={isEs ? "Destino de planeación" : "Planning destination"}>
                <select className={inp} value={f.target_planning_destination} onChange={(e) => upd({ target_planning_destination: e.target.value })}>
                  <option value="">—</option>
                  {tpl.planningDestinations.map((v) => { const d = PLANNING_DESTINATIONS.find((x) => x.value === v); return d ? <option key={v} value={v}>{isEs ? d.es : d.en}</option> : null; })}
                </select>
              </Field>
              <Field label={isEs ? "Estado de refinamiento" : "Refinement status"}>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[(REFINEMENT_STATUS_META[String(selected.refinement_status ?? "new")] ?? REFINEMENT_STATUS_META.new).tone]}`}>{(() => { const m = REFINEMENT_STATUS_META[String(selected.refinement_status ?? "new")] ?? REFINEMENT_STATUS_META.new; return isEs ? m.es : m.en; })()}</span>
              </Field>
            </div>

            {moveErr && <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{moveErr}</p>}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <button onClick={() => save()} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isEs ? "Guardar" : "Save"}</button>
              {REFINABLE_STATUSES.filter((s) => s !== "ready_for_planning").map((s) => { const meta = REFINEMENT_STATUS_META[s]; return (
                <button key={s} onClick={() => setStatus(s)} disabled={pending} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">{isEs ? meta.es : meta.en}</button>
              ); })}
              <button onClick={() => setSplitOpen((v) => !v)} disabled={pending} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"><Scissors className="h-3.5 w-3.5" />{isEs ? "Dividir" : "Split"}</button>
              <button onClick={del} disabled={pending} title={isEs ? "Eliminar este ítem" : "Delete this item"} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" />{isEs ? "Eliminar" : "Delete"}</button>
              {/* Mark refined + ready → the item shows up in the Backlog, ready to plan/pick up. */}
              <button onClick={() => setStatus("ready_for_planning")} disabled={pending} title={isEs ? "Marca el ítem como refinado y lo envía al Backlog para planearlo y que el responsable lo tome" : "Marks the item refined and sends it to the Backlog to be planned and picked up by the owner"} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{isEs ? "Enviar al Backlog" : "Send to Backlog"}</button>
              <button onClick={move} disabled={pending || String(selected.refinement_status) !== "ready_for_planning"} title={isEs ? "Crea la tarea en el Workboard (requiere 'Listo para planear')" : "Creates the task on the Workboard (requires 'Ready for Planning')"} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{isEs ? "Mover a planeación" : "Move to planning"}</button>
            </div>
          </div>
        )}

        {/* ── RIGHT: AI assistant ── */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-brand-500" />{isEs ? "Asistente de refinamiento" : "Refinement assistant"}</h3>
            <button onClick={runAi} disabled={pending || !selected} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}{isEs ? "Refinar con IA" : "Refine with AI"}</button>
          </div>

          {!aiResult ? (
            <p className="text-xs text-muted-foreground">{isEs ? "La IA usa el charter, el método de entrega y el contexto del proyecto para sugerir criterios, dependencias, riesgos, estimación y destino — separando hechos, supuestos y recomendaciones." : "The AI uses the charter, delivery method and project context to suggest criteria, dependencies, risks, estimate and destination — separating facts, assumptions and recommendations."}</p>
          ) : (
            <div className="space-y-3 text-xs">
              {strv(aiResult.ai_summary) && <p className="rounded-lg bg-muted/40 p-2.5 text-foreground">{strv(aiResult.ai_summary)}</p>}
              <AiList icon={HelpCircle} tone="text-blue-500" title={isEs ? "Preguntas abiertas" : "Open questions"} items={arrv(aiResult.questions)} />
              {strv(aiResult.suggested_acceptance_criteria) && <AiBlock title={isEs ? "Criterios de aceptación sugeridos" : "Suggested acceptance criteria"} body={strv(aiResult.suggested_acceptance_criteria)} onUse={() => upd({ acceptance_criteria: strv(aiResult.suggested_acceptance_criteria) })} useLabel={isEs ? "Usar" : "Use"} />}
              {strv(aiResult.suggested_completion_criteria) && <AiBlock title={isEs ? "Criterios de terminación sugeridos" : "Suggested completion criteria"} body={strv(aiResult.suggested_completion_criteria)} onUse={() => upd({ completion_criteria: strv(aiResult.suggested_completion_criteria) })} useLabel={isEs ? "Usar" : "Use"} />}
              <AiList icon={GitBranch} tone="text-brand-500" title={isEs ? "Dependencias probables" : "Likely dependencies"} items={arrv(aiResult.suggested_dependencies)} />
              <AiList icon={ShieldAlert} tone="text-amber-500" title={isEs ? "Riesgos probables" : "Likely risks"} items={arrv(aiResult.suggested_risks)} />
              <AiList icon={ClipboardCheck} tone="text-brand-500" title={isEs ? "DoR faltante" : "Missing DoR"} items={arrv(aiResult.suggested_dor)} />
              {(strv(aiResult.suggested_estimate) || strv(aiResult.suggested_priority) || strv(aiResult.suggested_destination)) && (
                <div className="rounded-lg border border-border p-2.5">
                  {strv(aiResult.suggested_estimate) && <p className="text-foreground"><span className="font-medium">{isEs ? "Estimación: " : "Estimate: "}</span>{strv(aiResult.suggested_estimate)}</p>}
                  {strv(aiResult.suggested_priority) && <p className="text-foreground"><span className="font-medium">{isEs ? "Prioridad: " : "Priority: "}</span>{strv(aiResult.suggested_priority)} <button onClick={() => upd({ priority: strv(aiResult.suggested_priority) })} className="text-[10px] text-brand-600 hover:underline dark:text-brand-400">{isEs ? "usar" : "use"}</button></p>}
                  {strv(aiResult.suggested_destination) && <p className="text-foreground"><span className="font-medium">{isEs ? "Destino: " : "Destination: "}</span>{strv(aiResult.suggested_destination)}</p>}
                </div>
              )}
              {strv(aiResult.split_suggestion) && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300"><Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{strv(aiResult.split_suggestion)}</span></div>}
              {strv(aiResult.readiness_explanation) && <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-muted-foreground"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /><span>{strv(aiResult.readiness_explanation)}</span></div>}
              <div className="grid gap-2">
                <AiList icon={CheckCircle2} tone="text-green-500" title={isEs ? "Hechos conocidos" : "Known facts"} items={arrv(aiResult.facts)} />
                <AiList icon={HelpCircle} tone="text-muted-foreground" title={isEs ? "Supuestos de IA" : "AI assumptions"} items={arrv(aiResult.assumptions)} />
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

// ── Refined backlog summary ───────────────────────────────────────────────────

function SummaryPanel({ isEs, refinable, sessions, itemRisks, onOpenItem }: { isEs: boolean; refinable: Record<string, unknown>[]; sessions: Record<string, unknown>[]; itemRisks: { item: Record<string, unknown>; risks: RefinementRisk[] }[]; onOpenItem: (id: string) => void }) {
  const total = refinable.length;
  const scored = refinable.filter((it) => it.readiness_score != null);
  const avg = scored.length > 0 ? Math.round(scored.reduce((s, it) => s + Number(it.readiness_score ?? 0), 0) / scored.length) : 0;
  const bandCount = (key: string) => refinable.filter((it) => bandForScore(Number(it.readiness_score ?? 0)).key === key).length;
  const readyForPlanning = refinable.filter((it) => String(it.refinement_status) === "ready_for_planning").length;
  const needsClar = refinable.filter((it) => String(it.refinement_status) === "needs_clarification").length;
  const splitReq = refinable.filter((it) => String(it.refinement_status) === "split_required").length;
  const activeSessions = sessions.filter((s) => String(s.status) === "active").length;
  const atRisk = itemRisks.length;
  const SEV_DOT: Record<string, string> = { high: "text-red-500", medium: "text-amber-500", low: "text-muted-foreground" };
  const SEV_BADGE: Record<string, string> = { high: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300", medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", low: "bg-muted text-muted-foreground" };

  const cards: { label: string; value: string | number; tone?: string }[] = [
    { label: isEs ? "Ítems a refinar" : "Items to refine", value: total },
    { label: isEs ? "Readiness promedio" : "Avg readiness", value: `${avg}/100`, tone: "text-brand-600 dark:text-brand-400" },
    { label: isEs ? "Listos para planear" : "Ready for planning", value: readyForPlanning, tone: "text-green-600 dark:text-green-400" },
    { label: isEs ? "Necesitan aclaración" : "Need clarification", value: needsClar, tone: needsClar > 0 ? "text-amber-600 dark:text-amber-400" : undefined },
    { label: isEs ? "Requieren división" : "Split required", value: splitReq, tone: splitReq > 0 ? "text-amber-600 dark:text-amber-400" : undefined },
    { label: isEs ? "En riesgo" : "At risk", value: atRisk, tone: atRisk > 0 ? "text-red-600 dark:text-red-400" : undefined },
    { label: isEs ? "Sesiones activas" : "Active sessions", value: activeSessions },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className={`mt-0.5 text-lg font-bold ${c.tone ?? "text-foreground"}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold text-foreground">{isEs ? "Distribución de readiness" : "Readiness distribution"}</p>
        <div className="space-y-1.5">
          {READINESS_BANDS.slice().reverse().map((b) => {
            const n = bandCount(b.key);
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            const bar: Record<string, string> = { red: "bg-red-500", amber: "bg-amber-500", blue: "bg-blue-500", green: "bg-green-500" };
            return (
              <div key={b.key} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-muted-foreground">{isEs ? b.es : b.en}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full ${bar[b.tone]}`} style={{ width: `${pct}%` }} /></div>
                <span className="w-10 shrink-0 text-right font-medium text-foreground">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><ShieldAlert className="h-4 w-4 text-red-500" />{isEs ? "Riesgos de refinamiento (predictivo)" : "Refinement risks (predictive)"}<span className="text-xs font-normal text-muted-foreground">({atRisk})</span></p>
        {atRisk === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4" />{isEs ? "Ningún ítem en riesgo. El backlog refinado se ve sano." : "No items at risk. The refined backlog looks healthy."}</p>
        ) : (
          <ul className="space-y-1.5">
            {itemRisks.slice().sort((a, b) => (topSeverity(a.risks) === "high" ? -1 : 0) - (topSeverity(b.risks) === "high" ? -1 : 0)).map(({ item, risks }) => (
              <li key={String(item.id)} className="rounded-lg border border-border/60 px-3 py-2">
                <button onClick={() => onOpenItem(String(item.id))} className="text-left text-sm font-medium text-foreground hover:text-brand-600 dark:hover:text-brand-400">{String(item.title)}</button>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {risks.map((r, i) => <span key={i} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${SEV_BADGE[r.severity]}`}><span className={SEV_DOT[r.severity]}>●</span>{isEs ? r.es : r.en}</span>)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── small helpers ─────────────────────────────────────────────────────────────

const strv = (x: unknown) => (typeof x === "string" ? x : "");
const arrv = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);

function AiFillButton({ loading, disabled, onClick, isEs }: { loading: boolean; disabled: boolean; onClick: () => void; isEs: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={isEs ? "Rellenar con IA" : "Fill with AI"}
      className="inline-flex items-center gap-1 rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}{isEs ? "Rellenar con IA" : "Fill with AI"}
    </button>
  );
}

function Field({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-[11px] font-medium text-muted-foreground">{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}

function AiList({ icon: Icon, tone, title, items }: { icon: typeof HelpCircle; tone: string; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><Icon className={`h-3.5 w-3.5 ${tone}`} />{title}</p>
      <ul className="space-y-0.5 pl-1">{items.map((it, i) => <li key={i} className="flex gap-1.5 text-muted-foreground"><span className="text-brand-500">•</span>{it}</li>)}</ul>
    </div>
  );
}

function AiBlock({ title, body, onUse, useLabel }: { title: string; body: string; onUse: () => void; useLabel: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="mb-1 flex items-center justify-between gap-2"><p className="font-medium text-foreground">{title}</p><button onClick={onUse} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-brand-600 hover:bg-muted dark:text-brand-400"><Plus className="h-3 w-3" />{useLabel}</button></div>
      <p className="whitespace-pre-line text-muted-foreground">{body}</p>
    </div>
  );
}
