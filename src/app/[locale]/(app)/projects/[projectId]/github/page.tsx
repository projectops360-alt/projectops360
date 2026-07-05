import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { localizedHref } from "@/i18n/href";
import {
  GitCommitHorizontal,
  GitBranch,
  GitPullRequest,
  Activity,
  Gauge,
  GitGraph,
  Sparkles,
  Rocket,
  CheckCircle2,
  XCircle,
  Tag,
} from "lucide-react";
import { assertGitHubIntelligenceAvailable } from "@/lib/github-intelligence/software-project-guard";
import { loadDashboardData, listProjectRepositories, type DateWindow } from "@/lib/github-intelligence/read-model";
import { readinessBandLabel } from "@/lib/github-intelligence/readiness";
import { GitHubLivingGraph } from "@/components/github-intelligence/github-living-graph";
import { RefreshButton, ConnectSampleButton } from "@/components/github-intelligence/github-action-buttons";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOWS: DateWindow[] = [7, 14, 30, "all"];

const BAND_TONE: Record<string, string> = {
  good: "text-green-600 dark:text-green-400",
  watch: "text-amber-600 dark:text-amber-400",
  at_risk: "text-orange-600 dark:text-orange-400",
  blocked: "text-red-600 dark:text-red-400",
};

export default async function GitHubIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ window?: string; repo?: string }>;
}) {
  const { locale, projectId } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const isEs = locale === "es";
  if (!UUID_RE.test(projectId)) notFound();

  const guard = await assertGitHubIntelligenceAvailable(projectId);

  // Software-only: render the explicit unavailable state on direct access.
  if (!guard.ok) {
    if (guard.reason === "not_software_project") {
      return <UnavailableState isEs={isEs} />;
    }
    // feature disabled / not found / forbidden / unauthenticated → 404 (no leak).
    notFound();
  }

  // Default to the full history so the graph can always be panned/zoomed back in
  // time (the graph auto-zooms to recent activity but keeps all history loaded).
  const windowDays: DateWindow = sp.window === "all"
    ? "all"
    : WINDOWS.includes(Number(sp.window) as DateWindow)
      ? (Number(sp.window) as DateWindow)
      : "all";

  const data = await loadDashboardData(guard.org, projectId, {
    windowDays,
    repositoryId: sp.repo,
    isEs,
  });

  const base = localizedHref(locale, `/projects/${projectId}/github`);
  const repos = await listProjectRepositories(guard.org, projectId);

  // Empty state — software project, no repository connected.
  if (!data.repository) {
    return (
      <EmptyState
        isEs={isEs}
        projectId={projectId}
        settingsHref={localizedHref(locale, `/projects/${projectId}/settings/integrations/github`)}
        canManage={guard.canManage}
      />
    );
  }

  const m = data.metrics;
  const cards = [
    { label: isEs ? "Commits" : "Commits", value: m.commitCount, icon: GitCommitHorizontal, tone: "text-foreground", sub: data.windowDays === "all" ? (isEs ? "todo el historial" : "all history") : `${data.windowDays}${isEs ? " días" : " days"}` },
    { label: isEs ? "Ramas activas" : "Active Branches", value: m.activeBranchCount, icon: GitBranch, tone: "text-foreground", sub: "" },
    { label: isEs ? "PRs abiertos" : "Open PRs", value: m.openPrCount, icon: GitPullRequest, tone: "text-foreground", sub: `${m.mergedPrCount} ${isEs ? "fusionados" : "merged"}` },
    { label: isEs ? "Salud de CI" : "Workflow Health", value: m.failedWorkflowCount > 0 ? `${m.failedWorkflowCount} ✗` : `${m.successWorkflowCount} ✓`, icon: Activity, tone: m.failedWorkflowCount > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400", sub: isEs ? "workflows" : "workflows" },
    { label: isEs ? "Release Readiness" : "Release Readiness", value: `${data.readiness.score}`, icon: Gauge, tone: BAND_TONE[data.readiness.band], sub: readinessBandLabel(data.readiness.band, isEs) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <GitGraph className="h-6 w-6 text-brand-500" />
            {isEs ? "GitHub Intelligence" : "GitHub Intelligence"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEs ? "Evidencia real de ejecución desde tu repositorio." : "Real execution evidence from your repository."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton projectId={projectId} repositoryId={data.repository.id} isEs={isEs} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {repos.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {repos.map((r) => (
              <Link
                key={r.id}
                href={`${base}?window=${windowDays}&repo=${r.id}`}
                className={`rounded px-2.5 py-1 text-xs font-medium ${r.id === data.repository!.id ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}
              >
                {r.fullName}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`${base}?window=${w}${sp.repo ? `&repo=${sp.repo}` : ""}`}
              className={`rounded px-2.5 py-1 text-xs font-medium ${w === windowDays ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}
            >
              {w === "all" ? (isEs ? "Todo" : "All") : isEs ? `${w} días` : `${w}d`}
            </Link>
          ))}
        </div>
      </div>

      {/* Top metric cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <c.icon className={`h-4 w-4 ${c.tone}`} />
            </div>
            <p className={`mt-1.5 text-2xl font-bold tracking-tight ${c.tone}`}>{c.value}</p>
            {c.sub && <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>}
          </div>
        ))}
      </section>

      {/* Main visualization */}
      <GitHubLivingGraph data={data.graph} isEs={isEs} />

      {/* Lower row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Activity summary */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Activity className="h-4 w-4 text-brand-500" />
            {isEs ? "Resumen de actividad" : "Activity Summary"}
          </h2>
          <ul className="space-y-2 text-sm">
            <SummaryRow icon={<GitCommitHorizontal className="h-4 w-4 text-muted-foreground" />} label={isEs ? "Commits" : "Commits"} value={m.commitCount} />
            <SummaryRow icon={<GitPullRequest className="h-4 w-4 text-muted-foreground" />} label={isEs ? "PRs fusionados" : "Merged PRs"} value={m.mergedPrCount} />
            <SummaryRow icon={<XCircle className="h-4 w-4 text-red-500" />} label={isEs ? "Workflows fallidos" : "Failed workflows"} value={m.failedWorkflowCount} />
            <SummaryRow icon={<Tag className="h-4 w-4 text-purple-500" />} label={isEs ? "Releases" : "Releases"} value={m.releaseCount} />
          </ul>
        </section>

        {/* Isabella insight (deterministic placeholder) */}
        <section className="rounded-2xl border border-border bg-gradient-to-br from-purple-500/5 to-brand-500/5 p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-4 w-4 text-purple-500" />
            {isEs ? "Perspectiva de Isabella" : "Isabella Insight"}
          </h2>
          <p className="text-sm font-medium text-foreground">{data.summary.summary}</p>
          {data.summary.risk && (
            <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">⚠ {data.summary.risk}</p>
          )}
          {data.summary.recommendation && (
            <p className="mt-1 text-sm text-foreground">→ {data.summary.recommendation}</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            {isEs
              ? "La readiness se calcula con evidencia reciente de GitHub. No reemplaza la aprobación humana."
              : "Release readiness is calculated from recent GitHub evidence. It does not replace human approval."}
          </p>
        </section>

        {/* Release path */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Rocket className="h-4 w-4 text-brand-500" />
            {isEs ? "Ruta al release" : "Release Path"}
          </h2>
          <ReleasePath isEs={isEs} data={data} />
        </section>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-foreground">{icon}{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </li>
  );
}

function ReleasePath({ isEs, data }: { isEs: boolean; data: Awaited<ReturnType<typeof loadDashboardData>> }) {
  const hasActiveBranch = data.metrics.activeBranchCount > 0;
  const hasOpenPr = data.metrics.openPrCount > 0;
  const ciGreen = data.metrics.failedWorkflowCount === 0 && data.metrics.successWorkflowCount > 0;
  const hasDeploy = data.metrics.deploymentCount > 0;
  const ready = data.readiness.band === "good";

  const steps: Array<{ label: string; done: boolean }> = [
    { label: isEs ? "Rama activa" : "Branch active", done: hasActiveBranch },
    { label: isEs ? "PR abierto" : "PR open", done: hasOpenPr },
    { label: isEs ? "CI en verde" : "CI passing", done: ciGreen },
    { label: isEs ? "Deploy/Staging" : "Staging deploy", done: hasDeploy },
    { label: isEs ? "Listo para producción" : "Production ready", done: ready },
  ];

  return (
    <ol className="space-y-2">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-sm">
          {s.done ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />
          )}
          <span className={s.done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

// ── Unavailable / empty states ─────────────────────────────────────────────────

function UnavailableState({ isEs }: { isEs: boolean }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <GitGraph className="mx-auto h-10 w-10 text-muted-foreground/50" />
      <h1 className="mt-4 text-lg font-semibold text-foreground">
        {isEs ? "GitHub Intelligence no está disponible" : "GitHub Intelligence is unavailable"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isEs
          ? "GitHub Intelligence está disponible solo para proyectos de software."
          : "GitHub Intelligence is available for software projects only."}
      </p>
    </div>
  );
}

function EmptyState({
  isEs,
  projectId,
  settingsHref,
  canManage,
}: {
  isEs: boolean;
  projectId: string;
  settingsHref: string;
  canManage: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <GitGraph className="h-6 w-6 text-brand-500" />
          {isEs ? "GitHub Intelligence" : "GitHub Intelligence"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEs ? "Evidencia real de ejecución desde tu repositorio." : "Real execution evidence from your repository."}
        </p>
      </div>
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <GitGraph className="mx-auto h-10 w-10 text-brand-500/70" />
        <h2 className="mt-4 text-base font-semibold text-foreground">
          {isEs ? "Conecta un repositorio de GitHub" : "Connect a GitHub repository"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {isEs
            ? "Conecta un repositorio para visualizar ramas, commits, PRs, CI, deployments y readiness de release. Integración de solo lectura."
            : "Connect a repository to visualize branches, commits, PRs, CI, deployments and release readiness. Read-only integration."}
        </p>
        {canManage && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <ConnectSampleButton projectId={projectId} isEs={isEs} />
            <Link href={settingsHref} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
              {isEs ? "Ir a la configuración de la integración" : "Go to integration settings"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
