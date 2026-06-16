import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ShieldCheck, Target, ClipboardCheck, Flag, AlertTriangle, Scale, Landmark, CalendarClock } from "lucide-react";
import { CHARTER_STATUS_META, type CharterStatus } from "@/lib/charter/fields";
import { StakeholderSummaryButton } from "../charter-extra";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  gray: "bg-muted text-muted-foreground", blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function Field({ icon: Icon, title, value, isEs }: { icon: typeof Target; title: string; value: unknown; isEs: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" />{title}</h3>
      <p className="whitespace-pre-line text-sm text-foreground">{value && String(value).trim() ? String(value) : <span className="text-muted-foreground">{isEs ? "Por definir." : "To be defined."}</span>}</p>
    </section>
  );
}

export default async function CharterSummaryPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";
  const org = await getOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects").select("id, slug, title_i18n")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!project) notFound();

  const [charterRes, milestonesRes, risksRes, decisionsRes] = await Promise.all([
    supabase.from("project_charters").select("project_goal, executive_summary, in_scope, out_of_scope, major_deliverables, success_criteria, status, version, reporting_cadence, governance_model").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle(),
    supabase.from("milestones").select("title, status, target_date").eq("project_id", projectId).is("deleted_at", null).order("order_index").limit(8),
    supabase.from("risks").select("title, status").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(50),
    supabase.from("decisions").select("title_i18n, status").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(50),
  ]);

  const charter = (charterRes.data ?? {}) as Record<string, unknown>;
  const status = (charter.status as CharterStatus | undefined) ?? "draft";
  const meta = CHARTER_STATUS_META[status];
  const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  const milestones = (milestonesRes.data ?? []) as { title: string; status: string; target_date: string | null }[];
  const openRisks = ((risksRes.data ?? []) as { title: string; status: string }[]).filter((r) => ["open", "identified", "mitigating"].includes(r.status)).slice(0, 6);
  const pendingDecisions = ((decisionsRes.data ?? []) as { title_i18n: Record<string, string>; status: string }[]).filter((d) => d.status === "proposed").slice(0, 6);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/projects/${projectId}/charter`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />{isEs ? "Volver al Charter" : "Back to Charter"}
      </Link>

      <header className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400"><ShieldCheck className="h-4 w-4" />{isEs ? "Fundación y Contexto de Estado del Proyecto" : "Project Foundation & Status Context"}</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{projectName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold ${TONE[meta.tone]}`}>{isEs ? meta.es : meta.en}</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">v{(charter.version as number) ?? 1}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{isEs ? "Esta vista ayuda a los interesados a entender el estado actual del proyecto en relación con el charter aprobado." : "This view helps stakeholders understand the current project status in relation to the approved charter."}</p>
      </header>

      <StakeholderSummaryButton projectId={projectId} locale={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field isEs={isEs} icon={Target} title={isEs ? "Propósito del proyecto" : "Project purpose"} value={charter.project_goal || charter.executive_summary} />
        <Field isEs={isEs} icon={ClipboardCheck} title={isEs ? "Entregables principales" : "Major deliverables"} value={charter.major_deliverables} />
        <Field isEs={isEs} icon={Target} title={isEs ? "Dentro del alcance" : "In scope"} value={charter.in_scope} />
        <Field isEs={isEs} icon={Flag} title={isEs ? "Criterios de éxito" : "Success criteria"} value={charter.success_criteria} />
        <Field isEs={isEs} icon={Landmark} title={isEs ? "Gobernanza" : "Governance"} value={charter.governance_model} />
        <Field isEs={isEs} icon={CalendarClock} title={isEs ? "Cadencia de reportes" : "Reporting cadence"} value={charter.reporting_cadence} />
      </div>

      {/* Key milestones */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Flag className="h-3.5 w-3.5" />{isEs ? "Hitos clave" : "Key milestones"}</h3>
        {milestones.length === 0 ? <p className="text-sm text-muted-foreground">{isEs ? "Sin hitos." : "No milestones."}</p> : (
          <ul className="space-y-1 text-sm">
            {milestones.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-border/40 py-1 last:border-0">
                <span className="text-foreground">{m.title}</span>
                <span className="text-xs text-muted-foreground">{m.target_date ? new Date(m.target_date).toLocaleDateString(isEs ? "es-ES" : "en-US") : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />{isEs ? "Riesgos principales" : "Major risks"}</h3>
          {openRisks.length === 0 ? <p className="text-sm text-muted-foreground">{isEs ? "Sin riesgos abiertos." : "No open risks."}</p> : (
            <ul className="space-y-1 text-sm text-foreground">{openRisks.map((r, i) => <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{r.title}</li>)}</ul>
          )}
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Scale className="h-3.5 w-3.5" />{isEs ? "Decisiones pendientes" : "Pending decisions"}</h3>
          {pendingDecisions.length === 0 ? <p className="text-sm text-muted-foreground">{isEs ? "Sin decisiones pendientes." : "No pending decisions."}</p> : (
            <ul className="space-y-1 text-sm text-foreground">{pendingDecisions.map((d, i) => <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />{getI18nValue(d.title_i18n as never, locale as Locale) || "—"}</li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
