---
slug: screen-product-intelligence
route: /product-intelligence
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/product-intelligence/page.tsx
  - src/components/product-brain/control-center.tsx
  - src/lib/product-brain/loader.ts
  - src/lib/product-brain/access.server.ts
  - src/lib/product-brain-center/registry.ts
---

# EN: Product Intelligence (Product Brain Control Center) screen

An internal-only governance cockpit at `/product-intelligence`, not a customer feature. Access is enforced server-side by a strict email allowlist (`isProductBrainAllowedEmail`, "TASK 10A"): unauthorized users receive a 404 so the route's existence is never revealed, and no Product Brain data is loaded or serialized to the client. For allowed users, the server loads the curated Product Brain markdown corpus via `getAllProductBrainDocs()` (with `?doc=` selecting the initial document, falling back to a default) and the structured registry `PRODUCT_BRAIN_ITEMS`. The client `ProductBrainControlCenter` is a tabbed cockpit: Dashboard (summary), Decisions (product decisions), Regressions, UX Contracts, Modules, ADRs/CAPs, Test Map (test-protection status), Guardrails (AI development guardrails), and Documents (the embedded canonical markdown). It offers full-text search and a module filter, item detail panels with GitHub source links into `docs/product-brain`, and two server actions: `askIsabellaAboutItemAction` (bridge into the Isabella assistant) and `exportProductBrainAction`. Data comes from repo documents and the registry, not tenant Supabase tables. Related screens: the admin Living Graph Observability panel (same allowlist gate) and Isabella surfaces that consume the same Product Brain corpus.

Source: src/app/[locale]/(app)/product-intelligence/page.tsx, src/components/product-brain/control-center.tsx, src/lib/product-brain*/**.
Verify: with an allowlisted email, open /product-intelligence; non-allowlisted accounts get a 404.

# ES: Pantalla Inteligencia de Producto (Product Brain Control Center)

Una cabina de gobernanza interna en `/product-intelligence`; no es una funcionalidad para clientes. El acceso se aplica del lado del servidor con una lista blanca estricta de correos (`isProductBrainAllowedEmail`, "TASK 10A"): los usuarios no autorizados reciben un 404 para no revelar que la ruta existe, y ningún dato del Product Brain se carga ni se serializa al cliente. Para usuarios permitidos, el servidor carga el corpus markdown curado del Product Brain con `getAllProductBrainDocs()` (el parámetro `?doc=` elige el documento inicial, con respaldo a uno por defecto) y el registro estructurado `PRODUCT_BRAIN_ITEMS`. El cliente `ProductBrainControlCenter` es una cabina con pestañas: Panel (resumen), Decisiones de producto, Regresiones, Contratos UX, Módulos, ADRs/CAPs, Mapa de tests, Guardrails de desarrollo con IA y Documentos (el markdown canónico embebido). Ofrece búsqueda de texto, filtro por módulo, paneles de detalle con enlaces al código fuente en GitHub (`docs/product-brain`) y dos server actions: `askIsabellaAboutItemAction` (puente hacia Isabella) y `exportProductBrainAction`. Los datos provienen de documentos del repositorio y del registro, no de tablas de Supabase del tenant. Pantallas relacionadas: el panel de Observabilidad del Living Graph (misma lista blanca) y las superficies de Isabella que consumen el mismo corpus.

Fuente: src/app/[locale]/(app)/product-intelligence/page.tsx, src/components/product-brain/control-center.tsx, src/lib/product-brain*/**.
Verifica: con un correo en la lista blanca, abre /product-intelligence; las cuentas no permitidas reciben un 404.
