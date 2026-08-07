"use client";

// ============================================================================
// What you can write in a KPI expression
// ============================================================================
// The editor listed the allowed FUNCTIONS but never the FIELDS, so the only
// way to learn that `open_overdue_flag` exists was to read one of the built-in
// KPI definitions and copy from it. Everything is now visible, and clicking a
// name inserts it — discovering a field and using it should not be two
// separate acts of archaeology.
// ============================================================================

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { KPI_FIELDS, KPI_FUNCTION_DOCS, KPI_EXAMPLES, EVM_EXPLAINERS, type KpiFieldScope } from "@/lib/kpi/reference";

interface KpiExpressionReferenceProps {
  isEs: boolean;
  /** Append a field or a whole example to the expression being edited. */
  onInsert: (text: string) => void;
}

const SCOPE_LABEL: Record<KpiFieldScope, { es: string; en: string }> = {
  task: { es: "Por tarea", en: "Per task" },
  milestone: { es: "Por hito", en: "Per milestone" },
  series: { es: "Serie temporal", en: "Time series" },
};

const SCOPES: KpiFieldScope[] = ["task", "milestone", "series"];

export function KpiExpressionReference({ isEs, onInsert }: KpiExpressionReferenceProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/70 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {isEs
          ? "Campos y funciones disponibles"
          : "Available fields and functions"}
        <span className="ml-auto font-normal text-muted-foreground">
          {isEs
            ? `${KPI_FIELDS.length} campos · ${KPI_FUNCTION_DOCS.length} funciones`
            : `${KPI_FIELDS.length} fields · ${KPI_FUNCTION_DOCS.length} functions`}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/70 px-3 py-3">
          <p className="text-[11px] text-muted-foreground">
            {isEs
              ? "Haz clic en cualquier nombre para añadirlo a la expresión."
              : "Click any name to add it to the expression."}
          </p>

          {SCOPES.map((scope) => {
            const fields = KPI_FIELDS.filter((f) => f.scope === scope);
            if (fields.length === 0) return null;
            return (
              <div key={scope}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {isEs ? SCOPE_LABEL[scope].es : SCOPE_LABEL[scope].en}
                </p>
                <ul className="space-y-1">
                  {fields.map((f) => (
                    <li key={f.field} className="flex items-baseline gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => onInsert(f.field)}
                        className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-brand-700 ring-1 ring-border transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
                      >
                        {f.field}
                      </button>
                      <span className="text-muted-foreground">{isEs ? f.es : f.en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isEs ? "Funciones" : "Functions"}
            </p>
            <ul className="space-y-1">
              {KPI_FUNCTION_DOCS.map((fn) => (
                <li key={fn.name} className="flex items-baseline gap-2 text-[11px]">
                  <span className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground ring-1 ring-border">
                    {fn.signature}
                  </span>
                  <span className="text-muted-foreground">{isEs ? fn.es : fn.en}</span>
                </li>
              ))}
            </ul>
          </div>

          {/*
            SPI and CPI get prose, not just an expression. They are the KPIs
            most often quoted and least often understood: "SPI 0.03" has to be
            read as "three percent of the planned work is done", not "something
            is 3% wrong". And each has a denominator that can legitimately be
            zero, which is why the editor sometimes answers "not computable".
          */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isEs ? "Valor Ganado (EVM)" : "Earned Value (EVM)"}
            </p>
            <ul className="space-y-2">
              {EVM_EXPLAINERS.map((evm) => (
                <li key={evm.code} className="rounded-md border border-border bg-background p-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] font-bold text-brand-700 dark:text-brand-300">
                      {evm.code}
                    </span>
                    <span className="text-[11px] font-medium text-foreground">
                      {isEs ? evm.nameEs : evm.nameEn}
                    </span>
                  </div>
                  <code className="mt-1 block font-mono text-[11px] font-semibold text-foreground">
                    {evm.formula}
                  </code>
                  <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                    {isEs ? evm.meaningEs : evm.meaningEn}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-foreground/80">
                    {isEs ? evm.readingEs : evm.readingEn}
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-amber-600 dark:text-amber-400">
                    {isEs ? evm.needsEs : evm.needsEn}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isEs ? "Ejemplos" : "Examples"}
            </p>
            <ul className="space-y-1.5">
              {KPI_EXAMPLES.map((ex) => (
                <li key={ex.expression}>
                  <button
                    type="button"
                    onClick={() => onInsert(ex.expression)}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-left transition-colors hover:border-brand-400"
                  >
                    <span className="block text-[11px] text-foreground">{isEs ? ex.es : ex.en}</span>
                    <code className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                      {ex.expression}
                    </code>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
