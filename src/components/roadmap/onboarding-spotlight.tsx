"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, X, PlusCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface OnboardingSpotlightProps {
  locale: string;
  /** Callback to open the milestone creation dialog */
  onCreateMilestone: () => void;
  /** i18n messages */
  title: string;
  description: string;
  ctaLabel: string;
  dismissLabel: string;
}

// ── Component ────────────────────────────────────────────────────────────────────

const ONBOARDING_SEEN_KEY = "projectops360_onboarding_seen";

export function OnboardingSpotlight({
  locale: _locale,
  onCreateMilestone,
  title,
  description,
  ctaLabel,
  dismissLabel,
}: OnboardingSpotlightProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if URL has ?onboard=true AND localStorage hasn't seen it
    const isOnboarding = searchParams.get("onboard") === "true";
    const alreadySeen = localStorage.getItem(ONBOARDING_SEEN_KEY) === "true";
    if (isOnboarding && !alreadySeen) {
      const id = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(id);
    }
  }, [searchParams]);

  if (!visible) return null;

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    // Clean up the URL by removing ?onboard=true
    const url = new URL(window.location.href);
    url.searchParams.delete("onboard");
    router.replace(url.pathname + url.hash, { scroll: false });
  }

  function handleCreate() {
    setVisible(false);
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    // Clean up the URL
    const url = new URL(window.location.href);
    url.searchParams.delete("onboard");
    router.replace(url.pathname + url.hash, { scroll: false });
    // Open the milestone creation dialog
    onCreateMilestone();
  }

  return (
    <div className="mb-6 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-brand-100/50 dark:from-brand-950/30 dark:to-brand-900/20 dark:border-brand-800 p-5 transition-all">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/50">
          <Sparkles className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <PlusCircle className="h-4 w-4" />
              {ctaLabel}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {dismissLabel}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={dismissLabel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}