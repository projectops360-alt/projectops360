"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, SquarePlus, X } from "lucide-react";

/** Chromium's install event. Not in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_AT_KEY = "po360.pwa-install-dismissed-at";
/** A declined invitation is respected for a month before we ask again. */
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** iOS has no install event, so its hint is shown on a short delay instead. */
const IOS_HINT_DELAY_MS = 2_500;

function isRunningInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes its own flag rather than the display-mode media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iosDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const webkitOnly = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iosDevice && webkitOnly;
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_AT_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_WINDOW_MS;
  } catch {
    // Private mode / storage disabled: fall back to always inviting.
    return false;
  }
}

export function PwaInstallPrompt() {
  const t = useTranslations("pwa");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  // Register the service worker. Without it browsers never fire the install
  // event, so this must run regardless of whether the banner ends up visible.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration only costs installability, never the app.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    if (isRunningInstalled() || wasRecentlyDismissed()) return;

    function onBeforeInstallPrompt(event: Event) {
      // Suppressing the mini-infobar lets us choose the moment and the wording.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstallEvent(null);
      setShowIosHint(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    let timer: number | undefined;
    if (isIosSafari()) {
      timer = window.setTimeout(() => setShowIosHint(true), IOS_HINT_DELAY_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    } catch {
      // Nothing to persist to; the banner simply returns next session.
    }
    setInstallEvent(null);
    setShowIosHint(false);
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // The event is single-use either way.
    setInstallEvent(null);
    if (outcome === "dismissed") dismiss();
  }, [dismiss, installEvent]);

  if (!installEvent && !showIosHint) return null;

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:mx-0 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-950 dark:text-slate-50">
            {t("title")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
            {showIosHint ? t("iosBody") : t("body")}
          </p>
          {showIosHint ? (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Share className="h-3.5 w-3.5" aria-hidden />
              {t("iosStepShare")}
              <span aria-hidden>→</span>
              <SquarePlus className="h-3.5 w-3.5" aria-hidden />
              {t("iosStepAdd")}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {t("install")}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t("later")}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
