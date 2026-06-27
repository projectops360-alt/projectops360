# ProjectOps360° — Product Intelligence™

> **The official source of truth for product evolution.** This repository (the Product
> Intelligence™ system, physically housed at `docs/product-brain/`) is the memory of the
> product. It exists so that product decisions, features, architectural concepts, and
> strategic direction are **never lost again** across prompts, branches, refactors, or
> AI-assisted development.

**Release:** Product Intelligence™ **v0.1** — *Foundation Established*
**Status:** Phase 0 — Product Architecture Repository (documentation only)
**Constitution:** [`ADR-000`](adrs/ADR-000-product-intelligence-source-of-truth.md) — Product
Intelligence™ supersedes conversation history, prompts, and temporary AI context.
**Created:** 2026-06-27
**Owner:** Product / Founder (Efraín Pradas)

---

## ⚠️ Read this first (for any human or AI agent)

1. **The Product Brain overrides conversation memory and prompts.** If a chat says one
   thing and the Product Brain says another, the Product Brain wins. See
   [11-ai-development-rules.md](11-ai-development-rules.md).
2. **Never remove, hide, replace, or degrade existing functionality** without an explicit
   decision recorded here. See [10-regression-log.md](10-regression-log.md) and
   [`ADR-007`](adrs/ADR-007-product-brain-is-source-of-truth.md).
3. **Audit before you build.** Check the [05-capability-registry.md](05-capability-registry.md)
   and [06-feature-registry.md](06-feature-registry.md) before touching a module.

---

## Map of the Product Brain

| File | Purpose |
|------|---------|
| [01-product-vision.md](01-product-vision.md) | What ProjectOps360° is and why it exists |
| [02-strategic-pillars.md](02-strategic-pillars.md) | The pillars every capability ladders up to |
| [03-system-architecture.md](03-system-architecture.md) | Layers, data flow, tech stack |
| [04-module-map.md](04-module-map.md) | Every route, lib module, and DB area that exists today |
| [05-capability-registry.md](05-capability-registry.md) | **Canonical capability registry** (audited status) |
| [06-feature-registry.md](06-feature-registry.md) | **Canonical feature registry** (audited status) |
| [07-adr-index.md](07-adr-index.md) | Index of Architecture Decision Records |
| [08-roadmap.md](08-roadmap.md) | Sequenced product roadmap |
| [09-technical-debt.md](09-technical-debt.md) | Known debt and structural risks |
| [10-regression-log.md](10-regression-log.md) | Tracked regressions and lost functionality |
| [11-ai-development-rules.md](11-ai-development-rules.md) | **Rules for Claude / any AI coding agent** |
| [12-living-graph-strategy.md](12-living-graph-strategy.md) | Living Graph vision (recovery doc) |
| [13-resource-capacity-intelligence.md](13-resource-capacity-intelligence.md) | Resource Capacity vision (recovery doc) |
| [14-executive-command-center.md](14-executive-command-center.md) | Executive Command Center vision |
| [15-knowledge-os.md](15-knowledge-os.md) | Knowledge OS substrate |
| [16-isabella-ai-workforce.md](16-isabella-ai-workforce.md) | Isabella & the AI Workforce |
| [17-project-memory.md](17-project-memory.md) | Project Memory layer |
| [18-execution-status-engine.md](18-execution-status-engine.md) | Execution Status Engine |
| [19-product-dna.md](19-product-dna.md) | **Product DNA** — immutable principles |
| [20-product-north-star.md](20-product-north-star.md) | **Product North Star** — how users should feel |
| [21-product-principles.md](21-product-principles.md) | **Product Principles** — engineering/product trade-offs |
| [22-modules.md](22-modules.md) | **Module Catalog** — what each module does/uses/connects to |
| [23-governance-rules.md](23-governance-rules.md) | **Governance Rules** — incl. *Product Intelligence First* |
| [module-documentation-template.md](module-documentation-template.md) | **Module doc template** — reusable per-module structure |
| [25-ux-design-debt.md](25-ux-design-debt.md) | **UX / Design Debt** — incl. UX-004 (Isabella compact layout) |
| [26-sprint-01-operational-clarity.md](26-sprint-01-operational-clarity.md) | **Sprint #1** — Workboard ownership + Critical Path source of truth |
| [27-sprint-02-living-graph-focus.md](27-sprint-02-living-graph-focus.md) | **Sprint #2** — Living Graph focus & usability (Focus Mode) |
| [28-sprint-03-overlay-clarity.md](28-sprint-03-overlay-clarity.md) | **Sprint #3** — Living Graph overlay clarity & intelligence |
| [29-sprint-04-navigation-evidence.md](29-sprint-04-navigation-evidence.md) | **Sprint #4** — Living Graph navigation hub & evidence drill-down |

### Sub-repositories

| Folder | Purpose |
|--------|---------|
| [adrs/](adrs/) | One file per Architecture Decision Record |
| [specs/](specs/) | Detailed feature/technical specs (filled as features are designed) |
| [capabilities/](capabilities/) | Deep-dive docs per capability (filled over time) |
| [regressions/](regressions/) | Investigation files for individual regressions |

---

## Status legend (used across registries)

| Status | Meaning |
|--------|---------|
| **Implemented** | Built, wired, in production, working as intended |
| **Partially implemented** | Core exists in prod, meaningful pieces of the vision are missing |
| **Prototype** | Code exists but not wired into the product / not in production |
| **Documented only** | Vision/spec exists, no code |
| **Missing** | Neither code nor spec exists yet |
| **Deprecated** | Superseded; should not be extended |
| **Regressed** | Was working/intended; lost or degraded — see regression log |
| **Unknown** | Not yet verified against code — must be investigated before relying on it |

> Honesty rule: when in doubt, mark **Unknown**. Do not overstate completion.
