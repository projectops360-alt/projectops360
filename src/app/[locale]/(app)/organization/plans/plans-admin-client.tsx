"use client";

// ============================================================================
// Plans & Pricing admin (platform owner). Editable prices + entitlements.
// Prices are GLOBAL — editing here changes the plan for all organizations.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, CheckCircle2, Tag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LIMIT_FIELDS, FEATURE_FIELDS, PLAN_LABELS } from "@/lib/billing/config";
import { updatePlanAction, updateEntitlementsAction } from "./actions";

const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function PlansAdminClient({ locale, plans }: { locale: string; plans: Record<string, unknown>[] }) {
  const isEs = locale === "es";
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
          <Tag className="h-4 w-4" />{isEs ? "Planes y precios" : "Plans & pricing"}
        </div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{isEs ? "Administrar planes" : "Manage plans"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{isEs ? "Edita precios y límites. Los cambios aplican a todas las organizaciones (planes globales)." : "Edit prices and limits. Changes apply to all organizations (global plans)."}</p>
        <Link href="/organization/billing" className="mt-1 inline-block text-xs text-brand-600 hover:underline dark:text-brand-400">← {isEs ? "Volver a facturación" : "Back to billing"}</Link>
      </div>
      {plans.map((p) => <PlanCard key={String(p.id)} plan={p} isEs={isEs} />)}
    </div>
  );
}

function PlanCard({ plan, isEs }: { plan: Record<string, unknown>; isEs: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const ent = (plan.entitlements as Record<string, unknown> | null) ?? {};
  const code = String(plan.plan_code);

  const [name, setName] = useState(String(plan.name ?? ""));
  const [description, setDescription] = useState(String(plan.description ?? ""));
  const [priceM, setPriceM] = useState(String(plan.price_monthly ?? 0));
  const [priceY, setPriceY] = useState(String(plan.price_yearly ?? 0));
  const [currency, setCurrency] = useState(String(plan.currency ?? "USD"));
  const [isActive, setIsActive] = useState(plan.is_active !== false);

  const [limits, setLimits] = useState<Record<string, string>>(
    Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, ent[f.key] === null || ent[f.key] === undefined ? "" : String(ent[f.key])])),
  );
  const [features, setFeatures] = useState<Record<string, boolean>>(
    Object.fromEntries(FEATURE_FIELDS.map((f) => [f.key, ent[f.key] === true])),
  );

  const save = () => start(async () => {
    await updatePlanAction({
      planId: String(plan.id), name, description,
      priceMonthly: Number(priceM) || 0, priceYearly: Number(priceY) || 0, currency, isActive,
    });
    const limPayload: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(limits)) limPayload[k] = v.trim() === "" ? null : Number(v);
    await updateEntitlementsAction({ planId: String(plan.id), limits: limPayload, features });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    router.refresh();
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          {PLAN_LABELS[code]?.[isEs ? "es" : "en"] ?? name}
          {plan.is_enterprise === true && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Enterprise</span>}
          {!isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{isEs ? "Inactivo" : "Inactive"}</span>}
        </h2>
        <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? (isEs ? "Guardado" : "Saved") : (isEs ? "Guardar" : "Save")}
        </button>
      </div>

      {/* Pricing */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={isEs ? "Nombre" : "Name"}><input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={isEs ? "Moneda" : "Currency"}><input className={inp} value={currency} onChange={(e) => setCurrency(e.target.value)} /></Field>
        <Field label={isEs ? "Precio mensual" : "Monthly price"}><input type="number" min={0} className={inp} value={priceM} onChange={(e) => setPriceM(e.target.value)} /></Field>
        <Field label={isEs ? "Precio anual" : "Yearly price"}><input type="number" min={0} className={inp} value={priceY} onChange={(e) => setPriceY(e.target.value)} /></Field>
        <Field label={isEs ? "Descripción" : "Description"} full><input className={inp} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-brand-600" />{isEs ? "Activo" : "Active"}</label>
        </div>
      </div>

      {/* Limits */}
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Límites (vacío = ilimitado)" : "Limits (empty = unlimited)"}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LIMIT_FIELDS.map((f) => (
          <Field key={f.key} label={isEs ? f.es : f.en}>
            <input type="number" min={0} placeholder={isEs ? "∞" : "∞"} className={inp} value={limits[f.key] ?? ""} onChange={(e) => setLimits((s) => ({ ...s, [f.key]: e.target.value }))} />
          </Field>
        ))}
      </div>

      {/* Features */}
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Funciones" : "Features"}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={features[f.key] ?? false} onChange={(e) => setFeatures((s) => ({ ...s, [f.key]: e.target.checked }))} className="h-4 w-4 accent-brand-600" />
            {isEs ? f.es : f.en}
          </label>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
