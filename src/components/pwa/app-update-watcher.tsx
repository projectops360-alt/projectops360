"use client";

// ============================================================================
// PWA auto-update watcher
// ============================================================================
// An installed app is a long-lived client: it can sit on someone's home screen
// for weeks and never reload. The service worker caches no HTML or JS, so a
// fresh navigation already gets the new build — the gap is the install that is
// never navigated, only resumed.
//
// This closes that gap: it compares the build id compiled into this bundle
// against the one the server reports, reloads when it can do so without
// interrupting anyone, and asks when it cannot. See `lib/pwa/update-policy`
// for the rule itself.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  BACKGROUND_THRESHOLD_MS,
  FOREGROUND_POLL_MS,
  decideUpdateAction,
  isComparableBuildId,
} from "@/lib/pwa/update-policy";

const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "development";

export interface AppUpdateCopy {
  /** e.g. "A new version is available." */
  message: string;
  /** e.g. "Update" */
  action: string;
  /** e.g. "Dismiss" */
  dismiss: string;
}

export function AppUpdateWatcher({ copy }: { copy: AppUpdateCopy }) {
  const [updateReady, setUpdateReady] = useState(false);
  const hiddenSince = useRef<number | null>(null);
  const checking = useRef(false);

  /** Ask the server which build is live. Null on any failure — never a guess. */
  const fetchLatestBuildId = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/version", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      const buildId = (data as { buildId?: unknown })?.buildId;
      return typeof buildId === "string" ? buildId : null;
    } catch {
      // Offline, or the check raced a deploy. Either way: no decision.
      return null;
    }
  }, []);

  const check = useCallback(
    async (wasBackgrounded: boolean) => {
      if (checking.current) return;
      // Nothing to compare against in local dev.
      if (!isComparableBuildId(CURRENT_BUILD_ID)) return;
      checking.current = true;
      try {
        const latestBuildId = await fetchLatestBuildId();
        const action = decideUpdateAction({
          currentBuildId: CURRENT_BUILD_ID,
          latestBuildId,
          wasBackgrounded,
          hasUnsavedWork: hasUnsavedWork(),
        });

        if (action === "reload") {
          window.location.reload();
          return;
        }
        if (action === "prompt") setUpdateReady(true);
      } finally {
        checking.current = false;
      }
    },
    [fetchLatestBuildId],
  );

  // Resume + periodic checks.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
        return;
      }
      const hiddenFor = hiddenSince.current ? Date.now() - hiddenSince.current : 0;
      hiddenSince.current = null;
      // Also nudge the browser to re-fetch sw.js so the worker itself can move
      // forward; it calls skipWaiting(), so there is no stuck-waiting state.
      void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
      void check(hiddenFor >= BACKGROUND_THRESHOLD_MS);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check(false);
    }, FOREGROUND_POLL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [check]);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4"
    >
      <div className="flex w-full max-w-md min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
        <RefreshCw className="h-4 w-4 shrink-0 text-brand-500" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-foreground">{copy.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 sm:min-h-0 sm:py-2"
        >
          {copy.action}
        </button>
        <button
          type="button"
          onClick={() => setUpdateReady(false)}
          aria-label={copy.dismiss}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground sm:min-h-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Best-effort check for work that a reload would destroy. The app has no global
 * dirty-state store, so this reads the DOM: a focused text field, or any form
 * that has opted in via `data-unsaved`.
 */
function hasUnsavedWork(): boolean {
  if (typeof document === "undefined") return false;
  if (document.querySelector("[data-unsaved='true']")) return true;

  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (active.getAttribute("contenteditable") === "true") return true;
  if (tag === "input") {
    const type = (active as HTMLInputElement).type;
    const typed = (active as HTMLInputElement).value.length > 0;
    return typed && !["checkbox", "radio", "submit", "button"].includes(type);
  }
  return false;
}
