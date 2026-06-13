import { setRequestLocale, getTranslations } from "next-intl/server";
import { localizedHref } from "@/i18n/href";
import Link from "next/link";
import { getOrgContext } from "@/lib/auth";
import { Bot, DraftingCompass, ArrowRight, UploadCloud } from "lucide-react";

export default async function AiOperatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Ensure user is authenticated
  await getOrgContext();

  const t = await getTranslations("placeholders");
  const tDi = await getTranslations("drawingIntelligence");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t("aiOperator.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("aiOperator.description")}</p>
      </div>

      {/* AI modules */}
      <div className="w-full max-w-md space-y-3">
        <Link
          href={localizedHref(locale, `/import`)}
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-500/40 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
            <UploadCloud className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {locale === "es" ? "Importación Inteligente de Proyectos" : "Project Import Intelligence"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "es"
                ? "Sube Excel, CSV, JSON, Word o PDF y conviértelo en un proyecto completo"
                : "Upload Excel, CSV, JSON, Word, or PDF and turn it into a full project"}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
        </Link>
        <Link
          href={localizedHref(locale, `/drawing-intelligence`)}
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-500/40 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
            <DraftingCompass className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{tDi("aiOperatorCard.title")}</p>
            <p className="text-xs text-muted-foreground">{tDi("aiOperatorCard.description")}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
        </Link>
      </div>
    </div>
  );
}
