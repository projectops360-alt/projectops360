# P4-T3 — Known-History and Grounded-Answer Validation

## Purpose

P4-T3 validates Process Mining and Isabella against version-controlled histories whose expected truth is known in advance. The validator fails on drift; it does not recalculate expectations from the output under test.

## Golden Histories

| History | Expected truth |
|---|---|
| `straight-through` | One case, two direct-follow relations, one variant, four-hour cycle, no waiting and no rework. |
| `explicit-wait-recovery` | One case, three direct-follow relations, one variant, five-hour cycle and exactly two hours of explicit waiting between `TaskBlocked` and `TaskUnblocked`. |
| `variant-with-rework` | Two cases, four unique direct-follow relations, two variants and one observed repeated-activity/rework path. |
| `active-explicit-blocker` | One open case ending in `TaskBlocked`; the blocker is accepted as a grounded direct fact and may support an advisory recommendation requiring human approval. |

Fixtures live in `src/lib/process-mining/validation/known-histories.ts`. They are immutable test data, not production rows and not generated from the current engine output.

## Validation Contract

For every history, the harness checks:

- exact case, direct-follow, variant, unknown-taxonomy and rework results;
- exact cycle and explicit-waiting metrics per case;
- English and Spanish Process Mining answers;
- evidence references and an accepted P4-T2 reasoning finding;
- no unsupported causal assertion from temporal succession;
- no confirmed cause or recommendation for histories without an active evidenced constraint;
- confirmed explicit blocker, grounded recommendation, human approval and no auto-execution for the active-blocker history;
- mutation detection by intentionally changing a golden expectation and proving the report fails.

## Result

All four golden histories pass validation version `1.0.0`. The suite contains six executable tests and is included with the broader P4 regression set.

## Boundaries

- Golden histories prove deterministic behavior and grounded answer contracts; they do not claim statistical accuracy across every future project domain.
- Production data is not copied into source control.
- The harness is read-only and makes no database, event-log, graph, task or recommendation writes.
- Temporal order remains non-causal. Only explicitly recorded evidence can support a confirmed blocker fact.
