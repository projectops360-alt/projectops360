// ============================================================================
// ProjectOps360° — Isabella Query Engine · semantic project-data catalog
// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE
//
// The schema-aware catalog: which entities/fields exist, their EN/ES aliases,
// and which operations each field allows. Extensible by design (add an entity /
// field here, not a new if/else). Pure data + resolvers — no retrieval, no LLM.
// This is why "tasks without milestone" is a GENERIC filter, not a hardcoded phrase.
// ============================================================================

import type {
  FilterOperator,
  IsabellaProjectQueryPlan,
  PlanValidationResult,
  QueryEntity,
} from "./query-plan";

/** The logical kind of a field — drives which operators/coercions are legal. */
export type FieldKind = "string" | "enum" | "date" | "boolean" | "ref";

export interface FieldDef {
  /** Canonical field name used across plan/filter-engine/formatter. */
  canonical: string;
  aliases: string[];
  kind: FieldKind;
  filterable: boolean;
  sortable: boolean;
  groupable: boolean;
  /** Enum value alias map (raw token → canonical value), for enum fields. */
  valueAliases?: Record<string, string>;
}

export interface EntityDef {
  entity: QueryEntity;
  aliases: string[];
  fields: FieldDef[];
  defaultFields: string[];
  defaultSort: { field: string; direction: "asc" | "desc" }[];
  /** false = declared for the future; the adapter is not wired yet. */
  supported: boolean;
}

// ── Task entity (fully wired) ────────────────────────────────────────────────

const TASK_STATUS_ALIASES: Record<string, string> = {
  "not started": "not_started",
  "not_started": "not_started",
  "sin iniciar": "not_started",
  "no iniciada": "not_started",
  "no iniciadas": "not_started",
  "sin empezar": "not_started",
  "in progress": "in_progress",
  "in_progress": "in_progress",
  "en progreso": "in_progress",
  "en curso": "in_progress",
  done: "done",
  hecho: "done",
  hecha: "done",
  completada: "done",
  completadas: "done",
  terminada: "done",
  tested: "tested",
  probada: "tested",
  implemented: "implemented",
  implementada: "implemented",
  blocked: "blocked",
  bloqueada: "blocked",
  bloqueadas: "blocked",
  deferred: "deferred",
  aplazada: "deferred",
};

const TASK_PRIORITY_ALIASES: Record<string, string> = {
  p1: "p1",
  p2: "p2",
  p3: "p3",
  "prioridad alta": "p1",
  high: "p1",
  alta: "p1",
  media: "p2",
  medium: "p2",
  baja: "p3",
  low: "p3",
};

export const TASK_ENTITY: EntityDef = {
  entity: "task",
  aliases: ["task", "tasks", "tarea", "tareas"],
  defaultFields: ["title", "status", "milestone", "priority", "owner", "dueDate"],
  defaultSort: [{ field: "title", direction: "asc" }],
  supported: true,
  fields: [
    { canonical: "title", aliases: ["title", "titulo", "título", "nombre", "name", "tarea"], kind: "string", filterable: true, sortable: true, groupable: false },
    { canonical: "status", aliases: ["status", "estado", "state", "columna", "column"], kind: "enum", filterable: true, sortable: true, groupable: true, valueAliases: TASK_STATUS_ALIASES },
    { canonical: "milestone", aliases: ["milestone", "hito", "fase", "phase", "etapa"], kind: "ref", filterable: true, sortable: true, groupable: true },
    { canonical: "priority", aliases: ["priority", "prioridad", "p1", "p2", "p3"], kind: "enum", filterable: true, sortable: true, groupable: true, valueAliases: TASK_PRIORITY_ALIASES },
    { canonical: "owner", aliases: ["owner", "responsable", "asignado", "assignee", "dueño", "dueno"], kind: "ref", filterable: true, sortable: true, groupable: true },
    { canonical: "dueDate", aliases: ["vence", "due", "due date", "deadline", "fecha de entrega", "fecha limite", "fecha límite", "vencimiento"], kind: "date", filterable: true, sortable: true, groupable: false },
    { canonical: "blocked", aliases: ["blocked", "bloqueada", "bloqueado", "blocker", "impedimento"], kind: "boolean", filterable: true, sortable: false, groupable: false },
    { canonical: "subtask", aliases: ["subtask", "subtarea", "parent", "tarea madre"], kind: "boolean", filterable: true, sortable: false, groupable: false },
    { canonical: "updatedAt", aliases: ["updated", "actualizado", "last updated", "modificado"], kind: "date", filterable: true, sortable: true, groupable: false },
    { canonical: "createdAt", aliases: ["created", "creado", "creación", "creacion"], kind: "date", filterable: true, sortable: true, groupable: false },
  ],
};

// Future entities — declared so the parser can recognize them, but the adapter
// is not wired yet (supported: false → the engine asks for a supported entity).
const FUTURE = (entity: QueryEntity, aliases: string[]): EntityDef => ({
  entity,
  aliases,
  fields: [],
  defaultFields: [],
  defaultSort: [],
  supported: false,
});

export const ENTITY_CATALOG: Record<QueryEntity, EntityDef> = {
  task: TASK_ENTITY,
  subtask: FUTURE("subtask", ["subtask", "subtasks", "subtarea", "subtareas"]),
  milestone: FUTURE("milestone", ["milestone", "milestones", "hito", "hitos", "fase", "fases"]),
  risk: FUTURE("risk", ["risk", "risks", "riesgo", "riesgos"]),
  decision: FUTURE("decision", ["decision", "decisions", "decisión", "decisiones"]),
  approval: FUTURE("approval", ["approval", "approvals", "aprobación", "aprobaciones"]),
};

// ── Resolvers ────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").trim();
}

/** Resolve an entity token (alias) to its canonical entity, or null. */
export function resolveEntity(token: string): QueryEntity | null {
  const t = norm(token);
  for (const def of Object.values(ENTITY_CATALOG)) {
    if (def.aliases.some((a) => norm(a) === t)) return def.entity;
  }
  return null;
}

/** Resolve a field alias to its canonical field for an entity, or null. */
export function resolveField(entity: QueryEntity, token: string): string | null {
  const t = norm(token);
  const def = ENTITY_CATALOG[entity];
  for (const f of def.fields) {
    if (f.canonical.toLowerCase() === t || f.aliases.some((a) => norm(a) === t)) return f.canonical;
  }
  return null;
}

export function getFieldDef(entity: QueryEntity, canonical: string): FieldDef | null {
  return ENTITY_CATALOG[entity].fields.find((f) => f.canonical === canonical) ?? null;
}

/** Resolve an enum value alias (e.g. "sin iniciar" → "not_started"), or the input. */
export function resolveEnumValue(entity: QueryEntity, canonical: string, rawValue: string): string {
  const f = getFieldDef(entity, canonical);
  const key = norm(rawValue);
  return f?.valueAliases?.[key] ?? f?.valueAliases?.[rawValue] ?? rawValue;
}

// ── Plan validation ──────────────────────────────────────────────────────────

const OPERATORS: ReadonlySet<FilterOperator> = new Set([
  "equals", "not_equals", "is_null", "is_not_null", "contains", "not_contains",
  "in", "not_in", "before", "after", "on_or_before", "on_or_after", "greater_than", "less_than",
]);

/**
 * Validate a plan against the catalog BEFORE execution. Rejects unknown/
 * unsupported entities, unknown or non-filterable/sortable/groupable fields, and
 * unknown operators — so the LLM can never smuggle a forbidden field/op into a
 * query. A plan flagged `requiresClarification` is valid (it won't execute).
 */
export function validateQueryPlan(plan: IsabellaProjectQueryPlan): PlanValidationResult {
  const errors: string[] = [];
  const def = ENTITY_CATALOG[plan.entity];

  if (!def) {
    return { ok: false, errors: [`Unknown entity: ${plan.entity}`] };
  }
  if (plan.requiresClarification) {
    return { ok: true, errors: [] }; // valid, but will ask instead of execute
  }
  if (!def.supported) {
    errors.push(`Entity not supported yet: ${plan.entity}`);
  }

  for (const fld of plan.selectedFields) {
    if (!getFieldDef(plan.entity, fld)) errors.push(`Unknown selected field: ${fld}`);
  }
  for (const f of plan.filters) {
    const fd = getFieldDef(plan.entity, f.field);
    if (!fd) { errors.push(`Unknown filter field: ${f.field}`); continue; }
    if (!fd.filterable) errors.push(`Field not filterable: ${f.field}`);
    if (!OPERATORS.has(f.operator)) errors.push(`Unknown operator: ${f.operator}`);
  }
  for (const s of plan.sort) {
    const fd = getFieldDef(plan.entity, s.field);
    if (!fd) { errors.push(`Unknown sort field: ${s.field}`); continue; }
    if (!fd.sortable) errors.push(`Field not sortable: ${s.field}`);
  }
  if (plan.groupBy) {
    const fd = getFieldDef(plan.entity, plan.groupBy);
    if (!fd) errors.push(`Unknown group field: ${plan.groupBy}`);
    else if (!fd.groupable) errors.push(`Field not groupable: ${plan.groupBy}`);
  }
  if (plan.limit <= 0) errors.push("limit must be > 0");

  return { ok: errors.length === 0, errors };
}
