-- ============================================================================
-- ProjectOps360° — Living Graph Edge Task Tooltip knowledge (UX-008)
-- ============================================================================
-- Incremental seed for the UX-008 Q&A package added to the manifest after the
-- base corpus was already applied. Idempotent (ON CONFLICT DO NOTHING).
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-living-graph-edge-tooltip', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-living-graph-edge-tooltip', 'verified', '32-product-ux-contracts.md → UX-008; 12-living-graph-strategy.md → Edges are evidence')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-living-graph-edge-tooltip', 'en', 'What happens when I hover over a Living Graph connection?', 'When you hover over a connection (edge) or its task-count label in the Living Graph, ProjectOps360° shows a read-only tooltip listing the tasks that connection represents and their current statuses — so you can understand what work links two milestones or phases without opening other panels. On touch devices, tap the task-count badge to open it. An edge that says "3 tasks" represents three tasks connecting the source and target milestone; hover it to see the list. The tooltip is read-only: it explains the tasks but does NOT change dependencies, tasks, milestones, blockers, or rollups, and it makes no database or AI call. Statuses use the same deterministic rules as the rest of the product — a completed task with a stale flag is shown as Done, not Blocked, and Waiting is distinct from Blocked (REG-008/010).
Source: 32-product-ux-contracts.md → UX-008 (Living Graph Edge Task Tooltip).
Verify: Execution Map → Living Graph (Milestones level) → hover an edge or its "N tasks" badge → the task list with statuses appears.'),
    ('pi-living-graph-edge-tooltip', 'es', '¿Qué pasa cuando paso el cursor sobre una conexión del Living Graph?', 'Cuando pasas el cursor sobre una conexión (edge) o sobre su etiqueta de cantidad de tareas en el Living Graph, ProjectOps360° muestra un tooltip de solo lectura con las tareas que representa esa conexión y su estado actual — así entiendes qué trabajo une dos hitos o fases sin abrir otros paneles. En dispositivos táctiles, toca la insignia de cantidad para abrirlo. Un edge que dice "3 tareas" representa tres tareas que conectan el hito origen y el destino; pásale el cursor para ver la lista. El tooltip es de solo lectura: explica las tareas pero NO cambia dependencias, tareas, hitos, bloqueos ni rollups, y no hace ninguna consulta a la base de datos ni llamada de IA. Los estados usan las mismas reglas deterministas que el resto del producto — una tarea completada con un flag obsoleto se muestra como Hecha, no Bloqueada, y En espera es distinto de Bloqueada (REG-008/010).
Fuente: 32-product-ux-contracts.md → UX-008 (Tooltip de Tareas en Edges del Living Graph).
Verifica: Execution Map → Living Graph (nivel Hitos) → pasa el cursor sobre un edge o su insignia "N tareas" → aparece la lista de tareas con estados.')
  ) AS c(slug, language, title, body) ON c.slug = p.slug
  RETURNING id, version_id, package_id, organization_id, language, body
)
INSERT INTO public.knowledge_chunks (
  localization_id, version_id, package_id, organization_id, language,
  ordinal, body, content_hash, index_status
)
SELECT
  l.id, l.version_id, l.package_id, l.organization_id, l.language,
  0, l.body, encode(digest(l.body, 'sha256'), 'hex'), 'pending'
FROM loc l;
