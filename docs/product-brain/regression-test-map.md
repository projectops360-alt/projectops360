# Regression → Test Map

> The executable index behind the regression log. Every protected regression and Product UX
> Contract maps to the test(s) that **fail if the behavior returns**. This file is part of the
> Product Engineering Rule (doc 11, rule 13): **no REG-### is closed without a test here.**
>
> Status legend: **protected** (executable test exists) · **manual only** (verified by hand, test
> still owed) · **missing test** (gap — must be filled before closing).
>
> Run the whole guard suite with `npm run test:run`. CI (`.github/workflows/ci.yml`) runs it on
> every PR and push to `master`.

| ID | Product area | Protected behavior | Test file | Status |
|----|--------------|--------------------|-----------|--------|
| REG-008 | Living Graph | Blocked requires an explicit **active** impediment; completed/terminal tasks are never blocked; waiting-on-dependency is counted separately | `src/lib/graph/__tests__/living-graph-status.test.ts` | **protected** |
| REG-010 | Metrics / rollups | Single source of truth for blocker/waiting/capacity/milestone counts; terminal tasks never count as active blockers; metrics declare scope | `src/lib/project-rollups/__tests__/project-rollup-engine.test.ts` · `src/lib/execution/__tests__/task-activity.test.ts` | **protected** |
| REG-011 | Navigation | Exactly one visible Rythm/Rhythm nav item, canonical `/rhythm` route; `/rythm` is a redirect, never a 2nd item | `src/components/layout/__tests__/project-tabs-nav.test.ts` | **protected** |
| REG-012 | Navigation / BIM | BIM (Drawing Intelligence) is discoverable in the Technical/BIM group, kept visible-disabled when the module is off, never buried | `src/components/layout/__tests__/project-tabs-nav.test.ts` | **protected** |
| REG-013 | Isabella | Project Health Briefing is deterministic, grounded, no hallucination; blocked vs waiting separated; missing data → gaps | `src/lib/project-briefing/__tests__/briefing-engine.test.ts` · (PMO) `src/lib/portfolio-briefing/__tests__/portfolio-engine.test.ts` · (QA) `src/lib/knowledge-os/__tests__/product-brain-knowledge.test.ts` | **protected** |
| REG-014 / UX-001 | Isabella | Welcome Hero collapses on active content (a briefing counts); full hero never stacks over a briefing/conversation; compact header ≤70px | `src/lib/product-ux-contracts/__tests__/isabella-welcome-hero.test.ts` | **protected** |
| UX-007 | Living Graph | Saved layouts are **presentation-only** — they never change tasks/dependencies/edges/status | `src/lib/graph/__tests__/graph-layout-storage.test.ts` · `src/lib/graph/__tests__/graph-ui-prefs.test.ts` | **protected** |
| REG-006 | Execution Status | Blocked vs Waiting-on-Dependency are independent dimensions; waiting is not a problem state | `src/lib/graph/__tests__/living-graph-status.test.ts` (+ `src/lib/execution/status-engine.ts` rules) | **protected** |
| REG-009 | Project Memory / Scribe | Voice/paste → AI structure → review → save into Project Memory; anti-hallucination (verbatim excerpt, null for missing, needs_review default, human approval) | `src/lib/scribe/__tests__/scribe-ai.test.ts` | **protected** |

## Open gaps (tests owed)

- _None._ Every protected regression in the table above has an executable test. New regressions must
  add their row + test before being marked closed (doc 11, rule 13).

## Adding a new regression (procedure)

1. Log it in [`10-regression-log.md`](10-regression-log.md) with root cause + protection rule.
2. Add an executable test under `src/**/__tests__/**` that **fails if the regression returns**.
3. Add a row here linking REG-### → test → status **protected**.
4. If it is a UX behavior, also register a contract in [`32-product-ux-contracts.md`](32-product-ux-contracts.md)
   and put the rule in `src/lib/product-ux-contracts/contracts.ts`.
5. CI (typecheck + `test:run` + build) must be green before merge.
