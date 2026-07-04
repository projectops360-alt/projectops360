// ============================================================================
// ProjectOps360° — Isabella Root Cause · evidence chains (pure)
// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE
//
// Every finding gets an evidence chain: symptom → supporting evidence →
// constraint signal → (inference) → (limitation) → conservative conclusion. The
// conclusion must match the finding's classification. Pure.
// ============================================================================

import type { RootCauseFinding, RootCauseLanguage, EvidenceChain, EvidenceChainStep } from "./types";

const CLASS_WORD = {
  confirmed_cause: { en: "Confirmed cause", es: "Causa confirmada" },
  likely_cause: { en: "Likely cause", es: "Causa probable" },
  possible_cause: { en: "Possible cause", es: "Causa posible" },
  insufficient_evidence: { en: "Insufficient evidence", es: "Evidencia insuficiente" },
} as const;

/** Build one evidence chain per finding (symptom → evidence → conclusion). */
export function buildEvidenceChains(findings: RootCauseFinding[], language: RootCauseLanguage): EvidenceChain[] {
  const es = language === "es";
  return findings.map((f) => {
    const steps: EvidenceChainStep[] = [];
    // 1) Symptom (what is observed).
    steps.push({ kind: "signal", label: f.label, confidence: f.confidence });
    // 2) Supporting evidence (refs), when present.
    if (f.evidenceRefs.length > 0) {
      steps.push({ kind: "evidence", label: es ? `Evidencia: ${f.evidenceRefs.length} referencia(s)` : `Evidence: ${f.evidenceRefs.length} reference(s)`, evidenceRef: f.evidenceRefs[0], confidence: f.confidence });
    }
    // 3) Inference — only for non-confirmed causal steps.
    if (f.classification === "likely_cause" || f.classification === "possible_cause") {
      steps.push({ kind: "inference", label: f.explanation, confidence: f.confidence });
    }
    // 4) Limitation — when evidence is incomplete.
    for (const l of (f.limitations ?? []).slice(0, 2)) steps.push({ kind: "limitation", label: l, confidence: "unavailable" });
    // 5) Conservative conclusion (matches the classification).
    const word = CLASS_WORD[f.classification][es ? "es" : "en"];
    return {
      id: `chain-${f.id}`,
      findingId: f.id,
      steps,
      conclusion: `${word}: ${f.label} (${f.confidence}).`,
    };
  });
}
