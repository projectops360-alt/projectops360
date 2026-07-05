"use client";

// Client action buttons for the GitHub Intelligence dashboard. Thin wrappers
// over server actions (guarded server-side) with pending state.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, GitGraph, Loader2, Plug, Unplug } from "lucide-react";
import {
  manualSyncAction,
  devConnectSampleRepositoryAction,
  startInstallationAction,
  disconnectRepositoryAction,
} from "@/app/[locale]/(app)/projects/[projectId]/github/actions";

export function RefreshButton({
  projectId,
  repositoryId,
  isEs,
}: {
  projectId: string;
  repositoryId: string;
  isEs: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await manualSyncAction(projectId, repositoryId);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-brand-500/40 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {isEs ? "Actualizar datos" : "Refresh data"}
    </button>
  );
}

export function ConnectSampleButton({ projectId, isEs }: { projectId: string; isEs: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await devConnectSampleRepositoryAction(projectId);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitGraph className="h-4 w-4" />}
      {isEs ? "Conectar repositorio de muestra" : "Connect sample repository"}
    </button>
  );
}

export function StartInstallButton({ projectId, isEs }: { projectId: string; isEs: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startInstallationAction(projectId);
          if (res.ok && res.installUrl) window.location.href = res.installUrl;
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
      {isEs ? "Conectar GitHub" : "Connect GitHub"}
    </button>
  );
}

export function DisconnectButton({
  projectId,
  repositoryId,
  isEs,
}: {
  projectId: string;
  repositoryId: string;
  isEs: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await disconnectRepositoryAction(projectId, repositoryId);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-600 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
      {isEs ? "Desconectar" : "Disconnect"}
    </button>
  );
}
