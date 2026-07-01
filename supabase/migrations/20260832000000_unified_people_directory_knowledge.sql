-- ============================================================================
-- ProjectOps360° — Unified People, Roles & Stakeholder Directory knowledge
-- (CAP-044 / PD-014). Lets Isabella explain where participants come from, how to
-- assign a person to a governance role, what "Unassigned" means, and that
-- Resource Capacity uses the same people. Idempotent.
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-unified-people-directory', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-unified-people-directory', 'verified', '30-product-decision-log.md → PD-014; 22-modules.md → People/Team; 05-capability-registry.md → CAP-044')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-unified-people-directory', 'en', 'Where do project participants, roles and stakeholders come from? (unified People Directory)',
'ProjectOps360° uses ONE unified people directory as the source of truth for participants, team members, stakeholders, roles, responsibilities, authority, RACI/approval roles and capacity. People are not module-specific data — the same person may appear in governance, delivery, capacity, task ownership, stakeholder communication and approvals. One person, many roles, one connected system.

- "Where do project participants come from?" — They come from the unified People & Roles directory. They can be internal users, external contacts, stakeholders, sponsors, vendors, clients, approvers, or a role placeholder that is not assigned to a person yet.
- "How do I assign a person to a governance role?" — Open Charter & Governance → Roles (or the People & Roles area under Resources) and select a person from the directory for that role; responsibility and authority stay editable.
- "Why does this role say Unassigned?" — The role exists, but no person has been assigned to it yet. "Unassigned / Sin asignar" is intentional, not a data error.
- "Does Resource Capacity use the same people?" — Yes — Resource Capacity, Workboard task ownership, and governance roles should all use the same person identity so workload, ownership and availability stay connected.

Technically: the directory is a read-only projection over the existing records (internal users, external contacts, stakeholders) de-duplicated by email; the canonical project assignment record is project_team_members. Source: PD-014 (Unified People, Roles & Stakeholder Directory).
Verify: open Charter & Governance → Roles → the person field suggests people from the whole directory.'),
    ('pi-unified-people-directory', 'es', '¿De dónde vienen los participantes, roles y stakeholders del proyecto? (Directorio de Personas unificado)',
'ProjectOps360° usa UN directorio de personas unificado como fuente de verdad para participantes, miembros del equipo, stakeholders, roles, responsabilidades, autoridad, roles RACI/aprobación y capacidad. Las personas no son datos de un módulo — la misma persona puede aparecer en gobernanza, entrega, capacidad, propiedad de tareas, comunicación con stakeholders y aprobaciones. Una persona, muchos roles, un sistema conectado.

- "¿De dónde vienen los participantes?" — Del directorio unificado de Personas y Roles. Pueden ser usuarios internos, contactos externos, stakeholders, patrocinadores, proveedores, clientes, aprobadores, o un rol sin persona asignada todavía.
- "¿Cómo asigno una persona a un rol de gobernanza?" — Abre Charter y Gobernanza → Roles (o el área de Personas y Roles en Recursos) y selecciona una persona del directorio para ese rol; la responsabilidad y la autoridad siguen siendo editables.
- "¿Por qué este rol dice Sin asignar?" — El rol existe, pero aún no se ha asignado ninguna persona. "Sin asignar / Unassigned" es intencional, no un error de datos.
- "¿Resource Capacity usa las mismas personas?" — Sí — Resource Capacity, la propiedad de tareas del Workboard y los roles de gobernanza deberían usar la misma identidad de persona para que carga, propiedad y disponibilidad queden conectadas.

Técnicamente: el directorio es una proyección de solo lectura sobre los registros existentes (usuarios internos, contactos externos, stakeholders) deduplicados por email; el registro canónico de asignación de proyecto es project_team_members. Fuente: PD-014.
Verifica: abre Charter y Gobernanza → Roles → el campo de persona sugiere personas de todo el directorio.')
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
