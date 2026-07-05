"use client";

// Repository picker shown after a GitHub App installation (Mode A). Lets the
// user choose which installation repositories to connect to this software
// project. Selection is re-validated server-side in selectRepositoriesAction.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitGraph, Loader2, Lock, Check } from "lucide-react";
import { selectRepositoriesAction } from "@/app/[locale]/(app)/projects/[projectId]/github/actions";
import type { InstallableRepo } from "@/lib/github-intelligence/installation";

export function RepoPicker({
  projectId,
  installationId,
  repos,
  isEs,
}: {
  projectId: string;
  installationId: number;
  repos: InstallableRepo[];
  isEs: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (repos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {isEs
          ? "La instalación no tiene repositorios accesibles. Ajusta el acceso de la GitHub App e inténtalo de nuevo."
          : "The installation has no accessible repositories. Adjust the GitHub App's repository access and try again."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">
        {isEs ? "Selecciona repositorios para conectar" : "Select repositories to connect"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {isEs
          ? "Solo lectura. Puedes cambiar la selección más tarde."
          : "Read-only. You can change the selection later."}
      </p>

      <ul className="mt-3 space-y-1.5">
        {repos.map((r) => {
          const on = selected.has(r.githubRepositoryId);
          return (
            <li key={r.githubRepositoryId}>
              <button
                type="button"
                onClick={() => toggle(r.githubRepositoryId)}
                className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                  on ? "border-brand-500/50 bg-brand-500/5" : "border-border hover:border-brand-500/30"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    on ? "border-brand-500 bg-brand-500 text-white" : "border-muted-foreground/40"
                  }`}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                <GitGraph className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm font-medium text-foreground">{r.fullName}</span>
                {r.private && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        disabled={pending || selected.size === 0}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await selectRepositoriesAction(projectId, installationId, Array.from(selected));
            if (res.ok) router.push(`/en/projects/${projectId}/github`);
            else setError(res.error ?? "error");
          })
        }
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitGraph className="h-4 w-4" />}
        {isEs
          ? `Conectar ${selected.size} repositorio${selected.size === 1 ? "" : "s"}`
          : `Connect ${selected.size} repositor${selected.size === 1 ? "y" : "ies"}`}
      </button>
    </div>
  );
}
