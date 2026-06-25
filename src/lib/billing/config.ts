// ============================================================================
// ProjectOps360° — Billing & Seat model configuration (pure data, client-safe)
// ============================================================================
// Billing happens at the ORGANIZATION level. Project teams are operational,
// not billing entities. A member is billable only when they are an active
// internal user with seat type owner/admin/full_seat/contributor_seat
// (light_seat is optionally billable per plan).
// ============================================================================

export type SeatType =
  | "owner" | "admin" | "full_seat" | "contributor_seat"
  | "light_seat" | "viewer_free" | "external_free";

export interface SeatMeta {
  value: SeatType;
  es: string;
  en: string;
  /** Counts against the plan's billable-user limit. */
  billable: boolean;
  descEs: string;
  descEn: string;
}

export const SEAT_TYPES: SeatMeta[] = [
  { value: "owner", es: "Propietario", en: "Owner", billable: true,
    descEs: "Control total del workspace, suscripción y facturación.", descEn: "Full workspace, subscription and billing control." },
  { value: "admin", es: "Administrador", en: "Admin", billable: true,
    descEs: "Gestiona miembros, proyectos, equipos y ajustes.", descEn: "Manages members, projects, teams and settings." },
  { value: "full_seat", es: "Asiento completo", en: "Full seat", billable: true,
    descEs: "PM, PMO, líderes de entrega, business owners.", descEn: "PMs, PMO users, delivery leads, business owners." },
  { value: "contributor_seat", es: "Colaborador", en: "Contributor", billable: true,
    descEs: "Ejecuta trabajo: tareas, backlog, ciclos, riesgos.", descEn: "Executes work: tasks, backlog, cycles, risks." },
  { value: "light_seat", es: "Asiento ligero", en: "Light seat", billable: false,
    descEs: "Aprobadores ocasionales, revisores de negocio.", descEn: "Occasional approvers, business reviewers." },
  { value: "viewer_free", es: "Observador (gratis)", en: "Viewer (free)", billable: false,
    descEs: "Solo lectura: ejecutivos, observadores.", descEn: "Read-only: executives, observers." },
  { value: "external_free", es: "Externo (gratis)", en: "External (free)", billable: false,
    descEs: "Proveedores, clientes, inspectores externos.", descEn: "Vendors, clients, external inspectors." },
];

/** Seat types that consume a billable seat. light_seat is intentionally free in MVP. */
export const BILLABLE_SEATS: SeatType[] = ["owner", "admin", "full_seat", "contributor_seat"];

export const seatMeta = (value: string | null | undefined): SeatMeta | undefined =>
  SEAT_TYPES.find((s) => s.value === value);

export const isBillableSeat = (value: string | null | undefined): boolean =>
  !!value && BILLABLE_SEATS.includes(value as SeatType);

// ── Workspace roles (the QTS / PMO operational structure) ───────────────────

export const WORKSPACE_ROLES: { value: string; es: string; en: string }[] = [
  { value: "Owner", es: "Propietario", en: "Owner" },
  { value: "Admin", es: "Administrador", en: "Admin" },
  { value: "PMO Manager", es: "Gerente PMO", en: "PMO Manager" },
  { value: "Project Manager", es: "Gerente de Proyecto", en: "Project Manager" },
  { value: "Team Member", es: "Miembro del equipo", en: "Team Member" },
  { value: "Stakeholder", es: "Stakeholder", en: "Stakeholder" },
  { value: "Viewer", es: "Observador", en: "Viewer" },
  { value: "External Collaborator", es: "Colaborador externo", en: "External Collaborator" },
];

/** Map a workspace role label onto the canonical enforced org_role. */
export function workspaceRoleToOrgRole(workspaceRole: string | null | undefined): string {
  switch (workspaceRole) {
    case "Owner": return "COMPANY_OWNER";
    case "Admin": return "PMO_ADMIN";
    case "PMO Manager": return "PMO_ADMIN";
    case "Project Manager": return "PROJECT_MANAGER";
    case "Team Member": return "TEAM_MEMBER";
    case "Stakeholder": return "STAKEHOLDER";
    case "Viewer": return "VIEWER";
    case "External Collaborator": return "CLIENT";
    default: return "TEAM_MEMBER";
  }
}

/** Map a billing seat type onto a sensible default enforced org_role. */
export function seatTypeToOrgRole(seat: string | null | undefined): string {
  switch (seat) {
    case "owner": return "COMPANY_OWNER";
    case "admin": return "PMO_ADMIN";
    case "full_seat": return "PROJECT_MANAGER";
    case "contributor_seat": return "TEAM_MEMBER";
    case "light_seat": return "STAKEHOLDER";
    case "viewer_free": return "VIEWER";
    case "external_free": return "CLIENT";
    default: return "TEAM_MEMBER";
  }
}

export const MEMBER_STATUSES: { value: string; es: string; en: string; tone: string }[] = [
  { value: "invited", es: "Invitado", en: "Invited", tone: "amber" },
  { value: "active", es: "Activo", en: "Active", tone: "green" },
  { value: "suspended", es: "Suspendido", en: "Suspended", tone: "gray" },
  { value: "removed", es: "Removido", en: "Removed", tone: "red" },
];

// ── Plans ───────────────────────────────────────────────────────────────────

export type PlanCode = "personal" | "team" | "business" | "enterprise";

export const PLAN_LABELS: Record<string, { es: string; en: string }> = {
  personal: { es: "Personal", en: "Personal" },
  team: { es: "Team", en: "Team" },
  business: { es: "Business / PMO", en: "Business / PMO" },
  enterprise: { es: "Enterprise", en: "Enterprise" },
};

// ── Entitlement field metadata (drives the billing dashboard + admin form) ──

export interface LimitField { key: string; es: string; en: string }

/** Numeric limits (NULL = unlimited). */
export const LIMIT_FIELDS: LimitField[] = [
  { key: "max_active_projects", es: "Proyectos activos", en: "Active projects" },
  { key: "max_billable_users", es: "Usuarios facturables", en: "Billable users" },
  { key: "max_company_teams", es: "Equipos de empresa", en: "Company teams" },
  { key: "max_external_contacts", es: "Contactos externos", en: "External contacts" },
  { key: "max_stakeholder_viewers", es: "Observadores / stakeholders", en: "Stakeholder viewers" },
  { key: "max_ai_credits_per_month", es: "Créditos IA / mes", en: "AI credits / month" },
  { key: "max_memory_storage_mb", es: "Almacenamiento memoria (MB)", en: "Memory storage (MB)" },
  { key: "max_documents_indexed", es: "Documentos indexados", en: "Documents indexed" },
];

/** Boolean feature flags. */
export const FEATURE_FIELDS: LimitField[] = [
  { key: "advanced_governance_enabled", es: "Gobernanza avanzada", en: "Advanced governance" },
  { key: "approval_matrix_enabled", es: "Matriz de aprobación", en: "Approval matrix" },
  { key: "stakeholder_portal_enabled", es: "Portal de stakeholders", en: "Stakeholder portal" },
  { key: "portfolio_view_enabled", es: "Vista de portafolio (PMO)", en: "Portfolio view (PMO)" },
  { key: "scope_creep_detection_enabled", es: "Detección de scope creep", en: "Scope creep detection" },
  { key: "project_memory_enabled", es: "Project Memory", en: "Project Memory" },
  { key: "integrations_enabled", es: "Integraciones", en: "Integrations" },
  { key: "audit_logs_enabled", es: "Logs de auditoría", en: "Audit logs" },
  { key: "sso_enabled", es: "SSO", en: "SSO" },
  { key: "custom_roles_enabled", es: "Roles personalizados", en: "Custom roles" },
];

/** Format a numeric limit for display: null/undefined = unlimited. */
export const formatLimit = (v: number | null | undefined, isEs: boolean): string =>
  v === null || v === undefined ? (isEs ? "Ilimitado" : "Unlimited") : String(v);
