"use client";

// ============================================================================
// PMO Simulation — intervention editor (CAP-049 §6)
// ============================================================================
// A form. It holds no rules: everything it produces is validated again by the
// engine, and any conflict between two interventions is detected there rather
// than being prevented here by greying controls out. That ordering is
// deliberate — a UI that silently forbids a combination teaches nothing, while
// the engine's conflict report names exactly what contradicts what.
//
// The one thing this component states out loud is the provenance of an assumed
// risk figure, because a number typed into a box and a number measured from the
// data look identical once they reach a table.
// ============================================================================

import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type {
  SimIntervention,
  SimInterventionKind,
  SimRiskAction,
  SimTargetKind,
} from "@/lib/pmo-simulation/contracts";
import { groupTargetsByProject } from "@/lib/pmo-simulation/target-grouping";

/**
 * Selectable entities, supplied by the server from the real portfolio.
 *
 * `projectLabel` is not decoration. A portfolio scenario can target anything in
 * the organization, so the flat list mixed milestones from every project — and
 * names like "M1" or "Design Phase" repeat across projects. Without saying
 * which project an entity belongs to, the picker asks the user to aim an
 * intervention at something they cannot identify.
 */
export interface SimTargetOption {
  kind: SimTargetKind;
  id: string;
  label: string;
  /** Owning project, or null for a portfolio-level entity (e.g. a resource). */
  projectId: string | null;
  /** Project title, used to group the options. */
  projectLabel: string | null;
}

const BUDGET_CATEGORIES = [
  "labor",
  "material",
  "equipment",
  "subcontractor",
  "software",
  "cloud",
  "permit",
  "contingency",
  "other",
] as const;

const RISK_ACTIONS: SimRiskAction[] = [
  "reduce_probability",
  "reduce_impact",
  "mitigate_partial",
  "mitigate_full",
  "materialize",
];

const KIND_TARGETS: Record<SimInterventionKind, SimTargetKind[]> = {
  budget: ["project", "milestone", "task"],
  schedule: ["project", "milestone", "task"],
  resource: ["resource"],
  risk: ["risk"],
};

export function InterventionEditor({
  intervention,
  targets,
  onChange,
  onRemove,
  onMove,
  isFirst,
  isLast,
  needsTarget = false,
}: {
  intervention: SimIntervention;
  targets: readonly SimTargetOption[];
  onChange: (next: SimIntervention) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
  /** Enabled but no target chosen — the engine would silently drop it. */
  needsTarget?: boolean;
}) {
  const t = useTranslations("pmoSimulation");

  const allowedKinds = KIND_TARGETS[intervention.kind];
  const options = targets.filter((target) => allowedKinds.includes(target.kind));

  const patch = (changes: Partial<SimIntervention>) =>
    onChange({ ...intervention, ...changes } as SimIntervention);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={intervention.enabled}
          onChange={(event) => patch({ enabled: event.target.checked })}
          aria-label={t("enableIntervention")}
          className="h-3.5 w-3.5"
        />
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
          {t(kindKey(intervention.kind))}
        </span>
        <input
          value={intervention.label}
          onChange={(event) => patch({ label: event.target.value })}
          placeholder={t("scenarioNamePlaceholder")}
          className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 text-xs"
        />
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label={t("moveUp")}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label={t("moveDown")}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("removeIntervention")}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Field label={t("target")}>
          <select
            value={`${intervention.target.kind}:${intervention.target.id}`}
            onChange={(event) => {
              const [kind, ...rest] = event.target.value.split(":");
              patch({ target: { kind: kind as SimTargetKind, id: rest.join(":") } });
            }}
            aria-invalid={needsTarget || undefined}
            aria-describedby={needsTarget ? `${intervention.id}-target-hint` : undefined}
            className={`w-full rounded border px-1.5 py-1 text-xs ${
              needsTarget ? "border-amber-400 bg-amber-50" : "border-slate-200"
            }`}
          >
            <option value=":">{t("selectTarget")}</option>
            {groupTargetsByProject(options, t("portfolioLevel")).map(([projectLabel, group]) => (
              <optgroup key={projectLabel} label={projectLabel}>
                {group.map((option) => (
                  <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {needsTarget ? (
            <span
              id={`${intervention.id}-target-hint`}
              className="mt-0.5 block text-[10px] font-semibold text-amber-700"
            >
              {t("missingTarget")}
            </span>
          ) : null}
        </Field>

        {intervention.kind === "budget" ? (
          <>
            <Field label={t("amountDelta")}>
              <NumberInput
                value={intervention.amountDelta}
                onChange={(value) => patch({ amountDelta: value, percentDelta: null })}
              />
            </Field>
            <Field label={t("percentDelta")}>
              <NumberInput
                value={intervention.percentDelta}
                onChange={(value) => patch({ percentDelta: value, amountDelta: null })}
              />
            </Field>
            <Field label={t("category")}>
              <select
                value={intervention.category ?? ""}
                onChange={(event) => patch({ category: event.target.value || null })}
                className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
              >
                <option value="">{t("categoryAll")}</option>
                {BUDGET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}

        {intervention.kind === "schedule" ? (
          <>
            <Field label={t("delayDays")}>
              <NumberInput
                value={intervention.delayDays}
                onChange={(value) => patch({ delayDays: value })}
              />
            </Field>
            <Field label={t("newStartDate")}>
              <DateInput
                value={intervention.newStartDate}
                onChange={(value) => patch({ newStartDate: value })}
              />
            </Field>
            <Field label={t("newDurationDays")}>
              <NumberInput
                value={intervention.newDurationDays}
                onChange={(value) => patch({ newDurationDays: value })}
              />
            </Field>
          </>
        ) : null}

        {intervention.kind === "resource" ? (
          <>
            <Field label={t("availabilityPercent")}>
              <NumberInput
                value={intervention.availabilityPercent}
                onChange={(value) => patch({ availabilityPercent: value })}
              />
            </Field>
            <Field label={t("weeklyHoursDelta")}>
              <NumberInput
                value={intervention.weeklyHoursDelta}
                onChange={(value) => patch({ weeklyHoursDelta: value })}
              />
            </Field>
          </>
        ) : null}

        {intervention.kind === "risk" ? (
          <>
            <Field label={t("riskAction")}>
              <select
                value={intervention.action}
                onChange={(event) => patch({ action: event.target.value as SimRiskAction })}
                className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
              >
                {RISK_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {t(actionKey(action))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("reductionPercent")}>
              <NumberInput
                value={intervention.reductionPercent}
                onChange={(value) => patch({ reductionPercent: value })}
              />
            </Field>
            <Field label={t("assumedCostImpact")}>
              <NumberInput
                value={intervention.assumedCostImpact}
                onChange={(value) => patch({ assumedCostImpact: value })}
              />
            </Field>
            <Field label={t("assumedDelayDays")}>
              <NumberInput
                value={intervention.assumedDelayDays}
                onChange={(value) => patch({ assumedDelayDays: value })}
              />
            </Field>
            {/* Said plainly, next to the inputs: this is the user's number and
                it stays inside the scenario. */}
            <p className="col-span-2 text-[10px] leading-tight text-amber-700">
              {t("assumedHint")}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tabular-nums"
    />
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
    />
  );
}

function kindKey(kind: SimInterventionKind): string {
  switch (kind) {
    case "budget":
      return "kindBudget";
    case "schedule":
      return "kindSchedule";
    case "resource":
      return "kindResource";
    case "risk":
      return "kindRisk";
  }
}

function actionKey(action: SimRiskAction): string {
  switch (action) {
    case "reduce_probability":
      return "actionReduceProbability";
    case "reduce_impact":
      return "actionReduceImpact";
    case "mitigate_partial":
      return "actionMitigatePartial";
    case "mitigate_full":
      return "actionMitigateFull";
    case "materialize":
      return "actionMaterialize";
  }
}
