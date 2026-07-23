"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Send, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import {
  calculateFinancialSetupLine,
  type FinancialSetupCostType,
  type FinancialSetupLineInput,
  type FinancialSetupPeriodBasis,
  type FinancialSetupRateUnit,
} from "@/lib/financial/setup-model";
import { approveFinancialSetupAction, saveFinancialSetupAction, submitFinancialSetupAction } from "./setup-actions";

export interface FinancialSetupResource {
  id: string;
  name: string;
  resourceType: string;
  costRate: number | null;
  costUnit: string | null;
}

export interface FinancialSetupDraft {
  estimate: {
    id: string;
    status: string;
    title: string;
    purpose: string;
    baseDate: string;
    asOfDate: string;
    currency: string;
    classificationValue: string | null;
  };
  boe: { status: string } | null;
  lines: FinancialSetupLineInput[];
}

interface FinancialSetupProps {
  locale: string;
  projectId: string;
  role: string;
  resources: FinancialSetupResource[];
  draft: FinancialSetupDraft | null;
}

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand-500";
const smallInputClass = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-brand-500";

function emptyLine(): FinancialSetupLineInput {
  return {
    name: "",
    costType: "labor",
    resourceName: null,
    controlAccountRef: null,
    cbsCode: null,
    wbsRef: null,
    quantity: 0,
    quantityUnit: "hours",
    rate: 0,
    rateUnit: "hour",
    periodBasis: "month",
    periodCount: 1,
    hoursPerPeriod: null,
  };
}

function starterLines(): FinancialSetupLineInput[] {
  return [
    "SAP licenses / subscriptions",
    "Implementation partner",
    "Internal project team",
    "Integrations and data migration",
    "Testing and quality assurance",
    "Training and change management",
    "Cloud and infrastructure",
    "Hypercare and support",
    "Contingency",
  ].map((name) => ({ ...emptyLine(), name, costType: name.includes("license") ? "software" : name.includes("Cloud") ? "cloud" : "subcontractor" }));
}

function lineFromDraft(line: FinancialSetupLineInput): FinancialSetupLineInput {
  return {
    ...emptyLine(),
    ...line,
    resourceName: line.resourceName ?? null,
    controlAccountRef: line.controlAccountRef ?? null,
    cbsCode: line.cbsCode ?? null,
    wbsRef: line.wbsRef ?? null,
    hoursPerPeriod: line.hoursPerPeriod ?? null,
  };
}

export function FinancialSetup({ locale, projectId, role, resources, draft }: FinancialSetupProps) {
  const isEs = locale === "es";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(draft?.estimate.title ?? (isEs ? "Estimado financiero del proyecto" : "Project financial estimate"));
  const [purpose, setPurpose] = useState(draft?.estimate.purpose ?? (isEs ? "Planificación PMO y control de costos" : "PMO planning and cost control"));
  const [scopeStatement, setScopeStatement] = useState(isEs ? "Captura inicial de alcance, recursos, tarifas y costos planificados." : "Initial capture of scope, resources, rates and planned costs.");
  const [currency, setCurrency] = useState(draft?.estimate.currency ?? "USD");
  const [baseDate, setBaseDate] = useState(draft?.estimate.baseDate ?? new Date().toISOString().slice(0, 10));
  const [asOfDate, setAsOfDate] = useState(draft?.estimate.asOfDate ?? new Date().toISOString().slice(0, 10));
  const [estimateClass, setEstimateClass] = useState(draft?.estimate.classificationValue ?? "4");
  const [lines, setLines] = useState<FinancialSetupLineInput[]>(draft?.lines.map(lineFromDraft) ?? [emptyLine()]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculatedLines = useMemo(() => lines.map(calculateFinancialSetupLine), [lines]);
  const total = useMemo(() => calculatedLines.reduce((sum, line) => sum + line.amount, 0), [calculatedLines]);
  const totalPlannedHours = useMemo(() => calculatedLines.reduce((sum, line) => sum + (line.plannedHours ?? 0), 0), [calculatedLines]);
  const status = draft?.estimate.status ?? "new";
  const locked = status === "submitted";

  const text = (en: string, es: string) => (isEs ? es : en);
  const money = (value: number) => value.toLocaleString(isEs ? "es-ES" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 });
  const updateLine = (index: number, patch: Partial<FinancialSetupLineInput>) => {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  };
  const removeLine = (index: number) => setLines((current) => current.length === 1 ? current : current.filter((_, i) => i !== index));
  const applyResource = (index: number, value: string) => {
    const resource = resources.find((item) => item.id === value);
    if (!resource) return;
    updateLine(index, {
      resourceName: resource.name,
      rate: resource.costRate ?? lines[index].rate,
      rateUnit: (resource.costUnit as FinancialSetupRateUnit | null) ?? lines[index].rateUnit,
    });
  };

  const run = (operation: () => Promise<{ error?: string }>, success: string) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await operation();
      if (result.error) setError(result.error);
      else {
        setMessage(success);
        router.refresh();
      }
    });
  };

  const save = () => run(() => saveFinancialSetupAction({
    projectId,
    locale,
    title,
    purpose,
    scopeStatement,
    currency,
    baseDate,
    asOfDate,
    estimateClass,
    lines: lines.map((line) => ({
      ...line,
      resourceName: line.resourceName?.trim() || null,
      controlAccountRef: line.controlAccountRef?.trim() || null,
      cbsCode: line.cbsCode?.trim() || null,
      wbsRef: line.wbsRef?.trim() || null,
    })),
  }), text("Draft saved.", "Borrador guardado."));

  const submit = () => {
    if (!draft) return;
    run(() => submitFinancialSetupAction({ projectId, estimateId: draft.estimate.id, locale }), text("Submitted for PMO review.", "Enviado a revisión PMO."));
  };

  const approve = () => {
    if (!draft) return;
    run(() => approveFinancialSetupAction({ projectId, estimateId: draft.estimate.id, locale }), text("Baseline activated.", "Baseline activado."));
  };

  return (
    <section className="mb-6 space-y-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900 dark:bg-brand-950/20" aria-labelledby="financial-setup-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="financial-setup-title" className="text-lg font-bold text-foreground">{text("Financial setup", "Configuración financiera")}</h2>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">{status === "new" ? text("New", "Nuevo") : status}</span>
          </div>
          <p className="mt-1 max-w-4xl text-xs text-muted-foreground">
            {text("Enter the cost plan here. Rates are reused by Team & Roles; actual costs remain separate and are later measured against tasks, resources and canonical financial actuals.", "Captura aquí el plan de costos. Las tarifas se reutilizan en Equipo y Roles; los costos reales permanecen separados y después se miden contra tareas, recursos y los reales financieros canónicos.")}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {text("Prepared by", "Preparado por")}: {role} · {text("A draft never changes the active baseline.", "Un borrador nunca cambia el baseline activo.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => router.push(`/${locale}/team`)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
            <UsersRound className="h-3.5 w-3.5" /> {text("Manage rates", "Gestionar tarifas")}
          </button>
          {status === "submitted" && draft ? (
            <button type="button" disabled={isPending} onClick={approve} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              <ShieldCheck className="h-3.5 w-3.5" /> {text("Approve & activate", "Aprobar y activar")}
            </button>
          ) : null}
        </div>
      </div>

      {locked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {text("This package is waiting for an independent approver. To change it, wait for the decision and create a new version.", "Este paquete espera a un aprobador independiente. Para cambiarlo, espera la decisión y crea una nueva versión.")}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Field label={text("Estimate title", "Título del estimado")} className="xl:col-span-2"><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field label={text("Purpose", "Propósito")} className="xl:col-span-2"><input className={inputClass} value={purpose} onChange={(event) => setPurpose(event.target.value)} /></Field>
            <Field label={text("Currency", "Moneda")}><input className={inputClass} maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></Field>
            <Field label={text("AACE class", "Clase AACE")}><select className={inputClass} value={estimateClass} onChange={(event) => setEstimateClass(event.target.value)}>{["1", "2", "3", "4", "5"].map((value) => <option key={value} value={value}>Class {value}</option>)}</select></Field>
            <Field label={text("Base date", "Fecha base")}><input type="date" className={inputClass} value={baseDate} onChange={(event) => setBaseDate(event.target.value)} /></Field>
            <Field label={text("As-of date", "Fecha de corte")}><input type="date" className={inputClass} value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} /></Field>
            <Field label={text("Scope / basis", "Alcance / base")} className="md:col-span-2 xl:col-span-4"><textarea className={`${inputClass} min-h-10`} value={scopeStatement} onChange={(event) => setScopeStatement(event.target.value)} /></Field>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{text("Cost plan lines", "Líneas del plan de costos")}</h3>
              <p className="text-[11px] text-muted-foreground">{text("For weekly, biweekly or monthly people costs, choose the rate basis and number of periods. Add hours per period to measure capacity.", "Para costos semanales, quincenales o mensuales de personas, selecciona la base de tarifa y el número de periodos. Agrega horas por periodo para medir capacidad.")}</p>
            </div>
            <button type="button" onClick={() => setLines(starterLines())} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-300 bg-background px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300">
              {text("Use SAP/software categories", "Usar categorías SAP/software")}
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const calculated = calculatedLines[index];
              return (
                <div key={index} className="rounded-xl border border-border bg-background p-3">
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-12">
                    <Field label={text("Line", "Línea")} className="xl:col-span-2"><input className={smallInputClass} value={line.name} onChange={(event) => updateLine(index, { name: event.target.value })} placeholder={text("e.g. SAP consultant", "ej. Consultor SAP")} /></Field>
                    <Field label={text("Type", "Tipo")}><select className={smallInputClass} value={line.costType} onChange={(event) => updateLine(index, { costType: event.target.value as FinancialSetupCostType })}>{["labor", "software", "cloud", "subcontractor", "material", "equipment", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
                    <Field label={text("Resource / rate card", "Recurso / tarifa")} className="xl:col-span-2">
                      <select className={smallInputClass} value={resources.find((resource) => resource.name === line.resourceName)?.id ?? ""} onChange={(event) => applyResource(index, event.target.value)}>
                        <option value="">{text("Choose or type below", "Elegir o escribir abajo")}</option>
                        {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}{resource.costRate != null ? ` · ${resource.costRate}/${resource.costUnit}` : ""}</option>)}
                      </select>
                      <input className={`${smallInputClass} mt-1`} value={line.resourceName ?? ""} onChange={(event) => updateLine(index, { resourceName: event.target.value || null })} placeholder={text("New resource name", "Nombre de recurso nuevo")} />
                    </Field>
                    <Field label={text("Qty / period", "Cant. / periodo")}><input type="number" min="0" step="any" className={smallInputClass} value={line.quantity || ""} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 0 })} /></Field>
                    <Field label={text("Rate", "Tarifa")}><input type="number" min="0" step="any" className={smallInputClass} value={line.rate || ""} onChange={(event) => updateLine(index, { rate: Number(event.target.value) || 0 })} /></Field>
                    <Field label={text("Rate per", "Tarifa por")}><select className={smallInputClass} value={line.rateUnit} onChange={(event) => updateLine(index, { rateUnit: event.target.value as FinancialSetupRateUnit })}>{["hour", "day", "week", "month", "unit", "fixed"].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
                    <Field label={text("Periods", "Periodos")}><input type="number" min="1" step="1" className={smallInputClass} value={line.periodCount} onChange={(event) => updateLine(index, { periodCount: Math.max(1, Number(event.target.value) || 1) })} /></Field>
                    <Field label={text("Cadence", "Cadencia")}><select className={smallInputClass} value={line.periodBasis} onChange={(event) => updateLine(index, { periodBasis: event.target.value as FinancialSetupPeriodBasis })}>{[["week", "week"], ["biweek", "biweek"], ["month", "month"], ["one_time", "one time"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                    <Field label={text("Unit", "Unidad")}><input className={smallInputClass} value={line.quantityUnit} onChange={(event) => updateLine(index, { quantityUnit: event.target.value })} placeholder="hours" /></Field>
                    <Field label={text("Hours / period", "Horas / periodo")}><input type="number" min="0" step="any" className={smallInputClass} value={line.hoursPerPeriod ?? ""} onChange={(event) => updateLine(index, { hoursPerPeriod: event.target.value === "" ? null : Number(event.target.value) || 0 })} /></Field>
                    <div className="flex items-end justify-between gap-2 xl:col-span-2">
                      <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{text("Planned total", "Total planificado")}</p><p className="truncate text-sm font-bold tabular-nums text-brand-700 dark:text-brand-300">{money(calculated.amount)}</p><p className="text-[10px] text-muted-foreground">{calculated.plannedHours != null ? `${calculated.plannedHours}h` : text("hours not entered", "horas no capturadas")}</p></div>
                      <button type="button" aria-label={text("Remove line", "Eliminar línea")} onClick={() => removeLine(index)} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="grid gap-2 md:col-span-2 xl:col-span-12 xl:grid-cols-3">
                      <input className={smallInputClass} value={line.controlAccountRef ?? ""} onChange={(event) => updateLine(index, { controlAccountRef: event.target.value || null })} placeholder={text("Control account reference", "Referencia cuenta de control")} />
                      <input className={smallInputClass} value={line.cbsCode ?? ""} onChange={(event) => updateLine(index, { cbsCode: event.target.value || null })} placeholder="CBS code" />
                      <input className={smallInputClass} value={line.wbsRef ?? ""} onChange={(event) => updateLine(index, { wbsRef: event.target.value || null })} placeholder="WBS reference" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border-t border-brand-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-brand-900">
            <button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"><Plus className="h-3.5 w-3.5" /> {text("Add line", "Agregar línea")}</button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="mr-2 text-right text-base font-bold text-foreground">{text("Total", "Total")}: {money(total)}<span className="ml-2 block text-[11px] font-normal text-muted-foreground">{totalPlannedHours > 0 ? `${totalPlannedHours}h ${text("planned", "planificadas")}` : text("hours not entered", "horas no capturadas")}</span></span>
              {draft?.estimate.status === "draft" ? <button type="button" disabled={isPending} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-background px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300"><Send className="h-3.5 w-3.5" /> {text("Submit for review", "Enviar a revisión")}</button> : null}
              <button type="button" disabled={isPending} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {isPending ? text("Saving…", "Guardando…") : text("Save draft", "Guardar borrador")}</button>
            </div>
          </div>
        </>
      )}

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p> : null}
    </section>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className ?? ""}`}><span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>{children}</label>;
}
