import { assertNoProhibitedAssurance } from "./authorization";
import type { TrustAnswer, TrustClaimKind, TrustReference } from "./engine";

export type TrustLanguage = "en" | "es";

/**
 * Renders a trust answer for a person.
 *
 * The claim kind is printed, not implied. A reader who cannot tell "the system
 * measured this" from "we decided this should be true" has been given the
 * impression of assurance without the substance, which is precisely the outcome
 * the Charter forbids.
 */

const KIND_LABEL: Record<TrustClaimKind, { en: string; es: string }> = {
  verified_current: { en: "Verified now", es: "Verificado ahora" },
  historical: { en: "Historical", es: "Histórico" },
  normative: { en: "Required by", es: "Exigido por" },
  inferred: { en: "Inferred", es: "Inferido" },
  recommendation: { en: "Recommendation", es: "Recomendación" },
};

const UNSUPPORTED_LABEL: Record<string, { en: string; es: string }> = {
  no_control_is_currently_operating: {
    en: "No control is currently operating.",
    es: "Ningún control está operando actualmente.",
  },
  no_control_is_currently_degraded: {
    en: "No control is currently degraded.",
    es: "Ningún control está degradado actualmente.",
  },
  no_open_findings: { en: "There are no open findings.", es: "No hay hallazgos abiertos." },
  no_unresolved_contradiction: {
    en: "There is no unresolved contradiction.",
    es: "No hay ninguna contradicción sin resolver.",
  },
  no_evidence_is_approaching_stale: {
    en: "No evidence is inside its warning window.",
    es: "Ninguna evidencia está en su ventana de aviso.",
  },
  no_change_since_previous_evaluation: {
    en: "Nothing changed since the previous evaluation.",
    es: "No cambió nada desde la evaluación anterior.",
  },
  nothing_to_remediate: { en: "Nothing to remediate.", es: "Nada que remediar." },
  control_not_found: {
    en: "That control is not in the context available to you.",
    es: "Ese control no está en el contexto disponible para ti.",
  },
  control_is_not_operating: {
    en: "That control is not operating, so there is no evidence that made it operate.",
    es: "Ese control no está operando, así que no hay evidencia que lo haya puesto a operar.",
  },
  no_evaluation_recorded: {
    en: "No evaluation has been recorded for that control yet.",
    es: "Todavía no se ha registrado ninguna evaluación para ese control.",
  },
  no_recorded_reason_for_degradation: {
    en: "No reason for the degradation is recorded.",
    es: "No hay ninguna razón registrada para la degradación.",
  },
};

function unsupportedLine(code: string, language: TrustLanguage): string {
  const known = UNSUPPORTED_LABEL[code];
  if (known) return known[language];
  if (code.startsWith("layer_unavailable:")) {
    const layer = code.split(":")[1];
    return language === "es"
      ? `La capa **${layer}** no se pudo leer, así que esta respuesta no la cubre.`
      : `The **${layer}** layer could not be read, so this answer does not cover it.`;
  }
  return language === "es" ? `Sin datos: ${code}` : `Data unavailable: ${code}`;
}

function renderReferences(references: readonly TrustReference[], language: TrustLanguage): string {
  if (references.length === 0) return "";
  const label = language === "es" ? "Referencias" : "References";
  const rendered = references
    .slice(0, 6)
    .map((reference) => `\`${reference.kind}:${reference.id.slice(0, 8)}\` ${reference.label}`)
    .join(" · ");
  return `\n  _${label}: ${rendered}_`;
}

export function formatTrustAnswer(answer: TrustAnswer, language: TrustLanguage): string {
  const lines: string[] = [];

  for (const claim of answer.claims) {
    lines.push(`- **${KIND_LABEL[claim.kind][language]}** — ${claim.statement}${renderReferences(claim.references, language)}`);
  }

  for (const code of answer.unsupported) {
    lines.push(`- ${unsupportedLine(code, language)}`);
  }

  if (answer.proposals.length > 0) {
    lines.push("");
    lines.push(
      language === "es"
        ? "**Propuestas (borrador — requieren aprobación humana):**"
        : "**Proposals (draft — require human approval):**",
    );
    for (const proposal of answer.proposals) {
      lines.push(`- ${proposal.title}: ${proposal.detail}`);
    }
    lines.push("");
    // Stated in the answer itself, not only in metadata. The person reading it is
    // the one who must know the system did not and cannot close anything.
    lines.push(
      language === "es"
        ? "_No puedo resolver hallazgos, aprobar excepciones ni cambiar el estado de un control. Eso lo decide una persona autorizada._"
        : "_I cannot resolve findings, approve exceptions or change a control's state. An authorized person decides that._",
    );
  }

  if (lines.length === 0) {
    return language === "es"
      ? "No hay contexto de Enterprise Trust disponible para responder eso."
      : "There is no Enterprise Trust context available to answer that.";
  }

  const rendered = lines.join("\n");
  // Belt and braces: the engine already checked its claims, this catches anything
  // introduced by formatting.
  assertNoProhibitedAssurance(rendered);
  return rendered;
}
