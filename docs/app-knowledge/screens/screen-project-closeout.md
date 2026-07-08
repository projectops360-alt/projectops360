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
---

# EN: Project Closeout Report screen

The end-of-project report with live metrics and an AI-generated executive narrative. The server page computes metrics, readiness, milestone durations and the project archive via lib/rhythm/closeout, and reads the latest "closing" meeting from the meetings table: a completed one carries the generated narrative inside ai_summary.closeout; the latest of any status drives a guided step rail (UX-010: schedule closing meeting → complete it → generate summary → review → export). Sections: executive summary (with a notice when not yet generated — it requires a completed "Closing Project" meeting in the Rhythm Center), Results KPIs (task completion, schedule and budget variance, risks resolved), key accomplishments, milestone durations table, detail cards for schedule, budget, risks/RFIs/submittals and governance/engagement, lessons learned (what went well / challenges), open items, next steps and the project archive. Actions: generateCloseoutNarrativeAction stores the AI narrative on the closing meeting (viewers are blocked), "Download PDF" prints via printWithFilename and then markCloseoutExportedAction stamps exportedAt so the workflow completes, and resolveRiskAction (REG-017) resolves open risks inline. A footer notes that untracked metrics (customer satisfaction, ROI, revenue) are omitted. Related screens: Rhythm Center meetings, Budget.
Source: src/app/[locale]/(app)/projects/[projectId]/closeout/page.tsx, closeout-client.tsx, actions.ts, src/lib/rhythm/closeout.ts.
Verify: open a project and go to /projects/[projectId]/closeout.

# ES: Pantalla Reporte de Cierre del Proyecto

El reporte de fin de proyecto con métricas en vivo y una narrativa ejecutiva generada con IA. La página de servidor calcula métricas, preparación, duración de hitos y el archivo del proyecto mediante lib/rhythm/closeout, y lee la reunión de tipo "closing" más reciente en la tabla meetings: la completada lleva la narrativa generada en ai_summary.closeout; la más reciente de cualquier estado alimenta un riel de pasos guiado (UX-010: programar reunión de cierre → completarla → generar resumen → revisar → exportar). Secciones: resumen ejecutivo (con aviso cuando aún no se genera — requiere completar la reunión "Cierre del Proyecto" en el Rhythm Center), KPIs de resultados (tareas completadas, variación de cronograma y presupuesto, riesgos resueltos), logros clave, tabla de duración de hitos, tarjetas de detalle de cronograma, presupuesto, riesgos/RFIs/submittals y gobernanza/participación, lecciones aprendidas (qué salió bien / retos), asuntos abiertos, próximos pasos y archivo del proyecto. Acciones: generateCloseoutNarrativeAction guarda la narrativa de IA en la reunión de cierre (los viewers no pueden), "Descargar PDF" imprime con printWithFilename y luego markCloseoutExportedAction registra exportedAt para completar el flujo, y resolveRiskAction (REG-017) resuelve riesgos abiertos en línea. Un pie aclara que métricas no rastreadas (satisfacción del cliente, ROI, ingresos) se omiten. Relacionadas: reuniones del Rhythm Center, Presupuesto.
Fuente: src/app/[locale]/(app)/projects/[projectId]/closeout/page.tsx, closeout-client.tsx, actions.ts, src/lib/rhythm/closeout.ts.
Verifica: abre un proyecto y ve a /projects/[projectId]/closeout.
