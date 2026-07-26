"use client";

// ============================================================================
// PMO Portfolio Living Graph — legend (CAP-048)
// ============================================================================
// The canvas encodes four things at once (kind, health, criticality,
// provenance). Without a legend that encoding is a private language, so this is
// part of the reading surface rather than a nicety.
//
// Collapsible and collapsed by default: it must never eat canvas the PMO needs.
// ============================================================================

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { GraphHealth } from "@/lib/pmo-living-graph/contracts";
import { HEALTH_CLASS, edgeColor } from "./graph-flow-types";
import { EDGE_TYPE_LABEL, HEALTH_LABEL, KIND_LABEL } from "./graph-nodes";

const HEALTHS: GraphHealth[] = ["healthy", "at_risk", "critical", "unknown"];

/** The kinds a PMO actually meets on this canvas, in reading order. */
const LEGEND_KINDS = ["organization", "project", "milestone", "task", "risk", "decision"] as const;

/** The relationships worth explaining; structural ones are self-evident. */
const LEGEND_EDGES = [
  "contains",
  "depends_on",
  "impacts",
  "consumes_budget",
  "shares_resource_with",
] as const;

export function GraphLegend({ locale }: { locale: "en" | "es" }) {
  const t = useTranslations("pmoLivingGraph");
  const [open, setOpen] = useState(false);
  const es = locale === "es";

  return (
    <div className="pointer-events-auto w-56 rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {t("legend")}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-3 py-2">
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t("health")}
            </h4>
            <ul className="mt-1 space-y-1">
              {HEALTHS.map((health) => (
                <li key={health} className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${HEALTH_CLASS[health].dot}`}
                    aria-hidden
                  />
                  {HEALTH_LABEL[health][es ? "es" : "en"]}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t("nodeType")}
            </h4>
            <ul className="mt-1 space-y-1">
              {LEGEND_KINDS.map((kind) => (
                <li key={kind} className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span
                    // Mirrors the canvas geometry so the mapping is learnable.
                    className={`h-3 w-4 border-2 border-slate-400 bg-white ${
                      kind === "project"
                        ? "rounded-md"
                        : kind === "milestone" || kind === "risk"
                          ? "rounded-tl-md rounded-br-md"
                          : kind === "organization" || kind === "decision"
                            ? "rounded-lg"
                            : "rounded-[2px]"
                    }`}
                    aria-hidden
                  />
                  {KIND_LABEL[kind][es ? "es" : "en"]}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t("relationship")}
            </h4>
            <ul className="mt-1 space-y-1">
              {LEGEND_EDGES.map((type) => (
                <li key={type} className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span
                    className="h-0.5 w-5 shrink-0 rounded-full"
                    style={{ backgroundColor: edgeColor(type) }}
                    aria-hidden
                  />
                  <span className="truncate">{EDGE_TYPE_LABEL[type][es ? "es" : "en"]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t("provenance")}
            </h4>
            {/* Dashed = computed. Stating this explicitly is what lets a reader
                distinguish a fact from a derivation without opening a panel. */}
            <ul className="mt-1 space-y-1">
              <li className="flex items-center gap-2 text-[11px] text-slate-700">
                <svg width="20" height="4" aria-hidden>
                  <line x1="0" y1="2" x2="20" y2="2" stroke="#475569" strokeWidth="2" />
                </svg>
                <span className="truncate">{t("provenanceObserved")}</span>
              </li>
              <li className="flex items-center gap-2 text-[11px] text-slate-700">
                <svg width="20" height="4" aria-hidden>
                  <line
                    x1="0"
                    y1="2"
                    x2="20"
                    y2="2"
                    stroke="#475569"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                </svg>
                <span className="truncate">{t("provenanceInferred")}</span>
              </li>
            </ul>
          </section>

          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t("criticalNodes")}
            </h4>
            <p className="mt-1 text-[11px] leading-snug text-slate-600">
              {/* Size + halo are one combined channel; describing it in words is
                  cheaper than three more swatches. */}
              {es
                ? "Los nodos más grandes y con halo son los más conectados del portafolio."
                : "Larger, haloed nodes are the most connected in the portfolio."}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
