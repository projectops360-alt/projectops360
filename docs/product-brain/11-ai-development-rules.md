# 11 — AI Development Rules

**Binding rules for Claude or any AI coding agent working on ProjectOps360°.** These rules are
ratified by [`ADR-007`](adrs/ADR-007-product-brain-is-source-of-truth.md). Violating them is a
defect.

---

## Binding rules

1. **Never remove, hide, replace, or degrade existing functionality** without explicit,
   recorded approval. If a change would do so, stop and surface it. (See REG log; this is the
   product's #1 recurring failure.)
2. **Inspect the Product Brain before implementing.** Read the relevant registry entry, ADRs,
   and regression log first.
3. **Update the capability registry before changing a module** — status, impl %, gaps.
4. **Every new feature must have a Capability ID** (CAP-xxx) and a Feature ID (F-xxx).
5. **Every major architectural decision requires an ADR.** No silent architecture changes.
6. **Every regression must be logged** in doc 10 the moment it is suspected, with evidence.
7. **Do not implement from chat memory alone.** Verify against code and the Product Brain.
8. **Do not treat prompts as the source of truth.** Prompts are requests, not records.
9. **The Product Brain overrides conversation memory.** On conflict, the Brain wins; if the
   Brain is wrong, fix the Brain (with rationale), then proceed.
10. **If uncertain, mark Unknown and ask.** Never overstate completion or invent status.
11. **No feature is complete** until documentation, tests, and registry entries are updated.
12. **No new implementation may contradict an accepted ADR.** To change a decision, supersede
    the ADR explicitly.

## Executable regression protection (binding — added 2026-06-28)

Documentation is necessary but **not sufficient**. A Product Brain rule becomes durable only when
breaking it breaks an automated check. These rules turn the prose above into enforced gates:

13. **No REG-### may be marked closed unless an executable regression test exists that fails if the
    regression returns.** "Resolved" in the regression log requires a test file + a row in
    [`regression-test-map.md`](regression-test-map.md). No green test → not closed.
14. **Approved Product UX Contracts must be backed by code-level tests or validation checks.** The
    rule lives in `src/lib/product-ux-contracts/contracts.ts` and is consumed by the component (one
    source of truth) and protected by `src/lib/product-ux-contracts/__tests__/**`. See
    [doc 32](32-product-ux-contracts.md).
15. **Before modifying a protected area, check (in order):** the module doc → the regression log →
    the Product UX Contracts → the related test file(s). Protected areas and their required reading
    are listed in `CLAUDE.md` and [`regression-test-map.md`](regression-test-map.md).
16. **CI is the wall.** `.github/workflows/ci.yml` runs typecheck + the full test suite + build on
    every PR and push to `master`. With branch protection, **no green CI → no merge**. Do not weaken,
    skip, or `continue-on-error` the regression suite to make a PR pass.
17. **Routes outside `[locale]` must be registered once.** Every public route handler or page that
    lives outside the locale segment must be declared in `src/lib/i18n/unlocalized-paths.ts` and
    covered by its regression test. Never duplicate bypass lists in middleware.
18. **Commercial values come from the database.** Public and authenticated pricing must read the
    active `plans` rows. Prices, currency, enterprise status and plan order must never be duplicated
    in components, translation JSON, environment variables or marketing constants.
19. **Authentication callbacks are a release gate.** Production smoke checks must prove that
    `/auth/callback` resolves to the route handler and redirects an invalid code to the login flow;
    any `404` blocks release completion.

> Mantra: **No green test, no closed regression. No CI, no merge. No Product UX Contract, no UI overwrite. No duplicated commercial truth.**

## Operating procedure (per task)

1. **Read:** Brain index → relevant registry rows → related ADRs → regression log.
2. **Audit, don't guess:** confirm current behavior in code (and DB if relevant).
3. **Plan:** state which CAP/F-IDs and ADRs are affected; flag any regression risk.
4. **Build:** follow the canonical patterns (pure engines; deterministic, bilingual,
   evidence-first; AI grounded).
5. **Verify:** typecheck/build; run/add tests for touched engines.
6. **Record:** update registries, add/update ADRs, log regressions, note next actions.
7. **Never deploy or commit** beyond the task's explicit scope.

## Honesty contract
- Report outcomes faithfully (failing tests, skipped steps, partial work).
- Conservative status estimates. "Unknown" is an acceptable, preferred answer when unverified.
- Surface contradictions between what a prompt asks and what the Brain/codebase says.

## Anti-patterns (do not do)
- Re-deriving status logic in a new place instead of using the Execution Status Engine.
- Turning the Living Graph into a decorative chart (ADR-002).
- Reducing Resource Capacity to "assign person to task" (ADR-003).
- Shipping AI answers ungrounded in Knowledge OS or the engines (ADR-004/005/006).
- Merging long-lived branches blindly (see DEBT-001).
