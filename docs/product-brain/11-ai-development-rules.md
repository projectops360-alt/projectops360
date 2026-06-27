# 11 — AI Development Rules

**Binding rules for Claude or any AI coding agent working on ProjectOps360°.** These rules are
ratified by [`ADR-007`](adrs/ADR-007-product-brain-is-source-of-truth.md). Violating them is a
defect.

---

## The 12 rules

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
