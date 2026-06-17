import { setRequestLocale } from "next-intl/server";
import { CreditCard, Users, FolderKanban, Eye, BookOpen, Sparkles, ShieldCheck, Settings2, ArrowUpRight, CheckCircle2, XCircle } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { Link } from "@/i18n/navigation";
import { getOrgBilling, getPlansWithEntitlements, checkLimit, isPlatformAdmin, type Entitlements } from "@/lib/billing/service";
import { PLAN_LABELS, FEATURE_FIELDS, formatLimit } from "@/lib/billing/config";

export const dynamic = "force-dynamic";

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";
  const org = await getOrgContext();

  const [billing, plans] = await Promise.all([getOrgBilling(org), getPlansWithEntitlements()]);
  const { plan, entitlements: ent, usage, subscription } = billing;
  const orgName = getI18nValue(org.organizationName, locale as Locale) || org.organizationSlug;
  const canManagePlans = isPlatformAdmin(org);

  const planLabel = plan ? (PLAN_LABELS[plan.plan_code]?.[isEs ? "es" : "en"] ?? plan.name) : "—";
  const statusTone: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    trialing: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    past_due: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    canceled: "bg-muted text-muted-foreground", suspended: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  };

  // Usage cards mapped to plan limits.
  const cards = [
    { icon: Users, es: "Usuarios facturables", en: "Billable users", current: usage.activeBillableUsers, limit: ent?.max_billable_users ?? null },
    { icon: FolderKanban, es: "Proyectos activos", en: "Active projects", current: usage.activeProjects, limit: ent?.max_active_projects ?? null },
    { icon: Eye, es: "Observadores (gratis)", en: "Free viewers", current: usage.freeViewers, limit: ent?.max_stakeholder_viewers ?? null },
    { icon: BookOpen, es: "Documentos indexados", en: "Documents indexed", current: usage.documentsIndexed, limit: ent?.max_documents_indexed ?? null },
    { icon: Sparkles, es: "Créditos IA / mes", en: "AI credits / month", current: usage.aiCreditsUsed, limit: ent?.max_ai_credits_per_month ?? null },
    { icon: BookOpen, es: "Memoria (MB)", en: "Memory (MB)", current: usage.memoryStorageMb, limit: ent?.max_memory_storage_mb ?? null },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
            <CreditCard className="h-4 w-4" />{isEs ? "Facturación y plan" : "Billing & plan"}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{orgName}</h1>
        </div>
        {canManagePlans && (
          <Link href="/organization/plans" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
            <Settings2 className="h-4 w-4" />{isEs ? "Administrar planes y precios" : "Manage plans & pricing"}
          </Link>
        )}
      </div>

      {/* Current plan */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-6 dark:border-brand-900 dark:bg-brand-950/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700 dark:text-brand-400">{isEs ? "Plan actual" : "Current plan"}</p>
            <h2 className="text-2xl font-bold text-foreground">{planLabel}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold ${statusTone[subscription?.status ?? "active"] ?? "bg-muted text-muted-foreground"}`}>
                {subscription?.status ?? "active"}
              </span>
              {plan && !plan.is_enterprise && (
                <span className="text-muted-foreground">
                  {plan.currency} {subscription?.billing_cycle === "yearly" ? `${plan.price_yearly}/${isEs ? "año" : "yr"}` : `${plan.price_monthly}/${isEs ? "mes" : "mo"}`}
                </span>
              )}
              {plan?.is_enterprise && <span className="text-muted-foreground">{isEs ? "Contrato personalizado" : "Custom contract"}</span>}
            </div>
          </div>
          <button disabled title={isEs ? "Integración de pagos próximamente" : "Payment integration coming soon"}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-brand-600/60 px-4 py-2 text-sm font-semibold text-white opacity-70">
            <ArrowUpRight className="h-4 w-4" />{isEs ? "Gestionar suscripción" : "Manage subscription"}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">{isEs ? "La facturación ocurre a nivel de organización. Stakeholders, observadores y externos no consumen asiento facturable." : "Billing happens at the organization level. Stakeholders, viewers and external collaborators don't consume a billable seat."}</p>
      </div>

      {/* Usage vs limits */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">{isEs ? "Uso y límites" : "Usage & limits"}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => {
            const chk = checkLimit(c.limit, c.current);
            const pct = chk.limit ? Math.min(100, Math.round((c.current / chk.limit) * 100)) : 0;
            const barTone = chk.atLimit ? "bg-red-500" : chk.nearLimit ? "bg-amber-500" : "bg-brand-500";
            return (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><c.icon className="h-3.5 w-3.5" />{isEs ? c.es : c.en}</p>
                <p className="mt-1 text-lg font-bold text-foreground">{c.current} <span className="text-sm font-normal text-muted-foreground">/ {formatLimit(c.limit, isEs)}</span></p>
                {chk.limit !== null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${barTone}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
                {chk.atLimit && <p className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">{isEs ? "Límite alcanzado — requiere upgrade." : "Limit reached — upgrade required."}</p>}
                {!chk.atLimit && chk.nearLimit && <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">{isEs ? "Acercándote al límite del plan." : "Approaching your plan limit."}</p>}
              </div>
            );
          })}
        </div>
        {usage.pendingInvites > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{isEs ? `${usage.pendingInvites} invitación(es) pendiente(s) — no cuentan como asiento facturable hasta aceptarse.` : `${usage.pendingInvites} pending invite(s) — not counted as billable seats until accepted.`}</p>
        )}
      </div>

      {/* Plan features */}
      {ent && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-brand-500" />{isEs ? "Funciones del plan" : "Plan features"}</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_FIELDS.map((f) => {
              const on = ent[f.key as keyof Entitlements] === true;
              return (
                <div key={f.key} className="flex items-center gap-2 text-sm">
                  {on ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  <span className={on ? "text-foreground" : "text-muted-foreground"}>{isEs ? f.es : f.en}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plan comparison */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">{isEs ? "Planes disponibles" : "Available plans"}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.filter((p) => p.is_active).map((p) => {
            const current = p.id === plan?.id;
            return (
              <div key={p.id} className={`rounded-xl border p-4 ${current ? "border-brand-400 bg-brand-50/40 dark:border-brand-700 dark:bg-brand-950/20" : "border-border bg-card"}`}>
                <p className="text-sm font-bold text-foreground">{PLAN_LABELS[p.plan_code]?.[isEs ? "es" : "en"] ?? p.name}</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">
                  {p.is_enterprise ? (isEs ? "A medida" : "Custom") : `${p.currency} ${p.price_monthly}`}
                  {!p.is_enterprise && <span className="text-xs font-normal text-muted-foreground">/{isEs ? "mes" : "mo"}</span>}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{p.description}</p>
                {current && <p className="mt-2 inline-flex rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">{isEs ? "Plan actual" : "Current plan"}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
