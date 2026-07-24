"use client";

import { ArrowLeft, FlaskConical, Table2 } from "lucide-react";
import type { PmoPiFlowModel } from "@/lib/pmo-process-intelligence/contracts";
import { ProcessCanvas, activityLabel } from "./process-canvas";

export function TechnicalEventExplorer({
  model,
  locale,
  tableView,
  onToggleTable,
  onBack,
}: {
  model: PmoPiFlowModel;
  locale: "en" | "es";
  tableView: boolean;
  onToggleTable: () => void;
  onBack: () => void;
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <FlaskConical className="h-4 w-4" />
            {tt("Advanced", "Avanzado")}
          </p>
          <h2 className="text-lg font-bold text-slate-950">
            {tt("Technical Event Explorer", "Explorador técnico de eventos")}
          </h2>
          <p className="max-w-3xl text-sm text-slate-600">
            {tt(
              "Technical event names, individual transitions and complete rework loops are shown only in this evidence-oriented view.",
              "Los nombres técnicos, transiciones individuales y loops completos de retrabajo aparecen únicamente en esta vista orientada a evidencia.",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleTable}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <Table2 className="h-4 w-4" />
            {tableView
              ? tt("Technical map", "Mapa técnico")
              : tt("Technical table", "Tabla técnica")}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {tt("Back to executive flow", "Volver al flujo ejecutivo")}
          </button>
        </div>
      </div>

      {tableView ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">{tt("Technical event", "Evento técnico")}</th>
                <th className="px-4 py-3">{tt("Frequency", "Frecuencia")}</th>
                <th className="px-4 py-3">{tt("Cases", "Casos")}</th>
                <th className="px-4 py-3">{tt("Average wait", "Espera media")}</th>
                <th className="px-4 py-3">{tt("Rework", "Retrabajo")}</th>
              </tr>
            </thead>
            <tbody>
              {model.nodes.map((node) => (
                <tr key={node.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {activityLabel(node.activity)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{node.frequency}</td>
                  <td className="px-4 py-3 text-slate-700">{node.caseCount}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {node.avgIncomingWaitingMs == null
                      ? "—"
                      : `${(node.avgIncomingWaitingMs / 3_600_000).toFixed(1)} h`}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {node.reworkOccurrences}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-4">
          <ProcessCanvas model={model} locale={locale} />
        </div>
      )}
    </section>
  );
}
