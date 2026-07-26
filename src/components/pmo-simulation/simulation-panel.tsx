"use client";

// ============================================================================
// PMO Simulation — scenario panel (CAP-049 §6)
// ============================================================================
// Configuration and consultation are two different jobs and now live on two
// different surfaces:
//
//   • BUILDING a scenario happens in a wide modal (`scenario-config-modal`).
//     A multi-intervention scenario could not be composed comfortably in the
//     260px rail this panel used to occupy — that was the reported problem.
//   • READING the answer happens here, in the rail, where it can stay on screen
//     next to the graph it explains.
//
// Running closes the modal and publishes the result to the rail. The draft
// itself is held HERE, not in the modal, so dismissing the dialog without
// running never destroys work; reopening shows exactly what was typed.
//
// State lives in this component; every calculation lives in `lib/pmo-simulation`
// and runs on the server, so this component never decides what a number means.
// A failed or contradictory run keeps the scenario intact for the same reason:
// clearing the form on error loses the user's work and explains nothing.
// ============================================================================

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, FilePlus2, FlaskConical, Maximize2, Pencil, Play, Trash2 } from "lucide-react";
import {
  runSimulationAction,
  saveScenarioAction,
  duplicateScenarioAction,
  deleteScenarioAction,
  getScenarioAction,
  listScenariosAction,
} from "@/lib/pmo-simulation/commands.server";
import type {
  SimIntervention,
  SimInterventionKind,
  SimResult,
  SimScenario,
} from "@/lib/pmo-simulation/contracts";
import {
  EMPTY_DRAFT,
  addIntervention as addInterventionTo,
  draftFromScenario,
  moveIntervention as moveInterventionIn,
  removeIntervention as removeInterventionFrom,
  toDraftPayload,
  updateIntervention as updateInterventionIn,
  type ScenarioDraft,
} from "@/lib/pmo-simulation/scenario-draft";
import { actionErrorKey } from "@/lib/pmo-simulation/presentation";
import {
  loadScenario,
  orderScenariosForPicker,
  startNewScenario,
} from "@/lib/pmo-simulation/surface-state";
import type { SimTargetOption } from "./intervention-editor";
import { ScenarioConfigModal } from "./scenario-config-modal";
import { SimulationResults } from "./simulation-results";
import { SimulationResultsModal } from "./simulation-results-modal";

export function SimulationPanel({
  locale,
  targets,
  initialScenario,
  initialResult,
  onAffectedNodesChange,
  /** Opens the builder on mount, so entering the lens lands on configuration. */
  autoOpenConfig = false,
}: {
  locale: string;
  /** Real portfolio entities, resolved on the server. */
  targets: readonly SimTargetOption[];
  initialScenario?: SimScenario | null;
  initialResult?: SimResult | null;
  /** Lets the graph highlight what the last run touched. */
  onAffectedNodesChange?: (nodeIds: string[], result: SimResult | null) => void;
  autoOpenConfig?: boolean;
}) {
  const t = useTranslations("pmoSimulation");
  const [pending, startTransition] = useTransition();

  // The draft survives the modal because it is held one level above it.
  const [draft, setDraft] = useState<ScenarioDraft>(() =>
    initialScenario ? draftFromScenario(initialScenario) : EMPTY_DRAFT,
  );
  // A scenario with nothing in it has nothing to consult, so the builder opens
  // first; once results exist the rail is the landing surface.
  const [configOpen, setConfigOpen] = useState(autoOpenConfig && !initialResult);
  const [result, setResult] = useState<SimResult | null>(initialResult ?? null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The rail is for consulting a result beside the graph; reading it carefully,
  // or taking it to a meeting, needs the width the rail does not have.
  const [expanded, setExpanded] = useState(false);
  // Saved scenarios. The server could always list them and the UI never asked,
  // so saving wrote something the user could not reopen.
  const [scenarios, setScenarios] = useState<SimScenario[]>([]);

  const refreshScenarios = useCallback(() => {
    startTransition(async () => {
      const response = await listScenariosAction();
      if (response.scenarios) setScenarios(orderScenariosForPicker(response.scenarios));
    });
  }, []);

  useEffect(refreshScenarios, [refreshScenarios]);

  /** Apply a whole surface transition at once — draft, result and canvas. */
  const applySurface = useCallback(
    (next: ReturnType<typeof startNewScenario>) => {
      setDraft(next.draft);
      setResult(next.result);
      setSelectedMetric(next.selectedMetric);
      setError(null);
      // The canvas must stop showing the previous scenario's blast radius.
      onAffectedNodesChange?.(next.affectedNodeIds, next.result);
    },
    [onAffectedNodesChange],
  );

  const newScenario = useCallback(() => {
    applySurface(startNewScenario());
    setConfigOpen(true);
  }, [applySurface]);

  const openScenario = useCallback(
    (scenarioId: string) => {
      setError(null);
      startTransition(async () => {
        const response = await getScenarioAction(scenarioId);
        if (response.error || !response.scenario) {
          setError(response.error ?? "unexpected");
          return;
        }
        // The stored result is READ, not recomputed: re-running on open would
        // measure against today's baseline while the user believes they are
        // looking at what they saved.
        applySurface(loadScenario(response.scenario, response.result ?? null));
      });
    },
    [applySurface],
  );

  const patchDraft = useCallback(
    (changes: Partial<ScenarioDraft>) => setDraft((current) => ({ ...current, ...changes })),
    [],
  );

  const addIntervention = useCallback(
    (kind: SimInterventionKind) => setDraft((current) => addInterventionTo(current, kind)),
    [],
  );

  const updateIntervention = useCallback(
    (index: number, next: SimIntervention) =>
      setDraft((current) => updateInterventionIn(current, index, next)),
    [],
  );

  const removeIntervention = useCallback(
    (index: number) => setDraft((current) => removeInterventionFrom(current, index)),
    [],
  );

  const moveIntervention = useCallback(
    (index: number, direction: -1 | 1) =>
      setDraft((current) => moveInterventionIn(current, index, direction)),
    [],
  );

  const run = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const response = await runSimulationAction(
        draft.scenarioId
          ? { scenarioId: draft.scenarioId, locale }
          : { draft: toDraftPayload(draft), locale },
      );
      if (response.error || !response.result) {
        // The modal stays open on failure: the fix is in the form the user is
        // already looking at, and closing over the error would hide it.
        setError(response.error ?? "unexpected");
        return;
      }
      setResult(response.result);
      setSelectedMetric(null);
      // Answer is ready — hand the screen back to the graph and the rail.
      setConfigOpen(false);
      onAffectedNodesChange?.(response.result.affectedNodeIds, response.result);
    });
  }, [draft, locale, onAffectedNodesChange]);

  const save = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const payload = toDraftPayload(draft);
      const response = await saveScenarioAction({
        id: draft.scenarioId ?? undefined,
        ...payload,
        name: draft.name.trim(),
      });
      if (response.error || !response.id) {
        setError(response.error ?? "unexpected");
        return;
      }
      setDraft((current) => ({ ...current, scenarioId: response.id! }));
      // A scenario the user just saved must appear in the picker immediately,
      // or saving looks like it did nothing.
      refreshScenarios();
    });
  }, [draft, refreshScenarios]);

  const duplicate = useCallback(() => {
    if (!draft.scenarioId) return;
    startTransition(async () => {
      const response = await duplicateScenarioAction(draft.scenarioId!, `${draft.name} (copy)`);
      if (response.error || !response.id) {
        setError(response.error ?? "unexpected");
        return;
      }
      setDraft((current) => ({
        ...current,
        scenarioId: response.id!,
        name: `${current.name} (copy)`,
      }));
      // The copy has not been run, so last run's numbers no longer apply.
      setResult(null);
      onAffectedNodesChange?.([], null);
      refreshScenarios();
    });
  }, [draft.scenarioId, draft.name, onAffectedNodesChange, refreshScenarios]);

  const remove = useCallback(() => {
    if (!draft.scenarioId) return;
    startTransition(async () => {
      const response = await deleteScenarioAction(draft.scenarioId!);
      if (response.error) {
        setError(response.error);
        return;
      }
      applySurface(startNewScenario());
      refreshScenarios();
    });
  }, [draft.scenarioId, applySurface, refreshScenarios]);

  const scenarioLabel = draft.name.trim() || t("untitledScenario");
  const enabledCount = draft.interventions.filter((item) => item.enabled).length;

  return (
    <div className="flex flex-col gap-2.5">
      <header>
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
          {t("title")}
        </h2>
        <p className="text-[10px] text-slate-500">{t("subtitle")}</p>
      </header>

      {/* Scenario summary. The rail states WHAT was run; the modal is where it
          is changed. Keeping the numbers and the controls apart is what frees
          this column up to be readable. */}
      {/* Scenario switcher. A what-if surface that can hold only one scenario
          is not a what-if surface — comparing options is the entire activity.
          The saved list comes from the server, which could always provide it. */}
      <section className="rounded-lg border border-slate-200 bg-white p-2.5">
        <div className="flex items-center gap-1">
          <select
            value={draft.scenarioId ?? ""}
            onChange={(event) => {
              if (event.target.value) openScenario(event.target.value);
            }}
            aria-label={t("openScenario")}
            className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] font-semibold text-slate-800"
          >
            {/* An unsaved draft has no id, so it needs an entry of its own —
                otherwise the select would show someone else's scenario name
                while the form holds unsaved work. */}
            {draft.scenarioId == null ? (
              <option value="">{t("unsavedDraft")}</option>
            ) : null}
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={newScenario}
            title={t("newScenarioHint")}
            className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
          >
            <FilePlus2 className="h-3 w-3" aria-hidden />
            {t("newScenario")}
          </button>
        </div>

        <p className="mt-1.5 truncate text-xs font-bold text-slate-900" title={scenarioLabel}>
          {scenarioLabel}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {t("interventionCount", { count: enabledCount })}
        </p>

        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfigOpen(true);
            }}
            className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
          >
            {result ? (
              <>
                <Pencil className="h-3 w-3" aria-hidden />
                {t("editScenario")}
              </>
            ) : (
              <>
                <FlaskConical className="h-3 w-3" aria-hidden />
                {t("configureScenario")}
              </>
            )}
          </button>

          {/* Re-running an unchanged scenario is a legitimate one-click action
              once it exists, so it does not require reopening the builder. */}
          {result ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Maximize2 className="h-3 w-3" aria-hidden />
              {t("expandResults")}
            </button>
          ) : null}

          {result ? (
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Play className="h-3 w-3" aria-hidden />
              {pending ? t("running") : t("rerun")}
            </button>
          ) : null}

          {draft.scenarioId ? (
            <>
              <button
                type="button"
                onClick={duplicate}
                disabled={pending}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <Copy className="h-3 w-3" aria-hidden />
                {t("duplicate")}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                {t("delete")}
              </button>
            </>
          ) : null}
        </div>
      </section>

      {/* Errors from a rail-initiated action (re-run, duplicate, delete) show
          here; errors raised while the builder is open show inside it. */}
      {error && !configOpen ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800"
        >
          {t(actionErrorKey(error))}
        </p>
      ) : null}

      {result ? (
        <SimulationResults
          result={result}
          locale={locale}
          selectedMetricKey={selectedMetric}
          onSelectMetric={(key) => {
            setSelectedMetric(key);
            // Selecting a metric focuses the nodes that produced it.
            const ids = key
              ? result.outcomes
                  .filter((outcome) => outcome.metrics.some((metric) => metric.key === key))
                  .flatMap((outcome) => outcome.affectedNodeIds)
              : result.affectedNodeIds;
            onAffectedNodesChange?.(ids, result);
          }}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-500">
          {t("noResults")}
        </p>
      )}

      <ScenarioConfigModal
        open={configOpen}
        draft={draft}
        targets={targets}
        pending={pending}
        error={configOpen ? error : null}
        onClose={() => setConfigOpen(false)}
        onDraftChange={patchDraft}
        onAddIntervention={addIntervention}
        onUpdateIntervention={updateIntervention}
        onRemoveIntervention={removeIntervention}
        onMoveIntervention={moveIntervention}
        onRun={run}
        onSave={save}
      />

      {result ? (
        <SimulationResultsModal
          open={expanded}
          onClose={() => setExpanded(false)}
          result={result}
          locale={locale}
          scenarioName={scenarioLabel}
        />
      ) : null}
    </div>
  );
}
