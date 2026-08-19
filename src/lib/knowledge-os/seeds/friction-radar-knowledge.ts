// ============================================================================
// Isabella — Friction Radar knowledge (evidence semantics)
// ============================================================================
// Friction Radar v1 reads execution friction from real event sequences. The
// danger with a radar is not that it misses a signal — it is that it turns the
// ABSENCE of a record into a claim about the world. "This task never started"
// is a devastating thing to tell a steering committee when the truth is that
// the task was completed, hours were logged against it, and the only thing
// missing was a TaskStarted row.
//
// So this corpus is written defensively. It teaches the vocabulary (category,
// signal, severity, confidence, evidence status), it teaches that every score
// is INDEPENDENT and that no Global Friction Score has been approved, and above
// all it teaches the difference between "no evidence" and "no friction".
//
// Every statement here is anchored to the shipped engine:
//   src/lib/friction-radar/event-taxonomy.ts   — which events prove work
//   src/lib/friction-radar/task-evidence.ts    — OBSERVED_START derivation
//   src/lib/friction-radar/types.ts            — the evidence contract
//   src/lib/friction-radar/read-model.ts       — why the global score is null
// Do not extend it with behaviour the engine does not implement.
//
// Kept in its own module (like the execution-intelligence wave) so this body of
// knowledge can be reviewed, revised and re-indexed as a unit.
// ============================================================================

import type { ProductBrainPackage } from "./product-brain-knowledge";

const DOMAIN = "product_intelligence" as const;

export const FRICTION_RADAR_PACKAGES: ProductBrainPackage[] = [
  {
    slug: "pi-friction-radar-what-it-is",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/load-production.ts; docs/friction-radar/AURORA_VALIDATION.md; PR #257/#258",
    authority: "cap",
    en: {
      title: "What is the Friction Radar and what is it for?",
      body:
        "Friction Radar is a read-only view that locates where execution is being slowed down, and shows the evidence for it. It is process mining applied to friction: it reads the real sequence of recorded events for each task and milestone (one case per task), compares what was observed against what was planned or committed, and promotes a SIGNAL only when a complete evidence contract exists. It creates no data of its own — it reuses the same authenticated, RLS-scoped read path as the rest of the product, adds no second event store, and never writes. It answers 'where is this project losing time, and what proves it'. It does not answer 'who is to blame': it reports signals about work, not judgements about people. In v1 it is a controlled pilot, enabled per project by a server-side flag, reachable at /projects/{projectId}/friction-radar and from the Execution Map after KPIs.\n" +
        "Source: src/lib/friction-radar/load-production.ts; docs/friction-radar/AURORA_VALIDATION.md.\n" +
        "Verify: open the project's Frictions entry point and read the Source audit card — it lists exactly which sources the read path could and could not see.",
    },
    es: {
      title: "¿Qué es el Radar de Fricción y para qué sirve?",
      body:
        "El Radar de Fricción es una vista de solo lectura que localiza dónde se está frenando la ejecución y muestra la evidencia que lo respalda. Es process mining aplicado a la fricción: lee la secuencia real de eventos registrados de cada tarea e hito (un caso por tarea), compara lo observado contra lo planificado o comprometido, y promueve una SEÑAL únicamente cuando existe un contrato de evidencia completo. No crea datos propios — reutiliza la misma ruta de lectura autenticada y limitada por RLS que el resto del producto, no añade un segundo almacén de eventos y nunca escribe. Responde «dónde está perdiendo tiempo este proyecto y qué lo demuestra». No responde «de quién es la culpa»: reporta señales sobre el trabajo, no juicios sobre las personas. En v1 es un piloto controlado, habilitado por proyecto mediante una bandera del servidor, accesible en /projects/{projectId}/friction-radar y desde el Mapa de Ejecución después de KPIs.\n" +
        "Fuente: src/lib/friction-radar/load-production.ts; docs/friction-radar/AURORA_VALIDATION.md.\n" +
        "Verifica: abre el punto de entrada Fricciones del proyecto y lee la tarjeta Auditoría de fuentes — enumera exactamente qué fuentes pudo y no pudo leer la ruta de lectura.",
    },
  },
  {
    slug: "pi-friction-radar-no-global-score",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/types.ts -> FrictionRadarReadModel.score; src/lib/friction-radar/scoring.ts",
    authority: "product_decision",
    en: {
      title: "How is a friction signal scored, and why is there no Global Friction Score?",
      body:
        "Every signal carries its OWN transparent rule score from 0 to 100, derived from that signal's severity and confidence, and it means nothing outside that signal. Scores are never added, averaged or rolled up. The severity bands are fixed: 80 and above is critical, 60 to 79 high, 35 to 59 medium, below 35 low. There is deliberately NO Global Friction Score and no category score in v1 — the read model returns null for both, because an aggregation policy has not been validated yet, and a single blended number would hide exactly what the radar exists to show. The category card therefore reports a signal COUNT and the highest single independent score, never a total. Never invent, estimate, average or imply a global or category friction score, and never present the highest signal score as if it were the project's score. If asked for one, say plainly that aggregation is not approved yet and offer the ranked signals instead.\n" +
        "Source: src/lib/friction-radar/types.ts (FrictionRadarReadModel.score is deliberately null); src/lib/friction-radar/scoring.ts.\n" +
        "Verify: Frictions -> the Global score metric card reads 'Aggregation awaits validation'; category cards show counts and the highest independent signal score.",
    },
    es: {
      title: "¿Cómo se puntúa una señal de fricción y por qué no hay una puntuación global?",
      body:
        "Cada señal lleva su PROPIA puntuación transparente de regla, de 0 a 100, derivada de la severidad y la confianza de esa señal, y no significa nada fuera de ella. Las puntuaciones nunca se suman, promedian ni agregan. Las bandas de severidad son fijas: 80 o más es crítica, de 60 a 79 alta, de 35 a 59 media, por debajo de 35 baja. Deliberadamente NO existe una puntuación global de fricción ni puntuación por categoría en v1 — el read model devuelve null en ambas, porque todavía no se ha validado una política de agregación y un único número mezclado ocultaría justo lo que el radar existe para mostrar. Por eso la tarjeta de categoría reporta un CONTEO de señales y la puntuación independiente más alta, nunca un total. Nunca inventes, estimes, promedies ni insinúes una puntuación global o por categoría, y nunca presentes la puntuación más alta como si fuera la del proyecto. Si te la piden, di con claridad que la agregación aún no está aprobada y ofrece en su lugar las señales ordenadas.\n" +
        "Fuente: src/lib/friction-radar/types.ts (FrictionRadarReadModel.score es null a propósito); src/lib/friction-radar/scoring.ts.\n" +
        "Verifica: Fricciones -> la tarjeta Puntuación global dice «La agregación espera validación»; las tarjetas de categoría muestran conteos y la puntuación independiente más alta.",
    },
  },
  {
    slug: "pi-friction-radar-signal-anatomy",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/types.ts -> FrictionSignal; src/lib/friction-radar/evidence-contract.ts",
    authority: "product_decision",
    en: {
      title: "What is the difference between category, signal, severity, confidence and evidence status?",
      body:
        "These are four independent axes and they must never be collapsed into one another. CATEGORY is the kind of friction (process, resource, dependency, schedule, cost, risk, decision, quality) — a bucket, not a measurement. SIGNAL TYPE is the specific detected pattern inside that category, such as queue_friction, stagnation, completed_then_reopened, backward_transition, blocked_by_predecessor, resource_overload or decision_wait. SEVERITY (low, medium, high, critical) says how bad the observation is IF it is true. CONFIDENCE (unknown, low, medium, high) says how well the underlying timestamps and records support it — it is a statement about the evidence, not about the impact. EVIDENCE STATUS says what the engine is willing to assert: 'confirmed' means the evidence contract is complete, 'candidate' means the pattern appears but corroboration is partial, 'unknown' means a required input was unavailable, and 'insufficient_evidence' means the input existed but did not qualify. A high-severity signal with low confidence is a lead to investigate, not a finding to report as fact — always state both.\n" +
        "Source: src/lib/friction-radar/types.ts (FrictionSignal); src/lib/friction-radar/evidence-contract.ts.\n" +
        "Verify: Frictions -> open any signal's View evidence panel; severity, confidence and evidence status are shown as separate labelled fields.",
    },
    es: {
      title: "¿Cuál es la diferencia entre categoría, señal, severidad, confianza y estado de evidencia?",
      body:
        "Son cuatro ejes independientes y nunca deben confundirse entre sí. La CATEGORÍA es el tipo de fricción (proceso, recursos, dependencias, cronograma, costos, riesgos, decisiones, calidad) — una agrupación, no una medición. El TIPO DE SEÑAL es el patrón concreto detectado dentro de esa categoría, como queue_friction, stagnation, completed_then_reopened, backward_transition, blocked_by_predecessor, resource_overload o decision_wait. La SEVERIDAD (baja, media, alta, crítica) indica qué tan grave es la observación SI es cierta. La CONFIANZA (desconocida, baja, media, alta) indica qué tan bien la respaldan los tiempos y registros subyacentes — es una afirmación sobre la evidencia, no sobre el impacto. El ESTADO DE EVIDENCIA dice qué está dispuesto a afirmar el motor: «confirmada» significa contrato de evidencia completo, «candidata» que el patrón aparece pero la corroboración es parcial, «desconocida» que faltó un insumo requerido, y «evidencia insuficiente» que el insumo existía pero no calificó. Una señal de severidad alta con confianza baja es una pista para investigar, no un hallazgo que reportar como hecho — siempre menciona ambas.\n" +
        "Fuente: src/lib/friction-radar/types.ts (FrictionSignal); src/lib/friction-radar/evidence-contract.ts.\n" +
        "Verifica: Fricciones -> abre el panel Ver evidencia de cualquier señal; severidad, confianza y estado de evidencia aparecen como campos separados y etiquetados.",
    },
  },
  {
    slug: "pi-friction-radar-observed-start",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/task-evidence.ts -> deriveObservedTaskStart; src/lib/friction-radar/event-taxonomy.ts",
    authority: "product_decision",
    en: {
      title: "Does a task with no TaskStarted event mean it never started or is waiting?",
      body:
        "No. NEVER claim a task is waiting, idle or never started merely because no TaskStarted event exists. The engine derives OBSERVED_START from the FIRST qualifying work evidence of any kind, and several event types establish a start: TaskStarted, TaskResumed, TaskImplemented, TaskTested, SubtaskStarted, SubtaskCompleted and SubtaskProgressChanged all prove work outright. TaskStatusChanged proves a start only when the transition lands on an active state. TimeLogged proves a start only when a CURRENT, non-deleted time entry with a valid operational work date backs it — a live time entry supersedes the historical TimeLogged payload, so corrected or deleted work dates cannot resurrect a start. Events that do not prove work include TaskCreated, TaskAssigned, TaskDependencyAdded, TaskMoved and TimeEntryUpdated. When no qualifying evidence is found the engine returns status 'insufficient_evidence' with the reason 'no_meaningful_work_event' — that is a statement about the RECORD, not about the task. A task can be completed, carry logged hours and still have no TaskStarted row, because start capture was introduced later than the work.\n" +
        "Source: src/lib/friction-radar/task-evidence.ts (deriveObservedTaskStart); src/lib/friction-radar/event-taxonomy.ts.\n" +
        "Verify: Frictions -> open the signal's evidence panel and read the observed start source and reason code; the event timeline shows which events qualified.",
    },
    es: {
      title: "¿Una tarea sin evento TaskStarted significa que nunca empezó o que está esperando?",
      body:
        "No. NUNCA afirmes que una tarea está esperando, inactiva o que nunca comenzó solo porque no exista un evento TaskStarted. El motor deriva el OBSERVED_START a partir de la PRIMERA evidencia de trabajo que califique, sea del tipo que sea, y varios tipos de evento establecen un inicio: TaskStarted, TaskResumed, TaskImplemented, TaskTested, SubtaskStarted, SubtaskCompleted y SubtaskProgressChanged demuestran trabajo por sí mismos. TaskStatusChanged demuestra inicio solo cuando la transición llega a un estado activo. TimeLogged demuestra inicio solo cuando lo respalda una entrada de tiempo VIGENTE, no borrada y con fecha operacional válida — una entrada viva prevalece sobre el payload histórico de TimeLogged, de modo que fechas corregidas o eliminadas no pueden resucitar un inicio. No demuestran trabajo: TaskCreated, TaskAssigned, TaskDependencyAdded, TaskMoved ni TimeEntryUpdated. Cuando no se encuentra evidencia que califique, el motor devuelve el estado «evidencia insuficiente» con el motivo «no_meaningful_work_event» — eso es una afirmación sobre el REGISTRO, no sobre la tarea. Una tarea puede estar completada, tener horas registradas y aun así no tener fila TaskStarted, porque la captura del inicio se introdujo después del trabajo.\n" +
        "Fuente: src/lib/friction-radar/task-evidence.ts (deriveObservedTaskStart); src/lib/friction-radar/event-taxonomy.ts.\n" +
        "Verifica: Fricciones -> abre el panel de evidencia de la señal y lee la fuente del inicio observado y su código de motivo; la línea de tiempo muestra qué eventos calificaron.",
    },
  },
  {
    slug: "pi-friction-radar-absence-is-not-a-fact",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/task-evidence.ts -> reason codes; src/lib/friction-radar/types.ts -> FrictionSignalGap",
    authority: "product_decision",
    en: {
      title: "What do UNKNOWN and INSUFFICIENT_EVIDENCE mean, and how is absence of data different from absence of friction?",
      body:
        "Absence of evidence is never converted into a fact. Five situations look similar on screen and mean completely different things. ABSENCE OF EVENTS means the ledger has no record — the work may still have happened. ABSENCE OF ACTIVITY means qualified evidence exists and shows nothing moved; only this one supports saying work stalled. INSUFFICIENT EVIDENCE means the input existed but did not qualify, with an explicit reason code such as capture_time_not_proven_as_business_time, planned_start_unavailable or no_current_operational_work_dates. TEMPORAL CONFLICT means timestamps contradict each other, so no duration can be trusted. LATE OR IMPORTED CAPTURE means the record was written well after the fact, or arrived through import, so recorded_at must not be read as when the work happened — a late event needs corroborating business time before it counts. UNKNOWN and INSUFFICIENT_EVIDENCE are reported as evidence GAPS, excluded from ranking on purpose, and they never mean zero friction. Always say which of the five you are looking at, and never upgrade a gap into a finding.\n" +
        "Source: src/lib/friction-radar/task-evidence.ts (qualification reason codes); src/lib/friction-radar/types.ts (FrictionSignalGap).\n" +
        "Verify: Frictions -> the 'Unknown and insufficient evidence' section lists each gap with its engine reason code and the sources it needed.",
    },
    es: {
      title: "¿Qué significan DESCONOCIDO y EVIDENCIA INSUFICIENTE, y en qué se diferencia la falta de datos de la falta de fricción?",
      body:
        "La ausencia de evidencia nunca se convierte en un hecho. Cinco situaciones se parecen en pantalla y significan cosas completamente distintas. AUSENCIA DE EVENTOS significa que el registro no tiene constancia — el trabajo pudo haber ocurrido igual. AUSENCIA DE ACTIVIDAD significa que existe evidencia calificada y muestra que nada se movió; solo este caso permite decir que el trabajo se detuvo. EVIDENCIA INSUFICIENTE significa que el insumo existía pero no calificó, con un código de motivo explícito como capture_time_not_proven_as_business_time, planned_start_unavailable o no_current_operational_work_dates. CONFLICTO TEMPORAL significa que los tiempos se contradicen, así que ninguna duración es confiable. CAPTURA TARDÍA O POR IMPORTACIÓN significa que el registro se escribió mucho después del hecho, o llegó por importación, así que recorded_at no debe leerse como el momento en que ocurrió el trabajo — un evento tardío necesita tiempo de negocio corroborante antes de contar. DESCONOCIDO y EVIDENCIA INSUFICIENTE se reportan como BRECHAS de evidencia, se excluyen del ranking a propósito, y nunca significan fricción cero. Di siempre cuál de las cinco estás viendo, y nunca conviertas una brecha en un hallazgo.\n" +
        "Fuente: src/lib/friction-radar/task-evidence.ts (códigos de motivo de calificación); src/lib/friction-radar/types.ts (FrictionSignalGap).\n" +
        "Verifica: Fricciones -> la sección «Desconocido y evidencia insuficiente» lista cada brecha con su código de motivo del motor y las fuentes que necesitaba.",
    },
  },
  {
    slug: "pi-friction-radar-categories",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/types.ts -> FRICTION_CATEGORIES; src/lib/friction-radar/operational-signal-adapter.ts",
    authority: "cap",
    en: {
      title: "Which friction categories exist, and what does an empty category mean?",
      body:
        "There are exactly eight categories in v1. PROCESS friction covers how work flows — queue time before work starts, stagnation, backward transitions, rework after completion, interrupted execution. RESOURCE friction covers people and capacity — overload, interruption, unavailability. DEPENDENCY friction covers work blocked by a predecessor and risk propagating along the chain. SCHEDULE friction covers lateness against plan — overdue tasks, milestone lateness, planned finish variance, critical path exposure. COST friction covers effort and money overruns and forecast deviation. RISK friction covers exposure from open registered risks. DECISION friction covers work waiting on a decision or an approval that has not been made. QUALITY friction covers defects and rework detected after testing. An EMPTY category never means that category has no friction. It means no signal in it could be demonstrated with complete evidence in this snapshot — the detector may lack a source, or the source may not be captured for this project. Report an empty category as 'not demonstrable here', never as 'no friction', and point to the evidence gaps.\n" +
        "Source: src/lib/friction-radar/types.ts (FRICTION_CATEGORIES); src/lib/friction-radar/operational-signal-adapter.ts.\n" +
        "Verify: Frictions -> Friction by category shows all eight with their counts; the evidence gaps section explains the empty ones.",
    },
    es: {
      title: "¿Qué categorías de fricción existen y qué significa una categoría vacía?",
      body:
        "En v1 existen exactamente ocho categorías. La fricción de PROCESO cubre cómo fluye el trabajo — tiempo en cola antes de empezar, estancamiento, transiciones hacia atrás, retrabajo tras completar, ejecución interrumpida. La de RECURSOS cubre personas y capacidad — sobrecarga, interrupción, indisponibilidad. La de DEPENDENCIAS cubre trabajo bloqueado por un predecesor y riesgo que se propaga por la cadena. La de CRONOGRAMA cubre el retraso frente al plan — tareas vencidas, hitos tardíos, variación de fin planificado, exposición de la ruta crítica. La de COSTOS cubre desviaciones de esfuerzo y dinero y del pronóstico. La de RIESGOS cubre la exposición por riesgos registrados abiertos. La de DECISIONES cubre trabajo esperando una decisión o una aprobación que no se ha tomado. La de CALIDAD cubre defectos y retrabajo detectados después de probar. Una categoría VACÍA nunca significa que esa categoría no tenga fricción. Significa que ninguna señal suya pudo demostrarse con evidencia completa en este corte — puede faltarle una fuente al detector, o la fuente puede no estar capturada en este proyecto. Reporta una categoría vacía como «no demostrable aquí», nunca como «sin fricción», y señala las brechas de evidencia.\n" +
        "Fuente: src/lib/friction-radar/types.ts (FRICTION_CATEGORIES); src/lib/friction-radar/operational-signal-adapter.ts.\n" +
        "Verifica: Fricciones -> Fricción por categoría muestra las ocho con sus conteos; la sección de brechas de evidencia explica las vacías.",
    },
  },
  {
    slug: "pi-friction-radar-evidence-contract",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/types.ts -> FrictionSignal evidence fields; src/lib/friction-radar/evidence-contract.ts",
    authority: "product_decision",
    en: {
      title: "What evidence does a friction signal carry, and what may never be invented?",
      body:
        "A promoted signal carries a complete, traceable evidence contract, and when describing a real signal these fields must be preserved as given: signal_id, project_id, task_id, milestone_id, category, signal_type, observed_value, expected_or_baseline, severity, confidence, evidence_event_ids, evidence_timestamp_start, evidence_timestamp_end, evidence_description and source_engine. Signals whose contract is incomplete are REJECTED by the engine and never shown — the rejected count is disclosed instead. The observed value is what the events actually show; the expected or baseline is what the plan or commitment said, and when there is no baseline the comparison is reported as not calculated rather than assumed. Never invent or embellish events, timestamps, owners, expected values, approvals, decisions, risks, costs, capacity or dependencies, and never attribute a signal to a named person. Never present the evidence description as a cause: it is what was observed. If a field is missing, say it is missing.\n" +
        "Source: src/lib/friction-radar/types.ts (FrictionSignal); src/lib/friction-radar/evidence-contract.ts (incomplete contracts are rejected).\n" +
        "Verify: Frictions -> View evidence shows the signal id, source engine, referenced event ids, the qualified time range and observed versus expected side by side.",
    },
    es: {
      title: "¿Qué evidencia lleva una señal de fricción y qué nunca puede inventarse?",
      body:
        "Una señal promovida lleva un contrato de evidencia completo y trazable, y al describir una señal real deben conservarse tal cual estos campos: signal_id, project_id, task_id, milestone_id, category, signal_type, observed_value, expected_or_baseline, severity, confidence, evidence_event_ids, evidence_timestamp_start, evidence_timestamp_end, evidence_description y source_engine. Las señales cuyo contrato está incompleto son RECHAZADAS por el motor y nunca se muestran — en su lugar se revela el conteo de rechazadas. El valor observado es lo que los eventos realmente muestran; el esperado o línea base es lo que decía el plan o compromiso, y cuando no hay línea base la comparación se reporta como no calculada, nunca se asume. Nunca inventes ni adornes eventos, fechas, responsables, valores esperados, aprobaciones, decisiones, riesgos, costos, capacidad ni dependencias, y nunca atribuyas una señal a una persona con nombre. Nunca presentes la descripción de la evidencia como una causa: es lo que se observó. Si falta un campo, di que falta.\n" +
        "Fuente: src/lib/friction-radar/types.ts (FrictionSignal); src/lib/friction-radar/evidence-contract.ts (los contratos incompletos se rechazan).\n" +
        "Verifica: Fricciones -> Ver evidencia muestra el id de la señal, el motor de origen, los ids de evento referenciados, el rango temporal calificado y observado frente a esperado lado a lado.",
    },
  },
  {
    slug: "pi-friction-radar-reading-the-screen",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/components/friction-radar/friction-radar-client.tsx; src/lib/friction-radar/ui-model.ts",
    authority: "module_strategy",
    en: {
      title: "How do I read the Friction Radar screen, use its filters and open a signal's evidence?",
      body:
        "The Spanish entry point is called Fricciones; the screen itself is the Friction Radar (Radar de Fricción) at /projects/{projectId}/friction-radar, also reachable from the Execution Map after KPIs. The default list is the deterministic Top 20 by independent score — switch Scope to All signals to see everything, and note that filtering never changes a score, a promotion or any evidence. Filters cover free text (task, signal type or evidence id), category, severity, confidence, milestone, task, scope and sort (highest score, newest or oldest evidence). Click View evidence on any signal to open the evidence contract panel: it shows the affected entity, observed versus expected side by side, the traceability block (signal id, source engine, source references) and the EVENT TIMELINE — the referenced canonical events in project sequence order with their type and timestamps. When no referenced canonical event is available the panel says so and still lists the source rows and qualified time range. From the panel you can open the affected entity on its own screen, and open the case in the Living Graph when the signal is backed by canonical events and you want the full audited chronology around it.\n" +
        "Source: src/components/friction-radar/friction-radar-client.tsx; src/lib/friction-radar/ui-model.ts (filtering is a pure projection).\n" +
        "Verify: Frictions -> set Scope to All signals, open any row's View evidence and read the Event timeline block.",
    },
    es: {
      title: "¿Cómo leo la pantalla del Radar de Fricción, uso sus filtros y abro la evidencia de una señal?",
      body:
        "El punto de entrada en español se llama Fricciones; la pantalla es el Radar de Fricción, en /projects/{projectId}/friction-radar, y también se llega desde el Mapa de Ejecución después de KPIs. La lista por defecto es el Top 20 determinista por puntuación independiente — cambia Alcance a Todas las señales para verlas todas, y ten presente que filtrar nunca cambia una puntuación, una promoción ni la evidencia. Los filtros son texto libre (tarea, tipo de señal o id de evidencia), categoría, severidad, confianza, hito, tarea, alcance y orden (mayor puntuación, evidencia más reciente o más antigua). Pulsa Ver evidencia en cualquier señal para abrir el panel del contrato de evidencia: muestra la entidad afectada, observado frente a esperado lado a lado, el bloque de trazabilidad (id de señal, motor de origen, referencias fuente) y la LÍNEA DE TIEMPO DE EVENTOS — los eventos canónicos referenciados en orden de secuencia del proyecto con su tipo y sus tiempos. Cuando no hay evento canónico referenciado disponible, el panel lo dice y de todos modos lista las filas fuente y el rango temporal calificado. Desde el panel puedes abrir la entidad afectada en su propia pantalla, y abrir el caso en el Living Graph cuando la señal está respaldada por eventos canónicos y quieres la cronología auditada completa a su alrededor.\n" +
        "Fuente: src/components/friction-radar/friction-radar-client.tsx; src/lib/friction-radar/ui-model.ts (el filtrado es una proyección pura).\n" +
        "Verifica: Fricciones -> pon Alcance en Todas las señales, abre Ver evidencia de cualquier fila y lee el bloque Línea de tiempo de eventos.",
    },
  },
  {
    slug: "pi-friction-radar-queue-and-rework",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/task-signal-adapter.ts; src/lib/friction-radar/task-evidence.ts -> queue and rework assessment",
    authority: "cap",
    en: {
      title: "How should queue time, stagnation and rework signals be interpreted?",
      body:
        "Read them against the plan and against the quality of the timestamps, never as raw elapsed time. QUEUE FRICTION compares the observed start with the PLANNED start; when the planned start is unavailable the engine returns unknown with the reason planned_start_unavailable, and a long gap alone proves nothing — a task planned to start later is not in a queue. STAGNATION applies only to tasks in an eligible state and needs a qualified last meaningful activity; if that is unavailable, or the analysis time precedes the activity, the result is unknown, not a stalled task. REWORK is a concrete recorded sequence: completed_then_reopened requires an explicit TaskCompleted followed by TaskReopened, and tested_to_rework requires a return after testing. Repeated completion and backward transition are separate patterns and should not be described as 'rework' unless that is the signal type given. Before calling any of these severe, check the qualified time range and the confidence: a duration built on late-recorded or import-derived timestamps is a candidate, not a finding. Business context that explains a reopen — for example a documented absence — is context recorded elsewhere in the product; report only what the signal actually carries.\n" +
        "Source: src/lib/friction-radar/task-signal-adapter.ts; src/lib/friction-radar/task-evidence.ts.\n" +
        "Verify: Frictions -> filter Category to Process, open a queue_friction or completed_then_reopened signal and compare its observed value with the expected/baseline field.",
    },
    es: {
      title: "¿Cómo deben interpretarse las señales de tiempo en cola, estancamiento y retrabajo?",
      body:
        "Léelas contra el plan y contra la calidad de los tiempos, nunca como tiempo transcurrido en bruto. La FRICCIÓN DE COLA compara el inicio observado con el inicio PLANIFICADO; cuando el inicio planificado no está disponible el motor devuelve desconocido con el motivo planned_start_unavailable, y un hueco largo por sí solo no demuestra nada — una tarea planificada para empezar más tarde no está en cola. El ESTANCAMIENTO solo aplica a tareas en un estado elegible y necesita una última actividad significativa calificada; si no está disponible, o si el momento de análisis es anterior a la actividad, el resultado es desconocido, no una tarea detenida. El RETRABAJO es una secuencia concreta registrada: completed_then_reopened exige un TaskCompleted explícito seguido de TaskReopened, y tested_to_rework exige un retorno después de probar. La finalización repetida y la transición hacia atrás son patrones distintos y no deben describirse como «retrabajo» salvo que ese sea el tipo de señal entregado. Antes de calificar cualquiera de estas como severa, revisa el rango temporal calificado y la confianza: una duración construida sobre tiempos registrados tarde o derivados de importación es una candidata, no un hallazgo. El contexto de negocio que explica una reapertura — por ejemplo una ausencia documentada — es contexto registrado en otra parte del producto; reporta solo lo que la señal realmente lleva.\n" +
        "Fuente: src/lib/friction-radar/task-signal-adapter.ts; src/lib/friction-radar/task-evidence.ts.\n" +
        "Verifica: Fricciones -> filtra Categoría a Proceso, abre una señal queue_friction o completed_then_reopened y compara su valor observado con el campo esperado/línea base.",
    },
  },
  {
    slug: "pi-friction-radar-availability-and-limits",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/friction-radar/flag.ts; src/lib/friction-radar/load-task-production.ts",
    authority: "product_decision",
    en: {
      title: "Who can see the Friction Radar, and what is Isabella allowed to do with it?",
      body:
        "Friction Radar v1 is a controlled pilot. A server-side flag must be on AND the project must be listed explicitly, so it is available on the pilot project only; every other project behaves as if the screen does not exist. Reads go through the authenticated, RLS-scoped client with the organization and project enforced on every query — there is no service-role bypass, and a project outside your organization is indistinguishable from one that does not exist, which is deliberate and must not be worked around or hinted at. Isabella reads this data through a read-only tool that reuses the same canonical read model as the screen: she never recomputes a signal, never re-scores one, never runs a second engine and never writes anything. She can list signals, explain a category or a signal type, walk through an evidence contract, explain what a confidence level or an evidence gap means, and link to the Frictions screen for the current locale and project. She cannot enable the feature, change a score, promote a rejected signal, or make friction data available for a project that is not in the pilot.\n" +
        "Source: src/lib/friction-radar/flag.ts; src/lib/friction-radar/load-task-production.ts (authenticated client, organization-scoped, SELECT only).\n" +
        "Verify: on a non-pilot project the Frictions entry point is absent and the route returns not found; on the pilot project ask Isabella for the frictions and compare her list with the screen.",
    },
    es: {
      title: "¿Quién puede ver el Radar de Fricción y qué le está permitido hacer a Isabella con él?",
      body:
        "El Radar de Fricción v1 es un piloto controlado. Una bandera del servidor debe estar activa Y el proyecto debe estar listado explícitamente, así que está disponible solo en el proyecto piloto; cualquier otro proyecto se comporta como si la pantalla no existiera. Las lecturas pasan por el cliente autenticado y limitado por RLS, con la organización y el proyecto forzados en cada consulta — no hay bypass con service role, y un proyecto de otra organización es indistinguible de uno que no existe, lo cual es deliberado y no debe eludirse ni insinuarse. Isabella lee estos datos mediante una herramienta de solo lectura que reutiliza el mismo read model canónico que la pantalla: nunca recalcula una señal, nunca la vuelve a puntuar, nunca ejecuta un segundo motor y nunca escribe nada. Puede listar señales, explicar una categoría o un tipo de señal, recorrer un contrato de evidencia, explicar qué significa un nivel de confianza o una brecha de evidencia, y enlazar a la pantalla Fricciones del idioma y proyecto actuales. No puede habilitar la funcionalidad, cambiar una puntuación, promover una señal rechazada ni poner datos de fricción a disposición de un proyecto que no esté en el piloto.\n" +
        "Fuente: src/lib/friction-radar/flag.ts; src/lib/friction-radar/load-task-production.ts (cliente autenticado, limitado por organización, solo SELECT).\n" +
        "Verifica: en un proyecto fuera del piloto el punto de entrada Fricciones no aparece y la ruta devuelve no encontrado; en el proyecto piloto pídele a Isabella las fricciones y compara su lista con la pantalla.",
    },
  },
];
