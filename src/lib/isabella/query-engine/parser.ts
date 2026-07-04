// ============================================================================
// ProjectOps360° — Isabella Query Engine · natural-language → query plan
// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE
//
// Transforms a natural-language project-data request into a SAFE query plan
// (entity + fields + filters + sort + group + aggregation). Deterministic and
// pure — the LLM interprets nothing here. "tasks without milestone" resolves to
// a GENERIC `{ milestone, is_null }` filter, one instance of a general engine.
// ============================================================================

import { detectTaskReportIntent } from "@/lib/isabella/task-report";
import { resolveEntity, resolveEnumValue, getFieldDef, ENTITY_CATALOG } from "./catalog";
import type {
  IsabellaProjectQueryPlan,
  QueryAggregation,
  QueryEntity,
  QueryFilter,
  QuerySort,
} from "./query-plan";

const DEFAULT_LIMIT = 100;

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").trim();
}

// ── Cues that this is a deterministic project-data request at all ─────────────
const RE_ENTITY_TASK = /\btareas?\b|\btasks?\b/;
const RE_STRONG_REPORT = /\b(reportes?|report|listados?|lista|tabla|table|resumen|summary)\b/;
const RE_FILTER_CUE = /\bsin\b|without|no\s+(tengan?|milestone|owner|due)|bloquead|blocked|overdue|vencid|atrasad|not started|sin iniciar|\bp1\b|\bp2\b|\bp3\b|\bdone\b|hecha|en progreso|in progress|con\s+(milestone|hito|owner|responsable)/;
// How-to / definition markers — NOT a data report (route to the knowledge corpus).
const RE_NOT_DATA = /\bhow (do|does|to|can)\b|c[oó]mo (se|funciona|abro|puedo|hago|veo|navego)\b|\bwork(s)?\s*\??$|\bqu[eé]\s+(es|son)\b|\bwhat\s+(is|are)\b/;

function hasEntityToken(q: string): boolean {
  for (const token of q.split(/[^a-z0-9áéíóúñ]+/)) {
    if (token && resolveEntity(token)) return true;
  }
  return false;
}

/**
 * Is this text a deterministic project-data query at all? Precise: a strong
 * report noun, a concrete data filter, or an entity token makes it one — UNLESS
 * it reads as a how-to / definition question (those go to the knowledge corpus).
 */
export function looksLikeProjectDataQuery(text: string): boolean {
  const q = norm(text);
  if (!q) return false;
  const strong = RE_STRONG_REPORT.test(q);
  const filter = RE_FILTER_CUE.test(q);
  if (RE_NOT_DATA.test(q) && !strong && !filter) return false;
  return strong || filter || RE_ENTITY_TASK.test(q) || hasEntityToken(q);
}

// ── Filter parsing (generic) ─────────────────────────────────────────────────

function parseFilters(q: string): QueryFilter[] {
  const filters: QueryFilter[] = [];

  // milestone presence
  if (/\bsin\s+(milestone|hito|fase|etapa)\b|no\s+(tengan?|tienen?)\s+(milestone|hito|fase)|que\s+no\s+(tengan?|tengan)\s+(milestone|hito|fase)|no\s+asignadas?\s+a\s+(milestone|hito|fase)|without\s+(milestone|phase)|\bno\s+milestone\b|milestone\s+(is\s+)?(empty|null)|unassigned\s+milestone/.test(q)) {
    filters.push({ field: "milestone", operator: "is_null" });
  } else if (/\bcon\s+(milestone|hito|fase|etapa)\b|with\s+(milestone|phase)|milestone\s+is\s+not\s+(empty|null)|\bhas\s+milestone\b/.test(q)) {
    filters.push({ field: "milestone", operator: "is_not_null" });
  } else {
    // "in Phase 5" / "de(l) hito X" / "en la fase X" → milestone contains X
    const m = q.match(/\b(?:in|en|de|del)\s+(?:phase|fase|hito|milestone)\s+([a-z0-9][\w\s-]{0,40}?)(?:\s+(?:order|orden|sort|por|by|ordenad)|$)/);
    if (m && m[1]) filters.push({ field: "milestone", operator: "contains", value: m[1].trim() });
  }

  // owner presence
  if (/\bsin\s+(owner|responsable|asignad[oa]|due[nñ]o)\b|without\s+(owner|assignee)|\bno\s+owner\b|sin\s+asignar|unassigned(?!\s+milestone)/.test(q)) {
    filters.push({ field: "owner", operator: "is_null" });
  } else if (/\bcon\s+(owner|responsable|asignad[oa])\b|with\s+(owner|assignee)/.test(q)) {
    filters.push({ field: "owner", operator: "is_not_null" });
  } else {
    const m = q.match(/\b(?:owner|responsable|asignad[oa]s?\s+a|assigned to)\s+([a-záéíóúñ][\w\s-]{0,30}?)(?:\s+(?:order|orden|sort|por|by|con|sin|ordenad)|$)/);
    if (m && m[1] && !/^(milestone|hito|fase|owner)$/.test(m[1].trim())) {
      filters.push({ field: "owner", operator: "contains", value: m[1].trim() });
    }
  }

  // due date
  if (/\bsin\s+(fecha|vencimiento|due\s*date|deadline)\b|no\s+due\s*date|without\s+due(\s*date)?/.test(q)) {
    filters.push({ field: "dueDate", operator: "is_null" });
  }
  if (/\boverdue\b|vencidas?|atrasadas?|retrasadas?/.test(q)) {
    filters.push({ field: "dueDate", operator: "before", value: "today" });
  }

  // blocked flag
  if (/\bno\s+bloqueadas?\b|not\s+blocked|sin\s+bloqueo/.test(q)) {
    filters.push({ field: "blocked", operator: "equals", value: false });
  } else if (/\bbloqueadas?\b|\bblocked\b|con\s+impedimento/.test(q)) {
    filters.push({ field: "blocked", operator: "equals", value: true });
  }

  // priority
  const pr = q.match(/\b(p1|p2|p3)\b|prioridad\s+(alta|media|baja)|\b(high|low)\s+priority/);
  if (pr) {
    const raw = pr[1] ?? pr[2] ?? pr[3] ?? "";
    filters.push({ field: "priority", operator: "equals", value: resolveEnumValue("task", "priority", raw) });
  }

  // status (value aliases). Detect negation for not_equals.
  const statusDef = getFieldDef("task", "status")!;
  for (const [alias, canonical] of Object.entries(statusDef.valueAliases ?? {})) {
    const a = norm(alias);
    // avoid double-counting "blocked/bloqueada" already handled as the flag
    if (canonical === "blocked") continue;
    const re = new RegExp(`(no\\s+est[eé]n?\\s+|not\\s+|que\\s+no\\s+(?:est[eé]n?\\s+)?)?\\b${a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`);
    const m = q.match(re);
    if (m) {
      const negated = !!m[1];
      filters.push({ field: "status", operator: negated ? "not_equals" : "equals", value: canonical });
      break; // one status filter is enough
    }
  }

  // subtask flag
  if (/\bsubtareas?\b|\bsubtasks?\b/.test(q)) {
    filters.push({ field: "subtask", operator: "equals", value: true });
  }

  return dedupeFilters(filters);
}

function dedupeFilters(filters: QueryFilter[]): QueryFilter[] {
  const seen = new Set<string>();
  const out: QueryFilter[] = [];
  for (const f of filters) {
    const key = `${f.field}|${f.operator}|${JSON.stringify(f.value ?? null)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

// ── Sort parsing ─────────────────────────────────────────────────────────────

function parseSort(q: string): QuerySort[] {
  // Reuse the shipped detector for the common "report … by title desc" shape.
  const shipped = detectTaskReportIntent(q);
  const explicitSort = /\b(order(ed)?\s+by|orden(ad[oa])?\s+por|sort\s+by|ordenad[oa]s?\s+por)\b/.test(q) || /\b(asc|desc|ascendente|descendente|a-z|z-a)\b/.test(q);

  const m = q.match(/(?:order(?:ed)?\s+by|orden(?:ad[oa])?\s+por|sort\s+by|ordenad[oa]s?\s+por|\bpor\b|\bby\b)\s+([a-záéíóúñ ]+?)(?:\s+(asc|desc|ascendente|descendente|a-z|z-a))?\b/);
  if (m && m[1]) {
    const fieldToken = m[1].trim().split(/\s+/).slice(0, 3).join(" ");
    const canonical = resolveSortField(fieldToken);
    if (canonical) {
      const dir = /desc|descendente|z-a|z\s*a|mayor a menor/.test(q) ? "desc" : "asc";
      // Only treat as sort if there was an explicit sort cue OR direction word.
      if (explicitSort) return [{ field: canonical, direction: dir }];
    }
  }

  if (shipped) return [{ field: "title", direction: shipped.sortDirection }];
  return [];
}

function resolveSortField(token: string): string | null {
  const t = norm(token);
  for (const f of ENTITY_CATALOG.task.fields) {
    if (!f.sortable) continue;
    if (f.canonical.toLowerCase() === t || f.aliases.some((a) => norm(a) === t)) return f.canonical;
  }
  return null;
}

// ── Group + aggregation parsing ──────────────────────────────────────────────

function parseGroup(q: string): { groupBy: string | null; aggregation: QueryAggregation } {
  const wantsCount = /\bresumen\b|\bsummary\b|cu[aá]nt[ao]s?\b|how many|\bcount\b|conteo/.test(q);
  const m = q.match(/(?:group(?:ed)?\s+by|agrupad[oa]s?\s+por|resumen\s+por|reporte\s+por|\bpor\b|\bby\b)\s+([a-záéíóúñ]+)/);
  let groupBy: string | null = null;
  if (m && m[1] && !/\b(asc|desc|ascendente|descendente)\b/.test(q.slice(m.index ?? 0))) {
    const explicitGroup = /group|agrupad|resumen|reporte\s+por|cu[aá]nt/.test(q);
    const noSortCue = !/\b(order|orden|sort|ordenad)\b/.test(q);
    const canonical = resolveGroupField(m[1]);
    if (canonical && (explicitGroup || noSortCue)) groupBy = canonical;
  }
  const aggregation: QueryAggregation = groupBy ? (wantsCount ? "count" : "grouped_list") : wantsCount ? "count" : "list";
  return { groupBy, aggregation };
}

function resolveGroupField(token: string): string | null {
  const t = norm(token);
  for (const f of ENTITY_CATALOG.task.fields) {
    if (!f.groupable) continue;
    if (f.canonical.toLowerCase() === t || f.aliases.some((a) => norm(a) === t)) return f.canonical;
  }
  return null;
}

// ── Public parse ─────────────────────────────────────────────────────────────

export interface ParseOptions {
  language: "en" | "es";
  limit?: number;
}

export interface RefinementOps {
  filters: QueryFilter[];
  sort: QuerySort[];
  groupBy: string | null;
  aggregation: QueryAggregation;
}

/**
 * Extract filters/sort/grouping from a follow-up message WITHOUT the standalone
 * entity gate — used by `refineQueryPlan` when a prior report supplies context
 * (e.g. "ese mismo pero agrupado por estado" has no entity of its own).
 */
export function parseRefinementOps(text: string): RefinementOps {
  const q = norm(text ?? "");
  const grp = parseGroup(q);
  return { filters: parseFilters(q), sort: parseSort(q), groupBy: grp.groupBy, aggregation: grp.aggregation };
}

/**
 * Parse a project-data request into a validated-shape plan. Returns null when it
 * is not a data query at all. A plan with `requiresClarification` is returned
 * when the entity/intent is too vague to execute safely.
 */
export function parseProjectDataQuery(text: string, opts: ParseOptions): IsabellaProjectQueryPlan | null {
  const raw = (text ?? "").trim();
  if (!looksLikeProjectDataQuery(raw)) return null;
  const q = norm(raw);

  // Parse the concrete request first so entity resolution can fall back to
  // `task` whenever there is a real filter/grouping (so a follow-up like
  // "solo las bloqueadas" / "sin milestone" works standalone).
  const filters = parseFilters(q);
  const sort = parseSort(q);
  const grp = parseGroup(q);

  // Entity: explicit entity token → that entity; else default to `task` when a
  // task/report cue OR a concrete filter/grouping is present. Only a truly vague
  // request (no entity, no filter, no grouping) asks for clarification.
  let entity: QueryEntity | null = null;
  for (const token of q.split(/[^a-z0-9áéíóúñ]+/)) {
    const e = token && resolveEntity(token);
    if (e) { entity = e; break; }
  }
  const hasTaskNoun = RE_ENTITY_TASK.test(q);
  const hasConcreteOps = filters.length > 0 || grp.groupBy != null;
  if (!entity && (hasTaskNoun || hasConcreteOps)) entity = "task";

  const base = (e: QueryEntity): IsabellaProjectQueryPlan => ({
    intent: "deterministic_project_report",
    entity: e,
    selectedFields: [...ENTITY_CATALOG[e].defaultFields],
    filters: [],
    sort: [...ENTITY_CATALOG[e].defaultSort],
    groupBy: null,
    aggregation: "list",
    limit: opts.limit ?? DEFAULT_LIMIT,
    language: opts.language,
    requiresClarification: false,
    clarificationQuestion: null,
  });

  if (!entity) {
    // Nothing concrete to act on → ask which entity.
    return {
      ...base("task"),
      requiresClarification: true,
      clarificationQuestion:
        opts.language === "es"
          ? "¿De qué quieres el reporte? Por ejemplo: tareas (con filtros como sin hito, bloqueadas, por estado…)."
          : "What would you like a report of? For example: tasks (with filters like without milestone, blocked, by status…).",
    };
  }

  const plan = base(entity);
  plan.filters = filters;
  if (sort.length > 0) plan.sort = sort;
  plan.groupBy = grp.groupBy;
  plan.aggregation = grp.aggregation;
  return plan;
}
