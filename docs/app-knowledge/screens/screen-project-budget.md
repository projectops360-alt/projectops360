---
slug: screen-project-budget
route: /projects/[projectId]/budget
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/budget/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/budget/budget-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/budget/actions.ts
---

# EN: Project Budget screen

An editable budget estimate built from the project's material requirements — "the estimator owns the final numbers". The server page reads material_requirements (name, description, quantity, unit, estimated unit cost, estimated total, metadata, needs_review, origin), groups lines into categories from metadata.category (fallback "Otros / Other"), computes per-category subtotals sorted by size, a grand total, and stats: line count, unquantified lines (no quantity) and uncosted lines (no unit cost). Currency defaults to USD in code. The client shows a header with "Download PDF" (printWithFilename with a BUD document code), summary stats (estimated total, line items, unquantified and uncosted warnings) and a category-grouped table with columns item, quantity, unit, unit cost and total. Quantity and unit cost are editable inline; each change recomputes the total live and auto-saves through the updateBudgetLineAction server action, flashing a saved indicator. Lines can carry a cost source from metadata and a needs-review flag. There is no create/delete of lines on this screen — rows come from the material requirements pipeline (origin field). Related screens: Closeout (budget performance metrics) and the drawing-intelligence / materials flows that generate requirements.
Source: src/app/[locale]/(app)/projects/[projectId]/budget/page.tsx, budget-client.tsx, actions.ts.
Verify: open a project and go to /projects/[projectId]/budget.

# ES: Pantalla Presupuesto del Proyecto

Un estimado de presupuesto editable construido desde los requerimientos de materiales del proyecto — "el estimador es dueño de los números finales". La página de servidor lee material_requirements (nombre, descripción, cantidad, unidad, costo unitario estimado, total estimado, metadatos, needs_review, origen), agrupa líneas en categorías desde metadata.category (por defecto "Otros / Other"), calcula subtotales por categoría ordenados por monto, un gran total y estadísticas: número de líneas, líneas sin cantidad y líneas sin costo unitario. La moneda es USD por defecto en el código. El cliente muestra un encabezado con "Descargar PDF" (printWithFilename con código de documento BUD), estadísticas de resumen (total estimado, líneas, avisos de sin cantidad y sin costo) y una tabla agrupada por categoría con columnas material, cantidad, unidad, costo unitario y total. Cantidad y costo unitario se editan en línea; cada cambio recalcula el total al momento y se guarda solo mediante la acción de servidor updateBudgetLineAction, con un indicador de guardado. Las líneas pueden traer fuente de costo en metadatos y marca de revisión. En esta pantalla no se crean ni eliminan líneas — provienen del flujo de requerimientos de materiales (campo origin). Relacionadas: Cierre (desempeño de presupuesto) y los flujos de drawing-intelligence / materiales que generan requerimientos.
Fuente: src/app/[locale]/(app)/projects/[projectId]/budget/page.tsx, budget-client.tsx, actions.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/budget.
