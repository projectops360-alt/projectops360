// ============================================================================
// ProjectOps360° — Team & Roles · Board model (pure, client-safe, tested)
// ============================================================================
// The single source of truth for the drag-and-drop Role Assignment Board logic.
// Rows come from project_team_members (one row = a role slot, optionally filled
// with a person). A BUCKET = a project_role; a real MEMBER = a row WITH identity
// (user_id / external_contact_id / display_name). Empty buckets (placeholders,
// required-but-unfilled roles) are NOT members and must never inflate the count
// or mark a role "covered". No I/O here — the client orchestrates persistence.
// ============================================================================

export type Row = Record<string, unknown>;

export interface PersonRef {
  kind: "user" | "ext";
  id: string;
  name: string;
}

// ── Predicates / keys ───────────────────────────────────────────────────────

function s(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function isActive(r: Row): boolean {
  return String(r.status ?? "active") !== "removed";
}

/** A row is a REAL member only when it carries a person identity. */
export function hasIdentity(r: Row): boolean {
  return !!(r.user_id || r.external_contact_id || r.display_name);
}

/** Stable person identity for de-duplication (internal user > external > name). */
export function rowPersonKey(r: Row): string | null {
  if (r.user_id) return `user:${String(r.user_id)}`;
  if (r.external_contact_id) return `ext:${String(r.external_contact_id)}`;
  if (r.display_name) return `name:${String(r.display_name).toLowerCase()}`;
  return null;
}

export function personKey(p: PersonRef): string {
  return `${p.kind}:${p.id}`;
}

export function sameRole(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

// ── Buckets ─────────────────────────────────────────────────────────────────

export interface BucketAssignment {
  rowId: string;
  personKey: string;
  name: string;
}

export interface RoleBucket {
  role: string;
  isRequired: boolean;
  /** No person assigned yet (required-but-empty, or a bare placeholder). */
  missing: boolean;
  count: number;
  assignments: BucketAssignment[];
  /** Empty placeholder rows for this role (fill the first before inserting). */
  placeholderRowIds: string[];
}

/**
 * Group rows into one bucket per role, ensuring every required role exists as a
 * bucket even with nobody assigned. Rows without a project_role are ignored
 * (they are not board buckets). Deterministic order: required roles first
 * (config order), then the rest alphabetically.
 */
export function buildBuckets(rows: Row[], requiredRoles: string[]): RoleBucket[] {
  const active = rows.filter(isActive);
  const byRole = new Map<string, { role: string; rows: Row[] }>();
  const keyOf = (role: string) => role.trim().toLowerCase();

  for (const r of active) {
    const role = s(r.project_role);
    if (!role) continue;
    const k = keyOf(role);
    if (!byRole.has(k)) byRole.set(k, { role, rows: [] });
    byRole.get(k)!.rows.push(r);
  }
  for (const req of requiredRoles) {
    const k = keyOf(req);
    if (!byRole.has(k)) byRole.set(k, { role: req, rows: [] });
  }

  const buckets: RoleBucket[] = [];
  for (const { role, rows: rrows } of byRole.values()) {
    const assignments = rrows
      .filter(hasIdentity)
      .map((r) => ({ rowId: String(r.id), personKey: rowPersonKey(r) ?? "", name: String(r.display_name ?? "") }));
    const placeholderRowIds = rrows.filter((r) => !hasIdentity(r)).map((r) => String(r.id));
    const isRequired = requiredRoles.some((req) => keyOf(req) === keyOf(role));
    buckets.push({ role, isRequired, missing: assignments.length === 0, count: assignments.length, assignments, placeholderRowIds });
  }

  const reqIndex = (role: string) => {
    const i = requiredRoles.findIndex((req) => keyOf(req) === keyOf(role));
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  buckets.sort((a, b) => reqIndex(a.role) - reqIndex(b.role) || a.role.localeCompare(b.role));
  return buckets;
}

/** True when this exact person is already assigned to this role (active). */
export function isDuplicateAssignment(rows: Row[], role: string, pkey: string): boolean {
  return rows.some((r) => isActive(r) && hasIdentity(r) && sameRole(r.project_role, role) && rowPersonKey(r) === pkey);
}

// ── Completeness (identity-aware) ───────────────────────────────────────────
// A placeholder is NEVER a member and NEVER marks a role covered.

export interface Completeness {
  score: number;
  hasPM: boolean;
  hasApprover: boolean;
  missingCritical: string[];
  totalMembers: number;
}

export function computeCompletenessFromRows(rows: Row[], criticalRoles: string[]): Completeness {
  const identity = rows.filter((r) => isActive(r) && hasIdentity(r));
  const distinctPeople = new Set(identity.map(rowPersonKey).filter((k): k is string => !!k));
  const rolesCovered = new Set(identity.map((r) => String(r.project_role ?? "").toLowerCase()).filter(Boolean));

  const hasPM = identity.some(
    (m) => m.permission_level === "project_manager" || m.permission_level === "project_owner" ||
      String(m.project_role ?? "").toLowerCase().includes("project manager"),
  );
  const hasApprover = identity.some(
    (m) => m.can_approve_changes === true || m.permission_level === "approver" ||
      /approver|sponsor|steering|accountable/i.test(String(m.governance_role ?? "")),
  );
  const missingCritical = criticalRoles.filter((r) => !rolesCovered.has(r.toLowerCase()));

  let score = 100;
  score -= missingCritical.length * 22;
  if (!hasApprover) score -= 18;
  if (distinctPeople.size === 0) score = 0;
  score = Math.max(0, Math.min(100, score));
  return { score, hasPM, hasApprover, missingCritical, totalMembers: distinctPeople.size };
}

// ── Optimistic reducers (pure) + the persistence op they imply ──────────────

export type PersistOp =
  | { kind: "fill"; rowId: string; person: PersonRef }
  | { kind: "insert"; tempId: string; role: string; person: PersonRef }
  | { kind: "move"; rowId: string; toRole: string; fromRole: string }
  | { kind: "clearIdentity"; rowId: string; person: PersonRef }
  | { kind: "removeRow"; rowId: string; role: string; person: PersonRef };

export interface ReduceResult {
  rows: Row[];
  op: PersistOp | null;
  duplicate: boolean;
}

function fillRow(r: Row, p: PersonRef): Row {
  return {
    ...r,
    member_type: p.kind === "user" ? "internal_user" : "external_contact",
    user_id: p.kind === "user" ? p.id : null,
    external_contact_id: p.kind === "ext" ? p.id : null,
    display_name: p.name,
  };
}

/** Assign a person to a role: fill an empty placeholder, else insert a new row. */
export function reduceAssign(rows: Row[], role: string, person: PersonRef, newId: () => string): ReduceResult {
  if (isDuplicateAssignment(rows, role, personKey(person))) return { rows, op: null, duplicate: true };

  const placeholder = rows.find((r) => isActive(r) && !hasIdentity(r) && sameRole(r.project_role, role));
  if (placeholder) {
    const rowId = String(placeholder.id);
    const rowsNext = rows.map((r) => (r === placeholder ? fillRow(r, person) : r));
    return { rows: rowsNext, op: { kind: "fill", rowId, person }, duplicate: false };
  }

  const tempId = newId();
  const row: Row = fillRow({ id: tempId, project_role: role, permission_level: "contributor", status: "active" }, person);
  return { rows: [...rows, row], op: { kind: "insert", tempId, role, person }, duplicate: false };
}

/** Move an existing assignment row to another role (keeps the row id → RACI-safe). */
export function reduceMove(rows: Row[], rowId: string, toRole: string): ReduceResult {
  const row = rows.find((r) => String(r.id) === rowId);
  if (!row) return { rows, op: null, duplicate: false };
  if (sameRole(row.project_role, toRole)) return { rows, op: null, duplicate: false };
  const pkey = rowPersonKey(row);
  const others = rows.filter((r) => String(r.id) !== rowId);
  if (pkey && isDuplicateAssignment(others, toRole, pkey)) return { rows, op: null, duplicate: true };
  const fromRole = String(row.project_role ?? "");
  const rowsNext = rows.map((r) => (String(r.id) === rowId ? { ...r, project_role: toRole } : r));
  return { rows: rowsNext, op: { kind: "move", rowId, toRole, fromRole }, duplicate: false };
}

/**
 * Remove a person from a role. If it is the LAST assignment for that role, keep
 * the bucket by reverting the row to an empty placeholder; otherwise soft-remove
 * the row. Either way the person stays in the Directory.
 */
export function reduceRemove(rows: Row[], rowId: string): { rows: Row[]; op: PersistOp | null } {
  const row = rows.find((r) => String(r.id) === rowId);
  if (!row) return { rows, op: null };
  const person: PersonRef = {
    kind: row.user_id ? "user" : "ext",
    id: String(row.user_id ?? row.external_contact_id ?? ""),
    name: String(row.display_name ?? ""),
  };
  const role = String(row.project_role ?? "");
  const siblings = rows.filter((r) => r !== row && isActive(r) && hasIdentity(r) && sameRole(r.project_role, role));

  if (siblings.length === 0) {
    const rowsNext = rows.map((r) => (r === row ? { ...r, user_id: null, external_contact_id: null, display_name: null } : r));
    return { rows: rowsNext, op: { kind: "clearIdentity", rowId, person } };
  }
  const rowsNext = rows.map((r) => (r === row ? { ...r, status: "removed" } : r));
  return { rows: rowsNext, op: { kind: "removeRow", rowId, role, person } };
}
