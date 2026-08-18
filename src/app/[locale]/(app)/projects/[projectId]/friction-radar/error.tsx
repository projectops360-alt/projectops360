"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function FrictionRadarError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("frictionRadar.error");
  return (
    <div className="mx-auto flex min-h-[420px] max-w-2xl flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm" role="alert">
      <div className="rounded-full bg-red-500/10 p-4"><AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" /></div>
      <h1 className="mt-5 text-xl font-semibold text-foreground">{t("title")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("description")}</p>
      <button type="button" onClick={reset} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />{t("retry")}
      </button>
    </div>
  );
}
