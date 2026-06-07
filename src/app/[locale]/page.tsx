import { setRequestLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { SupabaseStatus } from "@/components/shared/supabase-status";
import {
  FolderKanban,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-lg bg-brand-50 p-2.5 dark:bg-brand-950">
          <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
          <TrendingUp className="h-3.5 w-3.5" />
          {trend}
        </div>
      )}
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("dashboard");
  const t0 = await getTranslations("phase0");

  return (
    <AppShell>
      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("welcome")}
        </p>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("activeProjects.title")}
          value="0"
          subtitle={t("activeProjects.subtitle")}
          icon={FolderKanban}
        />
        <StatCard
          title={t("teamMembers.title")}
          value="1"
          subtitle={t("teamMembers.subtitle")}
          icon={Users}
          trend={t("teamMembers.trend")}
        />
        <StatCard
          title={t("completedTasks.title")}
          value="0"
          subtitle={t("completedTasks.subtitle")}
          icon={CheckCircle2}
        />
        <StatCard
          title={t("pendingItems.title")}
          value="—"
          subtitle={t("pendingItems.subtitle")}
          icon={Clock}
        />
      </div>

      {/* ── Phase 0 banner ── */}
      <div className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-800 dark:bg-brand-950">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-brand-100 p-2 dark:bg-brand-900">
            <AlertTriangle className="h-5 w-5 text-brand-700 dark:text-brand-300" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-brand-900 dark:text-brand-100">
              {t0("title")}
            </h2>
            <p className="text-sm text-brand-700 dark:text-brand-300">
              {t0("description")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {t0.raw("completed").map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-200"
                >
                  {tag} ✓
                </span>
              ))}
              {t0.raw("pending").map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full border border-brand-300 px-3 py-1 text-xs font-medium text-brand-600 dark:border-brand-700 dark:text-brand-400"
                >
                  {tag} pending
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Supabase connection test ── */}
      <div className="mt-8">
        <SupabaseStatus />
      </div>
    </AppShell>
  );
}