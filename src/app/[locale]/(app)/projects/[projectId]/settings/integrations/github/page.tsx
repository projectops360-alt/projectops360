import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { localizedHref } from "@/i18n/href";
import { GitGraph, ShieldCheck, Lock, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { assertGitHubIntelligenceAvailable } from "@/lib/github-intelligence/software-project-guard";
import { getPublicAppConfigStatus } from "@/lib/github-intelligence/config";
import { getConnectionStatus } from "@/lib/github-intelligence/read-model";
import { listInstallationRepositories, type InstallableRepo } from "@/lib/github-intelligence/installation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ConnectSampleButton,
  StartInstallButton,
  DisconnectButton,
  RefreshButton,
} from "@/components/github-intelligence/github-action-buttons";
import { RepoPicker } from "@/components/github-intelligence/repo-picker";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GitHubIntegrationSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ installation_id?: string }>;
}) {
  const { locale, projectId } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const isEs = locale === "es";
  if (!UUID_RE.test(projectId)) notFound();

  const guard = await assertGitHubIntelligenceAvailable(projectId);
  if (!guard.ok) {
    if (guard.reason === "not_software_project") {
      return (
        <div className="mx-auto max-w-lg py-16 text-center">
          <GitGraph className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            {isEs
              ? "GitHub Intelligence está disponible solo para proyectos de software."
              : "GitHub Intelligence is available for software projects only."}
          </p>
        </div>
      );
    }
    notFound();
  }

  const appStatus = getPublicAppConfigStatus();
  const conn = await getConnectionStatus(guard.org, projectId, appStatus.appConfigured, appStatus.appSlug);
  const dashboardHref = localizedHref(locale, `/projects/${projectId}/github`);

  // After an install callback (?installation_id), show the repo picker for the
  // active installation of this project (validated server-side).
  let pickerInstallationId: number | null = null;
  let installableRepos: InstallableRepo[] = [];
  if (sp.installation_id && /^\d+$/.test(sp.installation_id) && guard.canManage) {
    const admin = createAdminClient();
    const { data: inst } = await admin
      .from("github_installations")
      .select("installation_id")
      .eq("project_id", projectId)
      .eq("organization_id", guard.org.organizationId)
      .eq("installation_id", Number(sp.installation_id))
      .eq("is_active", true)
      .maybeSingle<{ installation_id: number }>();
    if (inst) {
      pickerInstallationId = inst.installation_id;
      try {
        installableRepos = await listInstallationRepositories(inst.installation_id);
      } catch {
        installableRepos = [];
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <GitGraph className="h-5 w-5 text-brand-500" />
          {isEs ? "GitHub Intelligence" : "GitHub Intelligence"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {isEs
            ? "Conecta un repositorio para visualizar ramas, commits, PRs, CI, deployments y readiness de release."
            : "Connect a repository to visualize branches, commits, PRs, CI, deployments and release readiness."}
        </p>
      </div>

      {/* Guarantees */}
      <div className="flex flex-wrap gap-3">
        <Badge icon={<Lock className="h-3.5 w-3.5" />} text={isEs ? "Solo lectura" : "Read-only"} />
        <Badge icon={<ShieldCheck className="h-3.5 w-3.5" />} text={isEs ? "Solo proyectos de software" : "Software projects only"} />
      </div>

      {/* Repo picker (shown right after a GitHub App install callback) */}
      {pickerInstallationId !== null && (
        <RepoPicker
          projectId={projectId}
          installationId={pickerInstallationId}
          repos={installableRepos}
          isEs={isEs}
        />
      )}

      {/* Connected repositories */}
      {conn.repositories.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {isEs ? "Repositorios conectados" : "Connected repositories"}
            </h2>
            <Link href={dashboardHref} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
              {isEs ? "Abrir dashboard" : "Open dashboard"} <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-2">
            {conn.repositories.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <GitGraph className="h-4 w-4 text-muted-foreground" />
                    {r.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.lastSyncedAt
                      ? `${isEs ? "Última sync" : "Last sync"}: ${new Date(r.lastSyncedAt).toLocaleString(locale)} · ${r.lastSyncStatus ?? ""}`
                      : isEs ? "Sin sincronizar aún" : "Not synced yet"}
                  </p>
                </div>
                {guard.canManage && (
                  <div className="flex items-center gap-2">
                    <RefreshButton projectId={projectId} repositoryId={r.id} isEs={isEs} />
                    <DisconnectButton projectId={projectId} repositoryId={r.id} isEs={isEs} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ConnectSection isEs={isEs} projectId={projectId} appStatus={appStatus} canManage={guard.canManage} />
      )}

      {/* App configuration status (setup wizard entry / diagnostics) */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {isEs ? "Configuración de la GitHub App" : "GitHub App configuration"}
        </h2>
        <ul className="space-y-2 text-sm">
          <StatusRow ok={appStatus.appConfigured} label={isEs ? "GitHub App configurada (env)" : "GitHub App configured (env)"} />
          <StatusRow ok={appStatus.webhookConfigured} label={isEs ? "Webhook secret configurado" : "Webhook secret configured"} />
          <StatusRow ok={appStatus.flagEnabled} label="GITHUB_INTELLIGENCE_ENABLED" />
        </ul>
        {!appStatus.appConfigured && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
            {isEs
              ? "No hay una GitHub App configurada. Para producción, configura las variables de entorno GITHUB_APP_* o usa el asistente de manifest. Consulta docs/product-brain/github-intelligence-layer.md."
              : "No GitHub App is configured. For production, set the GITHUB_APP_* environment variables or use the manifest setup wizard. See docs/product-brain/github-intelligence-layer.md."}
          </div>
        )}
      </section>
    </div>
  );
}

function ConnectSection({
  isEs,
  projectId,
  appStatus,
  canManage,
}: {
  isEs: boolean;
  projectId: string;
  appStatus: ReturnType<typeof getPublicAppConfigStatus>;
  canManage: boolean;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <GitGraph className="mx-auto h-9 w-9 text-brand-500/70" />
      <h2 className="mt-3 text-sm font-semibold text-foreground">
        {isEs ? "Conecta GitHub a este proyecto" : "Connect GitHub to this project"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground">
        {isEs
          ? "Integración de solo lectura: leemos metadatos del repositorio y recibimos eventos de webhook. No escribimos en GitHub."
          : "Read-only integration: we read repository metadata and receive webhook events. We never write to GitHub."}
      </p>
      {!canManage ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {isEs ? "Necesitas permiso de administrador/gestor para conectar." : "You need manager/admin permission to connect."}
        </p>
      ) : appStatus.appConfigured ? (
        <div className="mt-5 flex justify-center">
          <StartInstallButton projectId={projectId} isEs={isEs} />
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-2">
          <ConnectSampleButton projectId={projectId} isEs={isEs} />
          <p className="text-[11px] text-muted-foreground">
            {isEs
              ? "Modo dev sin GitHub App: conecta datos de muestra sintéticos para explorar el dashboard."
              : "Dev mode without a GitHub App: connect synthetic sample data to explore the dashboard."}
          </p>
        </div>
      )}
    </section>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {icon}
      {text}
    </span>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
