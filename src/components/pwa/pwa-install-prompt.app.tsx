"use client";

import { useTranslations } from "next-intl";
import { PwaInstallPrompt } from "./pwa-install-prompt";

/** Install banner for the authenticated app, translated with next-intl. */
export function AppPwaInstallPrompt() {
  const t = useTranslations("pwa");
  return (
    <PwaInstallPrompt
      copy={{
        title: t("title"),
        body: t("body"),
        install: t("install"),
        later: t("later"),
        dismiss: t("dismiss"),
        iosBody: t("iosBody"),
        iosStepShare: t("iosStepShare"),
        iosStepAdd: t("iosStepAdd"),
      }}
    />
  );
}
