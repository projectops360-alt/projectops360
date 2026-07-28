import "server-only";

import { getOrgContext } from "@/lib/auth";
import { isEkiRolloutOrganization } from "@/lib/eki-evidence/rollout";
import { getEnterpriseTrustOverview } from "@/lib/eki-trust-context/server";
import { IsabellaTrustAuthorityError } from "./authorization";
import { answerTrustQuestion, classifyTrustQuestion, type TrustAnswer } from "./engine";
import { formatTrustAnswer, type TrustLanguage } from "./formatter";

/**
 * Answers an Enterprise Trust question from LIVE canonical data.
 *
 * Live traversal for current state; retrieval (the existing RAG path) still owns
 * definitions and normative explanation. That split is the approved hybrid: a
 * definition is stable and can be retrieved, but "is this control operating right
 * now" has exactly one correct source and it is the running system. Answering it
 * from a corpus would produce a confidently stale compliance answer, which is
 * the failure mode the whole programme exists to prevent.
 */

export interface EnterpriseTrustAnswer {
  status: "answered" | "not_a_trust_question" | "unavailable" | "forbidden";
  answer: string;
  structured?: TrustAnswer;
  /** Named so the reader knows which layers the answer does and does not cover. */
  unavailableLayers?: string[];
}

export async function answerEnterpriseTrustQuestion(
  question: string,
  locale: string,
  options: { controlObjectId?: string } = {},
): Promise<EnterpriseTrustAnswer> {
  const kind = classifyTrustQuestion(question);
  if (!kind) return { status: "not_a_trust_question", answer: "" };

  const language: TrustLanguage = locale === "es" ? "es" : "en";

  // Controlled rollout. An organization outside the approved scope is reported
  // as "not a trust question" rather than "no context available", so the caller
  // falls through to retrieval and Isabella behaves exactly as before. Answering
  // "there is no Enterprise Trust context" would be a visible degradation for a
  // tenant that was never meant to see this capability at all.
  try {
    const org = await getOrgContext();
    if (!isEkiRolloutOrganization(org.organizationId)) {
      return { status: "not_a_trust_question", answer: "" };
    }
  } catch {
    return { status: "not_a_trust_question", answer: "" };
  }

  let overview;
  try {
    // The organization and the RLS scope come from the session inside this call.
    // Nothing about the tenant is taken from `question` or from `options`.
    overview = await getEnterpriseTrustOverview();
  } catch {
    // Reported as unavailable, never as "no controls". An unreadable context and
    // an empty one are different answers and only one of them is reassuring.
    return {
      status: "unavailable",
      answer:
        language === "es"
          ? "No pude leer el contexto de Enterprise Trust, así que no puedo responder eso ahora."
          : "I could not read the Enterprise Trust context, so I cannot answer that right now.",
    };
  }

  try {
    const structured = answerTrustQuestion({
      question: kind,
      views: overview.views,
      summary: overview.summary,
      remediation: overview.remediation,
      controlObjectId: options.controlObjectId,
      unavailableLayers: overview.context.unavailableLayers,
    });
    return {
      status: "answered",
      answer: formatTrustAnswer(structured, language),
      structured,
      unavailableLayers: overview.context.unavailableLayers,
    };
  } catch (error) {
    if (error instanceof IsabellaTrustAuthorityError) {
      // The whole answer is refused rather than trimmed. An answer with the
      // offending sentence removed still reads as if the system had said
      // something it is not entitled to say.
      return {
        status: "forbidden",
        answer:
          language === "es"
            ? "No puedo afirmar cumplimiento ni certificación. Puedo describir qué controles están operando y qué evidencia lo sostiene."
            : "I cannot assert compliance or certification. I can describe which controls are operating and what evidence supports that.",
      };
    }
    throw error;
  }
}
