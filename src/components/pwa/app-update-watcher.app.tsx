"use client";

import { useTranslations } from "next-intl";
import { AppUpdateWatcher } from "./app-update-watcher";

/** Update watcher for the authenticated app, translated with next-intl. */
export function AppUpdateWatcherWithCopy() {
  // Flat keys, not a nested `update` object: the PWA copy surfaces are guarded
  // as Record<string, string> and a nested value breaks that contract.
  const t = useTranslations("pwa");
  return (
    <AppUpdateWatcher
      copy={{
        message: t("updateMessage"),
        action: t("updateAction"),
        dismiss: t("updateDismiss"),
      }}
    />
  );
}
