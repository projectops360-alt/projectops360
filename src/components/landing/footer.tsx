"use client";

import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-[#e8eef0] bg-white">
      <div className="mx-auto flex max-w-[1800px] flex-col items-center justify-between gap-3 px-6 py-8 text-[13px] text-[#94a5a2] sm:flex-row">
        <span>{t("footer.copyright")}</span>
        <span>{t("footer.tags")}</span>
      </div>
    </footer>
  );
}
