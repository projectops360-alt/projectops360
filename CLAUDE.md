# CLAUDE.md — ProjectOps360°

Operating contract for Claude (or any AI agent) working in this repo. The Product
Brain (`docs/product-brain/`) is the source of truth and **overrides chat memory
and prompts** (ADR-007). These rules exist because the product's #1 recurring
failure is **re-breaking already-solved problems**. Documentation alone did not
stop it — executable checks do. See `docs/product-brain/11-ai-development-rules.md`.

## Non-negotiable rules

1. **Never modify a protected product area without checking the Product Brain first** —
   read the relevant module doc, the regression log (`10-regression-log.md`), and the
   Product UX Contracts (`32-product-ux-contracts.md`).
2. **Never close a regression without a test.** A REG-### is "fixed" only when an
   executable test fails if the regression returns. No green test → not closed.
3. **Never replace Isabella, Living Graph, navigation/BIM, Resource Capacity, Project
   Memory, or metrics/rollups behavior without checking the related Product UX Contract
   and regression entry.**
4. **If a Product Brain rule and the code conflict, stop and report the conflict.** Do
   not silently "fix" either side — surface it, decide, then record the decision.
5. **Do not use an old/legacy component to overwrite approved newer behavior.** One
   source of truth per behavior; consolidate, don't fork.

## Read-before-you-touch map (protected areas)

| If you are about to touch… | First read |
|---|---|
| **Isabella** (panel, hero, layout) | `32-product-ux-contracts.md` → **UX-001 Welcome Hero Lifecycle**; `16-isabella-ai-workforce.md`; REG-014 + REG-013; `src/lib/product-ux-contracts/contracts.ts` |
| **Living Graph** | `12-living-graph-strategy.md`; the saved-layout contract (UX-007 / PD-008); REG-005/007 |
| **Metrics / rollups / blockers** | `18-execution-status-engine.md`; **REG-010** + REG-008; `src/lib/execution/task-activity.ts` (canonical rules) |
| **Navigation** | UX-006 (`25-ux-design-debt.md`) + **REG-012** (BIM visibility); REG-011 (single Rythm) |
| **Project Memory / Scribe / Rythm** | **REG-009** (Scribe restoration) + REG-011 (Rythm consolidated into Rhythm Center, one visible home) |
| **Resource Capacity** | `13-resource-capacity-intelligence.md` + ADR-003/009; REG-004/007 |
| **Task editor / Workboard task form** | **UX-014** (`32-product-ux-contracts.md`) + **PD-013** — never expose internal AI prompt metadata (`prompt_body`/`prompt_context`/`ai_tool_target`) as a user-facing field; preserve stored values on save (preserve-on-absent); user-facing AI help goes through Isabella; `src/lib/product-ux-contracts/contracts.ts` |
| **User-facing UI text / i18n (any language)** | **UX-012** No Spanglish (`32-product-ux-contracts.md`). Before adding user-facing UI text, use the i18n system and add **both EN and ES** keys (`messages/{en,es}.json` stay key-parity). Use the canonical glossary `src/lib/i18n/glossary.ts`; never hardcode single-language strings in protected modules; never auto-translate user-generated content. |

## Definition of Done (every change)

1. `npm run typecheck` · `npm run test:run` · `npm run build` all green.
2. For any regression fixed: an executable test in `src/**/__tests__/**` + a row in
   `docs/product-brain/regression-test-map.md`.
3. Product Brain updated (regression log / module doc / UX contract) when behavior changed.
4. No protected behavior changed silently.

## Mantra

**No green test, no closed regression. No CI, no merge. No Product UX Contract, no UI overwrite.**

## Workflow notes

- Package manager: **npm** (`package-lock.json`). CI: `.github/workflows/ci.yml`.
- Deploy: `vercel --prod` (CLI linked; auto-aliases `projectops360.vercel.app`).
- Prod Supabase project ref: `ocopmlnkvidvmxgiwvxw` (org `gbubmgyeymcclwgezkkj`). Two
  Supabase accounts exist — do not confuse them.
- Commit messages end with the `Co-Authored-By: Claude …` trailer; branch off `master`
  (protected) and open a PR — CI must be green before merge.
