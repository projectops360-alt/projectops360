"use client";

import type { CSSProperties } from "react";
import type {
  Milestone,
  MilestoneStatus,
  RoadmapTask,
  TaskStatus,
  TaskPriority,
  Locale,
} from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import {
  Circle,
  Settings,
  Shield,
  Users,
  BookOpen,
  Link2,
  Sparkles,
  BarChart3,
  RotateCcw,
  CheckCircle,
  Rocket,
  Activity,
  AlertTriangle,
  ListChecks,
  Zap,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskCount {
  total: number;
  done: number;
  inProgress: number;
}

export interface FlowRoadmapTranslations {
  statusLabels: Record<MilestoneStatus | TaskStatus, string>;
  priorityLabels: Record<TaskPriority, string>;
  // Panel
  liveProcessFlow: string;
  conformance: string;
  currentPhase: string;
  tasks: string;
  noTasks: string;
  reworkNeeded: string; // "{count} blocked tasks — rework needed"
  // KPI
  kpiMilestonesCompleted: string;
  kpiOverallProgress: string;
  kpiTasksCompleted: string;
  kpiInProgress: string;
  kpiBlockers: string;
  kpiRemainingEffort: string;
  kpiOfTotal: string; // "of {total}"
  kpiNoBlockers: string;
  kpiTracked: string; // "tracked tasks"
  // Insights
  milestoneDistribution: string;
  conformanceCheck: string;
  taskByPriority: string;
  blockersRecommendations: string;
  noBlockers: string;
  completed: string;
  inProgress: string;
  planned: string;
  blocked: string;
  unblockSuggestion: string; // "Prioritize unblocking to restore flow"
  // Legend
  legend: string;
  legendActiveFlow: string;
  legendPendingPath: string;
}

interface FlowRoadmapProps {
  milestones: Milestone[];
  tasks: RoadmapTask[];
  progress: RoadmapProgress;
  tasksByMilestone: Record<string, RoadmapTask[]>;
  taskCounts: Record<string, TaskCount>;
  locale: Locale;
  translations: FlowRoadmapTranslations;
}

// ── Icon map for icon_key (reused from timeline) ─────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  setup: <Settings className="h-[18px] w-[18px]" />,
  shield_database: <Shield className="h-[18px] w-[18px]" />,
  users: <Users className="h-[18px] w-[18px]" />,
  notebook: <BookOpen className="h-[18px] w-[18px]" />,
  link: <Link2 className="h-[18px] w-[18px]" />,
  sparkles: <Sparkles className="h-[18px] w-[18px]" />,
  chart: <BarChart3 className="h-[18px] w-[18px]" />,
  loop: <RotateCcw className="h-[18px] w-[18px]" />,
  check_circle: <CheckCircle className="h-[18px] w-[18px]" />,
  rocket: <Rocket className="h-[18px] w-[18px]" />,
};

// ── Forced-dark palette for the flow canvas (theme-independent) ───────────────────

const C = {
  green: "#34d399", // brand-400 — completed
  blue: "#818cf8", // indigo — in_progress
  amber: "#fbbf24", // deferred / warning
  red: "#f87171", // blocked
  gray: "#334155", // planned / inactive
  greenDim: "rgba(52,211,153,0.12)",
  blueDim: "rgba(129,140,248,0.14)",
  amberDim: "rgba(251,191,36,0.12)",
  redDim: "rgba(248,113,113,0.12)",
  grayDim: "rgba(71,85,105,0.14)",
  text: "#e2e8f0",
  text2: "#94a3b8",
  text3: "#64748b",
  surface: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  nodeBg: "rgba(255,255,255,0.04)",
};

type Health = "completed" | "active" | "warning" | "blocked" | "inactive";

function nodeHealth(status: MilestoneStatus): Health {
  switch (status) {
    case "completed":
      return "completed";
    case "in_progress":
      return "active";
    case "blocked":
      return "blocked";
    case "deferred":
      return "warning";
    default:
      return "inactive";
  }
}

const HEALTH_COLOR: Record<Health, string> = {
  completed: C.green,
  active: C.blue,
  warning: C.amber,
  blocked: C.red,
  inactive: C.gray,
};

const HEALTH_DIM: Record<Health, string> = {
  completed: C.greenDim,
  active: C.blueDim,
  warning: C.amberDim,
  blocked: C.redDim,
  inactive: C.grayDim,
};

// Edge health derived from the two endpoint milestones.
type EdgeHealth = "healthy" | "active" | "warning" | "critical" | "inactive";

function edgeHealth(a: Milestone, b: Milestone): EdgeHealth {
  if (a.status === "blocked" || b.status === "blocked") return "critical";
  if (a.status === "completed" && b.status === "completed") return "healthy";
  if (a.status === "in_progress" || b.status === "in_progress") return "active";
  if (a.status === "deferred" || b.status === "deferred") return "warning";
  return "inactive";
}

function edgeStyle(h: EdgeHealth): {
  stroke: string;
  particle: string | null;
  dash: boolean;
  dur: number;
} {
  switch (h) {
    case "healthy":
      return { stroke: C.green, particle: C.green, dash: false, dur: 1.6 };
    case "active":
      return { stroke: C.blue, particle: C.green, dash: false, dur: 1.5 };
    case "warning":
      return { stroke: C.amber, particle: C.amber, dash: false, dur: 2 };
    case "critical":
      return { stroke: C.red, particle: C.red, dash: false, dur: 2.5 };
    default:
      return { stroke: C.gray, particle: null, dash: true, dur: 0 };
  }
}

// ── Geometry constants ───────────────────────────────────────────────────────────

const W_NODE = 158;
const H_NODE = 156; // approximate, used for edge/curve math
const MARGIN_X = 30;
const COL_GAP = 300;
const PER_ROW = 5;
const ROW_TOP = 72;
const ROW_GAP = 292;
const EDGE_OFFSET = 60;

// ── Helpers ──────────────────────────────────────────────────────────────────────

function formatDate(date: string | null, locale: Locale): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function durationDays(m: Milestone): number | null {
  if (!m.start_date || !m.target_date) return null;
  const d = Math.round(
    (new Date(m.target_date).getTime() - new Date(m.start_date).getTime()) / 86_400_000,
  );
  return d >= 0 ? d : null;
}

// ── Circular progress ring ───────────────────────────────────────────────────────

function Ring({
  pct,
  size = 42,
  stroke = 4,
  color,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          fontWeight: 800,
          color: "#fff",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────────

export function FlowRoadmap({
  milestones,
  tasks,
  progress,
  tasksByMilestone,
  taskCounts,
  locale,
  translations: t,
}: FlowRoadmapProps) {
  const total = milestones.length;

  // ── Layout geometry ──
  const column = (i: number): number => {
    const row = Math.floor(i / PER_ROW);
    const pos = i % PER_ROW;
    return row % 2 === 0 ? pos : PER_ROW - 1 - pos;
  };
  const xOf = (i: number) => MARGIN_X + column(i) * COL_GAP;
  const yOf = (i: number) => ROW_TOP + Math.floor(i / PER_ROW) * ROW_GAP;

  const maxCol = total <= PER_ROW ? total - 1 : PER_ROW - 1;
  const rows = Math.ceil(total / PER_ROW);
  const canvasW = MARGIN_X * 2 + maxCol * COL_GAP + W_NODE;
  const canvasH = ROW_TOP + (rows - 1) * ROW_GAP + H_NODE + 40;

  // ── Edges between consecutive milestones ──
  interface Edge {
    id: string;
    d: string;
    health: EdgeHealth;
    labelStyle: CSSProperties;
    target: Milestone;
  }
  const edges: Edge[] = [];
  for (let i = 0; i < total - 1; i++) {
    const a = milestones[i];
    const b = milestones[i + 1];
    const rowA = Math.floor(i / PER_ROW);
    const rowB = Math.floor((i + 1) / PER_ROW);
    const health = edgeHealth(a, b);
    const id = `floedge-${i}`;
    let d: string;
    let labelStyle: CSSProperties;

    if (rowA === rowB) {
      const ltr = rowA % 2 === 0;
      const ey = yOf(i) + EDGE_OFFSET;
      const sx = ltr ? xOf(i) + W_NODE : xOf(i);
      const ex = ltr ? xOf(i + 1) : xOf(i + 1) + W_NODE;
      const c1 = sx + (ex - sx) * 0.4;
      const c2 = sx + (ex - sx) * 0.6;
      d = `M ${sx} ${ey} C ${c1} ${ey}, ${c2} ${ey}, ${ex} ${ey}`;
      const midX = (sx + ex) / 2;
      const above = rowA % 2 === 0;
      labelStyle = { left: midX - 62, top: above ? ey - 82 : ey + 26 };
    } else {
      // Vertical serpentine transition (same column)
      const cx = xOf(i) + W_NODE / 2;
      const sy = yOf(i) + H_NODE;
      const ey = yOf(i + 1);
      const bulge = cx + 62;
      d = `M ${cx} ${sy} C ${bulge} ${sy + (ey - sy) * 0.35}, ${bulge} ${ey - (ey - sy) * 0.35}, ${cx} ${ey}`;
      labelStyle = { left: cx + 36, top: (sy + ey) / 2 - 28 };
    }
    edges.push({ id, d, health, labelStyle, target: b });
  }

  // ── Rework arcs for blocked milestones (same-row previous neighbor) ──
  interface ReworkArc {
    id: string;
    d: string;
    labelStyle: CSSProperties;
    count: number;
  }
  const reworkArcs: ReworkArc[] = [];
  milestones.forEach((m, i) => {
    const mTasks = tasksByMilestone[m.id] ?? [];
    const blockedTasks = mTasks.filter((tk) => tk.status === "blocked").length;
    const isBlocked = m.status === "blocked" || blockedTasks > 0;
    if (!isBlocked || i === 0) return;
    const prevRow = Math.floor((i - 1) / PER_ROW);
    const curRow = Math.floor(i / PER_ROW);
    if (prevRow !== curRow) return; // keep arc math simple — same row only
    const cxCur = xOf(i) + W_NODE / 2;
    const cxPrev = xOf(i - 1) + W_NODE / 2;
    const topY = yOf(i) - 6;
    const arcTop = topY - 64;
    const d = `M ${cxCur} ${topY} C ${cxCur} ${arcTop}, ${cxPrev} ${arcTop}, ${cxPrev} ${topY}`;
    reworkArcs.push({
      id: `florework-${i}`,
      d,
      labelStyle: { left: Math.min(cxCur, cxPrev) - 10, top: arcTop - 18 },
      count: blockedTasks || 1,
    });
  });

  // ── KPI values ──
  const completedMilestones = milestones.filter((m) => m.status === "completed").length;
  const doneTasks = tasks.filter((tk) => tk.status === "done").length;
  const inProgressTasks = tasks.filter((tk) => tk.status === "in_progress").length;
  const remainingEffort = tasks
    .filter((tk) => tk.status !== "done")
    .reduce((sum, tk) => sum + (tk.estimate_hours ?? 0), 0);

  // ── Insights: milestone distribution (ranked by progress) ──
  const ranked = [...milestones].sort(
    (a, b) =>
      (progress.milestones[b.id]?.progressPercent ?? b.progress_percent) -
      (progress.milestones[a.id]?.progressPercent ?? a.progress_percent),
  );

  // ── Insights: status distribution ──
  const statusCounts: Record<Health, number> = {
    completed: 0,
    active: 0,
    warning: 0,
    blocked: 0,
    inactive: 0,
  };
  milestones.forEach((m) => {
    statusCounts[nodeHealth(m.status)]++;
  });
  const pctOf = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // ── Insights: priority distribution ──
  const priorityCounts: Record<TaskPriority, number> = { p1: 0, p2: 0, p3: 0 };
  tasks.forEach((tk) => {
    priorityCounts[tk.priority]++;
  });
  const totalTasks = tasks.length;
  const priorityColor: Record<TaskPriority, string> = { p1: C.red, p2: C.amber, p3: C.green };

  // ── Insights: blockers ──
  const blockedMilestones = milestones.filter((m) => {
    const mTasks = tasksByMilestone[m.id] ?? [];
    return m.status === "blocked" || mTasks.some((tk) => tk.status === "blocked");
  });

  const conformancePct = progress.overallPercent;

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes floPulseRed { 0%,100% { box-shadow: 0 0 20px rgba(248,113,113,0.10); } 50% { box-shadow: 0 0 32px rgba(248,113,113,0.22); } }
        @keyframes floBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .flo-node-glass { transition: transform .3s ease, background .3s ease, box-shadow .3s ease; }
        .flo-node-glass:hover { transform: translateY(-3px); background: rgba(255,255,255,0.07); box-shadow: 0 12px 36px rgba(0,0,0,0.35); }
        .flo-edge-label { transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
        .flo-edge-label:hover { transform: scale(1.06); border-color: rgba(129,140,248,0.45); box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
        .flo-scroll::-webkit-scrollbar { height: 6px; }
        .flo-scroll::-webkit-scrollbar-track { background: transparent; }
        .flo-scroll::-webkit-scrollbar-thumb { background: rgba(129,140,248,0.3); border-radius: 3px; }
      `}</style>

      {/* ── KPI Bar ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          color={C.green}
          label={t.kpiMilestonesCompleted}
          value={String(completedMilestones)}
          sub={t.kpiOfTotal.replace("{total}", String(total))}
        />
        <KpiCard color={C.blue} label={t.kpiOverallProgress} value={`${progress.overallPercent}%`} sub={t.conformance} />
        <KpiCard
          color="#a78bfa"
          label={t.kpiTasksCompleted}
          value={String(doneTasks)}
          sub={t.kpiTracked.replace("{total}", String(totalTasks))}
        />
        <KpiCard color={C.green} label={t.kpiInProgress} value={String(inProgressTasks)} sub={t.tasks} />
        <KpiCard
          color={progress.blockersCount > 0 ? C.red : C.amber}
          label={t.kpiBlockers}
          value={String(progress.blockersCount)}
          sub={progress.blockersCount > 0 ? t.kpiBlockers : t.kpiNoBlockers}
        />
        <KpiCard color="#a78bfa" label={t.kpiRemainingEffort} value={`${remainingEffort}h`} sub={t.tasks} />
      </div>

      {/* ── Main grid: flow canvas + insights ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Flow panel (forced dark) */}
        <div
          className="overflow-hidden rounded-2xl border p-5"
          style={{
            background: "#06080f",
            borderColor: C.border,
            backgroundImage:
              "radial-gradient(ellipse at 20% 15%, rgba(129,140,248,0.06) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(52,211,153,0.05) 0%, transparent 55%)",
          }}
        >
          {/* Panel header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "#fff" }}>
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: C.green, animation: "floBlink 2s infinite" }}
              />
              {t.liveProcessFlow}
            </div>
            <div
              className="rounded-md px-3 py-1 text-[10px] font-semibold"
              style={{ background: C.greenDim, color: C.green }}
            >
              {conformancePctLabel(conformancePct, t.conformance)}
            </div>
          </div>

          {/* Scrollable canvas */}
          <div className="flo-scroll overflow-x-auto pb-5">
            <div style={{ position: "relative", minWidth: canvasW, height: canvasH }}>
              {/* SVG layer */}
              <svg
                viewBox={`0 0 ${canvasW} ${canvasH}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
              >
                {edges.map((e) => {
                  const s = edgeStyle(e.health);
                  return (
                    <g key={e.id}>
                      {s.particle && (
                        <path d={e.d} fill="none" stroke={s.stroke} strokeWidth={8} style={{ opacity: 0.07, filter: "blur(4px)" }} />
                      )}
                      <path
                        id={e.id}
                        d={e.d}
                        fill="none"
                        stroke={s.stroke}
                        strokeWidth={2.5}
                        strokeDasharray={s.dash ? "8 6" : undefined}
                        style={{ opacity: s.dash ? 0.3 : 0.55 }}
                      />
                      {s.particle && (
                        <>
                          <circle r={3} fill={s.particle} style={{ filter: `drop-shadow(0 0 3px ${s.particle})` }}>
                            <animateMotion dur={`${s.dur}s`} repeatCount="indefinite">
                              <mpath href={`#${e.id}`} />
                            </animateMotion>
                          </circle>
                          {(e.health === "healthy" || e.health === "critical") && (
                            <circle r={2} fill={s.particle} opacity={0.4} style={{ filter: `drop-shadow(0 0 3px ${s.particle})` }}>
                              <animateMotion dur={`${s.dur}s`} repeatCount="indefinite" begin={`${s.dur / 2}s`}>
                                <mpath href={`#${e.id}`} />
                              </animateMotion>
                            </circle>
                          )}
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Rework arcs */}
                {reworkArcs.map((a) => (
                  <g key={a.id}>
                    <path
                      id={a.id}
                      d={a.d}
                      fill="none"
                      stroke={C.amber}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      style={{ opacity: 0.5 }}
                    />
                    <circle r={2} fill={C.amber} style={{ filter: `drop-shadow(0 0 3px ${C.amber})` }}>
                      <animateMotion dur="3s" repeatCount="indefinite">
                        <mpath href={`#${a.id}`} />
                      </animateMotion>
                    </circle>
                  </g>
                ))}
              </svg>

              {/* Transition labels */}
              {edges.map((e) => {
                const counts = taskCounts[e.target.id] ?? { total: 0, done: 0, inProgress: 0 };
                const days = durationDays(e.target);
                const tColor =
                  e.health === "critical" ? C.red : e.health === "warning" ? C.amber : e.health === "active" ? C.blue : e.health === "healthy" ? C.green : C.text3;
                const desc = e.target.description?.trim() || t.statusLabels[e.target.status];
                return (
                  <div
                    key={`lbl-${e.id}`}
                    className="flo-edge-label absolute"
                    style={{
                      ...e.labelStyle,
                      zIndex: 20,
                      minWidth: 96,
                      maxWidth: 140,
                      background: "rgba(6,8,15,0.9)",
                      backdropFilter: "blur(12px)",
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: "6px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1, color: tColor }}>
                      {counts.total} {t.tasks.toLowerCase()}
                    </div>
                    {days != null && <div style={{ fontSize: 9, color: C.text3, marginTop: 3 }}>{days}d</div>}
                    <div style={{ fontSize: 9, color: C.text2, marginTop: 3, lineHeight: 1.3 }} className="line-clamp-2">
                      {desc}
                    </div>
                  </div>
                );
              })}

              {/* Rework labels */}
              {reworkArcs.map((a) => (
                <div
                  key={`rwlbl-${a.id}`}
                  className="absolute whitespace-nowrap"
                  style={{
                    ...a.labelStyle,
                    zIndex: 25,
                    background: "rgba(251,191,36,0.1)",
                    border: "1px solid rgba(251,191,36,0.25)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 9,
                    fontWeight: 700,
                    color: C.amber,
                  }}
                >
                  ↺ {t.reworkNeeded.replace("{count}", String(a.count))}
                </div>
              ))}

              {/* Milestone nodes */}
              {milestones.map((m, i) => {
                const h = nodeHealth(m.status);
                const color = HEALTH_COLOR[h];
                const dim = HEALTH_DIM[h];
                const counts = taskCounts[m.id] ?? { total: 0, done: 0, inProgress: 0 };
                const pct = progress.milestones[m.id]?.progressPercent ?? m.progress_percent;
                const icon = ICON_MAP[m.icon_key ?? ""] ?? <Circle className="h-[18px] w-[18px]" />;
                const startD = formatDate(m.start_date, locale);
                const targetD = formatDate(m.target_date, locale);
                const isBlocked = m.status === "blocked";
                const isCurrent = m.status === "in_progress";
                const dotBlink = isBlocked || isCurrent;

                return (
                  <div key={m.id} style={{ position: "absolute", left: xOf(i), top: yOf(i), width: W_NODE, zIndex: 10 }}>
                    {/* CURRENT PHASE label */}
                    {isCurrent && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider"
                        style={{ top: -22, background: C.blue, color: "#fff", letterSpacing: "1px" }}
                      >
                        {t.currentPhase}
                      </div>
                    )}
                    <div
                      className="flo-node-glass relative cursor-default rounded-2xl px-3.5 pb-3.5 pt-4 text-center"
                      style={{
                        background: C.nodeBg,
                        backdropFilter: "blur(24px)",
                        border: `1px solid ${C.border}`,
                        borderTop: `3px solid ${color}`,
                        animation: isBlocked ? "floPulseRed 3s ease-in-out infinite" : undefined,
                      }}
                    >
                      {/* Bottleneck tag */}
                      {isBlocked && (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded text-[7px] font-extrabold uppercase tracking-wider"
                          style={{ top: -11, background: C.red, color: "#fff", padding: "2px 8px", letterSpacing: "1.5px" }}
                        >
                          {t.blocked}
                        </div>
                      )}

                      {/* Status dot */}
                      <span
                        className="absolute h-2 w-2 rounded-full"
                        style={{
                          top: 10,
                          right: 10,
                          background: color,
                          boxShadow: `0 0 6px ${color}`,
                          animation: dotBlink ? "floBlink 1.5s infinite" : undefined,
                        }}
                      />

                      {/* Icon */}
                      <div
                        className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: dim, color }}
                      >
                        {icon}
                      </div>

                      {/* Title */}
                      <div className="mb-0.5 text-[12px] font-bold leading-tight" style={{ color: h === "inactive" ? C.text3 : "#f1f5f9" }}>
                        {m.title}
                      </div>

                      {/* Date range */}
                      <div className="mb-2 text-[9px] uppercase tracking-wide" style={{ color: C.text3, letterSpacing: "0.5px" }}>
                        {startD || targetD ? `${startD}${startD && targetD ? " → " : ""}${targetD}` : t.statusLabels[m.status]}
                      </div>

                      {/* Metrics: progress ring + task count */}
                      <div className="flex items-center justify-center gap-3">
                        <Ring pct={pct} color={color} />
                        <div
                          className="rounded-md px-2 py-1 text-center"
                          style={{ background: "rgba(0,0,0,0.25)" }}
                        >
                          <div className="text-[11px] font-extrabold" style={{ color }}>
                            {counts.done}/{counts.total}
                          </div>
                          <div className="mt-0.5 text-[7px] uppercase tracking-wide" style={{ color: C.text3 }}>
                            {t.tasks}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3" style={{ borderColor: C.border }}>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.text3 }}>
              {t.legend}
            </span>
            <LegendDot color={C.green} label={t.completed} />
            <LegendDot color={C.blue} label={t.inProgress} />
            <LegendDot color={C.gray} label={t.planned} />
            <LegendDot color={C.red} label={t.blocked} />
            <LegendLine color={C.green} label={t.legendActiveFlow} />
            <LegendLine color={C.gray} dashed label={t.legendPendingPath} />
          </div>
        </div>

        {/* ── Insights panel (respects theme, hidden < lg) ── */}
        <div className="hidden flex-col gap-3 lg:flex">
          {/* Milestone distribution */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <ListChecks className="h-3.5 w-3.5 text-brand-500" />
                {t.milestoneDistribution}
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {ranked.slice(0, 6).map((m, idx) => {
                const pct = progress.milestones[m.id]?.progressPercent ?? m.progress_percent;
                const color = HEALTH_COLOR[nodeHealth(m.status)];
                return (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-extrabold text-white"
                      style={{ background: color }}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-medium text-foreground">{m.title}</span>
                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conformance ring */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Activity className="h-3.5 w-3.5 text-brand-500" />
                {t.conformanceCheck}
              </h3>
              <span className="rounded px-2 py-0.5 text-[9px] font-semibold" style={{ background: C.greenDim, color: C.green }}>
                {conformancePct}%
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Ring pct={conformancePct} size={70} stroke={6} color={C.green} />
              <div className="flex-1 space-y-1">
                <ConfRow label={t.completed} value={`${pctOf(statusCounts.completed)}%`} color={C.green} />
                <ConfRow label={t.inProgress} value={`${pctOf(statusCounts.active)}%`} color={C.blue} />
                <ConfRow label={t.planned} value={`${pctOf(statusCounts.inactive)}%`} color={C.text2} />
                <ConfRow label={t.blocked} value={`${pctOf(statusCounts.blocked)}%`} color={C.red} />
              </div>
            </div>
          </div>

          {/* Task distribution by priority */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-brand-500" />
                {t.taskByPriority}
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {(["p1", "p2", "p3"] as TaskPriority[]).map((p) => {
                const count = priorityCounts[p];
                const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                return (
                  <div key={p} className="flex items-center gap-2.5">
                    <span className="w-20 shrink-0 truncate text-[10px] font-medium text-muted-foreground">{t.priorityLabels[p]}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: priorityColor[p] }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blockers & recommendations */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-brand-500" />
                {t.blockersRecommendations}
              </h3>
              {blockedMilestones.length > 0 && (
                <span className="rounded px-2 py-0.5 text-[9px] font-semibold" style={{ background: C.redDim, color: C.red }}>
                  {blockedMilestones.length}
                </span>
              )}
            </div>
            {blockedMilestones.length > 0 ? (
              <div className="flex flex-col gap-2">
                {blockedMilestones.map((m) => {
                  const mTasks = tasksByMilestone[m.id] ?? [];
                  const blockedCount = mTasks.filter((tk) => tk.status === "blocked").length;
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border-l-[3px] bg-muted/40 px-3 py-2"
                      style={{ borderLeftColor: C.red }}
                    >
                      <div className="text-[11px] font-semibold text-foreground">{m.title}</div>
                      <div className="mt-0.5 text-[9px] text-muted-foreground">
                        {blockedCount > 0
                          ? t.reworkNeeded.replace("{count}", String(blockedCount))
                          : t.statusLabels.blocked}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[9px] font-medium" style={{ color: C.amber }}>
                        <Zap className="h-2.5 w-2.5" />
                        {t.unblockSuggestion}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] italic text-muted-foreground">{t.noBlockers}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────────

function conformancePctLabel(pct: number, label: string): string {
  return `${pct}% ${label}`;
}

function KpiCard({ color, label, value, sub }: { color: string; label: string; value: string; sub: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4">
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[28px] font-extrabold leading-none text-foreground tabular-nums">{value}</div>
      <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function ConfRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px]" style={{ color: C.text2 }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px]" style={{ color: C.text2 }}>
      <span
        className="inline-block h-0.5 w-5"
        style={{
          background: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
          opacity: dashed ? 0.6 : 0.8,
        }}
      />
      {label}
    </span>
  );
}
