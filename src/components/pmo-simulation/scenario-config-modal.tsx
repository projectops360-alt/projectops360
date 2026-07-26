"use client";

// ============================================================================
// PMO Simulation — scenario configuration modal (CAP-049 §6)
// ============================================================================
// Where a scenario is BUILT. Results are not shown here; they live in the right
// rail. That split is the whole point of this file: the previous single panel
// asked the user to compose a multi-intervention scenario inside a 260px
// column, which is where the reported discomfort came from.
//
// The modal is a pure renderer of a `ScenarioDraft` it does not own. The draft
// is held by the parent, so closing this dialog without running keeps every
// value the user typed (see `scenario-draft.ts`).
// ============================================================================

import { useTranslations } from "next-intl";
import { Play, Plus, Save } from "lucide-react";
import type {
  SimIntervention,
  SimInterventionKind,
} from "@/lib/pmo-simulation/contracts";
import {
  draftBlockers,
  interventionsWithoutTarget,
  isRunnable,
  isSaveable,
  type DraftBlocker,
  type ScenarioDraft,
} from "@/lib/pmo-simulation/scenario-draft";
import { actionErrorKey } from "@/lib/pmo-simulation/presentation";
import { InterventionEditor, type SimTargetOption } from "./intervention-editor";
import { ModalDialog } from "./modal-dialog";

const KINDS: readonly SimInterventionKind[] = ["budget", "schedule", "resource", "risk"];

export function ScenarioConfigModal({
  open,
  draft,
  targets,
  pending,
  error,
  onClose,
  onDraftChange,
  onAddIntervention,
  onUpdateIntervention,
  onRemoveIntervention,
  onMoveIntervention,
  onRun,
  onSave,
}: {
  open: boolean;
  draft: ScenarioDraft;
  targets: readonly SimTargetOption[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onDraftChange: (changes: Partial<ScenarioDraft>) => void;
  onAddIntervention: (kind: SimInterventionKind) => void;
  onUpdateIntervention: (index: number, next: SimIntervention) => void;
  onRemoveIntervention: (index: number) => void;
  onMoveIntervention: (index: number, direction: -1 | 1) => void;
  onRun: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("pmoSimulation");

  // A disabled Run button that does not say why is its own small cruelty. The
  // blockers are rendered next to it, and the incomplete interventions are
  // marked in place so the user does not have to hunt for which one it is.
  const blockers = draftBlockers(draft);
  const untargeted = new Set(interventionsWithoutTarget(draft));

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={t("configureTitle")}
      description={t("configureSubtitle")}
      closeLabel={t("closeConfig")}
      footer={
        <>
          {/* Stated next to the buttons, where the decision is made. */}
          <p className="mr-auto text-[11px] text-slate-500">{t("neverModifies")}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !isSaveable(draft)}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            {t("save")}
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={pending || !isRunnable(draft)}
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {pending ? t("running") : t("run")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ── Scenario header ────────────────────────────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t("scenarioName")}
            </span>
            <input
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
              placeholder={t("scenarioNamePlaceholder")}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t("hypothesis")}
            </span>
            <textarea
              value={draft.description}
              onChange={(event) => onDraftChange({ description: event.target.value })}
              placeholder={t("hypothesisPlaceholder")}
              rows={3}
              className="w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t("scope")}
            </span>
            {/* V1 always simulates the whole portfolio. Shown, disabled, rather
                than hidden, so the scope of the answer is never a guess. */}
            <input
              value={t("scopeAllProjects")}
              readOnly
              disabled
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t("horizon")}
            </span>
            <input
              type="number"
              min={0}
              value={draft.horizonDays ?? ""}
              onChange={(event) =>
                onDraftChange({
                  horizonDays: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              placeholder={t("horizonPlaceholder")}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm tabular-nums text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </label>
        </section>

        {/* ── Intervention builder ───────────────────────────────────────── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t("interventions")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onAddIntervention(kind)}
                  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  {t(kindKey(kind))}
                </button>
              ))}
            </div>
          </div>

          {draft.interventions.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              {t("noInterventions")}
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {draft.interventions.map((intervention, index) => (
                <InterventionEditor
                  key={intervention.id}
                  intervention={intervention}
                  targets={targets}
                  onChange={(next) => onUpdateIntervention(index, next)}
                  onRemove={() => onRemoveIntervention(index)}
                  onMove={(direction) => onMoveIntervention(index, direction)}
                  isFirst={index === 0}
                  isLast={index === draft.interventions.length - 1}
                  needsTarget={untargeted.has(intervention.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Validation and conflicts surface where the user is still editing,
            not only after the modal has closed over the results. The error is
            translated: the raw action code is a developer's word. */}
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
          >
            {t(actionErrorKey(error))}
          </p>
        ) : null}

        {blockers.length > 0 ? (
          <ul className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {blockers.map((blocker) => (
              <li key={blocker}>{t(blockerKey(blocker))}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </ModalDialog>
  );
}

function blockerKey(blocker: DraftBlocker): string {
  return blocker === "no_enabled_intervention"
    ? "blockerNoIntervention"
    : "blockerMissingTarget";
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
