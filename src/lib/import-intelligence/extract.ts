// ============================================================================
// Project Import Intelligence — Heuristic Extraction Engine
// ============================================================================
// Maps the ParsedFile intermediate representation into the canonical import
// schema. Pure functions: deterministic, bilingual (en/es) header synonyms,
// evidence-first (every entity carries source_reference + confidence_score).
// Nothing is invented: a field that cannot be found stays empty.
// ============================================================================

import type {
  ParsedFile,
  ParsedTable,
  CanonicalImport,
  CanonicalTask,
  CanonicalMilestone,
  CanonicalDependency,
  CanonicalResource,
} from "@/types/import-intelligence";
import type { ProjectType } from "@/types/execution";

// ── Field synonym dictionaries (lowercase, en + es) ─────────────────────────

const FIELD_SYNONYMS: Record<string, string[]> = {
  name: ["name", "task", "task name", "title", "activity", "item", "description of work", "nombre", "tarea", "actividad", "título", "titulo", "partida", "concepto"],
  description: ["description", "details", "notes", "scope", "descripción", "descripcion", "detalle", "detalles", "notas", "alcance"],
  status: ["status", "state", "estado", "estatus"],
  priority: ["priority", "prioridad"],
  phase: ["phase", "stage", "fase", "etapa"],
  milestone: ["milestone", "hito"],
  start: ["start", "start date", "planned start", "begin", "from", "inicio", "fecha inicio", "fecha de inicio", "comienzo"],
  finish: ["finish", "end", "end date", "due", "due date", "planned finish", "to", "fin", "fecha fin", "fecha de fin", "término", "termino", "entrega", "fecha entrega"],
  duration: ["duration", "duration days", "days", "duración", "duracion", "días", "dias"],
  hours: ["hours", "estimated hours", "effort", "labor hours", "horas", "horas estimadas", "esfuerzo"],
  assignee: ["assigned to", "assignee", "owner", "responsible", "resource", "who", "asignado", "asignado a", "responsable", "encargado", "dueño", "dueno"],
  predecessor: ["predecessor", "predecessors", "depends on", "dependency", "dependencies", "after", "blocked by", "predecesor", "predecesores", "predecesora", "depende de", "dependencia", "dependencias"],
  wbs: ["wbs", "id", "no", "no.", "#", "code", "edt", "código", "codigo", "item no"],
  quantity: ["quantity", "qty", "amount", "cantidad", "cant", "cant."],
  unit: ["unit", "uom", "unit of measure", "unidad", "u.m.", "um"],
  unit_cost: ["unit cost", "unit price", "rate", "price", "costo unitario", "precio unitario", "tarifa"],
  total_cost: ["total cost", "total", "cost", "amount", "subtotal", "costo total", "costo", "importe", "monto"],
  estimated_cost: ["estimated cost", "estimate", "budget", "budgeted", "presupuesto", "costo estimado", "estimado"],
  actual_cost: ["actual cost", "actual", "spent", "costo real", "real", "gastado", "ejecutado"],
  supplier: ["supplier", "vendor", "provider", "proveedor", "suplidor"],
  lead_time: ["lead time", "lead time days", "tiempo de entrega", "plazo de entrega"],
  category: ["category", "type", "cost code", "categoría", "categoria", "tipo", "código de costo", "codigo de costo", "cost category"],
  probability: ["probability", "likelihood", "probabilidad"],
  impact: ["impact", "severity", "impacto", "severidad"],
  mitigation: ["mitigation", "response", "plan", "mitigación", "mitigacion", "respuesta"],
  role: ["role", "trade", "discipline", "rol", "oficio", "especialidad", "disciplina"],
  location: ["location", "zone", "area", "ubicación", "ubicacion", "zona", "área"],
};

/** Table-level keywords that identify what entity a sheet/table contains. */
const TABLE_TYPE_KEYWORDS: Record<string, string[]> = {
  task: ["task", "tasks", "activities", "activity", "schedule", "plan", "wbs", "tarea", "tareas", "actividades", "cronograma", "programa"],
  milestone: ["milestone", "milestones", "hito", "hitos"],
  material: ["material", "materials", "bom", "bill of materials", "takeoff", "procurement", "materiales", "insumos", "compras", "suministros"],
  budget: ["budget", "cost", "costs", "estimate", "presupuesto", "costos", "estimación", "estimacion"],
  risk: ["risk", "risks", "issues", "riesgo", "riesgos", "problemas"],
  resource: ["resource", "resources", "team", "people", "staff", "crew", "labor", "recursos", "equipo", "personal", "cuadrillas", "mano de obra"],
};

const PROJECT_TYPE_KEYWORDS: Record<Exclude<ProjectType, "general">, string[]> = {
  software_development: ["sprint", "backend", "frontend", "api", "deploy", "qa", "release", "bug", "software", "app", "código", "codigo", "desarrollo"],
  data_center_construction: ["data center", "datacenter", "rack", "ups", "generator", "fiber", "commissioning", "cooling", "pdu", "switchgear", "centro de datos"],
  residential_construction: ["house", "residential", "framing", "roofing", "drywall", "foundation", "vivienda", "casa", "residencial", "cimentación", "cimentacion", "techado"],
  commercial_construction: ["commercial", "tenant", "core and shell", "comercial", "edificio", "oficinas"],
  infrastructure: ["highway", "bridge", "road", "pipeline", "utility", "infraestructura", "carretera", "puente", "vialidad"],
  industrial: ["plant", "industrial", "refinery", "factory", "planta", "refinería", "refineria", "fábrica", "fabrica"],
};

// ── Header matching ─────────────────────────────────────────────────────────

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Find the column index for a canonical field; exact synonym match first,
 *  then containment. Returns -1 if not found. */
export function findColumn(headers: string[], field: keyof typeof FIELD_SYNONYMS): number {
  const synonyms = FIELD_SYNONYMS[field].map(normalizeHeader);
  const normalized = headers.map(normalizeHeader);
  for (let i = 0; i < normalized.length; i++) {
    if (synonyms.includes(normalized[i])) return i;
  }
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] && synonyms.some((s) => s.length > 3 && normalized[i].includes(s))) return i;
  }
  return -1;
}

/** Classify what entity type a table most likely contains. */
export function classifyTable(table: ParsedTable): { type: string; score: number } {
  const nameNorm = normalizeHeader(table.name);
  const headerBlob = table.headers.map(normalizeHeader).join(" ");

  let best = { type: "task", score: 0 };
  for (const [type, keywords] of Object.entries(TABLE_TYPE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const kwn = normalizeHeader(kw);
      if (nameNorm.includes(kwn)) score += 3;
      if (headerBlob.includes(kwn)) score += 1;
    }
    // Column-shape signals
    if (type === "task" && findColumn(table.headers, "start") >= 0 && findColumn(table.headers, "name") >= 0) score += 2;
    if (type === "material" && findColumn(table.headers, "quantity") >= 0 && findColumn(table.headers, "unit") >= 0) score += 3;
    if (type === "budget" && findColumn(table.headers, "estimated_cost") >= 0) score += 2;
    if (type === "risk" && findColumn(table.headers, "probability") >= 0) score += 3;
    if (type === "resource" && findColumn(table.headers, "role") >= 0 && findColumn(table.headers, "name") >= 0) score += 1;
    if (score > best.score) best = { type, score };
  }
  // A nameable table with no signals at all defaults to task list only if it has a name column
  if (best.score === 0 && findColumn(table.headers, "name") === -1) return { type: "unknown", score: 0 };
  return best;
}

// ── Value coercion ──────────────────────────────────────────────────────────

function toNumber(v: string | undefined): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[$€£\s,]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(v: string | undefined): string {
  if (!v) return "";
  const t = v.trim();
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  // dd/mm/yyyy or mm/dd/yyyy — ambiguous; treat first segment >12 as day-first
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, a, b] = m;
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    const first = parseInt(a, 10);
    const second = parseInt(b, 10);
    const dayFirst = first > 12 || (second <= 12 && first <= 12 && false);
    const day = dayFirst ? first : second;
    const month = dayFirst ? second : first;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return "";
}

const STATUS_MAP: Record<string, string> = {
  "done": "done", "complete": "done", "completed": "done", "finished": "done",
  "completado": "done", "completada": "done", "terminado": "done", "terminada": "done", "hecho": "done",
  "in progress": "in_progress", "in_progress": "in_progress", "ongoing": "in_progress", "started": "in_progress", "wip": "in_progress",
  "en progreso": "in_progress", "en proceso": "in_progress", "en curso": "in_progress",
  "blocked": "blocked", "bloqueado": "blocked", "bloqueada": "blocked", "on hold": "deferred",
  "deferred": "deferred", "pospuesto": "deferred", "pospuesta": "deferred", "diferido": "deferred",
  "not started": "not_started", "pending": "not_started", "to do": "not_started", "todo": "not_started", "planned": "not_started",
  "no iniciado": "not_started", "no iniciada": "not_started", "pendiente": "not_started", "por hacer": "not_started", "planificado": "not_started", "planificada": "not_started",
};

export function normalizeStatus(v: string | undefined): string {
  if (!v) return "not_started";
  return STATUS_MAP[v.toLowerCase().trim()] ?? "not_started";
}

const PRIORITY_MAP: Record<string, string> = {
  "high": "p1", "critical": "p1", "p1": "p1", "1": "p1", "alta": "p1", "crítica": "p1", "critica": "p1", "urgente": "p1",
  "medium": "p2", "p2": "p2", "2": "p2", "media": "p2", "normal": "p2",
  "low": "p3", "p3": "p3", "3": "p3", "baja": "p3",
};

export function normalizePriority(v: string | undefined): string {
  if (!v) return "p2";
  return PRIORITY_MAP[v.toLowerCase().trim()] ?? "p2";
}

// ── Dependency phrase detection ─────────────────────────────────────────────

const DEPENDENCY_PHRASES = [
  /(?:after|depends on|blocked by|cannot start until|prerequisite:?|predecessor:?|waiting (?:on|for))\s+[""']?([^.;,""'\n]{2,80})/gi,
  /(?:después de|despues de|depende de|bloqueado por|bloqueada por|no puede (?:iniciar|comenzar) hasta|prerrequisito:?|predecesor(?:a)?:?)\s+[""']?([^.;,""'\n]{2,80})/gi,
];

/** Extract referenced predecessor names/ids from free text. */
export function extractDependencyPhrases(text: string): string[] {
  const refs: string[] = [];
  for (const pattern of DEPENDENCY_PHRASES) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      refs.push(m[1].trim());
    }
  }
  return [...new Set(refs)];
}

// ── Table extractors ────────────────────────────────────────────────────────

interface ExtractionContext {
  result: CanonicalImport;
  taskCounter: { n: number };
}

function cell(row: string[], idx: number): string {
  return idx >= 0 ? (row[idx] ?? "").trim() : "";
}

function extractTasksFromTable(table: ParsedTable, ctx: ExtractionContext): void {
  const col = {
    name: findColumn(table.headers, "name"),
    description: findColumn(table.headers, "description"),
    status: findColumn(table.headers, "status"),
    priority: findColumn(table.headers, "priority"),
    phase: findColumn(table.headers, "phase"),
    milestone: findColumn(table.headers, "milestone"),
    start: findColumn(table.headers, "start"),
    finish: findColumn(table.headers, "finish"),
    duration: findColumn(table.headers, "duration"),
    hours: findColumn(table.headers, "hours"),
    assignee: findColumn(table.headers, "assignee"),
    predecessor: findColumn(table.headers, "predecessor"),
    wbs: findColumn(table.headers, "wbs"),
    location: findColumn(table.headers, "location"),
    role: findColumn(table.headers, "role"),
  };
  if (col.name === -1) return;

  // Base confidence from how many schedule columns were recognized
  const recognized = Object.values(col).filter((c) => c >= 0).length;
  const baseConfidence = Math.min(0.95, 0.5 + recognized * 0.05);

  for (const [rowIdx, row] of table.rows.entries()) {
    const name = cell(row, col.name);
    if (!name) continue;
    ctx.taskCounter.n++;
    const sourceId = cell(row, col.wbs) || `task-${ctx.taskCounter.n}`;
    const start = toIsoDate(cell(row, col.start));
    const finish = toIsoDate(cell(row, col.finish));
    let duration = toNumber(cell(row, col.duration));
    if (duration == null && start && finish) {
      const d = (Date.parse(finish) - Date.parse(start)) / 86_400_000 + 1;
      if (Number.isFinite(d) && d > 0) duration = Math.round(d);
    }

    const task: CanonicalTask = {
      source_id: sourceId,
      name,
      description: cell(row, col.description),
      phase: cell(row, col.phase),
      milestone: cell(row, col.milestone),
      status: normalizeStatus(cell(row, col.status)),
      priority: normalizePriority(cell(row, col.priority)),
      planned_start: start,
      planned_finish: finish,
      duration_days: duration,
      estimated_hours: toNumber(cell(row, col.hours)),
      assigned_to: cell(row, col.assignee),
      required_materials: [],
      cost_code: "",
      location: cell(row, col.location),
      discipline: "",
      trade: cell(row, col.role),
      confidence_score: baseConfidence,
      source_reference: `${table.name} · row ${rowIdx + 2}`,
    };
    ctx.result.tasks.push(task);

    // Explicit predecessor column → dependencies (split on , ; /)
    const predRaw = cell(row, col.predecessor);
    if (predRaw) {
      for (const ref of predRaw.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)) {
        ctx.result.dependencies.push({
          predecessor_source_id: ref,
          successor_source_id: sourceId,
          dependency_type: "finish_to_start",
          lag_days: 0,
          inferred: false,
          confidence_score: 0.85,
          source_reference: `${table.name} · row ${rowIdx + 2}`,
        });
      }
    }

    // Phrase-based dependencies from the description (inferred → needs review)
    if (task.description) {
      for (const ref of extractDependencyPhrases(task.description)) {
        ctx.result.dependencies.push({
          predecessor_source_id: ref,
          successor_source_id: sourceId,
          dependency_type: "finish_to_start",
          lag_days: 0,
          inferred: true,
          confidence_score: 0.5,
          source_reference: `${table.name} · row ${rowIdx + 2} (text)`,
        });
      }
    }

    // Assignee → resource candidate (deduplicated later)
    if (task.assigned_to) {
      ctx.result.resources.push({
        source_id: `res-${task.assigned_to.toLowerCase()}`,
        name: task.assigned_to,
        resource_type: "person",
        trade: cell(row, col.role),
        skills: [],
        cost_rate: null,
        confidence_score: 0.7,
        source_reference: `${table.name} · row ${rowIdx + 2}`,
      });
    }
  }
}

function extractMilestonesFromTable(table: ParsedTable, ctx: ExtractionContext): void {
  const col = {
    name: findColumn(table.headers, "name"),
    description: findColumn(table.headers, "description"),
    phase: findColumn(table.headers, "phase"),
    finish: findColumn(table.headers, "finish"),
    status: findColumn(table.headers, "status"),
  };
  if (col.name === -1) return;
  for (const [rowIdx, row] of table.rows.entries()) {
    const name = cell(row, col.name);
    if (!name) continue;
    ctx.result.milestones.push({
      source_id: `ms-${ctx.result.milestones.length + 1}`,
      name,
      description: cell(row, col.description),
      phase: cell(row, col.phase),
      target_date: toIsoDate(cell(row, col.finish)),
      status: normalizeStatus(cell(row, col.status)) === "done" ? "completed" : "planned",
      confidence_score: 0.85,
      source_reference: `${table.name} · row ${rowIdx + 2}`,
    });
  }
}

function extractMaterialsFromTable(table: ParsedTable, ctx: ExtractionContext): void {
  // Material sheets usually name the item column "Material"/"Insumo" rather
  // than "Name" — fall back to that, then to the first column.
  let nameCol = findColumn(table.headers, "name");
  if (nameCol === -1) {
    nameCol = table.headers.findIndex((h) => /material|insumo|item|art[íi]culo|articulo/i.test(h));
  }
  if (nameCol === -1 && table.headers.length > 0) nameCol = 0;
  const col = {
    name: nameCol,
    quantity: findColumn(table.headers, "quantity"),
    unit: findColumn(table.headers, "unit"),
    unit_cost: findColumn(table.headers, "unit_cost"),
    total_cost: findColumn(table.headers, "total_cost"),
    supplier: findColumn(table.headers, "supplier"),
    lead_time: findColumn(table.headers, "lead_time"),
    finish: findColumn(table.headers, "finish"),
  };
  if (col.name === -1) return;
  for (const [rowIdx, row] of table.rows.entries()) {
    const name = cell(row, col.name);
    if (!name) continue;
    const qty = toNumber(cell(row, col.quantity));
    ctx.result.materials.push({
      source_id: `mat-${ctx.result.materials.length + 1}`,
      name,
      quantity: qty,
      unit: cell(row, col.unit),
      unit_cost: toNumber(cell(row, col.unit_cost)),
      total_cost: toNumber(cell(row, col.total_cost)),
      supplier: cell(row, col.supplier),
      lead_time_days: toNumber(cell(row, col.lead_time)),
      required_by_task_source_id: "",
      required_by_date: toIsoDate(cell(row, col.finish)),
      confidence_score: qty != null && cell(row, col.unit) ? 0.85 : 0.6,
      source_reference: `${table.name} · row ${rowIdx + 2}`,
    });
  }
}

function extractBudgetFromTable(table: ParsedTable, ctx: ExtractionContext): void {
  const col = {
    name: findColumn(table.headers, "name"),
    category: findColumn(table.headers, "category"),
    estimated: findColumn(table.headers, "estimated_cost"),
    total: findColumn(table.headers, "total_cost"),
    actual: findColumn(table.headers, "actual_cost"),
    wbs: findColumn(table.headers, "wbs"),
  };
  if (col.name === -1) return;
  for (const [rowIdx, row] of table.rows.entries()) {
    const name = cell(row, col.name);
    if (!name) continue;
    const estimated = toNumber(cell(row, col.estimated)) ?? toNumber(cell(row, col.total));
    ctx.result.budget_items.push({
      source_id: `bud-${ctx.result.budget_items.length + 1}`,
      name,
      category: cell(row, col.category),
      cost_code: cell(row, col.wbs),
      estimated_cost: estimated,
      committed_cost: null,
      actual_cost: toNumber(cell(row, col.actual)),
      linked_task_source_id: "",
      confidence_score: estimated != null ? 0.8 : 0.55,
      source_reference: `${table.name} · row ${rowIdx + 2}`,
    });
  }
}

function extractRisksFromTable(table: ParsedTable, ctx: ExtractionContext): void {
  // Risk registers usually call the title column "Risk"/"Riesgo".
  let nameCol = findColumn(table.headers, "name");
  if (nameCol === -1) {
    nameCol = table.headers.findIndex((h) => /risk|riesgo|issue|problema/i.test(h));
  }
  if (nameCol === -1 && table.headers.length > 0) nameCol = 0;
  const col = {
    name: nameCol,
    description: findColumn(table.headers, "description"),
    probability: findColumn(table.headers, "probability"),
    impact: findColumn(table.headers, "impact"),
    mitigation: findColumn(table.headers, "mitigation"),
  };
  if (col.name === -1) return;
  const level = (v: string): string => {
    const n = normalizeHeader(v);
    if (["high", "alta", "alto", "critical", "crítica", "critico", "crítico"].some((k) => n.includes(k))) return "high";
    if (["low", "baja", "bajo"].some((k) => n.includes(k))) return "low";
    return "medium";
  };
  for (const [rowIdx, row] of table.rows.entries()) {
    const title = cell(row, col.name);
    if (!title) continue;
    const impact = level(cell(row, col.impact));
    ctx.result.risks.push({
      source_id: `risk-${ctx.result.risks.length + 1}`,
      title,
      description: cell(row, col.description),
      probability: level(cell(row, col.probability)),
      impact,
      severity: impact,
      mitigation: cell(row, col.mitigation),
      linked_task_source_id: "",
      confidence_score: 0.8,
      source_reference: `${table.name} · row ${rowIdx + 2}`,
    });
  }
}

function extractResourcesFromTable(table: ParsedTable, ctx: ExtractionContext): void {
  const col = {
    name: findColumn(table.headers, "name"),
    role: findColumn(table.headers, "role"),
    unit_cost: findColumn(table.headers, "unit_cost"),
  };
  if (col.name === -1) return;
  for (const [rowIdx, row] of table.rows.entries()) {
    const name = cell(row, col.name);
    if (!name) continue;
    const role = normalizeHeader(cell(row, col.role));
    const isCrew = ["crew", "cuadrilla", "team", "equipo"].some((k) => role.includes(k) || normalizeHeader(name).includes(k));
    const isEquipment = ["equipment", "equipo pesado", "machine", "maquinaria", "excavator", "crane", "grúa", "grua"].some((k) => role.includes(k));
    ctx.result.resources.push({
      source_id: `res-${name.toLowerCase()}`,
      name,
      resource_type: isEquipment ? "equipment" : isCrew ? "crew" : "person",
      trade: cell(row, col.role),
      skills: [],
      cost_rate: toNumber(cell(row, col.unit_cost)),
      confidence_score: 0.8,
      source_reference: `${table.name} · row ${rowIdx + 2}`,
    });
  }
}

// ── JSON extraction ─────────────────────────────────────────────────────────

function extractFromJson(json: unknown, ctx: ExtractionContext): void {
  if (typeof json !== "object" || json === null) return;
  const obj = json as Record<string, unknown>;

  const projectObj = (obj.project ?? obj) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  if (str(projectObj.name) || str(projectObj.title)) {
    ctx.result.project.name = str(projectObj.name) || str(projectObj.title);
    ctx.result.project.description = str(projectObj.description);
    ctx.result.project.start_date = toIsoDate(str(projectObj.start_date) || str(projectObj.startDate));
    ctx.result.project.target_finish_date = toIsoDate(
      str(projectObj.target_finish_date) || str(projectObj.end_date) || str(projectObj.endDate),
    );
  }

  const arrays: { key: string[]; toTable: (items: Record<string, unknown>[]) => ParsedTable }[] = [
    {
      key: ["tasks", "activities", "items", "tareas", "actividades"],
      toTable: (items) => jsonArrayToTable("tasks", items),
    },
    { key: ["milestones", "hitos"], toTable: (items) => jsonArrayToTable("milestones", items) },
    { key: ["materials", "materiales"], toTable: (items) => jsonArrayToTable("materials", items) },
    { key: ["budget", "budget_items", "presupuesto"], toTable: (items) => jsonArrayToTable("budget", items) },
    { key: ["risks", "riesgos"], toTable: (items) => jsonArrayToTable("risks", items) },
    { key: ["resources", "recursos", "people", "team"], toTable: (items) => jsonArrayToTable("resources", items) },
  ];

  for (const { key, toTable } of arrays) {
    for (const k of key) {
      const arr = obj[k];
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "object") {
        const table = toTable(arr as Record<string, unknown>[]);
        dispatchTable(table, classifyTable(table).type, ctx);
        break;
      }
    }
  }
}

function jsonArrayToTable(name: string, items: Record<string, unknown>[]): ParsedTable {
  const headers = [...new Set(items.flatMap((it) => Object.keys(it)))];
  const rows = items.map((it) =>
    headers.map((h) => {
      const v = it[h];
      if (v == null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    }),
  );
  return { name, headers, rows };
}

// ── Project-level detection ─────────────────────────────────────────────────

export function detectProjectType(text: string): { type: ProjectType; score: number } {
  const blob = normalizeHeader(text.slice(0, 50_000));
  let best: { type: ProjectType; score: number } = { type: "general", score: 0 };
  for (const [type, keywords] of Object.entries(PROJECT_TYPE_KEYWORDS) as [ProjectType, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      const occurrences = blob.split(normalizeHeader(kw)).length - 1;
      score += Math.min(occurrences, 5);
    }
    if (score > best.score) best = { type, score };
  }
  return best.score >= 3 ? best : { type: "general", score: best.score };
}

// ── Main extraction ─────────────────────────────────────────────────────────

function dispatchTable(table: ParsedTable, type: string, ctx: ExtractionContext): void {
  switch (type) {
    case "task": extractTasksFromTable(table, ctx); break;
    case "milestone": extractMilestonesFromTable(table, ctx); break;
    case "material": extractMaterialsFromTable(table, ctx); break;
    case "budget": extractBudgetFromTable(table, ctx); break;
    case "risk": extractRisksFromTable(table, ctx); break;
    case "resource": extractResourcesFromTable(table, ctx); break;
  }
}

export function emptyCanonicalImport(): CanonicalImport {
  return {
    project: {
      name: "",
      description: "",
      project_type: "",
      start_date: "",
      target_finish_date: "",
      budget: null,
      location: "",
      status: "planned",
    },
    milestones: [],
    tasks: [],
    dependencies: [],
    resources: [],
    materials: [],
    budget_items: [],
    risks: [],
  };
}

/** Run the deterministic extraction over a parsed file. */
export function extractCanonicalImport(parsed: ParsedFile, fileName: string): CanonicalImport {
  const ctx: ExtractionContext = { result: emptyCanonicalImport(), taskCounter: { n: 0 } };

  if (parsed.rawJson != null) {
    extractFromJson(parsed.rawJson, ctx);
  }

  for (const table of parsed.tables) {
    const { type } = classifyTable(table);
    dispatchTable(table, type, ctx);
  }

  // Project name fallbacks: first markdown H1, else file name without extension
  if (!ctx.result.project.name) {
    const h1 = parsed.rawText.match(/^#\s+(.+)$/m);
    ctx.result.project.name = h1 ? h1[1].trim() : fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  }

  const detected = detectProjectType(parsed.rawText);
  ctx.result.project.project_type = detected.type;

  // Resolve dependency references: predecessor refs may be WBS ids or task names
  const bySourceId = new Map(ctx.result.tasks.map((t) => [t.source_id.toLowerCase(), t.source_id]));
  const byName = new Map(ctx.result.tasks.map((t) => [t.name.toLowerCase(), t.source_id]));
  ctx.result.dependencies = ctx.result.dependencies
    .map((d) => {
      const ref = d.predecessor_source_id.toLowerCase().trim();
      const resolved = bySourceId.get(ref) ?? byName.get(ref) ?? null;
      return resolved ? { ...d, predecessor_source_id: resolved } : null;
    })
    .filter((d): d is CanonicalDependency => d !== null)
    .filter((d) => d.predecessor_source_id !== d.successor_source_id);

  // Deduplicate resources by name
  const seenResources = new Map<string, CanonicalResource>();
  for (const r of ctx.result.resources) {
    const key = r.name.toLowerCase();
    if (!seenResources.has(key)) seenResources.set(key, r);
  }
  ctx.result.resources = [...seenResources.values()];

  // Deduplicate dependencies
  const seenDeps = new Set<string>();
  ctx.result.dependencies = ctx.result.dependencies.filter((d) => {
    const key = `${d.predecessor_source_id}→${d.successor_source_id}`;
    if (seenDeps.has(key)) return false;
    seenDeps.add(key);
    return true;
  });

  return ctx.result;
}

// ── Mapping report (for project_import_mappings) ────────────────────────────

export interface FieldMapping {
  source_entity_type: string; // 'sheet:Tasks'
  source_field_name: string;  // original header
  target_entity_type: string; // canonical entity
  target_field_name: string;  // canonical field
  mapping_confidence: number;
}

/** Report which source columns were mapped to which canonical fields. */
export function buildFieldMappings(parsed: ParsedFile): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const fieldsPerType: Record<string, (keyof typeof FIELD_SYNONYMS)[]> = {
    task: ["name", "description", "status", "priority", "phase", "milestone", "start", "finish", "duration", "hours", "assignee", "predecessor", "wbs", "location", "role"],
    milestone: ["name", "description", "phase", "finish", "status"],
    material: ["name", "quantity", "unit", "unit_cost", "total_cost", "supplier", "lead_time"],
    budget: ["name", "category", "estimated_cost", "total_cost", "actual_cost", "wbs"],
    risk: ["name", "description", "probability", "impact", "mitigation"],
    resource: ["name", "role", "unit_cost"],
  };
  for (const table of parsed.tables) {
    const { type, score } = classifyTable(table);
    const fields = fieldsPerType[type];
    if (!fields) continue;
    const confidence = Math.min(0.95, 0.5 + score * 0.05);
    for (const field of fields) {
      const idx = findColumn(table.headers, field);
      if (idx === -1) continue;
      mappings.push({
        source_entity_type: `sheet:${table.name}`,
        source_field_name: table.headers[idx],
        target_entity_type: type === "budget" ? "budget_item" : type,
        target_field_name: field,
        mapping_confidence: confidence,
      });
    }
  }
  return mappings;
}

export type { CanonicalMilestone, CanonicalTask, CanonicalDependency };
