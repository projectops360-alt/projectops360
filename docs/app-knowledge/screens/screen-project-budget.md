---
slug: screen-project-budget
route: /projects/[projectId]/budget
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/budget/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/budget/budget-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/budget/actions.ts
  - src/app/[locale]/(app)/projects/[projectId]/budget/financial-setup.tsx
  - src/app/[locale]/(app)/projects/[projectId]/budget/financial-cockpit.tsx
  - src/app/[locale]/(app)/projects/[projectId]/budget/setup-actions.ts
  - src/lib/financial/flags.ts
  - src/lib/financial/read-model.server.ts
  - src/lib/financial/setup-read-model.server.ts
---

# EN: Project Budget screen

Three stacked sections, only one of which every project sees. The always-present part is the estimate table built from `material_requirements` (quantity, unit, estimated unit cost, total, `metadata.category`, `needs_review`, `origin`), grouped into categories with subtotals, a grand total and counts of unquantified and uncosted lines; currency is hardcoded `USD`. Quantity and unit cost are editable inline and auto-save via `updateBudgetLineAction`, which recomputes the extended cost, clears `needs_review` and stamps `metadata.manually_edited` so a regenerated estimate does not wipe the human number. "Download PDF" prints with a `BUD` document code. Lines cannot be created or deleted here. Above it, the financial control layer is **flag-gated and only appears for pilot projects**: `getFinancialFeatureStateFromProcess` requires the project id in `FINANCIAL_PILOT_PROJECT_IDS` plus `FINANCIAL_FOUNDATION_ENABLED` and the matching `FINANCIAL_WRITERS_ENABLED` / `FINANCIAL_UI_ENABLED`. When writers are on, Financial Setup edits a cost-plan draft (`financial_estimate_versions`, `financial_boe_versions`, `financial_baseline_versions`, `financial_baseline_lines`, rate cards in `resources`) with Save draft / Submit for review / Approve & activate, authorized through `project_team_members` capabilities — the approver must be independent of the preparer. When UI is on, the Financial Cockpit reads the `financial_project_cockpit` view for baseline, funding, commitment, actuals, accrual, EAC/P50/P80, CPI/SPI and data-quality warnings. Related: screen-project-closeout, screen-reports.
Source: budget/page.tsx, budget-client.tsx, actions.ts, financial-setup.tsx, financial-cockpit.tsx, setup-actions.ts.
Verify: open a project and go to /projects/[projectId]/budget; the financial sections appear only if the project is in FINANCIAL_PILOT_PROJECT_IDS.

# ES: Pantalla Presupuesto del Proyecto

Tres secciones apiladas, de las cuales solo una la ve todo proyecto. La parte siempre presente es la tabla de estimado construida desde `material_requirements` (cantidad, unidad, costo unitario estimado, total, `metadata.category`, `needs_review`, `origin`), agrupada en categorías con subtotales, gran total y conteos de líneas sin cantidad y sin costo; la moneda está fija en `USD`. Cantidad y costo unitario se editan en línea y se guardan solos con `updateBudgetLineAction`, que recalcula el total, quita `needs_review` y marca `metadata.manually_edited` para que un estimado regenerado no borre el número humano. "Descargar PDF" imprime con el código de documento `BUD`. Aquí no se crean ni eliminan líneas. Encima, la capa de control financiero está **detrás de banderas y solo aparece en proyectos piloto**: `getFinancialFeatureStateFromProcess` exige que el id del proyecto esté en `FINANCIAL_PILOT_PROJECT_IDS` más `FINANCIAL_FOUNDATION_ENABLED` y la bandera correspondiente `FINANCIAL_WRITERS_ENABLED` / `FINANCIAL_UI_ENABLED`. Con los escritores activos, Configuración financiera edita un borrador de plan de costos (`financial_estimate_versions`, `financial_boe_versions`, `financial_baseline_versions`, `financial_baseline_lines`, tarifas en `resources`) con Guardar borrador / Enviar a revisión / Aprobar y activar, autorizado por las capacidades de `project_team_members` — el aprobador debe ser independiente de quien preparó. Con la UI activa, el Cockpit Financiero lee la vista `financial_project_cockpit`: baseline, financiamiento, compromiso, reales, devengo, EAC/P50/P80, CPI/SPI y avisos de calidad de datos. Relacionadas: screen-project-closeout, screen-reports.
Fuente: budget/page.tsx, budget-client.tsx, actions.ts, financial-setup.tsx, financial-cockpit.tsx, setup-actions.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/budget; las secciones financieras solo salen si el proyecto está en FINANCIAL_PILOT_PROJECT_IDS.
