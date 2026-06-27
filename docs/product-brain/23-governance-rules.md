# 23 — Governance Rules

The binding governance rules for evolving ProjectOps360°. These complement the
[AI Development Rules](11-ai-development-rules.md) and are ratified by
[ADR-000](adrs/ADR-000-product-intelligence-source-of-truth.md) and
[ADR-007](adrs/ADR-007-product-brain-is-source-of-truth.md).

---

## ⭐ Product Intelligence First

**Before modifying any ProjectOps360° module, Product Intelligence must be reviewed and
updated first.**

- **Every new feature must begin with a Product Intelligence review.** Read the relevant
  capability/feature registry rows, ADRs, and this governance section before writing code.
- **Every module change must update module documentation** ([Module Catalog](22-modules.md))
  and the [Capability Registry](05-capability-registry.md).
- **Every major decision must create or update an ADR** ([ADR Index](07-adr-index.md)).
- **Final implementation reports must include the documentation updates** that were made.
- **Code must not move faster than product understanding.** If the understanding (the docs)
  isn't updated, the feature is not complete.

> This rule exists because the product repeatedly lost capabilities and decisions when code
> ran ahead of documentation (see [Regression Log](10-regression-log.md): REG-004, REG-005).

## Other governance rules

1. **No silent regressions.** Never remove, hide, replace, or degrade existing functionality
   without an explicit, recorded decision. Log suspected regressions immediately.
2. **Server-side authorization.** Access control is enforced on the server; hiding a menu item
   is never sufficient. (Applies directly to this Product Intelligence Center.)
3. **One source of truth per layer.** Knowledge OS (product), Project Memory (per-project),
   Product Intelligence (product evolution) stay distinct; status logic lives in one engine.
4. **Determinism & honesty.** Any status/health/risk shown to users is computed from rules +
   evidence; "Unknown" is preferred over overstating.
5. **ADRs are binding.** No implementation may contradict an accepted ADR; to change a
   decision, supersede the ADR explicitly.
6. **Internal stays internal.** Internal product strategy (this Center) is never exposed to
   clients, viewers, or external stakeholders.

## Security rules (summary)

- Multi-tenant isolation by `organization_id` with RLS on every business table.
- Project boundary enforced at the app layer in addition to RLS.
- Internal surfaces (Product Intelligence) are restricted to owner/admin, enforced server-side;
  unauthorized direct-URL access returns 404.
- Service keys never exposed to the client; no unauthenticated API returns internal content.

## How governance is applied (lifecycle)

1. **Review** Product Intelligence → 2. **Plan** (name affected CAP/F-IDs + ADRs + regression
   risk) → 3. **Build** following the canonical patterns → 4. **Verify** (typecheck/build/tests)
   → 5. **Record** (update registries/ADRs/regressions) → 6. **Report** including doc updates.
