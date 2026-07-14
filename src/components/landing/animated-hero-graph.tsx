"use client";

import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarClock,
  Columns3,
  FileBarChart,
  FolderKanban,
  GitFork,
  Ruler,
  Settings,
  ShieldAlert,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from "lucide-react";

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

const CONVERGENCE_SOURCES = [
  { key: "projects", position: "top-left", path: "M 14 14 C 28 15 34 34 50 50", duration: 4.1, delay: 0 },
  { key: "schedule", position: "middle-left", path: "M 11 46 C 27 43 37 47 50 50", duration: 3.7, delay: 0.7 },
  { key: "risks", position: "bottom-left", path: "M 15 82 C 30 77 38 62 50 50", duration: 4.4, delay: 1.3 },
  { key: "memory", position: "lower-left", path: "M 38 94 C 39 76 45 62 50 50", duration: 3.9, delay: 0.35 },
  { key: "bim", position: "top-right", path: "M 86 14 C 72 15 66 34 50 50", duration: 4.3, delay: 1.05 },
  { key: "decisions", position: "middle-right", path: "M 89 46 C 73 43 63 47 50 50", duration: 3.8, delay: 0.2 },
  { key: "analytics", position: "bottom-right", path: "M 85 82 C 70 77 62 62 50 50", duration: 4.5, delay: 0.9 },
  { key: "reports", position: "lower-right", path: "M 62 94 C 61 76 55 62 50 50", duration: 4, delay: 1.55 },
] as const;

export function AnimatedHeroGraph() {
  const { t } = useTranslation();

  return (
    <figure
      className="mx-auto w-full max-w-[1080px] overflow-hidden rounded-[22px] border border-[#dfe7df] bg-white text-left"
      style={{ boxShadow: "0 40px 90px -34px rgba(6,78,59,0.34)" }}
      aria-labelledby="lp-hero-graph-caption"
    >
      <figcaption id="lp-hero-graph-caption" className="sr-only">
        {t("heroGraph.subtitle")}
      </figcaption>

      <div aria-hidden="true">
        <div className="flex h-[38px] items-center gap-2 border-b border-[#edf0ec] bg-gradient-to-b from-white to-[#f8faf7] px-4">
          <span className="h-[11px] w-[11px] rounded-full bg-[#ff645d]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#ffc043]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#32c26c]" />
          <span className="ml-2.5 hidden text-[12px] font-bold text-[#98a29d] sm:inline">{t("heroGraph.window")}</span>
        </div>

        <div className="grid min-h-[510px] grid-cols-1 bg-[#fbfcfb] md:grid-cols-[190px_1fr]">
          <aside className="hidden flex-col gap-1.5 border-r border-[#e9eee8] bg-white p-[13px] md:flex">
            <div className="flex items-center gap-2 px-2 pb-3.5 pt-1.5 text-[13px] font-extrabold tracking-[-0.03em]">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-lg bg-[#007a4d] text-[12px] font-black text-white">P</span>
              ProjectOps360°
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
          </aside>

          <section className="relative overflow-hidden px-3 pb-4 pt-5 sm:px-[22px] sm:pb-[22px]">
            <div className="mb-4 flex items-start justify-between gap-4 sm:mb-[18px]">
              <div>
                <h3 className="lp-display m-0 text-[21px] font-bold tracking-[-0.04em] text-[#07130f]">{t("heroGraph.title")}</h3>
                <p className="mt-1 text-[12px] font-semibold text-[#5f6b66]">{t("heroGraph.subtitle")}</p>
              </div>
              <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#c8ead8] bg-[#f0fbf5] px-[11px] text-[12px] font-extrabold text-[#064e3b]">
                <span className="lp-live-dot h-[7px] w-[7px] rounded-full bg-[#007a4d]" />
                {t("heroGraph.live")}
              </span>
            </div>

            <div className="lp-convergence-stage">
              <div className="lp-convergence-grid" />
              <svg className="lp-convergence-lines" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                <defs>
                  <radialGradient id="lp-convergence-halo">
                    <stop offset="0" stopColor="#0aa564" stopOpacity="0.18" />
                    <stop offset="1" stopColor="#0aa564" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="29" fill="url(#lp-convergence-halo)" />
                {CONVERGENCE_SOURCES.map((source, index) => (
                  <g key={source.key} className={`lp-convergence-path lp-convergence-path-${source.position}`}>
                    <path id={`lp-convergence-line-${index}`} d={source.path} pathLength="100" />
                    <circle className="lp-convergence-particle" r="0.58">
                      <animateMotion
                        dur={`${source.duration}s`}
                        begin={`-${source.delay}s`}
                        repeatCount="indefinite"
                        path={source.path}
                      />
                    </circle>
                  </g>
                ))}
              </svg>

              {CONVERGENCE_SOURCES.map((source, index) => (
                <div
                  key={source.key}
                  className={`lp-convergence-source lp-convergence-source-${source.position}`}
                  style={{ animationDelay: `${-index * 0.48}s` }}
                >
                  <span />
                  {t(`heroGraph.sidebar.${source.key}`)}
                </div>
              ))}

              <div className="lp-convergence-core">
                <span className="lp-convergence-core-mark">P</span>
                <strong>ProjectOps360°</strong>
                <small>{t("heroGraph.live")}</small>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 text-center text-[12px] font-extrabold text-[#5f6b66]">
              <span className="hidden h-[7px] w-[7px] shrink-0 rounded-full bg-[#007a4d] sm:block" />
              {t("heroGraph.subtitle")}
            </div>
          </section>
        </div>
      </div>
    </figure>
  );
}
