// ============================================================================
// Isabella Companion — cerebro de respuestas (demo determinista)
//
// Contrato de integración (NO cambiar): brain(pregunta) devuelve
//   { text, state, focus? }
// donde `focus` es el id de un elemento señalable del dashboard.
// Este es el punto donde luego se conecta el LLM real (backend con la API de
// Claude) sin tocar UI ni voz: basta con sustituir la función manteniendo la
// misma firma de retorno.
// ============================================================================

export type IsabellaState = "calma" | "analiza" | "alerta" | "habla";
export type IsabellaLang = "es" | "en";

export interface IsabellaBrainReply {
  text: string;
  state: IsabellaState;
  /** id del elemento del dashboard a señalar (clave de `focusTargets`). */
  focus?: string;
}

export type IsabellaBrainFn = (
  question: string,
  lang: IsabellaLang,
) => IsabellaBrainReply;

/** Evento proactivo (Nivel 6). En la app real se dispara por eventos del
 * dominio (nuevo riesgo, cambio de camino crítico), no por timers. */
export interface IsabellaNotifyEvent {
  /** Oferta inicial: "Detecté X… ¿Quieres verlo?" */
  prompt: string;
  /** Explicación al aceptar ver el evento. */
  detail: string;
  /** id del elemento a señalar con el haz. */
  focus?: string;
  /** Etiqueta del CTA principal (p. ej. "Crear acción"). */
  actionLabel?: string;
  /** Callback al pulsar el CTA principal. */
  onAction?: () => void;
  /** Confirmación tras ejecutar la acción. */
  confirmation?: string;
}

/**
 * Crea el cerebro demo con memoria de tema (Nivel 5) y señalamiento
 * (Niveles 3, 6 y 8). La memoria (`lastTopic`) vive en el closure.
 */
export function createIsabellaBrain(): IsabellaBrainFn {
  let lastTopic: string | null = null;

  return function brain(q: string, lang: IsabellaLang): IsabellaBrainReply {
    const s = q.toLowerCase();
    const es = lang === "es";
    const R = (a: string, b: string) => (es ? a : b);

    if (/^(di|say):/i.test(q.trim())) {
      return { text: q.trim().replace(/^(di|say):\s*/i, ""), state: "calma" };
    }

    if (/riesgo|risk/i.test(s)) {
      lastTopic = "riesgo";
      return {
        text: R(
          "Tenemos 5 riesgos activos. Observa este: la API de pagos lleva 12 días sin credenciales de producción y está bloqueando la integración de pagos, que es parte del camino crítico.",
          "We have 5 active risks. Look at this one: the payments API has been without production credentials for 12 days, blocking the payments integration — part of the critical path.",
        ),
        state: "alerta",
        focus: "risk-target",
      };
    }
    if (/avance|progreso|estado|status|progress|c[oó]mo va|how('| i)s/i.test(s)) {
      lastTopic = "avance";
      return {
        text: R(
          "El proyecto va en 64% de avance con fin estimado el 28 de agosto. Vamos bien, pero el riesgo de pagos podría mover esa fecha.",
          "The project is at 64% progress, estimated finish August 28. We're on track, but the payments risk could move that date.",
        ),
        state: "analiza",
        focus: "kpi-avance",
      };
    }
    if (/hito|milestone/i.test(s)) {
      lastTopic = "hitos";
      return {
        text: R(
          "La auditoría de datos legados está completa. La integración de pagos va al 45% para el 12 de julio, y la migración enterprise apenas arranca. Priorizamos hitos antes que tareas porque así medimos mejor el progreso real.",
          "Legacy data audit is complete. Payments integration is at 45% due July 12, and the enterprise migration is just starting. We track milestones before tasks because that's how real progress is measured.",
        ),
        state: "analiza",
        focus: "card-milestones",
      };
    }
    if (/camino cr[ií]tico|critical path/i.test(s)) {
      lastTopic = "camino";
      return {
        text: R(
          "El camino crítico pasa por la integración de pagos y la migración enterprise. Cualquier retraso en esos nodos mueve directamente el go-live: por eso los vigilo con especial atención.",
          "The critical path runs through payments integration and the enterprise migration. Any delay in those nodes directly moves the go-live — that's why I watch them closely.",
        ),
        state: "alerta",
        focus: "card-path",
      };
    }
    if (/decisi[oó]n|decision/i.test(s)) {
      lastTopic = "decisiones";
      return {
        text: R(
          "Hay 2 decisiones pendientes desde hace más de una semana. Las decisiones que envejecen se convierten en riesgos: te sugiero agendar 15 minutos con el patrocinador para destrabarlas.",
          "There are 2 decisions pending for over a week. Aging decisions become risks — I suggest booking 15 minutes with the sponsor to unblock them.",
        ),
        state: "analiza",
        focus: "kpi-dec",
      };
    }
    if (/qu[eé] hago|recomiendas|sugieres|what (should|do) i|next step|siguiente paso/i.test(s)) {
      const t = lastTopic;
      if (t === "riesgo" || t === "camino") {
        return {
          text: R(
            "Sobre lo que veníamos hablando: escala hoy mismo las credenciales de la API de pagos al proveedor, con copia al patrocinador. Es la acción de mayor impacto en el cronograma.",
            "About what we were discussing: escalate the payments API credentials to the vendor today, copying the sponsor. It's the highest-impact action on the schedule.",
          ),
          state: "alerta",
          focus: "risk-target",
        };
      }
      return {
        text: R(
          "Te recomiendo empezar por los riesgos: pregúntame por ellos y te muestro el más urgente.",
          "I'd start with the risks: ask me about them and I'll show you the most urgent one.",
        ),
        state: "calma",
      };
    }
    if (/hola|buen[oa]s|qu[eé] tal|hello|\bhi\b|hey/i.test(s)) {
      if (lastTopic) {
        return {
          text: R(
            "¡Hola de nuevo! Hace un momento hablábamos de " + lastTopic + ". ¿Seguimos por ahí o revisamos otra cosa?",
            "Hi again! A moment ago we were talking about the " + lastTopic + ". Continue there, or review something else?",
          ),
          state: "calma",
        };
      }
      return {
        text: R(
          "¡Hola! Qué gusto verte. Estamos en Migración CRM, Fase 2. ¿Quieres un resumen del estado?",
          "Hi! Great to see you. We're on CRM Migration, Phase 2. Want a status summary?",
        ),
        state: "calma",
      };
    }
    if (/qui[eé]n eres|te llamas|who are you|your name/i.test(s)) {
      return {
        text: R(
          "Soy Isabella, la Project Intelligence Companion de ProjectOps360°. No soy un chatbot: observo tu proyecto, detecto lo que importa y te acompaño a decidir.",
          "I'm Isabella, the Project Intelligence Companion of ProjectOps360°. I'm not a chatbot: I watch your project, surface what matters, and help you decide.",
        ),
        state: "calma",
      };
    }
    if (/gracias|thank/i.test(s)) {
      return {
        text: R("Con gusto. Para eso estoy.", "You're welcome. That's what I'm here for."),
        state: "calma",
      };
    }
    if (/chiste|joke/i.test(s)) {
      return {
        text: R(
          "¿Sabes por qué el cronograma nunca va al gimnasio? Porque ya vive lleno de estiramientos.",
          "Why don't schedules go to the gym? They're already full of stretch goals.",
        ),
        state: "calma",
      };
    }

    return {
      text: R(
        "Buena pregunta. En esta demo puedo hablarte de riesgos, avance, hitos, decisiones y el camino crítico — y señalártelos en pantalla. Con el motor de inteligencia conectado, responderé cualquier cosa del proyecto.",
        "Good question. In this demo I can cover risks, progress, milestones, decisions and the critical path — and point at them on screen. With the intelligence engine connected, I'll answer anything about the project.",
      ),
      state: "calma",
    };
  };
}

/** Evento demo del escenario proactivo del prototipo (riesgo de credenciales). */
export function createDemoRiskEvent(lang: IsabellaLang): IsabellaNotifyEvent {
  const es = lang === "es";
  return {
    prompt: es
      ? "Detecté un riesgo que está afectando el camino crítico de Migración CRM. ¿Quieres verlo?"
      : "I detected a risk affecting the CRM Migration critical path. Want to see it?",
    detail: es
      ? "La API de pagos lleva 12 días sin credenciales de producción. Está bloqueando la integración de pagos, que es el nodo crítico antes de la migración enterprise. Sugiero escalarlo al proveedor hoy."
      : "The payments API has been without production credentials for 12 days. It's blocking the payments integration, the critical node before the enterprise migration. I suggest escalating it to the vendor today.",
    focus: "risk-target",
    actionLabel: es ? "Crear acción" : "Create action",
    confirmation: es
      ? 'Listo. Registré la acción "Escalar credenciales de producción al proveedor" y la asigné al PM del proyecto.'
      : 'Done. I logged the action "Escalate production credentials to the vendor" and assigned it to the project PM.',
  };
}
