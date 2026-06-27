# ADR-000 — Product Intelligence™ is the Official Source of Truth

**Status:** Accepted · 2026-06-27 · **Constitutional** (supersedes none; governs all)

> This is the constitutional document of ProjectOps360°. It sits above all other ADRs.
> ADR-007 is its operational expression; ADR-000 is its constitutional statement.

## Context
Product decisions, features, architecture, and strategic direction have repeatedly been lost or
overwritten across conversations, prompts, branches, and AI-assisted refactors. Conversation
history and prompts are volatile, contradictory, and non-authoritative. The product needs a
permanent constitution.

## Decision
**Product Intelligence™** (the `docs/product-brain/` repository — Product DNA, North Star,
Principles, Vision, Strategic Pillars, Architecture, Capability & Feature Registries, ADRs,
Regression Log, AI Development Rules, and strategy/recovery docs) is the **official source of
truth** for the evolution of ProjectOps360°.

It **supersedes conversation history, prompts, and temporary AI context.**

Every future implementation must:
- **exist in Product Intelligence first** (a capability/feature/spec entry),
- **have a Capability ID** (CAP-xxx) and, where user-facing, a Feature ID (F-xxx),
- **reference an ADR** when it embodies an architectural decision,
- **update Product Intelligence after implementation** (registries, regressions, status).

**No feature may be considered complete until Product Intelligence reflects it.**

## Consequences
- The registries, ADRs, DNA, North Star, principles, and regression log are maintained as part of
  doing work — not optional.
- Any AI coding agent (and any human) must read Product Intelligence before building and must not
  contradict accepted ADRs or violate Product DNA.
- When Product Intelligence is wrong, it is corrected *in the repository, with rationale* — not
  worked around in a prompt.

## What this prevents
- The recurring loss of capabilities and decisions (the entire reason this system exists; see the
  regression log: REG-004 Resource Capacity, REG-005 Living Graph).
- Building from stale chat memory; silent architecture drift; undocumented regressions.

## Related
All capabilities, all ADRs (esp. ADR-007), Product DNA (doc 19), AI Development Rules (doc 11).
