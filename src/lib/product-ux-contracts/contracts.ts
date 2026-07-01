// ============================================================================
// ProjectOps360° — Product UX Contracts (code-level, client-safe)
// ============================================================================
// Approved UX decisions that MUST NOT be silently reverted. Each contract is
// mirrored in the Product Brain (docs/product-brain/32-product-ux-contracts.md)
// and protected by automated tests. Runtime code should import the predicate(s)
// here instead of re-deriving the rule, so there is ONE source of truth and a
// future refactor cannot drift from the approved behavior.
// ============================================================================

export interface ProductUxContract {
  /** Stable id, e.g. "UX-001". */
  id: string;
  title: string;
  status: "APPROVED";
  /** Regression this contract guards, when applicable. */
  regression?: string;
  /** The binding rules, in plain language (also the test oracle). */
  rules: string[];
}

// ── UX-001 — Isabella Welcome Hero Lifecycle (REG-014) ──────────────────────

export type IsabellaLayoutState = "EMPTY_WELCOME" | "ACTIVE_CONTENT";

/**
 * The signals that determine Isabella's layout state. Kept deliberately small
 * and serializable so the rule is testable and cannot be quietly bypassed.
 */
export interface IsabellaLayoutSignals {
  /** Number of conversation turns (user/assistant messages). */
  turnCount: number;
  /** A Project or Portfolio Briefing is currently shown (counts as content). */
  briefingActive: boolean;
  /** A request is in flight. */
  pending: boolean;
  /** Length of the (trimmed) composer input — first character → active. */
  inputLength: number;
  /** The user explicitly re-expanded the avatar (UX-004) — user-initiated only. */
  avatarManuallyExpanded: boolean;
}

/**
 * Resolve Isabella's layout state. ACTIVE_CONTENT the moment ANY active content
 * or interaction exists; EMPTY_WELCOME only in a genuine empty/first-load state.
 * A briefing counts as active assistant content (REG-014).
 */
export function resolveIsabellaLayoutState(s: IsabellaLayoutSignals): IsabellaLayoutState {
  const active = s.turnCount > 0 || s.briefingActive || s.pending || s.inputLength > 0;
  return active ? "ACTIVE_CONTENT" : "EMPTY_WELCOME";
}

/**
 * Whether the compact header must be shown. True in ACTIVE_CONTENT unless the
 * user has explicitly re-expanded the avatar (an allowed, user-initiated action;
 * never an automatic state).
 */
export function isCompactHeaderRequired(s: IsabellaLayoutSignals): boolean {
  return resolveIsabellaLayoutState(s) === "ACTIVE_CONTENT" && !s.avatarManuallyExpanded;
}

/**
 * Whether the full Welcome Hero may be visible. It may ONLY appear in
 * EMPTY_WELCOME, or when the user manually re-expanded it. It must NEVER appear
 * automatically while a briefing or conversation exists — that stacked layout is
 * exactly the REG-014 regression.
 */
export function isFullHeroVisible(s: IsabellaLayoutSignals): boolean {
  return !isCompactHeaderRequired(s);
}

export const UX_001_ISABELLA_WELCOME_HERO: ProductUxContract = {
  id: "UX-001",
  title: "Isabella Welcome Hero Lifecycle",
  status: "APPROVED",
  regression: "REG-014",
  rules: [
    "Show the full Welcome Hero only in the empty first-load state.",
    "Collapse the Welcome Hero after the first user interaction.",
    "Collapse the Welcome Hero when a Project (or Portfolio) Briefing is generated.",
    "Collapse the Welcome Hero when any assistant content exists.",
    "Collapse the Welcome Hero when any conversation message exists.",
    "Animate the collapse smoothly (250–350ms); honor prefers-reduced-motion.",
    "During active content/conversation, show only the compact Isabella header (≤70px).",
    "The full hero must not reappear automatically during the same active conversation.",
    "The full hero may return only on New Conversation, Reset Isabella, or empty history.",
    "A Project Briefing counts as active assistant content.",
    "Saving/reloading UI state must not restore the full hero when active content exists.",
  ],
};

// ── UX-014 — Internal AI Prompt Metadata Must Not Be User-Facing ────────────

/**
 * Internal/developer AI-implementation metadata fields on a task. These store
 * the prompt text used during AI-assisted implementation and the target AI tool
 * — NOT a user-facing AI interaction. They MUST NOT appear as editable fields in
 * the normal task editor (an external reviewer reasonably read "Prompt de IA" as
 * an interactive AI input). User-facing AI help is routed through Isabella.
 *
 * This is the single source of truth for the rule; the task form and its
 * regression test both import from here so the field cannot quietly return.
 */
export const TASK_EDITOR_INTERNAL_AI_FIELDS = [
  "prompt_body",
  "prompt_context",
  "ai_tool_target",
] as const;

export type TaskEditorInternalAiField = (typeof TASK_EDITOR_INTERNAL_AI_FIELDS)[number];

/** True when a task field name is internal AI metadata that must not be user-facing. */
export function isInternalAiTaskField(name: string): boolean {
  return (TASK_EDITOR_INTERNAL_AI_FIELDS as readonly string[]).includes(name);
}

/** Labels that must NEVER appear in the normal task editor (case-insensitive). */
export const TASK_EDITOR_FORBIDDEN_LABELS = [
  "ai prompt",
  "prompt de ia",
  "developer prompt",
  "implementation prompt",
  "system prompt",
  "hidden ai instructions",
] as const;

/** True when a user-facing task-editor label is a forbidden internal/AI label. */
export function isForbiddenTaskEditorLabel(label: string): boolean {
  const l = label.trim().toLowerCase();
  return (TASK_EDITOR_FORBIDDEN_LABELS as readonly string[]).some((bad) => l === bad || l.includes(bad));
}

export const UX_014_TASK_EDITOR_AI_PROMPT: ProductUxContract = {
  id: "UX-014",
  title: "Internal AI Prompt Metadata Must Not Be User-Facing",
  status: "APPROVED",
  rules: [
    "Static AI prompt fields (prompt_body, prompt_context, ai_tool_target) must not appear in the normal task editor.",
    "User-facing AI actions must be explicit actions routed through Isabella (e.g. 'Ask Isabella about this task').",
    "Internal AI metadata must be hidden or permission-protected — never exposed by frontend-only logic.",
    "Existing stored prompt metadata must not be destroyed by a normal task save (preserve-on-absent).",
    "Forbidden user-facing labels: AI Prompt, Prompt de IA, Developer Prompt, Implementation Prompt, System Prompt, Hidden AI Instructions.",
    "Allowed notes labels remain: Implementation Notes, Testing Notes, Acceptance Criteria, Tracking & Notes.",
    "Future task editor redesigns must preserve this rule.",
  ],
};

export const PRODUCT_UX_CONTRACTS: ProductUxContract[] = [
  UX_001_ISABELLA_WELCOME_HERO,
  UX_014_TASK_EDITOR_AI_PROMPT,
];
