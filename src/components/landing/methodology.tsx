"use client";

import { useTranslation } from "react-i18next";
import { Reveal } from "./reveal";

type NodeVariant = "green" | "amber" | "idle";
const NODES: { key: string; variant: NodeVariant }[] = [
  { key: "charter", variant: "green" },
  { key: "framework", variant: "idle" },
  { key: "plan", variant: "idle" },
  { key: "execution", variant: "amber" },
  { key: "memory", variant: "idle" },
  { key: "reporting", variant: "idle" },
];

const STATS = [
  { v: "93%", k: "traceability" },
  { v: "1,243", k: "decisions" },
  { v: "0", k: "blindspots" },
];

export function Methodology() {
  const { t } = useTranslation();
  return (
    <section id="methodology" className="relative overflow-hidden bg-[#0A1611] px-6 py-24 md:px-10">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[900px] -translate-x-1/2 -translate-y-1/2 blur-[40px]"
        style={{ background: "radial-gradient(ellipse, rgba(31,181,135,.16), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-[1180px]">
        <Reveal className="mb-[62px] text-center">
          <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#3CE5A4]">{t("methodology.eyebrow")}</div>
          <h2 className="lp-display mx-auto m-0 max-w-[640px] text-[clamp(32px,4.4vw,46px)] font-extrabold leading-[1.04] tracking-[-.025em] text-white [text-wrap:balance]">
            {t("methodology.title")}
          </h2>
        </Reveal>

        {/* pipeline */}
        <Reveal className="relative mb-[14px] grid grid-cols-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {/* dashed connector (desktop only) */}
          <div
            className="absolute left-[8%] right-[8%] top-[13px] hidden h-0.5 lg:block"
            style={{ background: "repeating-linear-gradient(90deg, rgba(60,229,164,.5) 0 8px, transparent 8px 16px)" }}
          />
          {NODES.map((n) => {
            const border = n.variant === "green" ? "#3CE5A4" : n.variant === "amber" ? "#E2A33C" : "rgba(60,229,164,.4)";
            const halo = n.variant === "green" ? "0 0 0 5px rgba(60,229,164,.12)" : n.variant === "amber" ? "0 0 0 5px rgba(226,163,60,.12)" : "none";
            const dot = n.variant === "green" ? "#3CE5A4" : n.variant === "amber" ? "#E2A33C" : "rgba(60,229,164,.5)";
            const dotSize = n.variant === "idle" ? "h-2 w-2" : "h-[9px] w-[9px]";
            const subColor = n.variant === "amber" ? "#9A8763" : "#6F8278";
            return (
              <div key={n.key} className="relative px-1.5 text-center">
                <div
                  className="mx-auto mb-[18px] flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[#0A1611]"
                  style={{ borderColor: border, boxShadow: halo }}
                >
                  <span className={`${dotSize} rounded-full`} style={{ background: dot }} />
                </div>
                <div className="mb-1 text-[15px] font-bold text-white">{t(`methodology.nodes.${n.key}.title`)}</div>
                <div className="text-[12px]" style={{ color: subColor }}>{t(`methodology.nodes.${n.key}.sub`)}</div>
              </div>
            );
          })}
        </Reveal>

        {/* stat cards */}
        <Reveal className="mt-[54px] grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.k} className="rounded-[18px] border border-[#3CE5A4]/[0.14] bg-white/[0.03] p-7">
              <div className="lp-display mb-2.5 text-[34px] font-extrabold text-[#3CE5A4]">{s.v}</div>
              <div className="text-[15px] leading-[1.5] text-[#A9BAB1]">{t(`methodology.stats.${s.k}`)}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
