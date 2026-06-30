# 32 — Product UX Contracts

> **Approved UX decisions that must not be silently reverted.** A Product UX Contract is a binding,
> immutable-by-default agreement about how a surface behaves. Unlike general UX debt (doc 25), a
> contract is **APPROVED** and protected by **code-level constants + automated tests**, so a future
> refactor cannot quietly overwrite it. If a contract must change, that is an explicit Product
> Decision (doc 30) — never an accident.

**Authority:** a Product UX Contract overrides ad-hoc UI changes. Code source of truth:
`src/lib/product-ux-contracts/contracts.ts`. Tests: `src/lib/product-ux-contracts/__tests__/**`.

| Contract | Title | Status | Guards | Source |
|----------|-------|--------|--------|--------|
| UX-001 | Isabella Welcome Hero Lifecycle | **APPROVED** | [REG-014](10-regression-log.md#reg-014) | `contracts.ts` · `isabella-welcome-hero.test.ts` |
| UX-002 | Living Graph Saved Layouts are presentation-only | **APPROVED** (test exists; contract to be formalized in `contracts.ts`) | [UX-007 / PD-008](30-product-decision-log.md) | `src/lib/graph/__tests__/graph-layout-storage.test.ts` |
| UX-003 | Navigation never hides/orphans a strategic module (BIM visible-or-explained) | **APPROVED** (test exists; contract to be formalized) | [REG-012](10-regression-log.md#reg-012) · UX-006 | `src/components/layout/__tests__/project-tabs-nav.test.ts` |
| UX-004 | Metric rollups are consistent across surfaces (terminal tasks never blockers) | **APPROVED** (test exists; contract to be formalized) | [REG-010](10-regression-log.md#reg-010) · REG-008 | `src/lib/project-rollups/__tests__/project-rollup-engine.test.ts` · `task-activity.test.ts` |
| UX-008 | Living Graph edges are explainable (task tooltip) | **APPROVED** | — (usability; reuses REG-008/010 status rules) | `src/lib/graph/__tests__/edge-task-tooltip.test.ts` |
| UX-009 | Closeout Report has dashboard prominence | **APPROVED** | [REG-015](10-regression-log.md#reg-015) | `src/components/layout/__tests__/project-tabs-nav.test.ts` (Status placement) |
| UX-010 | Closeout Report process is guided & discoverable | **APPROVED** | — (usability) | `src/lib/rhythm/__tests__/closeout-workflow.test.ts` |
| UX-012 | Language Consistency / No Spanglish | **APPROVED** | — (usability/quality) | `contracts.ts` · `src/lib/i18n/glossary.ts` · `src/i18n/__tests__/message-parity.test.ts` · `glossary-consistency.test.ts` |
| UX-014 | Internal AI prompt metadata must not be user-facing (task editor) | **APPROVED** | [PD-013](30-product-decision-log.md#pd-013) | `contracts.ts` · `src/components/roadmap/__tests__/task-editor-ai-prompt-visibility.test.ts` |

> **Placeholders (UX-002/003/004)** already have executable tests guarding the behavior; they are
> listed here so the contract registry is the single index. Promote each to a full `contracts.ts`
> entry (like UX-001) when its rule is next touched — the test is the binding part, the registry row
> makes it discoverable.

---

## UX-001 — Isabella Welcome Hero Lifecycle

**Status:** APPROVED · **Guards:** REG-014 · **Also relates to:** UX-004 (compact layout), REG-013
(Project Health Briefing).

**Principle:** the Isabella avatar is a **welcome affordance, not permanent workspace chrome.** Once
Isabella has something useful to say, the content wins. A Project Briefing is active content.

**Contract (binding):**
- Show the full Welcome Hero **only** in the empty first-load state.
- Collapse the Welcome Hero after the first user interaction.
- Collapse the Welcome Hero when a Project (or Portfolio) Briefing is generated.
- Collapse the Welcome Hero when any assistant content exists.
- Collapse the Welcome Hero when any conversation message exists.
- Animate the collapse smoothly (**250–350ms**); honor `prefers-reduced-motion` (state still wins).
- During active content/conversation, show only the **compact Isabella header (≤70px)**.
- The full hero **must not reappear automatically** during the same active conversation.
- The full hero may return **only** on New Conversation, Reset Isabella, or empty history — or by an
  explicit user re-expand (UX-004), which is user-initiated, never automatic.
- A Project Briefing counts as active assistant content.
- Saving/reloading UI state must not restore the full hero when active content exists.

**State machine (`resolveIsabellaLayoutState`):**
- `EMPTY_WELCOME` — no turns, no briefing, not pending, empty input.
- `ACTIVE_CONTENT` — any of: a briefing is active, ≥1 turn, a pending request, or the first typed
  character. → compact header (unless the user manually re-expanded the avatar).

**Implementation:** `src/lib/product-ux-contracts/contracts.ts` (rule) → consumed by
`src/components/isabella/isabella-experience.tsx` (full hero in `.heroWrap`, CSS-collapsed when
active). **Do not** re-derive the rule inline; import it so there is one source of truth.

**The regression to never reintroduce:** a large avatar/hero stacked above a Project Briefing or an
active conversation.

---

## UX-008 — Living Graph Edge Task Tooltip

**Status:** APPROVED · **Reuses:** REG-008/REG-010 status rules (`task-activity.ts`).

**Principle:** Living Graph edges are **not decorative** — they are evidence. If an edge says
"3 tasks", the user must be able to see *which* 3 tasks and *what state* they are in.

**Contract (binding):**
- Hovering a milestone-connection edge (its path) **or** its task-count badge shows a read-only
  tooltip listing the tasks the connection represents, each with its current status.
- On touch, **tapping** the task-count badge toggles the tooltip; tapping outside / re-tapping closes it.
- The tooltip header shows `source → target` milestone titles and the title "Tasks between milestones".
- Status is **deterministic** and uses the same canonical rules as the rest of the product: a
  completed task with a stale `is_blocked` flag is **Done**, never Blocked (REG-008); **Waiting** is
  distinct from **Blocked**.
- It **never invents** tasks, owners, dates, priorities or statuses; missing fields are omitted.
- It is **read-only**: it must not modify graph data, dependencies, milestones, tasks, blockers, or
  rollups. No DB query and no AI call on hover.
- Long lists show the first ~7 tasks then "+N more tasks".

**Implementation:** task list attached to milestone-chain edges in
`src/lib/graph/living-graph-analysis.ts` (`edge.metadata.taskList`); pure helpers in
`src/lib/graph/edge-task-tooltip.ts`; rendered by `MilestoneChainEdge` in
`src/components/graph/living-graph-edge.tsx`. Protected by
`src/lib/graph/__tests__/edge-task-tooltip.test.ts`.

---

## UX-010 — Closeout Report process is guided & discoverable

**Status:** APPROVED.

**Principle:** A report page must not only say what is missing — it must **guide** the PM through the
process. The Closeout Report answers: *what is missing · where do I fix it · where do I run the
closing meeting · when can I generate the narrative · when can I download the final report*.

**Contract (binding):**
- The Closeout Report page shows a **guided workflow** (6 steps): check readiness → resolve
  requirements → Closing Project meeting → generate AI executive summary → review → download PDF.
- It shows a **single primary CTA appropriate to the current state**: *Create Closing Project
  Meeting* (no meeting) · *Open Closing Project Meeting* (scheduled) · *Generate Executive Summary*
  (meeting completed, no narrative) · *Download PDF* (report ready). Download PDF is **secondary**
  while the report is not ready and is never the only prominent action.
- **Pending readiness requirements are actionable**: each failing check links to the real route that
  resolves it (open tasks/blockers → Workboard, risks/milestones → Execution Map, decisions →
  Decisions, follow-ups → Communications, budget → Budget). No fabricated routes.
- The **Closing Project meeting runs in Project Memory → Rhythm Center** (`/rhythm`); the page routes
  the user there. The **AI narrative is generated only when the closing meeting is completed**;
  Download PDF exports, it does not generate.
- **States:** not_started · readiness_incomplete · ready_for_closing_meeting · meeting_scheduled ·
  meeting_completed · report_ready · exported, shown as a badge.
- **RBAC:** generating the narrative requires PMO/PM/member (not viewer).

**Implementation:** state machine in `src/lib/rhythm/closeout-workflow.ts` (pure); on-demand
generation `src/app/.../closeout/actions.ts` (`generateCloseoutNarrativeAction`, allowlisted by
role); UI in `closeout-client.tsx`; closing-meeting status loaded in `closeout/page.tsx`. Protected
by `src/lib/rhythm/__tests__/closeout-workflow.test.ts`.

---

## UX-014 — Internal AI Prompt Metadata Must Not Be User-Facing

**Status:** APPROVED · **Guards:** [PD-013](30-product-decision-log.md#pd-013).

**Principle:** if a field looks like an AI chat prompt, users will expect an AI answer. The task's
`prompt_body` / `prompt_context` / `ai_tool_target` are **internal AI-implementation metadata** (the
prompt used during AI-assisted development and the target tool), not a user-facing AI interaction.
An external reviewer reasonably read the **"Prompt de IA"** field in the task editor as an interactive
AI input — that confusion makes the product feel unfinished/technically exposed. User-facing AI help
belongs to **Isabella**.

**Contract (binding):**
- The normal task editor **must not** render `prompt_body`, `prompt_context`, or `ai_tool_target` as
  editable fields — for **any** role (PMO, PM, member, collaborator, viewer, external reviewer).
- User-facing AI help is an **explicit action routed through Isabella** ("Ask Isabella about this
  task"), never a static internal prompt field.
- Internal AI metadata, if ever surfaced in UI, must be **permission-protected**, never exposed by
  frontend-only logic.
- A normal task save **must preserve** any existing stored prompt metadata (preserve-on-absent) — it
  must never null it out. No destructive migration; cleanup is a documented follow-up if ever needed.
- Forbidden user-facing labels: **AI Prompt, Prompt de IA, Developer Prompt, Implementation Prompt,
  System Prompt, Hidden AI Instructions.** Allowed notes labels remain: Implementation Notes, Testing
  Notes, Acceptance Criteria, Tracking & Notes.
- Future task-editor redesigns must preserve this rule.

**Implementation:** rule + constants in `src/lib/product-ux-contracts/contracts.ts`
(`TASK_EDITOR_INTERNAL_AI_FIELDS`, `isInternalAiTaskField`, `isForbiddenTaskEditorLabel`,
`UX_014_TASK_EDITOR_AI_PROMPT`). The field was removed from
`src/components/roadmap/task-form-dialog.tsx` (section relabeled "Implementation & Testing Notes",
keeping `implementation_notes` + `test_notes`); the "Ask Isabella about this task" action dispatches
the app-wide `isabella:ask` event (`src/lib/isabella/ask-isabella.ts`) consumed by
`living-guide-widget.tsx` → `isabella-experience.tsx`. Data preservation enforced in
`roadmap/actions.ts` (`updateTaskAction` preserve-on-absent for the three columns). Protected by
`src/components/roadmap/__tests__/task-editor-ai-prompt-visibility.test.ts`.

**The regression to never reintroduce:** a "Prompt de IA / AI Prompt" (or any developer prompt) field
visible in the normal task editor.

---

## UX-012 — Language Consistency / No Spanglish

**Status:** APPROVED.

**Principle:** ProjectOps360° must feel professional in every supported language. When a language is
selected, **all** user-facing UI text is in that language — no Spanish/English mixing. An external
reviewer saw Spanish navigation mixed with English workflow labels; mixed-language UI makes the
product feel unfinished.

**Contract (binding):**
- Spanish mode shows Spanish UI; English mode shows English UI, across labels, buttons, helper text,
  menus, tabs, empty states, tooltips, alerts, and form fields.
- The **EN and ES message dictionaries** (`messages/en.json`, `messages/es.json`) must stay in
  **key-parity** — a key present in one locale must exist in the other — so the UI never silently
  falls back to the other language (the #1 Spanglish cause).
- Reviewer-flagged **protected labels** (nav groups, Workboard, task status, Project Memory, Execution
  Map…) must match the **canonical glossary** in the selected language.
- **User-generated content** (task titles, notes, names…) is **never** auto-translated.
- **Approved product names** (ProjectOps360°, Isabella, Rythm, Living Graph, Product Brain, ProjectOps
  Scribe, Knowledge OS, Workboard, Roadmap, Sprint, Stakeholders) and **technical acronyms** (PMO, BIM,
  RACI, KPI, PDF, API, RFI, WBS, CPM, SOP) may remain canonical/identical across locales.
- New user-facing strings must use the i18n dictionary (**both** EN and ES) — no hardcoded
  single-language UI text in protected modules. Future UI changes must use the existing i18n system.

**Canonical glossary (selected terms):** Command Center → Centro de Mando · Planning → Planificación ·
Execution → Ejecución · Resources → Recursos · Intelligence → Inteligencia · Technical / BIM →
Técnico / BIM · Workboard → Tablero de Trabajo · Execution Map → Mapa de Ejecución · Project Memory →
Memoria del Proyecto · Closeout Report → Reporte de Cierre · Team & Roles → Equipo y Roles · Owner →
Responsable · Planned Start → Inicio planificado · Planned Finish → Fin planificado · Blocked →
Bloqueado · Waiting → En espera · In Progress → En progreso · Completed → Completado · **Stakeholders**
kept verbatim (canonical PM-Spanish choice).

**Implementation:** canonical terms + allowed-untranslated names in `src/lib/i18n/glossary.ts`
(`CANONICAL_GLOSSARY`, `PROTECTED_MESSAGE_LABELS`, `CANONICAL_PRODUCT_NAMES`, `ALLOWED_ACRONYMS`,
`isCanonicalUntranslatable`); contract in `src/lib/product-ux-contracts/contracts.ts`
(`UX_012_LANGUAGE_CONSISTENCY`). Protected by `src/i18n/__tests__/message-parity.test.ts` (EN/ES
key-parity) and `src/i18n/__tests__/glossary-consistency.test.ts` (protected labels match the glossary
in the right language). The audit found the dictionaries already in full parity (1717 keys each); the
fixed Spanglish instance was `livingGraph.backToExecutionMap` (ES "Execution Map" → "Mapa de Ejecución").

**Ongoing (documented):** the dictionaries are the system of record and are well-translated; remaining
Spanglish lives in pockets of components that hardcode single-language strings. New work must route
through i18n; the key-parity test is the standing enforcement that keeps EN/ES aligned going forward.

**The regression to never reintroduce:** a protected nav/Workboard/status label appearing in the wrong
language, or an EN message key added without its ES counterpart (or vice-versa).
