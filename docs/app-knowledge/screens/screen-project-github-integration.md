---
slug: screen-project-github-integration
route: /projects/[projectId]/settings/integrations/github
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/settings/integrations/github/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/github/actions.ts
  - src/components/github-intelligence/github-action-buttons.tsx
  - src/components/github-intelligence/repo-picker.tsx
  - src/lib/github-intelligence/software-project-guard.ts
  - src/lib/github-intelligence/config.ts
  - src/lib/github-intelligence/read-model.ts
  - src/lib/github-intelligence/installation.ts
---

# EN: GitHub Integration Settings screen

Where a software project connects a GitHub repository, reached from Project Settings → GitHub Intelligence (card visible only for software projects with the feature flag on). The page is guarded by assertGitHubIntelligenceAvailable: non-software projects see an explicit "software projects only" message; disabled/forbidden cases 404. It advertises two guarantees as badges — Read-only and Software projects only — and states the integration reads repository metadata and receives webhooks but never writes to GitHub. If repositories are connected (getConnectionStatus), they are listed with last-sync time/status and, for managers/admins (guard.canManage), Refresh (manualSyncAction) and Disconnect (disconnectRepositoryAction) buttons, plus an "Open dashboard" link to /projects/[projectId]/github. Otherwise a connect section shows: with a configured GitHub App, StartInstallButton (startInstallationAction → GitHub App install flow); without one, a dev-mode ConnectSampleButton (devConnectSampleRepositoryAction) that loads synthetic sample data. After the install callback (?installation_id, validated against the github_installations table), a RepoPicker lists installable repositories (listInstallationRepositories) and saves the choice via selectRepositoriesAction. A diagnostics section shows whether the GitHub App env vars, webhook secret and GITHUB_INTELLIGENCE_ENABLED flag are configured. Related screens: GitHub Intelligence dashboard, Project Settings.
Source: settings/integrations/github/page.tsx, github/actions.ts, components/github-intelligence/*.
Verify: software project → Settings → GitHub Intelligence card.

# ES: Pantalla Configuración de la integración con GitHub

Donde un proyecto de software conecta un repositorio de GitHub; se llega desde Configuración del Proyecto → GitHub Intelligence (tarjeta visible solo en proyectos de software con el flag activo). La página está protegida por assertGitHubIntelligenceAvailable: los proyectos que no son de software ven un mensaje explícito ("solo proyectos de software"); los casos deshabilitados o sin permiso devuelven 404. Muestra dos garantías como insignias — Solo lectura y Solo proyectos de software — y aclara que la integración lee metadatos y recibe webhooks pero nunca escribe en GitHub. Si hay repositorios conectados (getConnectionStatus), se listan con fecha y estado de la última sincronización y, para gestores/administradores, botones Actualizar (manualSyncAction) y Desconectar (disconnectRepositoryAction), más un enlace "Abrir dashboard" hacia /projects/[projectId]/github. Si no, aparece la sección de conexión: con una GitHub App configurada, el botón de instalación (startInstallationAction); sin ella, un botón de modo desarrollo (devConnectSampleRepositoryAction) que carga datos sintéticos de muestra. Tras el callback de instalación (?installation_id, validado contra la tabla github_installations), un selector de repositorios (listInstallationRepositories) guarda la elección con selectRepositoriesAction. Una sección de diagnóstico indica si están configuradas las variables de la GitHub App, el webhook secret y el flag GITHUB_INTELLIGENCE_ENABLED. Relacionadas: dashboard de GitHub Intelligence, Configuración del Proyecto.
Fuente: settings/integrations/github/page.tsx, github/actions.ts, components/github-intelligence/*.
Verifica: proyecto de software → Settings → tarjeta GitHub Intelligence.
