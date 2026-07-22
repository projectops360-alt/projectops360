# Import Order Integrity — Milestones and Ordered Entities

**Regression:** `REG-024`  
**Status:** Protected  
**Owner:** Product / Engineering

## Binding rule

The order of imported milestones is project data, not visual layout state. The
authoritative display order is `milestones.order_index`, populated from the
canonical source sequence captured as
`project_import_entities.source_order`.

The Living Graph may render that order in a snake, horizontal, vertical, or
saved visual layout, but it must never infer business order from UUIDs,
`created_at`, event timestamps, database return order, or node position.

## Incident and root cause

An imported Budget & Cost Management project displayed P6 before P0. The source
JSON was correct (P0 through P9), and the Living Graph correctly sorted by
`milestones.order_index`. The corruption happened between analysis and import:

1. canonical entities were inserted in one bulk operation;
2. import execution read `project_import_entities` without an explicit order;
3. PostgreSQL does not guarantee row-return order without `ORDER BY`;
4. the executor assigned `milestones.order_index` in the arbitrary returned
   order, so P6 received index 0.

This is a data-order integrity defect, not a graph-layout defect.

## Preventive contract

1. Analysis assigns every persisted import entity a unique, zero-based
   `source_order` within its import job.
2. Import reads explicitly order by `source_order`.
3. `entitiesToCanonical` defensively sorts by `source_order` even if a caller
   supplies shuffled rows.
4. Legacy rows with no ordinal retain their received order; the system must not
   invent an order it cannot prove.
5. A unique partial index prevents duplicate non-null ordinals in one job.
6. The imported `milestones.order_index` remains the Living Graph source of
   truth. A saved visual layout never changes it.

## Diagnostic sequence

When a milestone appears before its real predecessor, investigate in this order:

1. **Canonical source:** confirm the JSON/CSV/XLSX source sequence.
2. **Import staging:** inspect entity `source_order` for the import job.
3. **Project data:** inspect milestone `title` and `order_index`, scoped to the
   exact project and excluding soft-deleted rows.
4. **Projection:** confirm the Living Graph milestone aggregator sorts by
   `milestoneOrder` / `order_index`.
5. **Layout:** only investigate node positioning after the four data checks pass.

Do not drag nodes manually to conceal a wrong `order_index`; that only masks the
data defect.

## Safe repair procedure

For an already imported project:

1. verify the exact project id and expected complete milestone set;
2. reject the repair if phases are missing, duplicated, or ambiguous;
3. reindex only those milestone ids, using temporary high indexes first if a
   uniqueness constraint could collide;
4. assign the verified final zero-based order;
5. query the project again ordered by `order_index` and compare the exact result;
6. do not modify tasks, dependencies, process edges, event history, other
   projects, or saved layouts.

## Isabella behavior

If asked why milestones are out of order, Isabella must explain that imported
business order comes from `source_order` and becomes `milestones.order_index`.
She should recommend the diagnostic sequence above and describe a scoped,
verified reindex. She must not recommend manual visual rearrangement as the data
fix and must not claim that timestamps establish milestone precedence.

## Verification

- Unit guard: `src/lib/import-intelligence/__tests__/execute-order.test.ts`
- Schema guard: `uq_project_import_entities_job_source_order`
- Runtime verification: import milestones P0…P9 while returning persisted entity
  rows in shuffled order; the created milestones and Living Graph must still
  display P0…P9.
