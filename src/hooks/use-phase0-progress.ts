"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskStatus, Phase0Progress } from "@/types/phase0";

const STORAGE_KEY = "pops360_phase0_progress";

const defaultProgress: Phase0Progress = {
  taskStatuses: {},
  taskNotes: {},
  lastSaved: new Date().toISOString(),
};

function loadProgress(): Phase0Progress {
  if (typeof window === "undefined") return defaultProgress;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultProgress;
  } catch {
    return defaultProgress;
  }
}

function saveProgress(progress: Phase0Progress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function usePhase0Progress() {
  const [progress, setProgress] = useState<Phase0Progress>(defaultProgress);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setLoaded(true);
  }, []);

  const setTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setProgress((prev) => {
      const next = {
        ...prev,
        taskStatuses: { ...prev.taskStatuses, [taskId]: status },
        lastSaved: new Date().toISOString(),
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const setTaskNotes = useCallback((taskId: string, notes: string) => {
    setProgress((prev) => {
      const next = {
        ...prev,
        taskNotes: { ...prev.taskNotes, [taskId]: notes },
        lastSaved: new Date().toISOString(),
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const next = { ...defaultProgress, lastSaved: new Date().toISOString() };
    saveProgress(next);
    setProgress(next);
  }, []);

  return { progress, loaded, setTaskStatus, setTaskNotes, resetProgress };
}