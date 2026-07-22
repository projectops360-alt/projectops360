import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type { FinancialCockpitSummary } from "@/lib/financial/read-model.server";

interface FinancialCockpitProps {
  locale: string;
  projectId: string;
  role: string;
  summary: FinancialCockpitSummary;
}

export async function FinancialCockpit({
  locale,
  projectId,
  role,
  summary,
}: FinancialCockpitProps) {
  const t = await getTranslations("financialControl");
  const isEs = locale === "es";
  const formatMoney = (value: number | null) =>
    value == null
      ? t("unavailable")
      : new Intl.NumberFormat(isEs ? "es-ES" : "en-US", {
          style: "currency",
          currency: summary.currency,
          maximumFractionDigits: 0,
        }).format(value);
  const formatIndex = (value: number | null) =>
    value == null ? t("unavailable") : value.toFixed(2);
  const warnings = [
    summary.currentBaseline == null ? t("noActiveBaseline") : null,
    summary.unverifiedActuals > 0
      ? t("legacyActualsWarning", { count: summary.unverifiedActuals })
      : null,
    summary.currencyMismatches > 0
      ? t("currencyMismatchWarning", { count: summary.currencyMismatches })
      : null,
    summary.reconciliationExceptions > 0
      ? t("reconciliationWarning", { count: summary.reconciliationExceptions })
      : null,
  ].filter((warning): warning is string => Boolean(warning));

  return (
    <section className="mb-6 space-y-4" aria-labelledby="financial-control-title">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 id="financial-control-title" className="text-lg font-bold text-foreground">
              {t("title")}
            </h1>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
              {t("badge")}
            </span>
            <QualityBadge status={summary.qualityStatus} translate={t} />
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            {t("description")}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("authorizedFor", { role })}
            {summary.dataDate ? ` · ${t("dataDate", { date: summary.dataDate })}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/projects/${projectId}/execution-map/living-graph`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <GitBranch className="h-3.5 w-3.5" /> {t("livingGraph")}
          </Link>
          <Link
            href={`/${locale}/reports`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <BarChart3 className="h-3.5 w-3.5" /> {t("reports")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinancialCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label={t("currentBaseline")}
          value={formatMoney(summary.currentBaseline)}
          detail={`${t("original")}: ${formatMoney(summary.originalBudget)}`}
        />
        <FinancialCard
          icon={<WalletCards className="h-4 w-4" />}
          label={t("authorizedFunding")}
          value={formatMoney(summary.authorizedFunding)}
          detail={`${t("released")}: ${formatMoney(summary.releasedFunding)}`}
        />
        <FinancialCard
          label={t("currentCommitment")}
          value={formatMoney(summary.currentCommitment)}
          detail={`${t("outstanding")}: ${formatMoney(summary.outstandingCommitment)}`}
        />
        <FinancialCard
          label={t("costExposure")}
          value={formatMoney(summary.actualCost + summary.openAccrual)}
          detail={`${t("actual")}: ${formatMoney(summary.actualCost)} · ${t("accrual")}: ${formatMoney(summary.openAccrual)}`}
        />
        <FinancialCard
          label={t("settledPayments")}
          value={formatMoney(summary.settledPayments)}
          detail={`${t("remainingReserve")}: ${formatMoney(summary.remainingReserve)}`}
        />
        <FinancialCard
          label={t("eac")}
          value={formatMoney(summary.latestEac)}
          detail={`${t("p50")} ${formatMoney(summary.p50Eac)} · ${t("p80")} ${formatMoney(summary.p80Eac)}`}
        />
        <FinancialCard
          label={t("cpiSpi")}
          value={`${formatIndex(summary.cpi)} / ${formatIndex(summary.spi)}`}
          detail={t("spiNote")}
        />
        <FinancialCard
          label={t("controlQueue")}
          value={String(summary.pendingApprovals)}
          detail={`${t("approvedChangesNotPosted")}: ${formatMoney(summary.approvedChangesNotPosted)}`}
        />
      </div>

      {warnings.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2" role="status">
          {warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("noExceptions")}
        </p>
      )}
    </section>
  );
}

function FinancialCard({
  icon,
  label,
  value,
  detail,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 truncate text-xl font-bold tabular-nums text-foreground" title={value}>{value}</p>
      <p className="mt-1 break-words text-[11px] text-muted-foreground">{detail}</p>
    </article>
  );
}

function QualityBadge({
  status,
  translate,
}: {
  status: string;
  translate: (key: string) => string;
}) {
  const healthy = status === "available";
  const labelKey = ["available", "provisional", "incomplete", "insufficient_inputs", "invalid"].includes(status)
    ? status
    : "unknown";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${healthy ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
      {translate(`quality.${labelKey}`)}
    </span>
  );
}
