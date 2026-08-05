// ============================================================================
// Permanent deletion — confirmation state machine
// ============================================================================
// Destroying a project is irreversible, so the user must clear two separate
// gates before anything is written. Keeping the transition here (rather than
// inline in the dialog) makes "one click can never destroy a project" an
// executable guarantee instead of a property of some JSX.
// ============================================================================

export type DeletionStep = 1 | 2;

export interface DeletionTransition {
  /** The step to render next. */
  step: DeletionStep;
  /** Whether this confirmation is the one that actually destroys the project. */
  destroy: boolean;
}

/** Advance the confirmation. Only the second gate authorises destruction. */
export function advanceDeletion(step: DeletionStep): DeletionTransition {
  if (step === 1) return { step: 2, destroy: false };
  return { step: 2, destroy: true };
}

/** Cancelling at any point returns to the start — never a partial commitment. */
export function resetDeletion(): DeletionStep {
  return 1;
}

export interface DeletionCounts {
  tasks: number;
  milestones: number;
  dependencies: number;
  events: number;
}

/**
 * The lines listed in the first confirmation. Zero-valued rows are omitted so
 * the warning states what is really at stake instead of padding it with "0
 * milestones", which trains people to skim past the dialog.
 */
export function deletionImpactLines(
  counts: DeletionCounts,
  labels: { tasks: string; milestones: string; dependencies: string; events: string },
): string[] {
  return (
    [
      [counts.tasks, labels.tasks],
      [counts.milestones, labels.milestones],
      [counts.dependencies, labels.dependencies],
      [counts.events, labels.events],
    ] as const
  )
    .filter(([value]) => value > 0)
    .map(([, label]) => label);
}
