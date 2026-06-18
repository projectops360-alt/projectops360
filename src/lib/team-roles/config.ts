// ============================================================================
// ProjectOps360° — Project Team & Roles configuration (pure data, client-safe)
// ============================================================================
// Project teams are OPERATIONAL, not billing entities. Adding someone to a
// project never creates a billable seat by itself.
// ============================================================================

export interface Opt { value: string; es: string; en: string }

// ── Member types ────────────────────────────────────────────────────────────
export const MEMBER_TYPES: Opt[] = [
  { value: "internal_user", es: "Usuario interno", en: "Internal user" },
  { value: "external_contact", es: "Contacto externo", en: "External contact" },
  { value: "stakeholder", es: "Stakeholder", en: "Stakeholder" },
  { value: "vendor", es: "Proveedor", en: "Vendor" },
  { value: "group_imported", es: "Importado de grupo", en: "Imported from group" },
];

// ── Permission levels + default flag presets ────────────────────────────────
export const PERMISSION_LEVELS: Opt[] = [
  { value: "project_owner", es: "Dueño del proyecto", en: "Project Owner" },
  { value: "project_manager", es: "Gerente de proyecto", en: "Project Manager" },
  { value: "contributor", es: "Colaborador", en: "Contributor" },
  { value: "approver", es: "Aprobador", en: "Approver" },
  { value: "stakeholder_viewer", es: "Observador (stakeholder)", en: "Stakeholder Viewer" },
  { value: "external_contributor", es: "Colaborador externo", en: "External Contributor" },
  { value: "external_viewer", es: "Observador externo", en: "External Viewer" },
  { value: "read_only", es: "Solo lectura", en: "Read Only" },
];

export const PERMISSION_FLAGS = [
  "can_approve_changes", "can_manage_tasks", "can_view_budget", "can_view_reports",
  "can_access_memory", "can_invite_others", "can_edit_charter", "can_manage_risks",
  "can_manage_changes", "can_manage_team",
] as const;
export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

const ALL_OFF: Record<PermissionFlag, boolean> = Object.fromEntries(PERMISSION_FLAGS.map((f) => [f, false])) as Record<PermissionFlag, boolean>;

/** Default can_* preset for each permission level. */
export const PERMISSION_PRESETS: Record<string, Record<PermissionFlag, boolean>> = {
  project_owner: Object.fromEntries(PERMISSION_FLAGS.map((f) => [f, true])) as Record<PermissionFlag, boolean>,
  project_manager: { ...ALL_OFF, can_approve_changes: true, can_manage_tasks: true, can_view_budget: true, can_view_reports: true, can_access_memory: true, can_invite_others: true, can_edit_charter: true, can_manage_risks: true, can_manage_changes: true, can_manage_team: true },
  contributor: { ...ALL_OFF, can_manage_tasks: true, can_view_reports: true, can_access_memory: true },
  approver: { ...ALL_OFF, can_approve_changes: true, can_view_budget: true, can_view_reports: true },
  stakeholder_viewer: { ...ALL_OFF, can_view_reports: true },
  external_contributor: { ...ALL_OFF, can_manage_tasks: true, can_view_reports: true },
  external_viewer: { ...ALL_OFF, can_view_reports: true },
  read_only: { ...ALL_OFF, can_view_reports: true },
};

export const PERMISSION_FLAG_LABELS: Record<PermissionFlag, { es: string; en: string }> = {
  can_approve_changes: { es: "Aprobar cambios", en: "Approve changes" },
  can_manage_tasks: { es: "Gestionar tareas", en: "Manage tasks" },
  can_view_budget: { es: "Ver presupuesto", en: "View budget" },
  can_view_reports: { es: "Ver reportes", en: "View reports" },
  can_access_memory: { es: "Acceder a Project Memory", en: "Access Project Memory" },
  can_invite_others: { es: "Invitar a otros", en: "Invite others" },
  can_edit_charter: { es: "Editar charter", en: "Edit charter" },
  can_manage_risks: { es: "Gestionar riesgos", en: "Manage risks" },
  can_manage_changes: { es: "Gestionar cambios", en: "Manage changes" },
  can_manage_team: { es: "Gestionar equipo", en: "Manage team" },
};

// ── Role suggestions (free-text with datalist) ──────────────────────────────
export const PROJECT_ROLES = [
  "Project Manager", "Sponsor", "Business Owner", "Product Owner", "Scrum Master",
  "Delivery Lead", "Developer", "QA", "Data Analyst", "BI Developer", "Business Analyst",
  "Field Supervisor", "Vendor", "Consultant", "Stakeholder", "Approver", "SME", "Observer", "Client",
];
export const DELIVERY_ROLES = [
  "Business Owner", "Value Owner", "Delivery Facilitator", "Delivery Team Member",
  "Kanban Contributor", "Phase Owner", "Reviewer", "Validator", "Backlog Owner",
];
export const GOVERNANCE_ROLES = [
  "Sponsor", "Approver", "Escalation Owner", "Steering Committee Member", "Budget Owner",
  "Risk Owner", "Change Control Owner", "Compliance Reviewer", "Quality Reviewer",
];

// ── Company team types ──────────────────────────────────────────────────────
export const TEAM_TYPES: Opt[] = [
  { value: "development", es: "Equipo de desarrollo", en: "Development Team" },
  { value: "data", es: "Equipo de datos / analítica", en: "Data / Analytics Team" },
  { value: "qa", es: "Equipo de QA", en: "QA Team" },
  { value: "finance", es: "Stakeholders de finanzas", en: "Finance Stakeholders" },
  { value: "erp", es: "Equipo de implementación ERP", en: "ERP Implementation Team" },
  { value: "field", es: "Equipo de campo", en: "Construction Field Team" },
  { value: "vendor", es: "Coordinación de proveedores", en: "Vendor Coordination Team" },
  { value: "steering", es: "Comité directivo", en: "Executive Steering Committee" },
  { value: "change_board", es: "Comité de control de cambios", en: "Change Control Board" },
  { value: "risk_committee", es: "Comité de revisión de riesgos", en: "Risk Review Committee" },
  { value: "other", es: "Otro", en: "Other" },
];

// ── External contact types ──────────────────────────────────────────────────
export const CONTACT_TYPES: Opt[] = [
  { value: "client", es: "Cliente", en: "Client" },
  { value: "vendor", es: "Proveedor", en: "Vendor" },
  { value: "contractor", es: "Contratista", en: "Contractor" },
  { value: "inspector", es: "Inspector", en: "Inspector" },
  { value: "consultant", es: "Consultor", en: "Consultant" },
  { value: "sponsor", es: "Patrocinador", en: "Sponsor" },
  { value: "approver", es: "Aprobador externo", en: "External Approver" },
  { value: "regulator", es: "Revisor regulatorio", en: "Regulatory Reviewer" },
  { value: "other", es: "Otro", en: "Other" },
];

// ── RACI ────────────────────────────────────────────────────────────────────
export const RACI_ROLES: { value: string; es: string; en: string; letter: string; tone: string }[] = [
  { value: "responsible", es: "Responsable", en: "Responsible", letter: "R", tone: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  { value: "accountable", es: "Aprobador final", en: "Accountable", letter: "A", tone: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
  { value: "consulted", es: "Consultado", en: "Consulted", letter: "C", tone: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  { value: "informed", es: "Informado", en: "Informed", letter: "I", tone: "bg-muted text-muted-foreground" },
];

export const ACCESS_LEVELS: Opt[] = [
  { value: "viewer", es: "Observador", en: "Viewer" },
  { value: "commenter", es: "Comentarista", en: "Commenter" },
  { value: "approver", es: "Aprobador", en: "Approver" },
  { value: "external", es: "Externo", en: "External" },
];

export const labelOf = (opts: Opt[], value: string | null | undefined, isEs: boolean): string => {
  const o = opts.find((x) => x.value === value);
  return o ? (isEs ? o.es : o.en) : (value ?? "—");
};

// ── Critical roles for completeness scoring ─────────────────────────────────
/** Roles every project should ideally have filled. */
export const CRITICAL_ROLES = ["Project Manager", "Sponsor", "Business Owner"];
