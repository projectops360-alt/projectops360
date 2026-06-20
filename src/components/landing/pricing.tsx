"use client";

import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Reveal } from "./reveal";

type Plan = { key: string; period: "perMonth" | "perUserMonth" | "none"; featured?: boolean };

const PLANS: Plan[] = [
  { key: "personal", period: "perMonth" },
  { key: "team", period: "perUserMonth" },
  { key: "business", period: "perUserMonth", featured: true },
  { key: "enterprise", period: "none" },
];

export function Pricing() {
  const { t } = useTranslation();
  return (
    <section id="pricing" className="relative overflow-hidden bg-[#0A1611] px-6 py-24 md:px-10">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 blur-[44px]"
        style={{ background: "radial-gradient(ellipse, rgba(31,181,135,.14), transparent 68%)" }}
      />
      <div className="relative mx-auto max-w-[1180px]">
        <Reveal className="mx-auto mb-14 max-w-[640px] text-center">
          <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#3CE5A4]">{t("pricing.eyebrow")}</div>
          <h2 className="lp-display m-0 text-[clamp(30px,4.2vw,46px)] font-extrabold leading-[1.04] tracking-[-.025em] text-white [text-wrap:balance]">
            {t("pricing.title")}
            <span className="lp-grad-text">{t("pricing.titleAccent")}</span>
          </h2>
          <p className="mt-4 text-[17px] leading-[1.55] text-[#A9BAB1]">{t("pricing.subtitle")}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
          {PLANS.map((plan, i) => {
            const features = t(`pricing.plans.${plan.key}.features`, { returnObjects: true }) as string[];
            const featured = plan.featured;
            return (
              <Reveal
                key={plan.key}
                index={i}
                className={`relative flex flex-col rounded-[20px] p-7 ${
                  featured
                    ? "border border-[#3CE5A4]/50 shadow-[0_24px_60px_-24px_rgba(60,229,164,.45)] lg:py-10"
                    : "border border-white/[0.08] bg-white/[0.03]"
                }`}
                style={featured ? { background: "linear-gradient(165deg, #123227, #0c1f18)" } : undefined}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#3CE5A4] px-3.5 py-1.5 text-[11px] font-extrabold text-[#06231a] shadow-[0_8px_20px_-6px_rgba(60,229,164,.6)]">
                    {t("pricing.mostPopular")}
                  </span>
                )}
                <h3 className="text-[15px] font-bold text-[#D6E2DA]">{t(`pricing.plans.${plan.key}.name`)}</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="lp-display text-[36px] font-extrabold leading-none text-white">{t(`pricing.plans.${plan.key}.price`)}</span>
                  {plan.period !== "none" && <span className="text-[13px] font-medium text-[#6F8278]">{t(`pricing.${plan.period}`)}</span>}
                </div>
                <p className="mt-3 text-[13.5px] leading-[1.55] text-[#A9BAB1]">{t(`pricing.plans.${plan.key}.desc`)}</p>

                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13.5px] text-[#D6E2DA]">
                      <Check size={16} strokeWidth={2.4} className="mt-0.5 flex-shrink-0 text-[#3CE5A4]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href="#cta"
                  className={`mt-7 inline-flex min-h-[46px] items-center justify-center rounded-full px-5 text-[14px] font-bold transition-colors ${
                    featured
                      ? "bg-[#3CE5A4] text-[#06231a] hover:bg-[#34d99a]"
                      : "border border-white/15 text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {t(`pricing.plans.${plan.key}.cta`)}
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
