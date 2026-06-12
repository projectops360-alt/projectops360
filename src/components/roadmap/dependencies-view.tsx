"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle, Trash2, ArrowRight, X, Loader2, AlertCircle, Link2,
} from "lucide-react";
import {
  createDependencyAction,
  deleteDependencyAction,
} from "@/app/[locale]/(app)/projects/[projectId]/execution-map/dependency-actions";
import { parseDependencyRefs, checkDependencies } from "@/lib/roadmap/dependencies";
import type { Milestone, RoadmapTask, TaskDependency, DependencyType, Locale } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DependenciesViewTranslations {
  title: string;
  description: string;
  addDependency: string;
  noDependencies: string;
  noDependenciesDescription: string;
  predecessor: string;
  successor: string;
  type: string;
  lagDays: string;
  delete: string;
  selectPredecessor: string;
  selectSuccessor: string;
  dependencyType: string;
  lagDaysLabel: string;
  create: string;
  creating: string;
  cancel: string;
  textDependencies: string;
  textDependenciesDescription: string;
  noTextDeps: string;
  incompleteWarning: string;
  complete: string;
  errorCircular: string;
  errorDuplicate: string;
  errorSelf: string;
  errorNotFound: string;
  errorUnexpected: string;
  typeLabels: Record<DependencyType, string>;
}

interface DependenciesViewProps {
  projectId: string;
  milestones: Milestone[];
  tasks: RoadmapTask[];
  dependencies: TaskDependency[];
  locale: Locale;
  translations: DependenciesViewTranslations;
}

// ── Component ────────────────────────────────────────────────────────────────────

export function DependenciesView({
  projectId,
  milestones,
  tasks,
  dependencies,
  locale,
  translations: t,
}: DependenciesViewProps) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task lookup
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Group structured dependencies
  const structuredDeps = dependencies.map((dep) => ({
    ...dep,
    predecessorTitle: taskMap.get(dep.predecessor_id)?.title ?? dep.predecessor_id,
    successorTitle: taskMap.get(dep.successor_id)?.title ?? dep.successor_id,
  }));

  // Text-based dependencies (fallback from dependency_notes)
  const tasksWithDeps = tasks.filter((task) => task.dependency_notes);
  const textDeps: {
    taskId: string;
    taskTitle: string;
    refs: { ref: string; title: string | null; status: string | null; isComplete: boolean }[];
  }[] = [];

  for (const task of tasksWithDeps) {
    const check = checkDependencies(task, tasks);
    if (check.dependencies.length > 0) {
      // Only include if any ref was resolved (not just text)
      const resolved = check.dependencies.filter((d) => d.taskId);
      if (resolved.length > 0) {
        textDeps.push({
          taskId: task.id,
          taskTitle: task.title,
          refs: resolved.map((d) => ({
            ref: d.ref,
            title: d.taskTitle,
            status: d.status,
            isComplete: d.isComplete,
          })),
        });
      }
    }
  }

  const handleDelete = useCallback(async (dependencyId: string) => {
    const res = await deleteDependencyAction({ dependencyId, projectId });
    if (res.error) {
      setError(t.errorUnexpected);
    } else {
      router.refresh();
    }
  }, [projectId, router, t.errorUnexpected]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAddDialog(true); setError(null); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <PlusCircle className="h-4 w-4" />
          {t.addDependency}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Structured Dependencies Table */}
      {structuredDeps.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.predecessor}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8"></th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.successor}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.type}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.lagDays}</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {structuredDeps.map((dep) => (
                <tr key={dep.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground truncate max-w-[200px]">
                    {dep.predecessorTitle}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-foreground truncate max-w-[200px]">
                    {dep.successorTitle}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.typeLabels[dep.dependency_type]}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {dep.lag_days > 0 ? `+${dep.lag_days}d` : dep.lag_days < 0 ? `${dep.lag_days}d` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleDelete(dep.id)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                      title={t.delete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Link2 className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t.noDependencies}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">{t.noDependenciesDescription}</p>
        </div>
      )}

      {/* Text-based Dependencies (fallback) */}
      {textDeps.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {t.textDependencies}
          </h3>
          <p className="text-xs text-muted-foreground/70">{t.textDependenciesDescription}</p>
          <div className="space-y-2">
            {textDeps.map((td) => (
              <div key={td.taskId} className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-medium text-foreground mb-1.5">{td.taskTitle}</p>
                <div className="space-y-1">
                  {td.refs.map((ref, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{ref.ref}</span>
                      {ref.title && <span className="text-foreground font-medium">{ref.title}</span>}
                      {ref.isComplete ? (
                        <span className="text-green-600 dark:text-green-400">{t.complete}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3" />
                          {t.incompleteWarning}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Dependency Dialog */}
      {showAddDialog && (
        <AddDependencyDialog
          projectId={projectId}
          tasks={tasks}
          locale={locale}
          translations={t}
          onClose={() => setShowAddDialog(false)}
          onCreated={() => {
            setShowAddDialog(false);
            router.refresh();
          }}
          isCreating={isCreating}
          setIsCreating={setIsCreating}
          setError={setError}
        />
      )}
    </div>
  );
}

// ── Add Dependency Dialog ──────────────────────────────────────────────────────

function AddDependencyDialog({
  projectId,
  tasks,
  locale,
  translations: t,
  onClose,
  onCreated,
  isCreating,
  setIsCreating,
  setError,
}: {
  projectId: string;
  tasks: RoadmapTask[];
  locale: Locale;
  translations: DependenciesViewTranslations;
  onClose: () => void;
  onCreated: () => void;
  isCreating: boolean;
  setIsCreating: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const [predecessorId, setPredecessorId] = useState("");
  const [successorId, setSuccessorId] = useState("");
  const [dependencyType, setDependencyType] = useState<DependencyType>("finish_to_start");
  const [lagDays, setLagDays] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!predecessorId || !successorId) return;

    setIsCreating(true);
    setError(null);

    const res = await createDependencyAction({
      predecessor_id: predecessorId,
      successor_id: successorId,
      dependency_type: dependencyType,
      lag_days: lagDays,
      projectId,
    });

    setIsCreating(false);

    if (res.error) {
      const errorMap: Record<string, string> = {
        circular_dependency: t.errorCircular,
        duplicate_dependency: t.errorDuplicate,
        self_dependency: t.errorSelf,
        task_not_found: t.errorNotFound,
        unexpected: t.errorUnexpected,
      };
      setError(errorMap[res.error] || t.errorUnexpected);
    } else {
      onCreated();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{t.addDependency}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Predecessor */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">{t.predecessor}</label>
            <select
              value={predecessorId}
              onChange={(e) => setPredecessorId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isCreating}
            >
              <option value="">{t.selectPredecessor}</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id} disabled={task.id === successorId}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          {/* Successor */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">{t.successor}</label>
            <select
              value={successorId}
              onChange={(e) => setSuccessorId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isCreating}
            >
              <option value="">{t.selectSuccessor}</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id} disabled={task.id === predecessorId}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          {/* Dependency Type + Lag Days */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">{t.dependencyType}</label>
              <select
                value={dependencyType}
                onChange={(e) => setDependencyType(e.target.value as DependencyType)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isCreating}
              >
                <option value="finish_to_start">{t.typeLabels.finish_to_start}</option>
                <option value="start_to_start">{t.typeLabels.start_to_start}</option>
                <option value="start_to_finish">{t.typeLabels.start_to_finish}</option>
                <option value="finish_to_finish">{t.typeLabels.finish_to_finish}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">{t.lagDaysLabel}</label>
              <input
                type="number"
                value={lagDays}
                onChange={(e) => setLagDays(parseInt(e.target.value) || 0)}
                min={-365}
                max={365}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isCreating}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isCreating || !predecessorId || !successorId}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreating ? t.creating : t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}