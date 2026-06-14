// ============================================================================
// ProjectOps360° — Rhythm Center: meeting templates + auto-agenda
// ============================================================================
// Each meeting type maps to a default objective, expected outcome and an agenda
// (ordered sections). Pure data + a builder — no I/O. Bilingual (en/es).
// ============================================================================

import type { AgendaSection, EventType, RhythmMeetingType, Locale } from "@/types/database";

interface Bilingual { en: string; es: string }
interface SectionDef { key: string; en: string; es: string }

export interface MeetingTemplate {
  meetingType: RhythmMeetingType;
  /** The calendar event_type this meeting maps to. */
  eventType: EventType;
  label: Bilingual;
  objective: Bilingual;
  expectedOutcome: Bilingual;
  agenda: SectionDef[];
}

export const MEETING_TEMPLATES: Record<RhythmMeetingType, MeetingTemplate> = {
  kickoff: {
    meetingType: "kickoff",
    eventType: "kickoff_meeting",
    label: { en: "Kickoff Meeting", es: "Reunión de Arranque" },
    objective: {
      en: "Align the team on objectives, scope, roles, schedule and risks to launch the project.",
      es: "Alinear al equipo en objetivos, alcance, roles, cronograma y riesgos para lanzar el proyecto.",
    },
    expectedOutcome: {
      en: "Shared understanding of the plan, assigned responsibilities and agreed next steps.",
      es: "Entendimiento compartido del plan, responsabilidades asignadas y próximos pasos acordados.",
    },
    agenda: [
      { key: "introductions", en: "Introductions", es: "Presentaciones" },
      { key: "objectives_scope", en: "Project objectives & scope", es: "Objetivos y alcance del proyecto" },
      { key: "roles", en: "Roles & responsibilities", es: "Roles y responsabilidades" },
      { key: "schedule_milestones", en: "Schedule & milestones", es: "Cronograma e hitos" },
      { key: "budget_overview", en: "Budget overview", es: "Resumen del presupuesto" },
      { key: "risks_assumptions", en: "Risks & assumptions", es: "Riesgos y supuestos" },
      { key: "communication_plan", en: "Communication plan", es: "Plan de comunicación" },
      { key: "next_steps", en: "Next steps", es: "Próximos pasos" },
    ],
  },

  status_update: {
    meetingType: "status_update",
    eventType: "status_update",
    label: { en: "Status Update Meeting", es: "Reunión de Actualización de Estado" },
    objective: {
      en: "Review progress, surface blockers, risks, changes and decisions, and align on next actions.",
      es: "Revisar avance, exponer bloqueos, riesgos, cambios y decisiones, y alinear próximas acciones.",
    },
    expectedOutcome: {
      en: "Updated status, captured decisions and a clear set of new action items with owners.",
      es: "Estado actualizado, decisiones registradas y un set claro de nuevas acciones con responsables.",
    },
    agenda: [
      { key: "previous_actions", en: "Previous action items review", es: "Revisión de acciones previas" },
      { key: "task_updates", en: "Task Updates", es: "Actualización de tareas" },
      { key: "schedule_update", en: "Schedule Update", es: "Actualización de cronograma" },
      { key: "budget_update", en: "Budget Update", es: "Actualización de presupuesto" },
      { key: "changes", en: "Changes", es: "Cambios" },
      { key: "risks", en: "Risks", es: "Riesgos" },
      { key: "resource_issues", en: "Resource Issues", es: "Problemas de recursos" },
      { key: "vendor_issues", en: "Vendor Issues", es: "Problemas de proveedores" },
      { key: "action_updates", en: "Action Updates", es: "Actualización de acciones" },
      { key: "decisions_required", en: "Decisions required", es: "Decisiones requeridas" },
      { key: "new_actions", en: "New action items", es: "Nuevas acciones" },
    ],
  },

  stakeholder_review: {
    meetingType: "stakeholder_review",
    eventType: "stakeholder_review",
    label: { en: "Stakeholder Review", es: "Revisión con Interesados" },
    objective: {
      en: "Present project status to stakeholders, secure decisions and gather feedback.",
      es: "Presentar el estado del proyecto a los interesados, obtener decisiones y recoger retroalimentación.",
    },
    expectedOutcome: {
      en: "Stakeholder alignment, approved decisions and documented feedback.",
      es: "Alineación de interesados, decisiones aprobadas y retroalimentación documentada.",
    },
    agenda: [
      { key: "status_overview", en: "Project status overview", es: "Resumen del estado del proyecto" },
      { key: "accomplishments", en: "Key accomplishments", es: "Logros clave" },
      { key: "schedule_budget", en: "Schedule & budget status", es: "Estado de cronograma y presupuesto" },
      { key: "risks_issues", en: "Risks & issues", es: "Riesgos e incidencias" },
      { key: "decisions_required", en: "Decisions required", es: "Decisiones requeridas" },
      { key: "feedback", en: "Stakeholder feedback", es: "Retroalimentación de interesados" },
      { key: "next_steps", en: "Next steps", es: "Próximos pasos" },
    ],
  },

  closing: {
    meetingType: "closing",
    eventType: "project_closing",
    label: { en: "Closing Project", es: "Cierre del Proyecto" },
    objective: {
      en: "Formally close the project: confirm deliverables, capture lessons learned, release resources and obtain sign-off.",
      es: "Cerrar formalmente el proyecto: confirmar entregables, capturar lecciones aprendidas, liberar recursos y obtener la aprobación.",
    },
    expectedOutcome: {
      en: "Final sign-off, documented lessons learned and closure of all open items.",
      es: "Aprobación final, lecciones aprendidas documentadas y cierre de todos los pendientes.",
    },
    agenda: [
      { key: "deliverables_signoff", en: "Deliverables acceptance & sign-off", es: "Aceptación y aprobación de entregables" },
      { key: "final_schedule_budget", en: "Final schedule & budget review", es: "Revisión final de cronograma y presupuesto" },
      { key: "outstanding_items", en: "Outstanding items & action closure", es: "Pendientes y cierre de acciones" },
      { key: "risks_closure", en: "Risks & issues closure", es: "Cierre de riesgos e incidencias" },
      { key: "lessons_learned", en: "Lessons learned", es: "Lecciones aprendidas" },
      { key: "resource_release", en: "Resource release / handover", es: "Liberación de recursos / entrega" },
      { key: "acknowledgments", en: "Stakeholder acknowledgments", es: "Reconocimientos a interesados" },
      { key: "archive_next", en: "Archive & next steps", es: "Archivo y próximos pasos" },
    ],
  },

  other: {
    meetingType: "other",
    eventType: "other",
    label: { en: "Other Meeting", es: "Otra Reunión" },
    objective: {
      en: "Discuss project matters not covered by a standard meeting type.",
      es: "Tratar asuntos del proyecto no cubiertos por un tipo de reunión estándar.",
    },
    expectedOutcome: {
      en: "Captured notes, decisions and action items.",
      es: "Notas, decisiones y acciones registradas.",
    },
    agenda: [
      { key: "topics", en: "Topics", es: "Temas" },
      { key: "discussion", en: "Discussion", es: "Discusión" },
      { key: "decisions", en: "Decisions", es: "Decisiones" },
      { key: "action_items", en: "Action items", es: "Acciones" },
    ],
  },

  project_review: {
    meetingType: "project_review",
    eventType: "project_review",
    label: { en: "Project Review", es: "Revisión de Proyecto" },
    objective: {
      en: "Assess overall project health across schedule, budget, scope, risk and quality.",
      es: "Evaluar la salud general del proyecto en cronograma, presupuesto, alcance, riesgo y calidad.",
    },
    expectedOutcome: {
      en: "Health assessment, corrective actions and recorded lessons learned.",
      es: "Evaluación de salud, acciones correctivas y lecciones aprendidas registradas.",
    },
    agenda: [
      { key: "overall_health", en: "Overall project health", es: "Salud general del proyecto" },
      { key: "schedule_performance", en: "Schedule performance", es: "Desempeño del cronograma" },
      { key: "budget_performance", en: "Budget performance", es: "Desempeño del presupuesto" },
      { key: "scope_changes", en: "Scope & changes", es: "Alcance y cambios" },
      { key: "risks_issues", en: "Risks & issues", es: "Riesgos e incidencias" },
      { key: "quality", en: "Quality", es: "Calidad" },
      { key: "lessons_learned", en: "Lessons learned", es: "Lecciones aprendidas" },
      { key: "action_items", en: "Action items", es: "Acciones" },
    ],
  },
};

export function getTemplate(meetingType: RhythmMeetingType): MeetingTemplate {
  return MEETING_TEMPLATES[meetingType];
}

/** Build the default agenda (empty content) for a meeting type in the given locale. */
export function buildAgenda(meetingType: RhythmMeetingType, locale: Locale): AgendaSection[] {
  return getTemplate(meetingType).agenda.map((s) => ({
    key: s.key,
    title: locale === "es" ? s.es : s.en,
    content: "",
  }));
}

export const MEETING_TYPES: RhythmMeetingType[] = ["kickoff", "status_update", "stakeholder_review", "project_review", "closing", "other"];
