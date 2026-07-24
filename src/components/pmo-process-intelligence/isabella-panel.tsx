"use client";

// ============================================================================
// PMO Process Intelligence — Isabella Intelligence panel (CAP-047 · M7)
// ============================================================================
// Renders ONLY evidence-complete insights from the deterministic engine.
// Each card: severity + confidence + impact + horizon + recommended action,
// an expandable evidence section (formulas, projections, assumptions,
// limitations, data quality) and governed feedback (accept/reject/defer →
// audit trail; never changes behavior by itself).
// ============================================================================

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock, Sparkles, X } from "lucide-react";
import type { PmoPiInsight } from "@/lib/pmo-process-intelligence/insights";
import { recordInsightFeedbackAction } from "@/app/[locale]/(app)/process-intelligence/actions";

const SEV: Record<PmoPiInsight["severity"], { en: string; es: string }> = {
  critical: { en: "Critical", es: "Crítico" },
  warning: { en: "Warning", es: "Advertencia" },
  info: { en: "Info", es: "Info" },
};

export function IsabellaPanel({
  insights,
  locale,
  onOpenInMap,
  onSimulate,
}: {
  insights: PmoPiInsight[];
  locale: "en" | "es";
  onOpenInMap?: (activities: string[]) => void;
  onSimulate?: (hint: string) => void;
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  async function sendFeedback(insight: PmoPiInsight, decision: "accepted" | "rejected" | "deferred") {
    setFeedback((f) => ({ ...f, [insight.id]: decision }));
    await recordInsightFeedbackAction({ insightId: insight.id, rule: insight.rule, decision });
  }

  return (
    <aside aria-label="Isabella Intelligence" className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-4 w-4 text-purple-500" />
        Isabella Intelligence
        <span className="ml-auto text-xs font-normal normal-case">{insights.length}</span>
      </h2>

      {insights.length === 0 ? (
        <div className="mt-4 py-10 text-center">
          <p className="mx-auto max-w-[240px] text-sm text-muted-foreground">
            {tt(
              "No rule produced an evidence-backed recommendation for the current scope.",
              "Ninguna regla produjo una recomendación con evidencia para el alcance actual.",
            )}
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {insights.map((ins) => {
            const open = expanded === ins.id;
            const given = feedback[ins.id];
            return (
              <li key={ins.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-semibold text-foreground">
                  [{SEV[ins.severity][locale]}] {ins.title[locale]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{ins.summary[locale]}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {tt("Confidence", "Confianza")}: {Math.round(ins.confidence * 100)}% ·{" "}
                  {tt("Impact", "Impacto")}: {ins.impact[locale]} ·{" "}
                  {tt("Horizon", "Horizonte")}: {ins.horizon.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">
                  → {ins.recommendedAction[locale]}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : ins.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:bg-muted"
                  >
                    {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {tt("View evidence", "Ver evidencia")}
                  </button>
                  {ins.openInMapActivities && onOpenInMap && (
                    <button
                      type="button"
                      onClick={() => onOpenInMap(ins.openInMapActivities!)}
                      className="rounded-md border border-border px-2 py-0.5 hover:bg-muted"
                    >
                      {tt("Open in map", "Abrir en el mapa")}
                    </button>
                  )}
                  {ins.simulateHint && onSimulate && (
                    <button
                      type="button"
                      onClick={() => onSimulate(ins.simulateHint!)}
                      className="rounded-md border border-border px-2 py-0.5 hover:bg-muted"
                    >
                      {tt("Simulate", "Simular")}
                    </button>
                  )}
                </div>

                {open && (
                  <div className="mt-2 space-y-1 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
                    <p><span className="font-semibold">{tt("Formulas", "Fórmulas")}:</span> {ins.evidence.formulas.join(" · ")}</p>
                    <p><span className="font-semibold">{tt("Sources", "Fuentes")}:</span> {ins.evidence.projections.join(", ")}</p>
                    {ins.evidence.assumptions.length > 0 && (
                      <p><span className="font-semibold">{tt("Assumptions", "Supuestos")}:</span> {ins.evidence.assumptions.join(", ")}</p>
                    )}
                    <p><span className="font-semibold">{tt("Limitations", "Limitaciones")}:</span> {ins.evidence.limitations.join(", ")}</p>
                    <p><span className="font-semibold">{tt("Data quality", "Calidad de datos")}:</span> {Math.round(ins.evidence.dataQualityScore * 100)}%</p>
                    <p><span className="font-semibold">{tt("Affected", "Afectados")}:</span> {ins.affected.map((a) => `${a.type}:${a.id.slice(0, 8)}`).join(", ")}</p>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                  {given ? (
                    <span className="text-muted-foreground">
                      {tt("Feedback recorded", "Feedback registrado")}: {given}
                    </span>
                  ) : (
                    <>
                      <button type="button" onClick={() => sendFeedback(ins, "accepted")} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:bg-muted">
                        <Check className="h-3 w-3" /> {tt("Accept", "Aceptar")}
                      </button>
                      <button type="button" onClick={() => sendFeedback(ins, "rejected")} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:bg-muted">
                        <X className="h-3 w-3" /> {tt("Reject", "Rechazar")}
                      </button>
                      <button type="button" onClick={() => sendFeedback(ins, "deferred")} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:bg-muted">
                        <Clock className="h-3 w-3" /> {tt("Defer", "Diferir")}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
        {tt(
          "Deterministic rules over real projections — no recommendation exists without evidence. Feedback is audited and only reaches Isabella through versioned, reviewable knowledge.",
          "Reglas deterministas sobre proyecciones reales — ninguna recomendación existe sin evidencia. El feedback se audita y solo llega a Isabella mediante conocimiento versionado y revisable.",
        )}
      </p>
    </aside>
  );
}
