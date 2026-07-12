"use client";

// ============================================================================
// ProjectOps360° — Custom KPI section (CAP-046 F3.2, client)
// ============================================================================
// Lists persisted custom KPIs (already evaluated server-side against the same
// engine as the built-in catalog) and offers the human-approved creation flow:
// the user writes/pastes an expression (typically translated by Isabella from
// natural language), the server re-validates it against the sandbox allow-list
// and only then persists. Delete = soft delete (creator or org admin).
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { createCustomKpi, deleteCustomKpi } from "@/lib/kpi/custom-actions";

export interface EvaluatedCustomKpi {
  id: string;
  name: string;
  description: string | null;
  expression: string;
  unit: string | null;
  formatted: string | null; // null = not computable
  target: number | null;
  onTarget: boolean | null;
}

export function CustomKpiSection({
  projectId,
  kpis,
  canCreate,
}: {
  projectId: string;
  kpis: EvaluatedCustomKpi[];
  canCreate: boolean;
}) {
  const t = useTranslations("kpiEngine.custom");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nameEs: "",
    nameEn: "",
    expression: "",
    unit: "",
    target: "",
    targetDirection: "at_or_above" as "at_or_above" | "at_or_below",
  });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const target = form.target.trim() === "" ? null : Number(form.target);
      const result = await createCustomKpi({
        projectId,
        nameEs: form.nameEs,
        nameEn: form.nameEn || form.nameEs,
        expression: form.expression,
        unit: form.unit || undefined,
        target: target !== null && Number.isFinite(target) ? target : null,
        targetDirection: form.target.trim() === "" ? null : form.targetDirection,
      });
      if (!result.ok) {
        setError(result.error ?? "Error");
        return;
      }
      setShowForm(false);
      setForm({ nameEs: "", nameEn: "", expression: "", unit: "", target: "", targetDirection: "at_or_above" });
      router.refresh();
    });
  };

  const remove = (kpiId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomKpi({ projectId, kpiId });
      if (!result.ok) setError(result.error ?? "Error");
      else router.refresh();
    });
  };

  const inputClass =
    "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("create")}
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-2 border-b border-border bg-muted/20 p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              className={inputClass}
              placeholder={t("form.nameEs")}
              value={form.nameEs}
              onChange={(e) => setForm({ ...form, nameEs: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder={t("form.nameEn")}
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            />
          </div>
          <input
            className={`${inputClass} font-mono`}
            placeholder={t("form.expression")}
            value={form.expression}
            onChange={(e) => setForm({ ...form, expression: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              className={inputClass}
              placeholder={t("form.unit")}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder={t("form.target")}
              inputMode="decimal"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
            <select
              className={inputClass}
              value={form.targetDirection}
              onChange={(e) =>
                setForm({ ...form, targetDirection: e.target.value as "at_or_above" | "at_or_below" })
              }
            >
              <option value="at_or_above">{t("form.atOrAbove")}</option>
              <option value="at_or_below">{t("form.atOrBelow")}</option>
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("form.hint")}</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            disabled={isPending || !form.nameEs.trim() || !form.expression.trim()}
            onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {t("form.save")}
          </button>
        </div>
      )}

      {kpis.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {kpis.map((kpi) => (
            <li key={kpi.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{kpi.name}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" title={kpi.expression}>
                  {kpi.expression}
                </p>
                {kpi.description && <p className="mt-0.5 text-xs text-muted-foreground">{kpi.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {kpi.formatted ?? "—"}
                    {kpi.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{kpi.unit}</span>}
                  </p>
                  {kpi.onTarget !== null && (
                    <p
                      className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                        kpi.onTarget ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {kpi.onTarget ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                      ) : (
                        <XCircle className="h-3 w-3" aria-hidden />
                      )}
                      {kpi.onTarget ? t("onTarget", { target: kpi.target ?? 0 }) : t("offTarget", { target: kpi.target ?? 0 })}
                    </p>
                  )}
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => remove(kpi.id)}
                    disabled={isPending}
                    title={t("delete")}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
