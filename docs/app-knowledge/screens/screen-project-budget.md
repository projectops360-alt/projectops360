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
  - src/app/[locale]/(app)/projects/[projectId]/budget/setup-actions.ts
  - src/app/[locale]/(app)/projects/[projectId]/budget/financial-cockpit.tsx
  - src/lib/financial/flags.ts
  - src/lib/financial/setup-model.ts
  - src/lib/financial/setup-read-model.server.ts
  - src/lib/financial/read-model.server.ts
  - src/lib/financial/workflow.server.ts
  - src/components/layout/project-tabs-config.ts
---

# EN: Financial Control (Project Budget)

The Budget route is now the project's financial control center, reached from the "Financial Control" tab in the project navigation (Planning group). It stacks up to three flag-gated layers per pilot project (FINANCIAL_PILOT_PROJECT_IDS plus FINANCIAL_FOUNDATION/WRITERS/PROJECTIONS/UI_ENABLED). Financial Setup (writers flag) is the PMO cost-plan form: estimate title, purpose, currency, AACE class, base/as-of dates, and cost-plan lines with type, resource or rate card, quantity, rate, cadence (week/biweek/month/one-time), periods and hours per period, totaled by calculateFinancialSetupLine. Buttons: Save draft, Submit for review, Approve & activate (independent approver), Manage rates (goes to /team), and an SAP/software starter template. Saving writes financial_estimate_versions, financial_boe_versions, financial_baseline_versions (original_budget and current_baseline) and financial_baseline_lines, and upserts rates into resources; submit/approve run capability-guarded transitions (financial.prepare / financial.approve from project_team_members) through executeFinancialTransition, with audit logging. The Financial Cockpit (ui flag) reads the financial_project_cockpit projection: baseline vs original budget, funding, commitments, actual cost plus accrual, settled payments, EAC with P50/P80, CPI/SPI, pending approvals, a quality badge and exception warnings, with links to the Living Graph and Reports. Below, the classic editable estimate still lists material_requirements grouped by metadata.category with inline quantity/unit-cost editing (updateBudgetLineAction) and print-to-PDF. Related screens: Team & Roles, Reports, Living Graph, Drawing Intelligence takeoff.
Source: budget/page.tsx, financial-setup.tsx, setup-actions.ts, financial-cockpit.tsx, budget-client.tsx, actions.ts; src/lib/financial/{flags,setup-model,setup-read-model.server,read-model.server,workflow.server}.ts; project-tabs-config.ts.
Verify: open a pilot project and go to Financial Control, or visit /projects/[projectId]/budget.

# ES: Control Financiero (Presupuesto del Proyecto)

La ruta Budget es ahora el centro de control financiero del proyecto, accesible desde la pestaña "Control Financiero" de la navegación del proyecto (grupo Planificación). Apila hasta tres capas activadas por banderas por proyecto piloto (FINANCIAL_PILOT_PROJECT_IDS más FINANCIAL_FOUNDATION/WRITERS/PROJECTIONS/UI_ENABLED). La Configuración Financiera (bandera writers) es el formulario PMO del plan de costos: título del estimado, propósito, moneda, clase AACE, fechas base y de corte, y líneas con tipo, recurso o tarifa, cantidad, tarifa, cadencia (semanal/quincenal/mensual/único), periodos y horas por periodo, totalizadas por calculateFinancialSetupLine. Botones: Guardar borrador, Enviar a revisión, Aprobar y activar (aprobador independiente), Gestionar tarifas (va a /team) y una plantilla inicial SAP/software. Guardar escribe financial_estimate_versions, financial_boe_versions, financial_baseline_versions (original_budget y current_baseline) y financial_baseline_lines, y actualiza tarifas en resources; enviar y aprobar ejecutan transiciones protegidas por capacidades (financial.prepare / financial.approve desde project_team_members) mediante executeFinancialTransition, con registro de auditoría. El Cockpit Financiero (bandera ui) lee la proyección financial_project_cockpit: baseline frente a presupuesto original, financiamiento, compromisos, costo real más devengos, pagos liquidados, EAC con P50/P80, CPI/SPI, aprobaciones pendientes, insignia de calidad y avisos de excepciones, con enlaces al Living Graph y a Reportes. Debajo, el estimado editable clásico sigue listando material_requirements agrupados por metadata.category, con edición en línea de cantidad y costo unitario (updateBudgetLineAction) e impresión a PDF. Pantallas relacionadas: Equipo y Roles, Reportes, Living Graph, takeoff de Drawing Intelligence.
Fuente: budget/page.tsx, financial-setup.tsx, setup-actions.ts, financial-cockpit.tsx, budget-client.tsx, actions.ts; src/lib/financial/{flags,setup-model,setup-read-model.server,read-model.server,workflow.server}.ts; project-tabs-config.ts.
Verifica: abre un proyecto piloto y entra a Control Financiero, o visita /projects/[projectId]/budget.
