// ============================================================================
// ProjectOps360° — Variant Analysis · Isabella formatter (CAP-046 F1)
// ============================================================================
// Pure, deterministic, bilingual compact text for the Isabella tool result.
// Evidence-only: states what the engine computed; when there is no reference
// variant it says so explicitly — it never invents comparisons.
// ============================================================================

import type { VariantAnalysis, VariantAssignment } from "./types";

function spaced(activity: string): string {
  return activity.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function sequenceText(signature: readonly string[], max = 10): string {
  const shown = signature.slice(0, max).map(spaced).join(" → ");
  return signature.length > max ? `${shown} (+${signature.length - max})` : shown;
}

export function formatVariantAnalysisForIsabella(
  analysis: VariantAnalysis,
  focusAssignment: VariantAssignment | null,
  projectTitle: string,
  lang: "en" | "es",
): string {
  const es = lang === "es";
  const lines: string[] = [];

  if (focusAssignment) {
    const variant = analysis.variants.find((v) => v.variantId === focusAssignment.variantId);
    if (variant) {
      lines.push(
        es
          ? `Ruta de ejecución de "${projectTitle}": variante compartida por ${variant.caseCount} proyecto(s) (${variant.frequencyPct}% de ${analysis.analyzedCases} analizados).`
          : `Execution path of "${projectTitle}": variant shared by ${variant.caseCount} project(s) (${variant.frequencyPct}% of ${analysis.analyzedCases} analyzed).`,
      );
      lines.push(
        (es ? "Secuencia: " : "Sequence: ") + sequenceText(variant.signature),
      );
      if (variant.reworkRate > 0) {
        lines.push(
          es
            ? `Retrabajo en la secuencia: ${Math.round(variant.reworkRate * 100)}% de actividades repetidas.`
            : `Rework in the sequence: ${Math.round(variant.reworkRate * 100)}% repeated activities.`,
        );
      }
      if (focusAssignment.fitnessVsReference !== null) {
        lines.push(
          es
            ? `Ajuste frente a la variante más exitosa: ${Math.round(focusAssignment.fitnessVsReference * 100)}%.`
            : `Fit vs the most successful variant: ${Math.round(focusAssignment.fitnessVsReference * 100)}%.`,
        );
        if (focusAssignment.skippedActivities.length > 0) {
          lines.push(
            (es ? "No realizadas vs referencia: " : "Not performed vs reference: ") +
              focusAssignment.skippedActivities.map(spaced).join(", "),
          );
        }
        if (focusAssignment.insertedActivities.length > 0) {
          lines.push(
            (es ? "Adicionales vs referencia: " : "Extra vs reference: ") +
              focusAssignment.insertedActivities.map(spaced).join(", "),
          );
        }
      }
    }
  } else {
    lines.push(
      es
        ? `"${projectTitle}" aún no tiene eventos de negocio: su ruta de ejecución aparecerá a medida que se registre trabajo.`
        : `"${projectTitle}" has no business events yet: its execution path will appear as work is recorded.`,
    );
  }

  if (analysis.referenceVariantId === null) {
    lines.push(
      es
        ? "Aún no hay variante de referencia: ningún proyecto comparado tiene desenlace decidido (completado o cancelado). No se infiere nada."
        : "No reference variant yet: no compared project has a decided outcome (completed or cancelled). Nothing is inferred.",
    );
  }

  const top = analysis.variants.slice(0, 3);
  if (top.length > 0) {
    lines.push(
      es
        ? `Variantes descubiertas: ${analysis.variants.length} entre ${analysis.analyzedCases} proyecto(s) analizados. Principales:`
        : `Discovered variants: ${analysis.variants.length} across ${analysis.analyzedCases} analyzed project(s). Top:`,
    );
    for (const variant of top) {
      const success =
        variant.successRate === null
          ? es
            ? "sin desenlace"
            : "no outcome"
          : `${Math.round(variant.successRate * 100)}% ${es ? "éxito" : "success"}`;
      const reference = variant.isReference ? (es ? " · referencia" : " · reference") : "";
      lines.push(
        `- ${variant.caseCount}× (${variant.frequencyPct}%) · ${success}${reference} · ${sequenceText(variant.signature, 6)}`,
      );
    }
  }

  return lines.join("\n");
}
