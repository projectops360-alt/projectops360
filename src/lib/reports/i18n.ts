// ============================================================================
// ProjectOps360° — Report Builder label localization (UX-012, client-safe)
// ============================================================================
// The curated dataset registry (registry.ts) stores business labels in English
// (the canonical key language). This module translates those labels to Spanish
// at render time so the Report Builder / Data Explorer is never Spanglish.
// Canonical terms (Owner→Responsable, Planned Start→Inicio planificado, …) match
// src/lib/i18n/glossary.ts. Pure data — safe to import anywhere.
// ============================================================================

import type { DatasetColumn, DatasetDefinition } from "./types";

type Locale = string;

/** EN → ES for every curated report label: dataset names, groups, columns, enums. */
const REPORT_ES: Record<string, string> = {
  // ── Dataset display names ──
  "Project Health": "Salud del proyecto",
  "Task Execution": "Ejecución de tareas",
  "Budget Performance": "Desempeño presupuestal",
  "Financial Control": "Control financiero",
  "Risk Register": "Registro de riesgos",
  "Material Requirements": "Requerimientos de materiales",
  "RFI Log": "Bitácora de RFI",
  "Project Memory": "Memoria del Proyecto",

  // ── Dataset descriptions ──
  "Executive view of every project's status, progress, and open risk areas.":
    "Vista ejecutiva del estado, progreso y áreas de riesgo abiertas de cada proyecto.",
  "Day-to-day task control: status, owners, schedule, blockers, and critical path.":
    "Control diario de tareas: estado, responsables, cronograma, bloqueos y ruta crítica.",
  "Project controls: estimated, committed, actual, and forecast cost with variance.":
    "Control de proyecto: costo estimado, comprometido, real y proyectado con variación.",
  "PMO control view from canonical baseline, funding, commitment, actual, accrual, payment, reserve, and forecast projections.":
    "Vista de control PMO desde proyecciones canónicas de baseline, funding, compromisos, actuals, accruals, pagos, reservas y forecast.",
  "Risk analysis and mitigation tracking across the project.":
    "Análisis de riesgos y seguimiento de mitigación en todo el proyecto.",
  "Materials needed by task, date, supplier, and status — including drawing-derived items.":
    "Materiales necesarios por tarea, fecha, proveedor y estado — incluye ítems derivados de planos.",
  "Requests for information: status, ownership, and what work they block.":
    "Solicitudes de información (RFI): estado, responsable y qué trabajo bloquean.",
  "Captured project context — notes, communications, decisions, risk signals, and evidence — with AI classification flags. Foundation for Decision Log, Communication Log, Risk Signals, Stakeholder Concerns and Evidence reports.":
    "Contexto capturado del proyecto — notas, comunicaciones, decisiones, señales de riesgo y evidencia — con clasificación por IA. Base para Bitácora de Decisiones, Bitácora de Comunicación, Señales de Riesgo, Inquietudes de Stakeholders y reportes de Evidencia.",

  // ── Group names ──
  Identification: "Identificación",
  "Project Structure": "Estructura del proyecto",
  Status: "Estado",
  Schedule: "Cronograma",
  Progress: "Progreso",
  Risk: "Riesgo",
  Assignment: "Asignación",
  Effort: "Esfuerzo",
  Cost: "Costo",
  "Financial Context": "Contexto financiero",
  Baseline: "Baseline",
  Funding: "Funding",
  Commitments: "Compromisos",
  "Cash Flow": "Flujo de caja",
  Reserves: "Reservas",
  Changes: "Cambios",
  Forecast: "Forecast",
  Performance: "Desempeño",
  "Data Quality": "Calidad de datos",
  "Control Queue": "Cola de control",
  Assessment: "Evaluación",
  Mitigation: "Mitigación",
  "AI / Evidence": "IA / Evidencia",
  Quantity: "Cantidad",
  People: "Personas",
  "AI Classification": "Clasificación por IA",
  Calculated: "Calculados",

  // ── Visualization options ──
  Table: "Tabla",
  "KPI Cards": "Tarjetas KPI",
  "Bar Chart": "Gráfico de barras",
  Donut: "Dona",
  Pivot: "Tabla dinámica",

  // ── Column labels ──
  "Project Name": "Nombre del proyecto",
  "Project Type": "Tipo de proyecto",
  Project: "Proyecto",
  Milestone: "Hito",
  "Record Type": "Tipo de registro",
  "Parent Task": "Tarea principal",
  "Task Name": "Nombre de la tarea",
  Priority: "Prioridad",
  Owner: "Responsable",
  Trade: "Especialidad",
  Discipline: "Disciplina",
  "Start Date": "Fecha de inicio",
  "Target Finish": "Fin objetivo",
  "Planned Start": "Inicio planificado",
  "Planned Finish": "Fin planificado",
  "Duration (days)": "Duración (días)",
  "Overall Progress %": "Progreso general %",
  "Progress %": "Progreso %",
  "Total Tasks": "Tareas totales",
  "Completed Tasks": "Tareas completadas",
  "Blocked Tasks": "Tareas bloqueadas",
  "Open Risks": "Riesgos abiertos",
  "Open RFIs": "RFI abiertos",
  Blocked: "Bloqueado",
  "Blocker Reason": "Motivo del bloqueo",
  "On Critical Path": "En ruta crítica",
  "Total Float (days)": "Holgura total (días)",
  "Estimated Hours": "Horas estimadas",
  "Budget Item": "Partida presupuestal",
  Category: "Categoría",
  "Cost Code": "Código de costo",
  "Estimated Cost": "Costo estimado",
  "Committed Cost": "Costo comprometido",
  "Actual Cost": "Costo real",
  Currency: "Moneda",
  "Original Budget": "Presupuesto original",
  "Current Baseline": "Baseline actual",
  "Authorized Funding": "Funding autorizado",
  "Released Funding": "Funding liberado",
  "Current Commitment": "Compromiso actual",
  "Outstanding Commitment": "Compromiso pendiente",
  "Open Accrual": "Accrual abierto",
  "Settled Payments": "Pagos liquidados",
  "Remaining Reserve": "Reserva restante",
  "Approved Changes Not Posted": "Cambios aprobados sin postear",
  "Latest EAC": "EAC más reciente",
  "P50 EAC": "EAC P50",
  "P80 EAC": "EAC P80",
  "Quality Status": "Estado de calidad",
  "Pending Approvals": "Aprobaciones pendientes",
  "Reconciliation Exceptions": "Excepciones de reconciliación",
  "Unverified Actuals": "Actuals sin verificar",
  "Currency Mismatches": "Diferencias de moneda",
  "Data Date": "Fecha de datos",
  "Forecast Cost": "Costo proyectado",
  Variance: "Variación",
  "Variance %": "Variación %",
  Probability: "Probabilidad",
  Impact: "Impacto",
  Severity: "Severidad",
  "Mitigation Plan": "Plan de mitigación",
  "AI Generated": "Generado por IA",
  "AI Confidence %": "Confianza IA %",
  "Confidence %": "Confianza %",
  "Needs Review": "Requiere revisión",
  Material: "Material",
  Unit: "Unidad",
  "Estimated Total Cost": "Costo total estimado",
  "Procurement Status": "Estado de compra",
  "Lead Time (days)": "Tiempo de entrega (días)",
  "Required By": "Requerido para",
  Source: "Origen",
  "RFI Number": "Número de RFI",
  Subject: "Asunto",
  "Due Date": "Fecha límite",
  "Blocking Work": "Bloquea trabajo",
  Title: "Título",
  "Source Type": "Tipo de origen",
  Importance: "Importancia",
  Sentiment: "Sentimiento",
  Author: "Autor",
  "Occurred At": "Ocurrió el",
  Decision: "Decisión",
  "Action Item": "Acción pendiente",
  "Scope Change": "Cambio de alcance",
  "Schedule Impact": "Impacto en cronograma",
  "Cost Impact": "Impacto en costo",
  "Stakeholder Concern": "Inquietud de stakeholder",

  // ── Enum values ──
  Software: "Software",
  "Data Center": "Centro de datos",
  Residential: "Residencial",
  Commercial: "Comercial",
  Infrastructure: "Infraestructura",
  Industrial: "Industrial",
  General: "General",
  Planning: "Planificación",
  Active: "Activo",
  "On hold": "En pausa",
  Completed: "Completado",
  Cancelled: "Cancelado",
  "Not started": "Sin iniciar",
  "Prompt ready": "Prompt listo",
  "Sent to AI": "Enviado a IA",
  "In progress": "En progreso",
  "In review": "En revisiÃ³n",
  Implemented: "Implementado",
  Tested: "Probado",
  Done: "Hecho",
  Task: "Tarea",
  Subtask: "Subtarea",
  Deferred: "Diferido",
  "P1 — Critical": "P1 — Crítica",
  "P2 — Important": "P2 — Importante",
  "P3 — Normal": "P3 — Normal",
  Low: "Baja",
  Medium: "Media",
  High: "Alta",
  Critical: "Crítica",
  Labor: "Mano de obra",
  Equipment: "Equipo",
  Subcontractor: "Subcontratista",
  Cloud: "Nube",
  Permit: "Permiso",
  Contingency: "Contingencia",
  Other: "Otro",
  Planned: "Planificado",
  Approved: "Aprobado",
  "At risk": "En riesgo",
  Overrun: "Sobrecosto",
  Closed: "Cerrado",
  Budget: "Presupuesto",
  Scope: "Alcance",
  Technical: "Técnico",
  Quality: "Calidad",
  Safety: "Seguridad",
  External: "Externo",
  Open: "Abierto",
  Mitigating: "Mitigando",
  Accepted: "Aceptado",
  Resolved: "Resuelto",
  Required: "Requerido",
  Requested: "Solicitado",
  Quoted: "Cotizado",
  Ordered: "Ordenado",
  "Partially delivered": "Entregado parcialmente",
  Delivered: "Entregado",
  Installed: "Instalado",
  Unavailable: "No disponible",
  Delayed: "Retrasado",
  Manual: "Manual",
  Drawing: "Plano",
  AI: "IA",
  Template: "Plantilla",
  Import: "Importación",
  Draft: "Borrador",
  Answered: "Respondido",
  Void: "Anulado",
  "Manual note": "Nota manual",
  Email: "Correo",
  "Chat message": "Mensaje de chat",
  "Meeting note": "Nota de reunión",
  "Risk signal": "Señal de riesgo",
  Evidence: "Evidencia",
  Approval: "Aprobación",
  "Change request": "Solicitud de cambio",
  "System event": "Evento del sistema",
  Document: "Documento",
  Positive: "Positivo",
  Neutral: "Neutral",
  Negative: "Negativo",
  Concerned: "Preocupado",
  Mixed: "Mixto",
};

/** Translate one curated report label. Falls back to the English label. */
export function trReport(label: string, locale: Locale): string {
  if (locale !== "es") return label;
  return REPORT_ES[label] ?? label;
}

/** Localize a column (label, group, enum value labels) for the given locale. */
export function localizeColumn(col: DatasetColumn, locale: Locale): DatasetColumn {
  if (locale !== "es") return col;
  return {
    ...col,
    label: trReport(col.label, locale),
    group: trReport(col.group, locale),
    enumValues: col.enumValues?.map((e) => ({ ...e, label: trReport(e.label, locale) })),
  };
}

/** Localize a full dataset definition (display name, description, columns). */
export function localizeDataset(ds: DatasetDefinition, locale: Locale): DatasetDefinition {
  if (locale !== "es") return ds;
  return {
    ...ds,
    displayName: trReport(ds.displayName, locale),
    description: ds.description ? trReport(ds.description, locale) : ds.description,
    columns: ds.columns.map((c) => localizeColumn(c, locale)),
  };
}
