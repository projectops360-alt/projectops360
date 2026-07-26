"use client";

import { useTranslation } from "react-i18next";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";

/**
 * Install banner for the public landing.
 *
 * The landing is where anonymous visitors actually arrive — the site root
 * redirects them here — so without this mount nobody would ever be invited to
 * install, and the service worker would never register on first contact.
 * Translated with the landing's own react-i18next instance, not next-intl.
 */
export function LandingPwaInstallPrompt() {
  const { t } = useTranslation();
  return (
    <PwaInstallPrompt
      copy={{
        title: t("pwa.title"),
        body: t("pwa.body"),
        install: t("pwa.install"),
        later: t("pwa.later"),
        dismiss: t("pwa.dismiss"),
        iosBody: t("pwa.iosBody"),
        iosStepShare: t("pwa.iosStepShare"),
        iosStepAdd: t("pwa.iosStepAdd"),
      }}
    />
  );
}
