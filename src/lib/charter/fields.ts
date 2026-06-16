// ============================================================================
// ProjectOps360° — Project Charter field & section configuration
// ============================================================================
// Pure data (no server imports) so both the server (completion %) and the
// client (form rendering) can share it. Tabs map to the PMO charter structure.
// ============================================================================

export type CharterStatus =
  | "draft" | "under_review" | "pending_approval" | "approved"
  | "active" | "revision_required" | "superseded" | "archived";

/** Every editable text column on project_charters. */
export type CharterFieldKey =
  | "executive_summary" | "background" | "business_case" | "project_goal"
  | "objectives" | "business_drivers"
  | "in_scope" | "out_of_scope" | "assumptions" | "constraints" | "limitations" | "dependencies"
  | "major_deliverables" | "acceptance_criteria" | "success_criteria" | "knowledge_transfer_expectations"
  | "governance_model" | "decision_making_process" | "escalation_process" | "reporting_cadence"
  | "issue_management_process" | "change_management_process" | "risk_management_process"
  | "quality_management_process" | "communication_management_process";

export interface CharterField {
  key: CharterFieldKey;
  es: string;
  en: string;
  /** Required fields drive the completion percentage and the incompleteness warning. */
  required?: boolean;
  helpEs?: string;
  helpEn?: string;
}

export interface CharterSection {
  key: string;
  es: string;
  en: string;
  descEs: string;
  descEn: string;
  fields: CharterField[];
}

export const CHARTER_SECTIONS: CharterSection[] = [
  {
    key: "summary",
    es: "Resumen del Charter", en: "Charter Summary",
    descEs: "Por qué existe el proyecto y qué lo justifica.",
    descEn: "Why the project exists and what justifies it.",
    fields: [
      { key: "executive_summary", es: "Resumen ejecutivo", en: "Executive summary" },
      { key: "background", es: "Antecedentes", en: "Background" },
      { key: "business_case", es: "Caso de negocio", en: "Business case", required: true },
      { key: "business_drivers", es: "Impulsores del negocio", en: "Business drivers" },
    ],
  },
  {
    key: "scope",
    es: "Alcance y Objetivos", en: "Scope & Objectives",
    descEs: "Meta, objetivos y los límites del proyecto.",
    descEn: "Goal, objectives and the boundaries of the project.",
    fields: [
      { key: "project_goal", es: "Meta del proyecto", en: "Project goal", required: true },
      { key: "objectives", es: "Objetivos", en: "Objectives", required: true,
        helpEs: "Específicos y medibles (uno por línea).", helpEn: "Specific and measurable (one per line)." },
      { key: "in_scope", es: "Dentro del alcance", en: "In scope", required: true },
      { key: "out_of_scope", es: "Fuera del alcance", en: "Out of scope", required: true,
        helpEs: "Define los límites para evitar scope creep.", helpEn: "Define boundaries to prevent scope creep." },
      { key: "assumptions", es: "Supuestos", en: "Assumptions" },
      { key: "constraints", es: "Restricciones", en: "Constraints" },
      { key: "limitations", es: "Limitaciones", en: "Limitations" },
      { key: "dependencies", es: "Dependencias", en: "Dependencies" },
    ],
  },
  {
    key: "deliverables",
    es: "Entregables y Criterios de Éxito", en: "Deliverables & Success Criteria",
    descEs: "Qué se entrega y cómo se mide el éxito.",
    descEn: "What is delivered and how success is measured.",
    fields: [
      { key: "major_deliverables", es: "Entregables principales", en: "Major deliverables", required: true },
      { key: "acceptance_criteria", es: "Criterios de aceptación", en: "Acceptance criteria" },
      { key: "success_criteria", es: "Criterios de éxito", en: "Success criteria", required: true },
      { key: "knowledge_transfer_expectations", es: "Transferencia de conocimiento", en: "Knowledge transfer expectations" },
    ],
  },
  {
    key: "governance",
    es: "Reglas de Gobernanza", en: "Governance Rules",
    descEs: "Cómo se decide, escala, reporta y controla la ejecución.",
    descEn: "How execution is decided, escalated, reported and controlled.",
    fields: [
      { key: "governance_model", es: "Modelo de gobernanza", en: "Governance model", required: true },
      { key: "decision_making_process", es: "Proceso de toma de decisiones", en: "Decision-making process" },
      { key: "escalation_process", es: "Proceso de escalamiento", en: "Escalation process", required: true },
      { key: "reporting_cadence", es: "Cadencia de reportes", en: "Reporting cadence", required: true },
      { key: "issue_management_process", es: "Gestión de incidencias", en: "Issue management process" },
      { key: "change_management_process", es: "Gestión de cambios", en: "Change management process" },
      { key: "risk_management_process", es: "Gestión de riesgos", en: "Risk management process" },
      { key: "quality_management_process", es: "Gestión de calidad", en: "Quality management process" },
      { key: "communication_management_process", es: "Gestión de comunicación", en: "Communication management process" },
    ],
  },
];

export const CHARTER_FIELDS: CharterField[] = CHARTER_SECTIONS.flatMap((s) => s.fields);
export const REQUIRED_FIELD_KEYS: CharterFieldKey[] = CHARTER_FIELDS.filter((f) => f.required).map((f) => f.key);

/** Completion % based on required fields filled. */
export function computeCharterCompletion(charter: Partial<Record<CharterFieldKey, string | null>>): {
  pct: number; filled: number; total: number; missing: CharterFieldKey[];
} {
  const missing = REQUIRED_FIELD_KEYS.filter((k) => !charter[k] || !String(charter[k]).trim());
  const filled = REQUIRED_FIELD_KEYS.length - missing.length;
  return {
    pct: REQUIRED_FIELD_KEYS.length ? Math.round((filled / REQUIRED_FIELD_KEYS.length) * 100) : 0,
    filled, total: REQUIRED_FIELD_KEYS.length, missing,
  };
}

// ── Status metadata ─────────────────────────────────────────────────────────

export const CHARTER_STATUS_META: Record<CharterStatus, { es: string; en: string; tone: "gray" | "blue" | "amber" | "green" | "red" }> = {
  draft:             { es: "Borrador",            en: "Draft",             tone: "gray" },
  under_review:      { es: "En revisión",         en: "Under Review",      tone: "blue" },
  pending_approval:  { es: "Pendiente de aprobación", en: "Pending Approval", tone: "amber" },
  approved:          { es: "Aprobado",            en: "Approved",          tone: "green" },
  active:            { es: "Activo",              en: "Active",            tone: "green" },
  revision_required: { es: "Requiere revisión",   en: "Revision Required", tone: "amber" },
  superseded:        { es: "Reemplazado",         en: "Superseded",        tone: "gray" },
  archived:          { es: "Archivado",           en: "Archived",          tone: "gray" },
};

/** A charter is considered "locked" (execution-ready) when approved or active. */
export const CHARTER_LOCKED_STATUSES: CharterStatus[] = ["approved", "active"];
