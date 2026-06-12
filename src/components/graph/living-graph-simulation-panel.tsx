"use client";

// ============================================================================
// ProjectOps360° — Living Graph what-if simulation cockpit panel
// ============================================================================
// Floating panel shown in the Simulation overlay once a node is selected.
// Runs deterministic scenarios and shows a Current Plan vs Simulated Plan
// comparison: affected nodes, propagated delay, critical-path impact,
// milestones at risk and suggested mitigation.
// ============================================================================

import { memo } from "react";
import { useTranslations } from "next-intl";
import { FlaskConical, RotateCcw, ArrowRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { RISK_COLORS, hexToRgba } from "@/lib/graph/living-graph-styles";
import type {
  LivingGraphNode,
  LivingGraphSimulationState,
  LivingGraphSimulationScenario,
} from "@/types/living-graph";

const SCENARIOS: LivingGraphSimulationScenario[] = [
  "delay1d",
  "delay3d",
  "delay1w",
  "markBlocked",
  "removeBlocker",
  "increaseDuration",
];

const ACCENT = "#f97316";

export interface LivingGraphSimulationPanelProps {
  selectedNode: LivingGraphNode;
  simulation: LivingGraphSimulationState | null;
  /** Baseline duration of the selected node's plan, in days. */
  baselineDays: number;
  onRunScenario: (nodeId: string, scenario: LivingGraphSimulationScenario) => void;
  onReset: () => void;
}

function LivingGraphSimulationPanelComponent({
  selectedNode,
  simulation,
  baselineDays,
  onRunScenario,
  onReset,
}: LivingGraphSimulationPanelProps) {
  const t = useTranslations("livingGraph");

  const active = simulation?.focusNodeId === selectedNode.id ? simulation : null;
  const simulatedDays = active
    ? Math.round((baselineDays + active.estimatedDelayDays) * 10) / 10
    : null;

  return (
    <div
      role="region"
      aria-label={t("simulationPanel.title")}
      className="absolute bottom-3 left-1/2 z-20 w-[min(560px,calc(100%-24px))] -translate-x-1/2 rounded-xl border bg-card/95 p-3 shadow-2xl backdrop-blur-md"
      style={{
        borderColor: hexToRgba(ACCENT, 0.4),
        boxShadow: `0 12px 40px ${hexToRgba(ACCENT, 0.15)}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FlaskConical className="h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden />
          <p className="truncate text-xs font-semibold text-foreground">
            {t("simulationPanel.title")}
            <span className="ml-1.5 font-normal text-muted-foreground">
              — {selectedNode.label}
            </span>
          </p>
        </div>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] text-foreground hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            {t("simulationPanel.reset")}
          </button>
        )}
      </div>

      {/* Scenario buttons */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario}
            type="button"
            onClick={() => onRunScenario(selectedNode.id, scenario)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
              active?.scenario === scenario
                ? "text-white"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
            style={
              active?.scenario === scenario
                ? { backgroundColor: ACCENT, borderColor: ACCENT }
                : undefined
            }
          >
            {t(`simulation.scenarios.${scenario}`)}
          </button>
        ))}
      </div>

      {/* Current vs Simulated comparison */}
      {active && simulatedDays != null && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
          <div className="flex items-center justify-center gap-3 text-center">
            <div className="flex-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {t("simulationPanel.currentPlan")}
              </p>
              <p className="font-mono text-base font-bold tabular-nums text-foreground">
                {Math.round(baselineDays * 10) / 10}d
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div
              className="flex-1 rounded-lg border px-2 py-1.5"
              style={{
                borderColor: hexToRgba(ACCENT, 0.5),
                backgroundColor: hexToRgba(ACCENT, 0.08),
              }}
            >
              <p className="text-[9px] uppercase tracking-wider" style={{ color: ACCENT }}>
                {t("simulationPanel.simulatedPlan")}
              </p>
              <p className="font-mono text-base font-bold tabular-nums" style={{ color: ACCENT }}>
                {simulatedDays}d
                <span className="ml-1 text-[10px] font-semibold">
                  ({active.estimatedDelayDays >= 0 ? "+" : ""}
                  {active.estimatedDelayDays}d)
                </span>
              </p>
            </div>
          </div>

          <p className="text-[11px] text-foreground">
            {t("simulation.result", {
              affected: active.affectedNodeIds.length,
              delay: active.estimatedDelayDays,
              critical: active.criticalPathImpact,
            })}
          </p>
          {active.affectedMilestoneLabels.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {t("simulation.milestonesAffected", {
                milestones: active.affectedMilestoneLabels.join(", "),
              })}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" aria-hidden />
              {t("simulation.riskDelta")}:
              <span className="font-semibold" style={{ color: RISK_COLORS[active.riskDelta] }}>
                {t(`detailPanel.risk.${active.riskDelta}`)}
              </span>
            </span>
            <span className="truncate text-[10px] text-muted-foreground" title={t("simulation.mitigation")}>
              {t("simulation.mitigation")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const LivingGraphSimulationPanel = memo(LivingGraphSimulationPanelComponent);
LivingGraphSimulationPanel.displayName = "LivingGraphSimulationPanel";
