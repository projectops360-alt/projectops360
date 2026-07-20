"use client";

import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Reveal } from "./reveal";
import { useAuthPaths } from "./auth-links";
import {
  getPlanPricingPeriod,
  type PublicPricingPlan,
} from "@/lib/billing/config";

interface PricingProps {
  plans: PublicPricingPlan[];
}

export function Pricing({ plans }: PricingProps) {
  const { t, i18n } = useTranslation();
  const auth = useAuthPaths();
  return (
    <section id="pricing" className="relative overflow-hidden bg-[#f8faf7] px-6 py-24 md:px-10">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 blur-[44px]"
        style={{ background: "radial-gradient(ellipse, rgba(0,122,77,.06), transparent 68%)" }}
      />
      <div className="relative mx-auto max-w-[1180px]">
        <Reveal className="mx-auto mb-14 max-w-[640px] text-center">
          <div className="mb-4 text-[13px] font-extrabold uppercase tracking-[.16em] text-[#007a4d]">{t("pricing.eyebrow")}</div>
          <h2 className="lp-display m-0 text-[clamp(30px,4.2vw,46px)] font-extrabold leading-[1.04] tracking-[-.025em] text-[#07130f] [text-wrap:balance]">
            {t("pricing.title")}
            <span className="lp-grad-text">{t("pricing.titleAccent")}</span>
          </h2>
          <p className="mt-4 text-[17px] leading-[1.55] text-[#5f6b66]">{t("pricing.subtitle")}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
          {plans.map((plan, i) => {
            const features = t(`pricing.plans.${plan.planCode}.features`, { returnObjects: true }) as string[];
            const featured = plan.planCode === "business";
            const period = getPlanPricingPeriod(plan.planCode, plan.isEnterprise);
            const formattedPrice = plan.isEnterprise
              ? t("pricing.custom")
              : new Intl.NumberFormat(i18n.resolvedLanguage ?? "en", {
                  style: "currency",
                  currency: plan.currency,
                  maximumFractionDigits: 0,
                }).format(plan.monthlyPrice);
            return (
              <Reveal
                key={plan.planCode}
                index={i}
                className={`relative flex flex-col rounded-[20px] bg-white p-7 ${
                  featured
                    ? "border-[1.5px] border-[#007a4d] shadow-[0_28px_60px_-28px_rgba(0,122,77,.5)] lg:py-10"
                    : "border border-[#e2e8e1] shadow-[0_10px_34px_-24px_rgba(7,19,15,.14)]"
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#007a4d] px-3.5 py-1.5 text-[11px] font-extrabold text-white shadow-[0_8px_20px_-6px_rgba(0,122,77,.6)]">
                    {t("pricing.mostPopular")}
                  </span>
                )}
                <h3 className="text-[15px] font-bold text-[#5f6b66]">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="lp-display text-[36px] font-extrabold leading-none text-[#07130f]">{formattedPrice}</span>
                  {period !== "none" && <span className="text-[13px] font-medium text-[#7b877f]">{t(`pricing.${period}`)}</span>}
                </div>
                <p className="mt-3 text-[13.5px] leading-[1.55] text-[#5f6b66]">{t(`pricing.plans.${plan.planCode}.desc`)}</p>

                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13.5px] text-[#07130f]">
                      <Check size={16} strokeWidth={2.4} className="mt-0.5 flex-shrink-0 text-[#007a4d]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={`${auth.signup}?plan=${plan.planCode}`}
                  className={`mt-7 inline-flex min-h-[46px] items-center justify-center rounded-full px-5 text-[14px] font-bold transition-colors ${
                    featured
                      ? "bg-[#007a4d] text-white hover:bg-[#066b44]"
                      : "border border-[#bcd8cb] text-[#07130f] hover:bg-[#f0fbf5]"
                  }`}
                >
                  {t(`pricing.plans.${plan.planCode}.cta`)}
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
