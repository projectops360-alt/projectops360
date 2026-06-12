// ============================================================================
// ProjectOps360° — Living Graph centralized style mapping
// ============================================================================
// Single source of truth for node-type and edge-type visuals so components
// never hardcode colors. Hex values are used (instead of Tailwind classes)
// because React Flow edges/minimap require inline SVG colors.
// ============================================================================

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  GitBranch,
  MessageSquare,
  FileText,
  Flag,
  OctagonAlert,
  HardHat,
  DraftingCompass,
  Lightbulb,
} from "lucide-react";
import type {
  ProcessNodeType,
  ProcessEdgeType,
  ShortageRiskLevel,
} from "@/types/database";

// ── Node styles ────────────────────────────────────────────────────────────────

export interface NodeTypeStyle {
  icon: LucideIcon;
  /** Accent hex color (border, icon, minimap). */
  accent: string;
  /** Soft background hex with alpha for the icon chip. */
  soft: string;
}

export const NODE_TYPE_STYLES: Record<ProcessNodeType, NodeTypeStyle> = {
  task_transition: { icon: Activity, accent: "#3b82f6", soft: "rgba(59,130,246,0.14)" },
  decision_cascade: { icon: GitBranch, accent: "#a855f7", soft: "rgba(168,85,247,0.14)" },
  communication_flow: { icon: MessageSquare, accent: "#06b6d4", soft: "rgba(6,182,212,0.14)" },
  document_link: { icon: FileText, accent: "#10b981", soft: "rgba(16,185,129,0.14)" },
  milestone_gate: { icon: Flag, accent: "#f59e0b", soft: "rgba(245,158,11,0.14)" },
  blocker_event: { icon: OctagonAlert, accent: "#ef4444", soft: "rgba(239,68,68,0.14)" },
  labor_risk: { icon: HardHat, accent: "#f97316", soft: "rgba(249,115,22,0.14)" },
  drawing_event: { icon: DraftingCompass, accent: "#6366f1", soft: "rgba(99,102,241,0.14)" },
  drawing_insight: { icon: Lightbulb, accent: "#8b5cf6", soft: "rgba(139,92,246,0.14)" },
};

// ── Edge styles ────────────────────────────────────────────────────────────────

export interface EdgeTypeStyle {
  /** SVG stroke color. */
  stroke: string;
  strokeWidth: number;
  /** SVG dash pattern; undefined = solid. */
  dashArray?: string;
  /** Animate the dash flow (handoff-like edges). */
  animated: boolean;
  /** Render with extra curvature (feedback/rework loops). */
  curved: boolean;
}

export const EDGE_TYPE_STYLES: Record<ProcessEdgeType, EdgeTypeStyle> = {
  // dependency-like causal link: solid
  caused: { stroke: "#64748b", strokeWidth: 1.8, animated: false, curved: false },
  // enabling/sequence link: neutral solid
  enabled: { stroke: "#10b981", strokeWidth: 1.8, animated: false, curved: false },
  // blocking link: high-risk red
  blocked: { stroke: "#ef4444", strokeWidth: 2.4, animated: false, curved: false },
  // delay/rework signal: dashed + curved
  delayed: { stroke: "#f59e0b", strokeWidth: 2, dashArray: "6 4", animated: false, curved: true },
  // acceleration/handoff: animated directional flow
  accelerated: { stroke: "#06b6d4", strokeWidth: 2, dashArray: "8 4", animated: true, curved: false },
  // informational/evidence link: thin dotted
  informed: { stroke: "#94a3b8", strokeWidth: 1.2, dashArray: "2 4", animated: false, curved: false },
  // labor capacity shortage constraining downstream: orange dashed curved
  labor_constrained: { stroke: "#f97316", strokeWidth: 2, dashArray: "5 3", animated: false, curved: true },
  // drawing → AI insight: indigo dashed
  generated_insight: { stroke: "#6366f1", strokeWidth: 1.8, dashArray: "4 3", animated: false, curved: false },
  // insight → affected task/milestone: violet solid
  affects: { stroke: "#8b5cf6", strokeWidth: 2, animated: false, curved: false },
};

// ── Shared semantic colors ─────────────────────────────────────────────────────

export const GRAPH_SEMANTIC_COLORS = {
  critical: "#f43f5e",
  bottleneck: "#f97316",
  rework: "#f59e0b",
  traceabilityGap: "#eab308",
  risk: "#dc2626",
  sopCandidate: "#22c55e",
  blocked: "#ef4444",
  completed: "#10b981",
  active: "#3b82f6",
  dimmed: "#475569",
  searchHit: "#8b5cf6",
  simulationImpact: "#f97316",
  laborCapacity: "#f97316",
} as const;

export const RISK_COLORS: Record<"low" | "medium" | "high", string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};

/** 5-level shortage risk colors for labor capacity indicators. */
export const SHORTAGE_RISK_COLORS: Record<ShortageRiskLevel, string> = {
  none: "#10b981",
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#dc2626",
};

/** Minimap color resolver. */
export function minimapNodeColor(nodeType: ProcessNodeType): string {
  return NODE_TYPE_STYLES[nodeType]?.accent ?? GRAPH_SEMANTIC_COLORS.dimmed;
}

/** Convert a #rrggbb hex color to an rgba() string with the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
