// ============================================================================
// ProjectOps360° — "Resolve now" (blocker alert) navigation target
// ============================================================================
// Product rule (REG-BLOCKER-RESOLVE-OPENS-TASK): the dashboard "Resolve now"
// button OPENS the blocked task in the existing Workboard editor so the user
// decides what to do. It NEVER mutates: it must not change status, complete the
// task, delete the blocker, or run any recommendation. A pure href → the button
// is a plain navigation that can never hang on a server action.
// ============================================================================

/**
 * Build the deep-link that opens a task in the Workboard editor.
 * `projectBaseHref` is the localized `/{locale}/projects/{projectId}` base.
 */
export function buildBlockerResolveHref(projectBaseHref: string, taskId: string): string {
  return `${projectBaseHref}/workboard?task=${encodeURIComponent(taskId)}`;
}
