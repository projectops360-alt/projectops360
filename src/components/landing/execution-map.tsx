"use client";

import { Fragment } from "react";
import { useTranslation } from "react-i18next";

// Decorative product preview with SAMPLE data. Card labels/titles are i18n;
// the numbers (%, tasks, footer stats) are illustrative, per the handoff.

type Variant = "current" | "normal" | "amber";
type Card = { key: string; pct: number; tasks: string; variant: Variant };

const CARDS: Card[] = [
  { key: "charter", pct: 94, tasks: "17/18", variant: "current" },
  { key: "framework", pct: 100, tasks: "9/9", variant: "normal" },
  { key: "plan", pct: 100, tasks: "8/8", variant: "normal" },
  { key: "execution", pct: 71, tasks: "12/17", variant: "amber" },
  { key: "memory", pct: 100, tasks: "24/24", variant: "normal" },
  { key: "reporting", pct: 88, tasks: "7/8", variant: "normal" },
];

function MapCard({ c, className = "" }: { c: Card; className?: string }) {
  const { t } = useTranslation();
  const accent = c.variant === "amber" ? "#E2A33C" : "#3CE5A4";
  const innerBg = c.variant === "amber" ? "#15110B" : "#101A15";
  const labelColor = c.variant === "current" ? "#3CE5A4" : c.variant === "amber" ? "#E2A33C" : "#6F8278";
  const titleColor = c.variant === "amber" ? "#F5E9D4" : c.variant === "current" ? "#fff" : "#E7EFEA";
  const tasksColor = c.variant === "amber" ? "#E2A33C" : c.variant === "current" ? "#3CE5A4" : "#E7EFEA";
  const cardStyle =
    c.variant === "current"
      ? { background: "linear-gradient(160deg, #15241D, #0E1512)", border: "1px solid rgba(60,229,164,.4)", boxShadow: "0 10px 30px -16px rgba(60,229,164,.5)" }
      : c.variant === "amber"
        ? { background: "linear-gradient(160deg, #1E1A12, #13110C)", border: "1px solid rgba(226,163,60,.35)" }
        : { background: "linear-gradient(160deg, #13201A, #0E1512)", border: "1px solid rgba(60,229,164,.12)" };
  return (
    <div className={`rounded-[14px] p-[14px] ${className}`} style={cardStyle}>
      <div className="mb-[9px] text-[8px] font-extrabold tracking-[.08em]" style={{ color: labelColor }}>
        {t(`executionMap.cards.${c.key}.label`)}
      </div>
      <div className="mb-[11px] text-[12px] font-bold leading-[1.2]" style={{ color: titleColor }}>
        {t(`executionMap.cards.${c.key}.title`)}
      </div>
      <div className="mb-[9px] flex h-[42px] w-[42px] items-center justify-center rounded-full" style={{ background: `conic-gradient(${accent} ${c.pct}%, rgba(255,255,255,.07) 0)` }}>
        <div className="flex h-[31px] w-[31px] items-center justify-center rounded-full text-[8.5px] font-extrabold text-white" style={{ background: innerBg }}>
          {c.pct}%
        </div>
      </div>
      <div className="text-[12.5px] font-extrabold" style={{ color: tasksColor }}>
        {c.tasks}
      </div>
    </div>
  );
}

export function ExecutionMap() {
  const { t } = useTranslation();
  return (
    <div
      className="lp-anim-float rounded-t-[20px] border border-[#3CE5A4]/[0.18] px-6 pb-7 pt-[22px]"
      style={{
        background: "linear-gradient(165deg, #0E1512, #0A0F0C)",
        boxShadow: "0 -10px 70px -22px rgba(60,229,164,.3), 0 50px 90px -30px rgba(0,0,0,.8)",
      }}
    >
      {/* header */}
      <div className="mb-[18px] flex items-center justify-between">
        <div className="flex items-center gap-[7px]">
          <span className="h-[11px] w-[11px] rounded-full bg-[#FF5F57]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#FEBC2E]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#28C840]" />
          <span className="ml-[13px] text-[13.5px] font-bold text-[#E7EFEA]">{t("executionMap.title")}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3CE5A4]/[0.12] px-[11px] py-[5px] text-[11.5px] font-bold text-[#3CE5A4]">
          <span className="lp-anim-blink h-[7px] w-[7px] rounded-full bg-[#3CE5A4]" />
          {t("executionMap.live")}
        </span>
      </div>

      {/* connected flow row (Celonis-style) — large screens */}
      <div className="hidden items-stretch lg:flex">
        {CARDS.map((c, i) => (
          <Fragment key={c.key}>
            <MapCard c={c} className="flex-1" />
            {i < CARDS.length - 1 && <div className="lp-connector" aria-hidden />}
          </Fragment>
        ))}
      </div>

      {/* stacked grid — small / medium screens */}
      <div className="grid grid-cols-2 gap-[11px] sm:grid-cols-3 lg:hidden">
        {CARDS.map((c) => (
          <MapCard key={c.key} c={c} />
        ))}
      </div>

      {/* footer */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-[15px]">
        <div className="flex items-center gap-[9px]">
          <span
            className="inline-flex h-[27px] w-[27px] items-center justify-center rounded-lg text-[11px] text-[#06231a]"
            style={{ background: "linear-gradient(150deg, #3CE5A4, #0C3A2A)" }}
          >
            ◈
          </span>
          <span className="text-[12.5px] font-bold text-[#E7EFEA]">{t("executionMap.activeMemory")}</span>
        </div>
        <div className="flex gap-6 text-right sm:gap-8">
          {[
            { v: "1,243", k: "decisions", mint: false },
            { v: "78", k: "risks", mint: false },
            { v: "93%", k: "traceability", mint: true },
          ].map((s) => (
            <div key={s.k}>
              <div className="text-[18px] font-extrabold" style={{ color: s.mint ? "#3CE5A4" : "#fff" }}>
                {s.v}
              </div>
              <div className="text-[10px] text-[#6F8278]">{t(`executionMap.stats.${s.k}`)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
