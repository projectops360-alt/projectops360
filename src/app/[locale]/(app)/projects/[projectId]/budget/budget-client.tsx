"use client";

// ============================================================================
// Project Budget — editable estimate (the estimator owns the final numbers)
// + category subtotals + grand total, print-to-PDF.
// Quantities and unit costs are editable inline; totals recompute live and
// persist on blur. Print CSS in globals.css isolates #budget-report-print.
// ============================================================================

import { useMemo, useState } from "react";
import Image from "next/image";
import { Download, AlertTriangle, Check, Loader2 } from "lucide-react";
import { updateBudgetLineAction } from "./actions";

export interface BudgetLine {
  id: string;
  name: string;
  spec: string | null;
  quantity: number | null;
  unit: string | null;
  unitCost: number | null;
  total: number | null;
  costSource: string | null;
  needsReview: boolean;
}

export interface BudgetCategory {
  name: string;
  lines: BudgetLine[];
  subtotal: number;
}

interface BudgetReportClientProps {
  locale: string;
  projectId: string;
  projectName: string;
  categories: BudgetCategory[];
  grandTotal: number;
  currency: string;
  stats: { lineCount: number; unquantified: number; uncosted: number };
}

interface EditVals { quantity: number | null; unitCost: number | null }

export function BudgetReportClient({
  locale, projectId, projectName, categories, grandTotal: _initialTotal, currency, stats: _initialStats,
}: BudgetReportClientProps) {
  const isEs = locale === "es";
  const fmt = (n: number | null): string =>
    n == null ? "—" : n.toLocaleString(isEs ? "es-ES" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date().toLocaleDateString(isEs ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" });

  // Editable state, keyed by line id.
  const [edits, setEdits] = useState<Record<string, EditVals>>(() => {
    const map: Record<string, EditVals> = {};
    for (const cat of categories) for (const l of cat.lines) map[l.id] = { quantity: l.quantity, unitCost: l.unitCost };
    return map;
  });
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const lineTotal = (id: string): number | null => {
    const e = edits[id];
    return e && e.quantity != null && e.unitCost != null ? Math.round(e.quantity * e.unitCost * 100) / 100 : null;
  };

  // Live rollups computed from edits.
  const { grandTotal, unquantified, uncosted, lineCount } = useMemo(() => {
    let total = 0, unq = 0, unc = 0, n = 0;
    for (const cat of categories) for (const l of cat.lines) {
      n++;
      const e = edits[l.id];
      if (!e || e.quantity == null) unq++;
      if (!e || e.unitCost == null) unc++;
      const t = lineTotal(l.id);
      if (t != null) total += t;
    }
    return { grandTotal: Math.round(total * 100) / 100, unquantified: unq, uncosted: unc, lineCount: n };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, categories]);

  const parse = (v: string): number | null => {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  async function persist(id: string) {
    const e = edits[id];
    if (!e) return;
    setSaving((s) => new Set(s).add(id));
    const res = await updateBudgetLineAction({
      materialId: id, projectId, locale, quantity: e.quantity, unitCost: e.unitCost,
    });
    setSaving((s) => { const n = new Set(s); n.delete(id); return n; });
    if (!res.error) {
      setSaved((s) => new Set(s).add(id));
      setTimeout(() => setSaved((s) => { const n = new Set(s); n.delete(id); return n; }), 1500);
    }
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {isEs
            ? "Aún no hay líneas de presupuesto. Genera el estimado desde Drawing Intelligence → Takeoff → \"Generar estimado\"."
            : "No budget lines yet. Generate the estimate from Drawing Intelligence → Takeoff → \"Generate estimate\"."}
        </p>
      </div>
    );
  }

  const inputCls =
    "w-16 rounded border-b border-dashed border-border bg-transparent px-1 py-0.5 text-right text-sm tabular-nums text-foreground focus:border-brand-500 focus:outline-none print:border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div>
      {/* Toolbar (hidden in print) */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-bold text-foreground">{isEs ? "Presupuesto" : "Budget"}</h1>
          <p className="text-xs text-muted-foreground">
            {isEs ? "Edita cantidad y costo unitario; el total se recalcula y guarda solo." : "Edit quantity and unit cost; totals recompute and save automatically."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Download className="h-4 w-4" />
          {isEs ? "Descargar PDF" : "Download PDF"}
        </button>
      </div>

      {/* Printable report */}
      <div id="budget-report-print" className="space-y-6 rounded-2xl border border-border bg-card p-8 print:border-0 print:shadow-none">
        <header className="border-b border-border pb-5">
          <Image src="/logo-3d.png" alt="Project Ops 360°" width={1344} height={768} className="mb-4 h-12 w-auto" priority />
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
            {isEs ? "Estimado de presupuesto" : "Budget Estimate"}
          </p>
          <h2 className="text-2xl font-bold text-foreground">{projectName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryStat label={isEs ? "Total estimado" : "Estimated total"} value={`${currency} ${fmt(grandTotal)}`} highlight />
          <SummaryStat label={isEs ? "Líneas" : "Line items"} value={String(lineCount)} />
          <SummaryStat label={isEs ? "Sin cantidad" : "Unquantified"} value={String(unquantified)} warn={unquantified > 0} />
          <SummaryStat label={isEs ? "Sin costo" : "Uncosted"} value={String(uncosted)} warn={uncosted > 0} />
        </div>

        {(unquantified > 0 || uncosted > 0) && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 print:break-inside-avoid">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {isEs
              ? `El total cuenta solo las ${lineCount - unquantified} líneas con cantidad. ${unquantified} necesitan que captures la cantidad (edítalas abajo).`
              : `The total counts only the ${lineCount - unquantified} lines with a quantity. ${unquantified} need a quantity entered (edit them below).`}
          </p>
        )}

        {categories.map((cat) => {
          const subtotal = cat.lines.reduce((s, l) => s + (lineTotal(l.id) ?? 0), 0);
          return (
            <section key={cat.name} className="break-inside-avoid">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <h3 className="text-sm font-semibold text-foreground">{cat.name}</h3>
                <span className="text-sm font-semibold text-foreground">{currency} {fmt(Math.round(subtotal * 100) / 100)}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 font-medium">{isEs ? "Material" : "Item"}</th>
                    <th className="py-1.5 pl-4 pr-2 text-right font-medium">{isEs ? "Cant." : "Qty"}</th>
                    <th className="py-1.5 pr-4 font-medium">{isEs ? "Un." : "Unit"}</th>
                    <th className="py-1.5 text-right font-medium">{isEs ? "Costo unit." : "Unit cost"}</th>
                    <th className="py-1.5 pl-4 text-right font-medium">{isEs ? "Total" : "Total"}</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.lines.map((l) => {
                    const e = edits[l.id] ?? { quantity: null, unitCost: null };
                    const t = lineTotal(l.id);
                    return (
                      <tr key={l.id} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 pr-2 text-foreground">
                          <span className="flex items-center gap-1.5">
                            {l.name}
                            {saving.has(l.id) && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground print:hidden" />}
                            {saved.has(l.id) && <Check className="h-3 w-3 text-green-500 print:hidden" />}
                          </span>
                          {l.spec && <span className="block max-w-[340px] truncate text-[11px] text-muted-foreground">{l.spec}</span>}
                        </td>
                        <td className="py-1.5 pl-4 pr-2 text-right">
                          <input
                            type="number" min={0} step="any" inputMode="decimal"
                            className={inputCls}
                            value={e.quantity ?? ""}
                            placeholder="—"
                            onChange={(ev) => setEdits((m) => ({ ...m, [l.id]: { ...e, quantity: parse(ev.target.value) } }))}
                            onBlur={() => persist(l.id)}
                          />
                        </td>
                        <td className="py-1.5 pr-4 text-muted-foreground">{l.unit && !/^(null|undefined)$/i.test(l.unit) ? l.unit : "—"}</td>
                        <td className="py-1.5 text-right">
                          <input
                            type="number" min={0} step="any" inputMode="decimal"
                            className={`${inputCls} w-20`}
                            value={e.unitCost ?? ""}
                            placeholder="—"
                            onChange={(ev) => setEdits((m) => ({ ...m, [l.id]: { ...e, unitCost: parse(ev.target.value) } }))}
                            onBlur={() => persist(l.id)}
                          />
                        </td>
                        <td className="py-1.5 pl-4 text-right font-medium tabular-nums text-foreground">{t != null ? fmt(t) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}

        <div className="flex items-center justify-between border-t-2 border-foreground/20 pt-3">
          <span className="text-base font-bold text-foreground">TOTAL</span>
          <span className="text-xl font-bold text-brand-600 dark:text-brand-400">{currency} {fmt(grandTotal)}</span>
        </div>

        <p className="text-[10px] text-muted-foreground">
          {isEs
            ? "Costos unitarios del catálogo (defaults aproximados, no precios de mercado). Estimado preliminar — verificar antes de usar comercialmente."
            : "Unit costs from the catalog (approximate defaults, not market quotes). Preliminary estimate — verify before commercial use."}
        </p>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30" : "border-border bg-muted/20"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${highlight ? "text-brand-600 dark:text-brand-400" : warn ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
