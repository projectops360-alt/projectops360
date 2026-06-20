"use client";

import { useTranslation } from "react-i18next";
import { BarChart3, Brain, ClipboardCheck, LayoutGrid, Play, RefreshCw, type LucideIcon } from "lucide-react";

// Decorative product preview with SAMPLE data. Node titles/labels are i18n;
// the numbers (%, tasks, dates, footer stats) are illustrative, per the handoff.

const R = 14;
const CIRC = 2 * Math.PI * R; // 87.96

type Node = {
  key: string; // i18n key under executionMap.nodes.*
  left: number;
  top: number;
  Icon: LucideIcon;
  date: string;
  pct: number;
  tasks: string;
  current?: boolean;
  amber?: boolean;
};

const NODES: Node[] = [
  { key: "charter", left: 4, top: 14, Icon: ClipboardCheck, date: "MAY 9 – MAY 16", pct: 94, tasks: "17/18", current: true },
  { key: "framework", left: 176, top: 14, Icon: RefreshCw, date: "MAY 17 – JUN 14", pct: 100, tasks: "9/9" },
  { key: "plan", left: 348, top: 14, Icon: LayoutGrid, date: "JUN 15 – JUN 21", pct: 100, tasks: "8/8" },
  { key: "execution", left: 348, top: 206, Icon: Play, date: "JUN 22 – JUL 12", pct: 71, tasks: "12/17", amber: true },
  { key: "memory", left: 176, top: 206, Icon: Brain, date: "JUL 13 – JUL 26", pct: 100, tasks: "24/24" },
  { key: "reporting", left: 4, top: 206, Icon: BarChart3, date: "JUL 27 – AUG 2", pct: 88, tasks: "7/8" },
];

const WIRES_X = [
  { left: 152, top: 75 },
  { left: 324, top: 75 },
  { left: 324, top: 267 },
  { left: 152, top: 267 },
];
const DOTS = [
  { left: 160, top: 72, delay: "0s" },
  { left: 332, top: 72, delay: ".5s" },
  { left: 418, top: 198, delay: "1s" },
  { left: 332, top: 264, delay: "1.5s" },
  { left: 160, top: 264, delay: ".8s" },
];

function ProgressRing({ pct, amber }: { pct: number; amber?: boolean }) {
  const color = amber ? "#eab857" : "#34D9A6";
  const offset = CIRC * (1 - pct / 100);
  return (
    <div className="relative h-[34px] w-[34px] flex-shrink-0">
      <svg width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
        <circle
          cx="17"
          cy="17"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRC.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          transform="rotate(-90 17 17)"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[8.5px] font-bold"
        style={{ color: amber ? "#f0dcb0" : "#cfe9e1" }}
      >
        {pct}%
      </span>
    </div>
  );
}

export function ExecutionMap() {
  const { t } = useTranslation();
  return (
    <div className="lp-exec-scale mx-auto w-[532px] max-w-full">
      <div
        className="overflow-hidden rounded-[18px] border border-white/[0.08]"
        style={{
          background: "radial-gradient(120% 80% at 82% -5%, #173a31 0%, #0b1411 58%)",
          boxShadow: "0 32px 70px -30px rgba(7,16,12,.85)",
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-[13px]">
          <div className="flex items-center gap-[11px]">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e07c7c]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#eab857]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#34D9A6]" />
            </div>
            <span className="lp-head text-[12.5px] font-semibold text-[#9fb3ad]">{t("executionMap.title")}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34D9A6]/[0.12] px-[11px] py-1 text-[11px] font-semibold text-[#34D9A6]">
            <span className="lp-anim-pulse h-1.5 w-1.5 rounded-full bg-[#34D9A6] shadow-[0_0_8px_#34D9A6]" />
            {t("executionMap.live")}
          </span>
        </div>

        {/* graph canvas */}
        <div className="relative mx-auto h-[344px] w-[500px]">
          {/* wires */}
          {WIRES_X.map((w, i) => (
            <div key={`wx-${i}`} className="lp-wire-x lp-anim-flowx absolute h-0.5 w-6 rounded-[2px]" style={{ left: w.left, top: w.top }} />
          ))}
          <div className="lp-wire-y lp-anim-flowy absolute h-[68px] w-0.5 rounded-[2px]" style={{ left: 421, top: 138 }} />

          {/* junction dots */}
          {DOTS.map((d, i) => (
            <div
              key={`dot-${i}`}
              className="lp-anim-node absolute h-2 w-2 rounded-full bg-[#34D9A6] shadow-[0_0_9px_rgba(52,217,166,.85)]"
              style={{ left: d.left, top: d.top, animationDelay: d.delay }}
            />
          ))}

          {/* nodes */}
          {NODES.map((n) => {
            const accent = n.amber ? "#eab857" : "#34D9A6";
            return (
              <div
                key={n.key}
                className={`absolute box-border flex h-[124px] w-[148px] flex-col gap-[5px] rounded-[13px] p-[11px_12px] ${
                  n.current ? "lp-anim-glow" : ""
                }`}
                style={{
                  left: n.left,
                  top: n.top,
                  background: n.current ? "rgba(52,217,166,.06)" : "rgba(255,255,255,.035)",
                  border: n.current ? "1px solid rgba(52,217,166,.45)" : "1px solid rgba(255,255,255,.09)",
                }}
              >
                {n.current && (
                  <span className="absolute -top-[9px] left-3 rounded-full bg-[#1B4D3D] px-2 py-[3px] text-[7.5px] font-bold tracking-[.07em] text-white shadow-[0_2px_9px_rgba(42,157,143,.5)]">
                    {t("executionMap.currentPhase")}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-[7px]"
                    style={{ background: n.amber ? "rgba(234,184,87,.15)" : "rgba(52,217,166,.14)", color: accent }}
                  >
                    <n.Icon size={13} strokeWidth={1.9} />
                  </span>
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
                </div>
                <div>
                  <strong className="block text-[11.5px] font-semibold leading-[1.25] tracking-[-.01em] text-[#e7f1ee]">
                    {t(`executionMap.nodes.${n.key}`)}
                  </strong>
                  <span className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#6f857f]">{n.date}</span>
                </div>
                <div className="mt-auto flex items-center gap-[9px]">
                  <ProgressRing pct={n.pct} amber={n.amber} />
                  <div>
                    <span className="block text-[12px] font-bold leading-none" style={{ color: accent }}>
                      {n.tasks}
                    </span>
                    <span className="text-[8px] font-semibold tracking-[.08em] text-[#6f857f]">{t("executionMap.tasks")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer stats */}
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.02] px-[18px] py-3.5">
          <strong className="flex items-center gap-2 text-[12.5px] text-[#cfe9e1]">
            <span className="rounded-[5px] bg-[#34D9A6] px-[7px] py-0.5 text-[9px] font-extrabold text-[#06231b]">AI</span>
            {t("executionMap.activeMemory")}
          </strong>
          <div className="flex gap-5">
            {[
              { v: "1,243", k: "decisions" },
              { v: "78", k: "risks" },
              { v: "93%", k: "traceability" },
            ].map((s) => (
              <div key={s.k} className="text-center">
                <span className="lp-head block text-[16px] font-bold text-[#e7f1ee]">{s.v}</span>
                <span className="text-[10px] text-[#6f857f]">{t(`executionMap.stats.${s.k}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
