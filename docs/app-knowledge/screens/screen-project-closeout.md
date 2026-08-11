---
slug: screen-project-closeout
route: /projects/[projectId]/closeout
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/closeout/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/closeout/closeout-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/closeout/actions.ts
  - src/lib/rhythm/closeout.ts
  - src/lib/events/risk-capture-flag.ts
---

# EN: Project Closeout Report screen

The end-of-project report with live metrics and an AI-generated executive narrative. The server page computes metrics, readiness, milestone durations and the archive through `lib/rhythm/closeout`, then reads the `meetings` table twice: the latest **completed** `closing` meeting carries the narrative inside `ai_summary.closeout`, and the latest closing meeting of any status drives the UX-010 guided rail (schedule → complete → generate summary → review → export). Sections: executive summary (with a notice that it needs a completed "Closing Project" meeting in the Rhythm Center), Results KPIs, key accomplishments, milestone durations, detail cards for schedule, budget, risks/RFIs/submittals and governance, lessons learned, open items, next steps and the archive. Actions: `generateCloseoutNarrativeAction` stores the narrative on the closing meeting (blocked for viewers — the page passes `canRunCloseout = role !== "viewer"`), "Download PDF" prints with a `CLS` code then `markCloseoutExportedAction` stamps `exportedAt`, and `resolveRiskAction` (REG-017) resolves open `risks` inline. Behind **two independent, default-OFF per-project env flags** (`RISK_EVENT_CAPTURE_PROJECT_IDS` and `RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS`, both must list the project), each risk row also exposes Assess, Materialize and Reopen: these append `risk_assessed`, `risk_materialized` and `risk_reopened` to `project_event_log` with a client-supplied command id for idempotency; only Reopen changes the record, atomically back to `open`. A footer notes untracked metrics are omitted. Related: screen-project-rhythm-center, screen-project-budget.
Source: closeout/page.tsx, closeout-client.tsx, actions.ts, src/lib/rhythm/closeout.ts.
Verify: open a project and go to /projects/[projectId]/closeout; the Assess/Materialize/Reopen risk controls appear only when both risk-event flags list that project.

# ES: Pantalla Reporte de Cierre del Proyecto

El reporte de fin de proyecto con métricas en vivo y una narrativa ejecutiva generada con IA. La página de servidor calcula métricas, preparación, duración de hitos y el archivo mediante `lib/rhythm/closeout`, y lee dos veces la tabla `meetings`: la reunión `closing` **completada** más reciente lleva la narrativa en `ai_summary.closeout`, y la reunión de cierre más reciente de cualquier estado alimenta el riel guiado UX-010 (programar → completar → generar resumen → revisar → exportar). Secciones: resumen ejecutivo (con aviso de que requiere una reunión "Cierre del Proyecto" completada en el Rhythm Center), KPIs de resultados, logros clave, duración de hitos, tarjetas de cronograma, presupuesto, riesgos/RFIs/submittals y gobernanza, lecciones aprendidas, asuntos abiertos, próximos pasos y archivo. Acciones: `generateCloseoutNarrativeAction` guarda la narrativa en la reunión de cierre (bloqueada para viewers — la página pasa `canRunCloseout = role !== "viewer"`), "Descargar PDF" imprime con código `CLS` y luego `markCloseoutExportedAction` registra `exportedAt`, y `resolveRiskAction` (REG-017) resuelve riesgos abiertos de `risks` en línea. Detrás de **dos banderas de entorno por proyecto, independientes y apagadas por defecto** (`RISK_EVENT_CAPTURE_PROJECT_IDS` y `RISK_EVENT_CAPTURE_AFFORDANCES_PROJECT_IDS`, ambas deben listar el proyecto), cada riesgo ofrece además Evaluar, Materializar y Reabrir: agregan `risk_assessed`, `risk_materialized` y `risk_reopened` a `project_event_log` con un id de comando enviado por el cliente para idempotencia; solo Reabrir modifica el registro, de forma atómica de vuelta a `open`. Un pie aclara que se omiten métricas no rastreadas. Relacionadas: screen-project-rhythm-center, screen-project-budget.
Fuente: closeout/page.tsx, closeout-client.tsx, actions.ts, src/lib/rhythm/closeout.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/closeout; los controles Evaluar/Materializar/Reabrir solo aparecen si ambas banderas de eventos de riesgo listan ese proyecto.
