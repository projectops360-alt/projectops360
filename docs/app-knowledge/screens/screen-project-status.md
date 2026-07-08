---
slug: screen-project-status
route: /projects/[projectId]/status
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/status/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/status/status-report-client.tsx
  - src/lib/execution/status-report.ts
---

# EN: Project Status Report screen

A plain-language, printable status report, reached from the project's Status tab (also surfaced from the Command Center's Reports & Executive Outputs area). The server page loads milestones, roadmap_tasks, task_dependencies, material_requirements, a budget_items count, profiles and resources (for owner names) plus the project_charters goal/status for context, and feeds everything into the deterministic buildStatusReport engine (lib/execution/status-report.ts) — no AI is involved. The report shows a headline sentence, a completion progress ring and stat buckets (done/started/blocked/not started), the milestone phases with completed/in-progress/upcoming states, blocked tasks surfaced first with their blocker_reason, attention items (blocked work, missing info), materials status and a daily plan with action types unblock/do_now/start/assign. Crucially, tasks whose only issue is an unfinished predecessor are counted as "waiting", never as blocked — blocked means an explicit impediment, matching the product's independent status dimensions. The only button is "Download PDF", which uses the browser print dialog via printWithFilename with a generated document name; print CSS isolates the #status-report-print block. The screen is read-only and writes nothing. Related screens: Command Center (Status card uses the briefing engine), Closeout Report, Workboard.
Source: status/page.tsx, status/status-report-client.tsx, lib/execution/status-report.ts.
Verify: open a project → Status tab; click Download PDF to print.

# ES: Pantalla Reporte de Estado del proyecto

Un reporte de estado en lenguaje claro e imprimible; se llega desde la pestaña Status del proyecto (también enlazado desde el área de reportes del Command Center). El servidor carga milestones, roadmap_tasks, task_dependencies, material_requirements, el conteo de budget_items, profiles y resources (nombres de responsables) y el objetivo/estado del charter (project_charters) como contexto, y lo pasa al motor determinista buildStatusReport (lib/execution/status-report.ts); no interviene IA. El reporte muestra una frase titular, un anillo de progreso y contadores (hechas/iniciadas/bloqueadas/sin iniciar), las fases por hito con estados completado/en curso/próximo, las tareas bloqueadas primero con su blocker_reason, elementos de atención (trabajo bloqueado, información faltante), estado de materiales y un plan diario con acciones de tipo desbloquear/hacer ahora/iniciar/asignar. Un punto clave: las tareas cuyo único problema es una predecesora sin terminar se cuentan como "en espera", nunca como bloqueadas; bloqueado implica un impedimento explícito, acorde con las dimensiones de estado independientes del producto. El único botón es "Descargar PDF", que usa el diálogo de impresión del navegador (printWithFilename) con un nombre de documento generado. La pantalla es de solo lectura y no escribe nada. Relacionadas: Command Center, Reporte de Cierre, Workboard.
Fuente: status/page.tsx, status/status-report-client.tsx, lib/execution/status-report.ts.
Verifica: abre un proyecto → pestaña Status; usa Descargar PDF para imprimir.
