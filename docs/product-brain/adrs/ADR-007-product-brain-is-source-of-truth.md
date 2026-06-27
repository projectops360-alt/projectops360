# ADR-007 — Product Brain is the source of truth for product evolution

**Status:** Accepted · 2026-06-27

## Context
Product decisions, features, and architecture have been lost across prompts, branches, and
AI-assisted refactors. Conversation memory is volatile and contradictory; prompts are not a
reliable record.

## Decision
The **Product Brain** (`docs/product-brain/`) is the durable source of truth for product
evolution. It **overrides conversation memory and prompts.** No feature is complete until its
capability/feature registry entries, tests, and (when architectural) ADRs are updated. Any
regression must be logged. Any AI coding agent must read the Product Brain before building and
must not contradict accepted ADRs.

## Consequences
- The registries (05, 06), ADRs, and regression log (10) are maintained as part of doing work,
  not as an afterthought.
- AI development rules (11) are binding.
- The Product Brain is versioned in git and reviewed like code.

## What this prevents
- Re-losing capabilities (REG-004, REG-005); building from stale chat memory; silent
  regressions.

## Related capabilities
All (meta-capability).

## Related modules
`docs/product-brain/`, plus every module via its registry entry.
