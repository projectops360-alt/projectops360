"use client";

// ============================================================================
// ProjectOps360° — Living Graph collapsible legend
// ============================================================================
// Floating, collapsible legend explaining node types, edge types, risk
// levels and special indicators (critical path, bottleneck, rework,
// traceability gaps, simulation impact). Driven entirely by the
// centralized style maps — no duplicated colors.
// ============================================================================

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpenText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_TYPE_STYLES,
  EDGE_TYPE_STYLES,
  RISK_COLORS,
  GRAPH_SEMANTIC_COLORS,
} from "@/lib/graph/living-graph-styles";
import type { ProcessNodeType, ProcessEdgeType } from "@/types/database";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
      {children}
    </p>
  );
}

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex w-6 shrink-0 items-center justify-center">{swatch}</span>
      <span className="truncate text-[10px] text-foreground">{label}</span>
    </div>
  );
}

function LivingGraphLegendComponent() {
  const t = useTranslations("livingGraph");
  const [open, setOpen] = useState(false);

  const nodeTypes = Object.entries(NODE_TYPE_STYLES) as [
    ProcessNodeType,
    (typeof NODE_TYPE_STYLES)[ProcessNodeType],
  ][];
  const edgeTypes = Object.entries(EDGE_TYPE_STYLES) as [
    ProcessEdgeType,
    (typeof EDGE_TYPE_STYLES)[ProcessEdgeType],
  ][];

  return (
    <div className="absolute left-2 top-2 z-10 max-w-[220px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-card/95 px-2 py-1.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted",
          open && "rounded-b-none border-b-0",
        )}
      >
        <BookOpenText className="h-3.5 w-3.5" aria-hidden />
        {t("legend.title")}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="max-h-[55vh] overflow-y-auto rounded-md rounded-tl-none border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur-sm">
          <SectionTitle>{t("legend.nodeTypes")}</SectionTitle>
          <div className="space-y-1">
            {nodeTypes.map(([type, style]) => {
              const Icon = style.icon;
              return (
                <LegendRow
                  key={type}
                  swatch={<Icon className="h-3 w-3" style={{ color: style.accent }} aria-hidden />}
                  label={t(`nodeTypes.${type}`)}
                />
              );
            })}
          </div>

          <SectionTitle>{t("legend.edgeTypes")}</SectionTitle>
          <div className="space-y-1">
            {edgeTypes.map(([type, style]) => (
              <LegendRow
                key={type}
                swatch={
                  <svg width="24" height="6" aria-hidden>
                    <line
                      x1="0"
                      y1="3"
                      x2="24"
                      y2="3"
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      strokeDasharray={style.dashArray}
                    />
                  </svg>
                }
                label={t(`edgeTypes.${type}`)}
              />
            ))}
          </div>

          <SectionTitle>{t("legend.riskLevels")}</SectionTitle>
          <div className="space-y-1">
            {(["low", "medium", "high"] as const).map((risk) => (
              <LegendRow
                key={risk}
                swatch={
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: RISK_COLORS[risk] }}
                    aria-hidden
                  />
                }
                label={t(`detailPanel.risk.${risk}`)}
              />
            ))}
          </div>

          <SectionTitle>{t("legend.indicators")}</SectionTitle>
          <div className="space-y-1">
            <LegendRow
              swatch={
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ boxShadow: `0 0 0 2px ${GRAPH_SEMANTIC_COLORS.critical}` }}
                  aria-hidden
                />
              }
              label={t("legend.criticalPath")}
            />
            <LegendRow
              swatch={
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ boxShadow: `0 0 0 2px ${GRAPH_SEMANTIC_COLORS.bottleneck}` }}
                  aria-hidden
                />
              }
              label={t("legend.bottleneck")}
            />
            <LegendRow
              swatch={
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ boxShadow: `0 0 0 2px ${GRAPH_SEMANTIC_COLORS.rework}` }}
                  aria-hidden
                />
              }
              label={t("legend.rework")}
            />
            <LegendRow
              swatch={
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ boxShadow: `0 0 0 2px ${GRAPH_SEMANTIC_COLORS.traceabilityGap}` }}
                  aria-hidden
                />
              }
              label={t("legend.traceabilityGap")}
            />
            <LegendRow
              swatch={
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ boxShadow: `0 0 0 2px ${GRAPH_SEMANTIC_COLORS.simulationImpact}` }}
                  aria-hidden
                />
              }
              label={t("legend.simulationImpact")}
            />
            <LegendRow
              swatch={
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ boxShadow: `0 0 0 2px ${GRAPH_SEMANTIC_COLORS.searchHit}` }}
                  aria-hidden
                />
              }
              label={t("legend.searchHit")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const LivingGraphLegend = memo(LivingGraphLegendComponent);
LivingGraphLegend.displayName = "LivingGraphLegend";
