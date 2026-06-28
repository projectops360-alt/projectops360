"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Columns3,
  Share2,
  Ruler,
  CalendarClock,
  ShieldAlert,
  GitFork,
  BookOpen,
  FileBarChart,
  TrendingUp,
  Settings,
  FolderKanban,
  Workflow,
  SlidersHorizontal,
  Maximize2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// AnimatedHeroGraph — premium, real HTML/CSS/SVG/React Living Graph preview.
// NOT a static screenshot. Nodes float subtly (requestAnimationFrame), SVG
// edges flow with a dashed stroke, particles travel the paths, at-risk nodes
// pulse softly. Honors prefers-reduced-motion (renders a calm static graph).
// Coordinate "stage" is native 912×350 and scaled to fit the container.
// ============================================================================

type Variant = "done" | "progress" | "risk" | "pending";
type EdgeType = "green" | "blue" | "risk" | "";

interface NodeDef {
  id: string;
  left: number;
  top: number;
  variant: Variant;
  chip: "milestone" | "phase";
  pct: string; // literal "100%" or "" (uses pending label)
}

const STAGE_W = 912;
const STAGE_H = 350;
const NODE_W = 142;
const NODE_H = 66;

const NODES: NodeDef[] = [
  { id: "start", left: 24, top: 58, variant: "done", chip: "milestone", pct: "100%" },
  { id: "req", left: 194, top: 44, variant: "done", chip: "phase", pct: "100%" },
  { id: "design", left: 364, top: 76, variant: "progress", chip: "phase", pct: "85%" },
  { id: "config", left: 548, top: 38, variant: "risk", chip: "phase", pct: "60%" },
  { id: "integrations", left: 548, top: 154, variant: "risk", chip: "phase", pct: "40%" },
  { id: "training", left: 330, top: 216, variant: "pending", chip: "phase", pct: "" },
  { id: "deploy", left: 552, top: 258, variant: "pending", chip: "milestone", pct: "" },
  { id: "golive", left: 770, top: 168, variant: "pending", chip: "milestone", pct: "" },
];

const CONNECTIONS: [string, string, EdgeType][] = [
  ["start", "req", "green"],
  ["req", "design", "green"],
  ["design", "config", "blue"],
  ["design", "integrations", "risk"],
  ["design", "training", ""],
  ["config", "golive", "risk"],
  ["integrations", "deploy", "risk"],
  ["training", "deploy", ""],
  ["deploy", "golive", ""],
];

const SIDEBAR: { key: string; Icon: LucideIcon; active?: boolean }[] = [
  { key: "workboard", Icon: Columns3 },
  { key: "livingGraph", Icon: Workflow, active: true },
  { key: "projects", Icon: FolderKanban },
  { key: "schedule", Icon: CalendarClock },
  { key: "risks", Icon: ShieldAlert },
  { key: "decisions", Icon: GitFork },
  { key: "memory", Icon: BookOpen },
  { key: "bim", Icon: Ruler },
  { key: "reports", Icon: FileBarChart },
  { key: "analytics", Icon: TrendingUp },
  { key: "settings", Icon: Settings },
];

function dotColor(v: Variant) {
  return v === "risk" ? "#e95454" : v === "pending" ? "#9aa6a0" : "#007a4d";
}
function pctColor(v: Variant) {
  return v === "risk" ? "#e95454" : v === "pending" ? "#7b8782" : "#007a4d";
}

export function AnimatedHeroGraph() {
  const { t } = useTranslation();

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pathRefs = useRef<Record<number, SVGPathElement | null>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Static geometry helpers ------------------------------------------------
    const base: Record<string, { left: number; top: number; ampX: number; ampY: number; speed: number; phase: number }> = {};
    const pos: Record<string, { x: number; y: number }> = {};
    NODES.forEach((n, i) => {
      base[n.id] = {
        left: n.left,
        top: n.top,
        ampX: 4 + (i % 3) * 2.25,
        ampY: 3 + (i % 4) * 1.6,
        speed: 0.00065 + (i % 4) * 0.00008,
        phase: i * 0.84,
      };
      pos[n.id] = { x: n.left, y: n.top };
    });

    const centerOf = (id: string) => ({
      x: pos[id].x + NODE_W / 2,
      y: pos[id].y + NODE_H / 2,
    });
    const makePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = b.x - a.x;
      return `M ${a.x} ${a.y} C ${a.x + dx * 0.42} ${a.y}, ${a.x + dx * 0.58} ${b.y}, ${b.x} ${b.y}`;
    };

    const drawEdges = () => {
      CONNECTIONS.forEach(([from, to], i) => {
        const p = pathRefs.current[i];
        if (p) p.setAttribute("d", makePath(centerOf(from), centerOf(to)));
      });
    };

    const placeAlert = () => {
      const c = centerOf("integrations");
      if (alertRef.current) {
        alertRef.current.style.left = `${c.x - 14}px`;
        alertRef.current.style.top = `${c.y + 30}px`;
      }
    };

    // Responsive scaling -----------------------------------------------------
    const applyScale = () => {
      const card = cardRef.current;
      const stage = stageRef.current;
      if (!card || !stage) return;
      const w = card.clientWidth;
      const s = Math.min(1.12, Math.max(0.6, w / STAGE_W));
      stage.style.transform = `scale(${s})`;
      card.style.height = `${Math.round(STAGE_H * s)}px`;
    };

    applyScale();
    drawEdges();
    placeAlert();

    let ro: ResizeObserver | null = null;
    if (cardRef.current && "ResizeObserver" in window) {
      ro = new ResizeObserver(() => applyScale());
      ro.observe(cardRef.current);
    } else {
      window.addEventListener("resize", applyScale);
    }

    if (reduce) {
      // Calm static graph — no rAF, no floating, particles already paused by CSS.
      return () => {
        ro?.disconnect();
        window.removeEventListener("resize", applyScale);
      };
    }

    const animate = (time: number) => {
      for (const n of NODES) {
        const b = base[n.id];
        const x = b.left + Math.sin(time * b.speed + b.phase) * b.ampX;
        const y = b.top + Math.cos(time * (b.speed * 1.18) + b.phase) * b.ampY;
        pos[n.id] = { x, y };
        const el = nodeRefs.current[n.id];
        if (el) el.style.transform = `translate3d(${x - b.left}px, ${y - b.top}px, 0)`;
      }
      drawEdges();
      placeAlert();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      window.removeEventListener("resize", applyScale);
    };
  }, []);

  return (
    <div
      className="mx-auto w-full max-w-[1080px] overflow-hidden rounded-[22px] border border-[#dfe7df] bg-white text-left"
      style={{ boxShadow: "0 40px 90px -34px rgba(6,78,59,0.34)" }}
      aria-label="ProjectOps360 Living Graph preview"
    >
      {/* window bar */}
      <div className="flex h-[38px] items-center gap-2 border-b border-[#edf0ec] bg-gradient-to-b from-white to-[#f8faf7] px-4">
        <span className="h-[11px] w-[11px] rounded-full bg-[#ff645d]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#ffc043]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#32c26c]" />
        <span className="ml-2.5 hidden text-[12px] font-bold text-[#98a29d] sm:inline">{t("heroGraph.window")}</span>
      </div>

      <div className="grid min-h-[510px] grid-cols-1 bg-[#fbfcfb] md:grid-cols-[190px_1fr]">
        {/* sidebar */}
        <aside className="hidden flex-col gap-1.5 border-r border-[#e9eee8] bg-white p-[13px] md:flex">
          <div className="flex items-center gap-2 px-2 pb-3.5 pt-1.5 text-[13px] font-extrabold tracking-[-0.03em]">
            <span className="grid h-[22px] w-[22px] place-items-center rounded-lg bg-[#007a4d] text-[12px] font-black text-white">P</span>
            ProjectOps 360°
          </div>
          {SIDEBAR.map(({ key, Icon, active }) => (
            <div
              key={key}
              className={`flex min-h-[34px] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-bold ${
                active ? "bg-[#e7f5ee] text-[#064e3b]" : "text-[#35413c]"
              }`}
            >
              <Icon size={15} strokeWidth={1.9} className="opacity-90" />
              {t(`heroGraph.sidebar.${key}`)}
            </div>
          ))}
          <div className="mt-auto flex items-center gap-2.5 border-t border-[#eef2ee] px-2 pb-1 pt-4">
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-gradient-to-br from-[#0f7c54] to-[#cceadc] text-[12px] font-black text-white">EP</span>
            <div>
              <strong className="block text-[12px]">{t("heroGraph.user.name")}</strong>
              <small className="text-[11px] text-[#5f6b66]">{t("heroGraph.user.role")}</small>
            </div>
          </div>
        </aside>

        {/* workspace */}
        <section
          className="relative overflow-hidden px-[22px] pb-[22px] pt-5"
          style={{
            background:
              "radial-gradient(circle at 18px 18px, rgba(6,78,59,0.07) 1px, transparent 1.4px) 0 0 / 22px 22px, #fbfcfb",
          }}
        >
          {/* header */}
          <div className="mb-[18px] flex items-start justify-between gap-4">
            <div>
              <h3 className="lp-display m-0 text-[21px] font-bold tracking-[-0.04em] text-[#07130f]">{t("heroGraph.title")}</h3>
              <p className="mt-1 text-[12px] font-semibold text-[#5f6b66]">{t("heroGraph.subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[#c8ead8] bg-[#f0fbf5] px-[11px] text-[12px] font-extrabold text-[#064e3b]">
                <span className="lp-live-dot h-[7px] w-[7px] rounded-full bg-[#007a4d]" />
                {t("heroGraph.live")}
              </span>
              <span className="hidden h-8 items-center gap-1.5 rounded-[9px] border border-[#e1e7df] bg-white px-[11px] text-[12px] font-extrabold text-[#2a3731] sm:inline-flex">
                <Share2 size={13} strokeWidth={2} /> {t("heroGraph.share")}
              </span>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[#007a4d] bg-[#007a4d] px-[11px] text-[12px] font-extrabold text-white">
                {t("heroGraph.saveView")}
              </span>
            </div>
          </div>

          {/* toolbar */}
          <div className="mb-3.5 flex flex-wrap gap-3">
            <div className="flex h-[42px] min-w-[168px] items-center justify-between rounded-xl border border-[#e3eae2] bg-white px-3 text-[12px] font-extrabold text-[#26322d]">
              {t("heroGraph.toolbar.project")} <ChevronDown size={14} className="text-[#9aa6a0]" />
            </div>
            <div className="hidden h-[42px] min-w-[150px] items-center justify-between rounded-xl border border-[#e3eae2] bg-white px-3 text-[12px] font-extrabold text-[#26322d] sm:flex">
              {t("heroGraph.toolbar.view")} <ChevronDown size={14} className="text-[#9aa6a0]" />
            </div>
            <div className="inline-flex h-[42px] items-center gap-2 rounded-xl border border-[#e3eae2] bg-white px-3.5 text-[12px] font-extrabold text-[#26322d]">
              <SlidersHorizontal size={14} /> {t("heroGraph.toolbar.filters")}
            </div>
            <div className="hidden h-[42px] w-[42px] items-center justify-center rounded-xl border border-[#e3eae2] bg-white text-[#26322d] sm:flex">
              <Maximize2 size={14} />
            </div>
          </div>

          {/* graph card */}
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-[18px] border border-[#e2e9e2]"
            style={{ height: STAGE_H, background: "rgba(255,255,255,0.82)" }}
          >
            {/* faint grid */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(0,122,77,.025) 1px, transparent 1px) 0 0 / 42px 42px, linear-gradient(180deg, rgba(0,122,77,.025) 1px, transparent 1px) 0 0 / 42px 42px",
              }}
            />

            {/* scaled stage */}
            <div
              ref={stageRef}
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: STAGE_W, height: STAGE_H }}
            >
              <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                {CONNECTIONS.map(([, , type], i) => (
                  <g key={i}>
                    <path
                      ref={(el) => {
                        pathRefs.current[i] = el;
                      }}
                      id={`lp-edge-${i}`}
                      className={`lp-edge ${type}`}
                    />
                    <circle r={type === "risk" ? 4.3 : 3.6} className={`lp-particle ${type === "risk" ? "risk" : ""}`}>
                      <animateMotion dur={`${3.2 + (i % 3) * 0.7}s`} repeatCount="indefinite" begin={`${(i * 0.27) % 2}s`}>
                        <mpath href={`#lp-edge-${i}`} />
                      </animateMotion>
                    </circle>
                  </g>
                ))}
              </svg>

              {NODES.map((n) => (
                <div
                  key={n.id}
                  ref={(el) => {
                    nodeRefs.current[n.id] = el;
                  }}
                  className={`lp-node ${n.variant === "risk" ? "risk" : n.variant === "pending" ? "pending" : ""}`}
                  style={{ left: n.left, top: n.top }}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-black leading-[1.25] text-[#1c2823]">
                    {t(`heroGraph.nodes.${n.id}`)}
                    <span className="h-2 w-2 flex-none rounded-full" style={{ background: dotColor(n.variant) }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className="inline-flex h-5 min-w-[38px] items-center justify-center rounded-full border px-[7px] text-[9px] font-black tracking-[0.04em]"
                      style={
                        n.variant === "risk"
                          ? { color: "#a83232", background: "#fff1f1", borderColor: "rgba(233,84,84,.25)" }
                          : n.variant === "pending"
                            ? { color: "#67736e", background: "#f2f4f2", borderColor: "#e1e6e1" }
                            : { color: "#064e3b", background: "#e7f5ee", borderColor: "#c9e8d8" }
                      }
                    >
                      {t(`heroGraph.chip.${n.chip}`)}
                    </span>
                    <span className="text-[11px] font-black" style={{ color: pctColor(n.variant) }}>
                      {n.pct || t("heroGraph.pending")}
                    </span>
                  </div>
                </div>
              ))}

              {/* risk alert badge */}
              <div
                ref={alertRef}
                className="lp-risk-alert absolute z-[3] grid h-7 w-7 place-items-center rounded-full bg-[#e95454] text-[14px] font-black text-white"
                style={{ boxShadow: "0 10px 22px rgba(233,84,84,.32)" }}
              >
                !
              </div>

              {/* mini-map */}
              <div className="absolute bottom-3.5 right-4 z-[4] h-[72px] w-[110px] overflow-hidden rounded-[10px] border border-[#dfe9e2] bg-white/[0.86] shadow-[0_8px_20px_rgba(7,19,15,.06)]">
                <span className="lp-mini-node absolute h-2 w-3.5 rounded-[3px] bg-[#007a4d]/40" style={{ left: 21, top: 24 }} />
                <span className="lp-mini-node absolute h-2 w-3.5 rounded-[3px] bg-[#007a4d]/40" style={{ left: 42, top: 20 }} />
                <span className="lp-mini-node absolute h-2 w-3.5 rounded-[3px] bg-[#e95454]/45" style={{ left: 62, top: 29 }} />
                <span className="lp-mini-node absolute h-2 w-3.5 rounded-[3px] bg-[#007a4d]/40" style={{ left: 78, top: 44 }} />
              </div>
            </div>
          </div>

          {/* legend */}
          <div className="mt-3 flex flex-wrap items-center gap-5 text-[12px] font-extrabold text-[#5f6b66]">
            <span className="inline-flex items-center gap-2"><span className="h-[9px] w-[9px] rounded-full bg-[#007a4d]" />{t("heroGraph.legend.completed")}</span>
            <span className="inline-flex items-center gap-2"><span className="h-[9px] w-[9px] rounded-full bg-[#2f80ed]" />{t("heroGraph.legend.inProgress")}</span>
            <span className="inline-flex items-center gap-2"><span className="h-[9px] w-[9px] rounded-full bg-[#e95454]" />{t("heroGraph.legend.atRisk")}</span>
            <span className="inline-flex items-center gap-2"><span className="h-[9px] w-[9px] rounded-full bg-[#adb6b1]" />{t("heroGraph.legend.pending")}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
