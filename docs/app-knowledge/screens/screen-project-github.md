---
slug: screen-project-github
route: /projects/[projectId]/github
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/github/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/github/actions.ts
  - src/components/github-intelligence/github-living-graph.tsx
  - src/lib/github-intelligence/read-model.ts
  - src/lib/github-intelligence/readiness.ts
  - src/lib/github-intelligence/summary.ts
  - src/lib/github-intelligence/software-project-guard.ts
---

# EN: GitHub Intelligence dashboard screen

The read-only execution-evidence dashboard for a connected repository, at /projects/[projectId]/github (linked from the integration settings). Guarded by assertGitHubIntelligenceAvailable: non-software projects get an explicit unavailable state; disabled/forbidden access 404s. With no repository connected it shows an empty state pointing managers to the sample-data button and the integration settings. Once connected, loadDashboardData (lib/github-intelligence/read-model) builds everything server-side. Filters are URL query params: a date window (7/14/30 days or all history, default all) and a repository switcher when several repos are connected. Five metric cards summarize commits, active branches, open PRs (with merged count), workflow/CI health and the Release Readiness score with a good/watch/at_risk/blocked band (lib/github-intelligence/readiness). The main visualization is the GitHubLivingGraph (branches/commits/PRs over time). Below sit three panels: an Activity Summary (commits, merged PRs, failed workflows, releases), an "Isabella Insight" card — a deterministic summary/risk/recommendation, labeled in code as a deterministic placeholder, with a note that readiness never replaces human approval — and a Release Path checklist (branch active, PR open, CI passing, staging deploy, production ready) derived from the metrics. The Refresh button calls manualSyncAction; the integration never writes to GitHub. Related screens: GitHub integration settings, Project Settings.
Source: github/page.tsx, github/actions.ts, lib/github-intelligence/read-model.ts.
Verify: software project with a connected repo → GitHub tab, or via Settings → GitHub Intelligence → Open dashboard.

# ES: Pantalla Dashboard de GitHub Intelligence

El dashboard de evidencia de ejecución, de solo lectura, para un repositorio conectado, en /projects/[projectId]/github (enlazado desde la configuración de la integración). Protegido por assertGitHubIntelligenceAvailable: los proyectos que no son de software ven un estado de no disponible explícito; los accesos deshabilitados o sin permiso devuelven 404. Sin repositorio conectado muestra un estado vacío que dirige a los gestores al botón de datos de muestra y a la configuración. Conectado, loadDashboardData (lib/github-intelligence/read-model) construye todo en el servidor. Los filtros son parámetros de URL: ventana de tiempo (7/14/30 días o todo el historial, por defecto todo) y selector de repositorio si hay varios. Cinco tarjetas resumen commits, ramas activas, PRs abiertos (con fusionados), salud de CI/workflows y el puntaje de Release Readiness con banda good/watch/at_risk/blocked (lib/github-intelligence/readiness). La visualización principal es el GitHubLivingGraph (ramas/commits/PRs en el tiempo). Debajo hay tres paneles: Resumen de actividad (commits, PRs fusionados, workflows fallidos, releases), la "Perspectiva de Isabella" — un resumen/riesgo/recomendación determinista, marcado en el código como placeholder determinista, con la nota de que la readiness no reemplaza la aprobación humana — y la Ruta al release (rama activa, PR abierto, CI en verde, deploy a staging, listo para producción) derivada de las métricas. El botón Actualizar llama a manualSyncAction; la integración nunca escribe en GitHub. Relacionadas: configuración de la integración con GitHub, Configuración del Proyecto.
Fuente: github/page.tsx, github/actions.ts, lib/github-intelligence/read-model.ts.
Verifica: proyecto de software con repositorio conectado → pestaña GitHub, o Settings → GitHub Intelligence → Abrir dashboard.
