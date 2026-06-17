"use client";

// ============================================================================
// Adaptive Delivery Framework — setup wizard + framework overview.
// Project-agnostic: software terminology only when project type is software.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Layers, Sparkles, Loader2, CheckCircle2, Settings2, Gauge, ShieldCheck,
  FileText, MessageSquare, GitBranch, Columns3, CalendarClock, Rocket, Info, BarChart3,
} from "lucide-react";
import {
  PROJECT_TYPES, UNCERTAINTY, GOVERNANCE, CADENCE, FEEDBACK_FREQ, DOCUMENTATION, CHANGE_CONTROL,
  VENDOR_DEP, DELIVERY_METHODS, FRAMEWORK_STATUS_META, MEETING_RHYTHM, workboardColumnLabels,
  label, type DeliveryMethod, type Opt,
} from "@/lib/delivery/config";
import {
  recommendFrameworkAction, saveFrameworkAction, activateFrameworkAction,
  scheduleFrameworkMeetingsAction, setColumnWipAction, type FrameworkConfig,
} from "./actions";
import { BacklogTab, CyclesTab, AiHealthTab } from "./delivery-tabs";
import { Link } from "@/i18n/navigation";

interface Props {
  locale: string;
  projectId: string;
  projectName: string;
  defaultProjectType: string;
  framework: Record<string, unknown> | null;
  boardColumns: Record<string, unknown>[];
  events: Record<string, unknown>[];
  charterGoal: string | null;
  charterObjectives: string | null;
  backlog: Record<string, unknown>[];
  cycles: Record<string, unknown>[];
  cycleItems: Record<string, unknown>[];
  taskStatusCounts: Record<string, number>;
  alerts: Record<string, unknown>[];
  milestones: Record<string, unknown>[];
  risks: Record<string, unknown>[];
  startSetup: boolean;
}

const TONE: Record<string, string> = {
  gray: "bg-muted text-muted-foreground", blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};
const sel = "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

const TABS = [
  { key: "overview", es: "Resumen", en: "Overview" },
  { key: "backlog", es: "Backlog", en: "Backlog" },
  { key: "cycles", es: "Ciclos", en: "Cycles" },
  { key: "ai", es: "IA y Salud", en: "AI & Health" },
];

export function DeliveryClient(p: Props) {
  const isEs = p.locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const fw = p.framework;
  const configured = !!fw && fw.status !== "draft" && !!fw.delivery_method;
  const [mode, setMode] = useState<"overview" | "wizard">(configured && !p.startSetup ? "overview" : "wizard");
  const [tab, setTab] = useState("overview");

  if (mode === "wizard" || !configured) {
    return <Wizard p={p} isEs={isEs} pending={pending} start={start} router={router} onDone={() => setMode("overview")} />;
  }

  return (
    <div className="space-y-5">
      <Header p={p} isEs={isEs} actions={
        <div className="flex flex-wrap items-center gap-2">
          {fw!.status !== "active" && (
            <button onClick={() => start(async () => { await activateFrameworkAction({ projectId: p.projectId }); router.refresh(); })} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}{isEs ? "Activar ejecución" : "Activate execution"}
            </button>
          )}
          <button onClick={() => setMode("wizard")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">
            <Settings2 className="h-4 w-4" />{isEs ? "Reconfigurar" : "Reconfigure"}
          </button>
        </div>
      } />

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {isEs ? t.es : t.en}
            {t.key === "ai" && p.alerts.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{p.alerts.length}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewBody p={p} isEs={isEs} />}
      {tab === "backlog" && <BacklogTab projectId={p.projectId} locale={p.locale} items={p.backlog} milestones={p.milestones} risks={p.risks} />}
      {tab === "cycles" && <CyclesTab projectId={p.projectId} locale={p.locale} cycles={p.cycles} backlog={p.backlog} cycleItems={p.cycleItems} />}
      {tab === "ai" && <AiHealthTab projectId={p.projectId} locale={p.locale} alerts={p.alerts} />}
    </div>
  );
}

// ── Wizard ──────────────────────────────────────────────────────────────────

function Wizard({ p, isEs, pending, start, router, onDone }: { p: Props; isEs: boolean; pending: boolean; start: React.TransitionStartFunction; router: ReturnType<typeof useRouter>; onDone: () => void }) {
  const fw = p.framework;
  const init = <T,>(k: string, d: T) => (fw?.[k] as T) ?? d;
  const [f, setF] = useState({
    projectType: init("project_type", p.defaultProjectType) as string,
    uncertainty: init("uncertainty_level", "medium") as string,
    governance: init("governance_level", "moderate") as string,
    documentation: init("documentation_level", "moderate") as string,
    changeControl: init("change_control_required", "recommended") as string,
    feedbackFreq: init("stakeholder_feedback_frequency", "every_cycle") as string,
    vendorDep: init("vendor_dependency_level", "low") as string,
    executionCadence: init("execution_cadence", "biweekly") as string,
    reviewCadence: init("review_cadence", "every_cycle") as string,
    deliveryMethod: init("delivery_method", "hybrid") as DeliveryMethod,
    regulatory: init("regulatory_requirement", false) as boolean,
  });
  const [rec, setRec] = useState<{ method: DeliveryMethod; confidence: number; reasonEs: string; reasonEn: string; cadence: string; reviewCadence: string; boardTemplate: string; boardColumns: string[] } | null>(null);
  const [aiUsed, setAiUsed] = useState(false);

  const recommend = () => start(async () => {
    const r = await recommendFrameworkAction({ projectId: p.projectId, inputs: { projectType: f.projectType, uncertainty: f.uncertainty, governance: f.governance, documentation: f.documentation, changeControl: f.changeControl, feedbackFreq: f.feedbackFreq, vendorDep: f.vendorDep } });
    if ("rec" in r && r.rec) {
      setRec(r.rec); setAiUsed(false);
      setF((s) => ({ ...s, deliveryMethod: r.rec.method, executionCadence: r.rec.cadence, reviewCadence: r.rec.reviewCadence, regulatory: f.governance === "regulatory" || f.documentation === "regulatory" }));
    }
  });

  const save = () => start(async () => {
    const config: FrameworkConfig = {
      projectType: f.projectType, deliveryMethod: f.deliveryMethod, governance: f.governance, uncertainty: f.uncertainty,
      executionCadence: f.executionCadence, reviewCadence: f.reviewCadence, feedbackFreq: f.feedbackFreq,
      documentation: f.documentation, changeControl: f.changeControl, vendorDep: f.vendorDep, regulatory: f.regulatory,
      aiRecommended: aiUsed, recommendationConfidence: rec?.confidence, recommendationReason: rec ? (isEs ? rec.reasonEs : rec.reasonEn) : undefined,
    };
    await saveFrameworkAction({ projectId: p.projectId, config, locale: p.locale });
    router.refresh(); onDone();
  });

  return (
    <div className="space-y-5">
      <Header p={p} isEs={isEs} />

      {p.startSetup && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <p className="text-sm text-foreground">{isEs ? "Configura cómo se ejecutará este proyecto. Diagnostica el contexto y deja que el sistema recomiende el mejor modelo, o elígelo manualmente." : "Configure how this project will be executed. Diagnose the context and let the system recommend the best model, or pick it manually."}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Diagnostic */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Settings2 className="h-4 w-4 text-brand-500" />{isEs ? "Diagnóstico del proyecto" : "Project diagnostic"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <WizardField isEs={isEs} label={isEs ? "Tipo de proyecto" : "Project type"} opts={PROJECT_TYPES} value={f.projectType} onChange={(v) => setF({ ...f, projectType: v })} />
            <WizardField isEs={isEs} label={isEs ? "Nivel de incertidumbre" : "Uncertainty level"} opts={UNCERTAINTY} value={f.uncertainty} onChange={(v) => setF({ ...f, uncertainty: v })} />
            <WizardField isEs={isEs} label={isEs ? "Nivel de gobernanza" : "Governance level"} opts={GOVERNANCE} value={f.governance} onChange={(v) => setF({ ...f, governance: v })} />
            <WizardField isEs={isEs} label={isEs ? "Nivel de documentación" : "Documentation level"} opts={DOCUMENTATION} value={f.documentation} onChange={(v) => setF({ ...f, documentation: v })} />
            <WizardField isEs={isEs} label={isEs ? "Control de cambios" : "Change control"} opts={CHANGE_CONTROL} value={f.changeControl} onChange={(v) => setF({ ...f, changeControl: v })} />
            <WizardField isEs={isEs} label={isEs ? "Feedback de stakeholders" : "Stakeholder feedback"} opts={FEEDBACK_FREQ} value={f.feedbackFreq} onChange={(v) => setF({ ...f, feedbackFreq: v })} />
            <WizardField isEs={isEs} label={isEs ? "Dependencia de proveedores" : "Vendor dependency"} opts={VENDOR_DEP} value={f.vendorDep} onChange={(v) => setF({ ...f, vendorDep: v })} />
            <WizardField isEs={isEs} label={isEs ? "Cadencia de ejecución" : "Execution cadence"} opts={CADENCE} value={f.executionCadence} onChange={(v) => setF({ ...f, executionCadence: v })} />
          </div>
          <button onClick={recommend} disabled={pending} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Recomendar marco" : "Recommend framework"}
          </button>
        </div>

        {/* Recommendation + method choice */}
        <div className="space-y-4">
          {rec && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-900 dark:bg-brand-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">{isEs ? "Recomendación" : "Recommendation"} · {rec.confidence}%</p>
              <p className="text-base font-bold text-foreground">{isEs ? DELIVERY_METHODS[rec.method].es : DELIVERY_METHODS[rec.method].en}</p>
              <p className="mt-1 text-xs text-muted-foreground">{isEs ? rec.reasonEs : rec.reasonEn}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{isEs ? "Tablero sugerido" : "Suggested board"}: {rec.boardColumns.join(" → ")}</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">{isEs ? "Método de entrega (puedes cambiarlo)" : "Delivery method (you can override)"}</label>
            <div className="space-y-1.5">
              {(Object.keys(DELIVERY_METHODS) as DeliveryMethod[]).map((m) => {
                const active = f.deliveryMethod === m;
                return (
                  <button key={m} onClick={() => setF({ ...f, deliveryMethod: m })}
                    className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${active ? "border-brand-400 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30" : "border-border hover:bg-muted"}`}>
                    <span className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${active ? "border-brand-600 bg-brand-600" : "border-muted-foreground"}`} />
                    <span>
                      <span className="font-medium text-foreground">{isEs ? DELIVERY_METHODS[m].es : DELIVERY_METHODS[m].en}</span>
                      {rec?.method === m && <span className="ml-1 rounded bg-brand-100 px-1 text-[9px] font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{isEs ? "sugerido" : "suggested"}</span>}
                      <span className="block text-[11px] text-muted-foreground">{isEs ? DELIVERY_METHODS[m].descEs : DELIVERY_METHODS[m].descEn}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button onClick={save} disabled={pending} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isEs ? "Guardar configuración" : "Save configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────

function OverviewBody({ p, isEs }: { p: Props; isEs: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fw = p.framework!;
  const method = fw.delivery_method as DeliveryMethod;
  const projectType = (fw.project_type as string) ?? null;
  const m = DELIVERY_METHODS[method];
  const rhythm = MEETING_RHYTHM[method] ?? [];
  const Card = OverviewCard;

  // Live task counts (drives adaptive metrics + WIP badges).
  const counts = p.taskStatusCounts ?? {};
  const totalTasks = Object.values(counts).reduce((s, n) => s + n, 0);
  const c = (k: string) => counts[k] ?? 0;
  const metrics = buildMetrics(method, counts, totalTasks, p, isEs);

  // Reverse map for WIP: workboard label → TaskStatus (only for adapted profiles).
  const statusByLabel: Record<string, string> = {};
  for (const [status, lbl] of Object.entries(workboardColumnLabels(method, projectType, isEs))) statusByLabel[lbl] = status;

  const scheduleMeetings = () => start(async () => { await scheduleFrameworkMeetingsAction({ projectId: p.projectId, locale: p.locale }); router.refresh(); });

  return (
    <div className="space-y-5">
      {/* Method headline */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 dark:border-brand-900 dark:bg-brand-950/20">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700 dark:text-brand-400">{isEs ? "Método de entrega" : "Delivery method"}</p>
        <h2 className="text-xl font-bold text-foreground">{isEs ? m.es : m.en}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{(fw.recommendation_reason as string) || (isEs ? m.descEs : m.descEn)}</p>
      </div>

      {/* Adaptive metrics — emphasis changes per delivery method */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground"><BarChart3 className="h-4 w-4 text-brand-500" />{isEs ? `Reporte del marco (${isEs ? m.es : m.en})` : `Framework report (${m.en})`}</h3>
        {totalTasks === 0 ? (
          <p className="text-xs text-muted-foreground">{isEs ? "Aún no hay tareas en el Workboard. Promueve items del backlog para ver métricas." : "No tasks on the Workboard yet. Promote backlog items to see metrics."}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((mt, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{mt.label}</p>
                <p className={`mt-0.5 text-lg font-bold ${mt.tone ?? "text-foreground"}`}>{mt.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card icon={Gauge} title={isEs ? "Incertidumbre" : "Uncertainty"} value={label(UNCERTAINTY, fw.uncertainty_level as string, isEs)} />
        <Card icon={ShieldCheck} title={isEs ? "Gobernanza" : "Governance"} value={label(GOVERNANCE, fw.governance_level as string, isEs)} />
        <Card icon={FileText} title={isEs ? "Documentación" : "Documentation"} value={label(DOCUMENTATION, fw.documentation_level as string, isEs)} />
        <Card icon={GitBranch} title={isEs ? "Control de cambios" : "Change control"} value={label(CHANGE_CONTROL, fw.change_control_required as string, isEs)} />
        <Card icon={CalendarClock} title={isEs ? "Cadencia" : "Cadence"} value={label(CADENCE, fw.execution_cadence as string, isEs)} />
        <Card icon={MessageSquare} title={isEs ? "Feedback" : "Feedback"} value={label(FEEDBACK_FREQ, fw.stakeholder_feedback_frequency as string, isEs)} />
        <Card icon={Layers} title={isEs ? "Tipo de proyecto" : "Project type"} value={label(PROJECT_TYPES, fw.project_type as string, isEs)} />
        <Card icon={Sparkles} title={isEs ? "Confianza" : "Confidence"} value={fw.recommendation_confidence ? `${fw.recommendation_confidence}%` : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Single execution board → Workboard, with WIP limits */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 flex items-center justify-between gap-1.5 text-sm font-semibold text-foreground">
            <span className="flex items-center gap-1.5"><Columns3 className="h-4 w-4 text-brand-500" />{isEs ? "Tablero de ejecución" : "Execution board"}</span>
            <Link href={`/projects/${p.projectId}/workboard`} className="text-xs font-normal text-brand-600 hover:underline dark:text-brand-400">{isEs ? "Abrir Workboard →" : "Open Workboard →"}</Link>
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">{isEs ? "Columnas del marco con límite de WIP (en curso / límite). En rojo si se excede." : "Framework columns with WIP limits (in progress / limit). Red when exceeded."}</p>
          {p.boardColumns.length > 0 ? (
            <div className="space-y-1.5">
              {p.boardColumns.map((col) => (
                <WipRow key={String(col.id)} col={col} projectId={p.projectId} isEs={isEs}
                  liveCount={statusByLabel[String(col.name)] ? c(statusByLabel[String(col.name)]) : null}
                  onSaved={() => router.refresh()} />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">{isEs ? "Configura el marco para generar las columnas." : "Configure the framework to generate columns."}</p>
          )}
        </div>
        {/* Meeting rhythm + schedule into Rhythm Center */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-2 flex items-center justify-between gap-1.5 text-sm font-semibold text-foreground">
            <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-brand-500" />{isEs ? "Ritmo de reuniones sugerido" : "Suggested meeting rhythm"}</span>
          </h3>
          <ul className="space-y-1 text-sm text-foreground">
            {rhythm.map((r, i) => <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{isEs ? r.es : r.en}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={scheduleMeetings} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}{isEs ? "Programar en el Rhythm Center" : "Schedule in the Rhythm Center"}
            </button>
            <Link href={`/projects/${p.projectId}/rhythm`} className="text-xs text-brand-600 hover:underline dark:text-brand-400">{isEs ? "Ver calendario →" : "View calendar →"}</Link>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{isEs ? "Crea estas reuniones (semanales desde la próxima semana) en el calendario del proyecto. No duplica si ya existen." : "Creates these meetings (weekly from next week) in the project calendar. Won't duplicate if they already exist."}</p>
        </div>
      </div>

      <p className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {isEs ? "Flujo: define el Backlog → promueve a tarea → ejecuta en el Workboard. Usa Ciclos e IA para planear y controlar." : "Flow: define the Backlog → promote to task → execute on the Workboard. Use Cycles and AI to plan and control."}
      </p>
    </div>
  );
}

// ── Adaptive metrics per delivery method ────────────────────────────────────

interface Metric { label: string; value: string | number; tone?: string }

function buildMetrics(method: DeliveryMethod, counts: Record<string, number>, total: number, p: Props, isEs: boolean): Metric[] {
  const c = (k: string) => counts[k] ?? 0;
  const done = c("done");
  const blocked = c("blocked");
  const inProgress = c("in_progress");
  const queue = c("not_started") + c("prompt_ready") + c("sent_to_ai");
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const activeCycles = p.cycles.filter((x) => String(x.status) === "active").length;
  const openBacklog = p.backlog.filter((x) => String(x.status) !== "promoted").length;
  const blkTone = blocked > 0 ? "text-red-600 dark:text-red-400" : "text-foreground";

  if (method === "kanban") {
    return [
      { label: isEs ? "En curso (WIP)" : "In progress (WIP)", value: inProgress },
      { label: isEs ? "Bloqueados" : "Blocked", value: blocked, tone: blkTone },
      { label: isEs ? "En cola" : "In queue", value: queue },
      { label: isEs ? "Entregados" : "Delivered", value: done, tone: "text-green-600 dark:text-green-400" },
    ];
  }
  if (method === "predictive") {
    return [
      { label: isEs ? "Avance" : "Progress", value: `${pct}%`, tone: "text-brand-600 dark:text-brand-400" },
      { label: isEs ? "Hitos" : "Milestones", value: p.milestones.length },
      { label: isEs ? "Pendientes" : "Pending", value: queue + inProgress },
      { label: isEs ? "Bloqueados" : "Blocked", value: blocked, tone: blkTone },
    ];
  }
  // scrum / agile / xp / hybrid
  return [
    { label: isEs ? "Ciclos activos" : "Active cycles", value: activeCycles },
    { label: isEs ? "Backlog abierto" : "Open backlog", value: openBacklog },
    { label: isEs ? "En curso" : "In progress", value: inProgress },
    { label: isEs ? "Completado" : "Completed", value: `${pct}%`, tone: "text-green-600 dark:text-green-400" },
  ];
}

// ── WIP limit row (editable) ────────────────────────────────────────────────

function WipRow({ col, projectId, isEs, liveCount, onSaved }: { col: Record<string, unknown>; projectId: string; isEs: boolean; liveCount: number | null; onSaved: () => void }) {
  const [pending, start] = useTransition();
  const initial = col.wip_limit != null ? String(col.wip_limit) : "";
  const [val, setVal] = useState(initial);
  const limit = col.wip_limit != null ? Number(col.wip_limit) : null;
  const over = limit != null && liveCount != null && liveCount > limit;

  const save = () => {
    const n = val.trim() === "" ? null : Number(val);
    if ((n === null && initial === "") || String(n) === initial) return;
    start(async () => { await setColumnWipAction({ projectId, columnId: String(col.id), wipLimit: n }); onSaved(); });
  };

  return (
    <div className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs ${over ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : "border-border bg-muted/20"}`}>
      <span className="flex items-center gap-2 truncate text-foreground">
        {String(col.name)}
        {liveCount != null && (
          <span className={`rounded px-1.5 py-0.5 font-semibold ${over ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>
            {liveCount}{limit != null ? ` / ${limit}` : ""}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        <label className="text-[10px]">{isEs ? "WIP" : "WIP"}</label>
        <input type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="∞" className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs text-foreground focus:border-brand-500 focus:outline-none" />
      </span>
    </div>
  );
}

// ── Shared header ───────────────────────────────────────────────────────────

function WizardField({ label, opts, value, onChange, isEs }: { label: string; opts: Opt[]; value: string; onChange: (v: string) => void; isEs: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <select className={sel} value={value} onChange={(e) => onChange(e.target.value)}>
        {opts.map((o) => <option key={o.value} value={o.value}>{isEs ? o.es : o.en}</option>)}
      </select>
    </div>
  );
}

function OverviewCard({ icon: Icon, title, value }: { icon: typeof Gauge; title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" />{title}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Header({ p, isEs, actions }: { p: Props; isEs: boolean; actions?: React.ReactNode }) {
  const fw = p.framework;
  const status = (fw?.status as string) ?? "draft";
  const meta = FRAMEWORK_STATUS_META[status] ?? FRAMEWORK_STATUS_META.draft;
  const method = fw?.delivery_method ? DELIVERY_METHODS[fw.delivery_method as DeliveryMethod] : null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
            <Layers className="h-4 w-4" />{isEs ? "Marco de Ejecución" : "Delivery Framework"}
          </div>
          <h1 className="mt-1 truncate text-xl font-bold text-foreground">{p.projectName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold ${TONE[meta.tone]}`}>{isEs ? meta.es : meta.en}</span>
            {method && <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">{isEs ? method.es : method.en}</span>}
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
}
