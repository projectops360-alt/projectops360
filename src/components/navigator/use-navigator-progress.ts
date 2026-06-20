"use client";

// ============================================================================
// Navigator onboarding progress — localStorage-backed completion tracking
// ============================================================================
// MVP: lifecycle step completion is stored in localStorage so no database
// changes are required. Steps are toggled manually from the lifecycle map.
// ============================================================================

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "projectops360.navigator.completedSteps";

function readSteps(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeSteps(steps: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

export function useNavigatorProgress() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setCompleted(readSteps());
    setHydrated(true);
  }, []);

  // Keep multiple instances (e.g. button + drawer) in sync across tabs/instances.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setCompleted(readSteps());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleStep = useCallback((stepKey: string) => {
    setCompleted((prev) => {
      const next = prev.includes(stepKey)
        ? prev.filter((k) => k !== stepKey)
        : [...prev, stepKey];
      writeSteps(next);
      return next;
    });
  }, []);

  const isComplete = useCallback((stepKey: string) => completed.includes(stepKey), [completed]);

  return { completed, toggleStep, isComplete, hydrated };
}