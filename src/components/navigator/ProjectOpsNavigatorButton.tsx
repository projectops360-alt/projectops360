"use client";

// ============================================================================
// ProjectOpsNavigatorButton — global header entry point for the Navigator
// ============================================================================
// Renders the bilingual "Navigator / Navegador" button in the top bar and
// owns the open state of the contextual drawer.
// ============================================================================

import { useState } from "react";
import { useLocale } from "next-intl";
import { Compass } from "lucide-react";
import type { Locale } from "@/types/database";
import { navigatorContent, toNavigatorLanguage } from "@/features/navigator/navigatorContent";
import { ProjectOpsNavigatorDrawer } from "@/components/navigator/ProjectOpsNavigatorDrawer";

export function ProjectOpsNavigatorButton() {
  const locale = useLocale() as Locale;
  const language = toNavigatorLanguage(locale);
  const chrome = navigatorContent[language].chrome;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={chrome.openHelp}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand-400 hover:bg-muted hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        <Compass className="h-4 w-4 text-brand-600" aria-hidden="true" />
        <span className="hidden sm:inline">{chrome.buttonLabel}</span>
      </button>

      <ProjectOpsNavigatorDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}