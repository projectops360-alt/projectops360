// ============================================================================
// Import Intelligence — project type detection counts words, not substrings
// Guard: IMPORT-PROJECT-TYPE-WORD-BOUNDARY
// ============================================================================
// `detectProjectType` used `blob.split(keyword).length - 1`, a raw substring
// count. Two of the keywords are two letters — "ai" and its Spanish form "ia" —
// and "ia" is a suffix of ordinary Spanish nouns: ingeniería, licencia,
// garantía, transferencia, provincia. A Spanish construction or infrastructure
// plan therefore accumulated `ai_native_execution` hits from words that have
// nothing to do with AI, cleared the score-3 threshold, and was imported as an
// AI-native project — which in turn decides which modules the project gets.
//
// The bug was found by running a real infrastructure workbook through the
// extractor, not by reading the code: the classification simply came back wrong.
// ============================================================================

import { describe, expect, it } from "vitest";
import { detectProjectType } from "../extract";

describe("project type detection (IMPORT-PROJECT-TYPE-WORD-BOUNDARY)", () => {
  it("Spanish words ending in -ia are not AI evidence", () => {
    // Every "ia" here is a suffix. None of this is an AI project.
    const text = [
      "Ingeniería de detalle y permisos",
      "Tramitación de licencia ambiental",
      "Garantía de cumplimiento y transferencia de activos",
      "Vigilancia de obra y residencia técnica",
    ].join(" ");
    expect(detectProjectType(text).type).not.toBe("ai_native_execution");
  });

  it("an infrastructure plan is classified as infrastructure", () => {
    const text = [
      "Ampliación de subestación: obra civil, carretera de acceso y puente sobre el canal.",
      "Infraestructura eléctrica. Vialidad interna y pipeline de servicios.",
    ].join(" ");
    expect(detectProjectType(text).type).toBe("infrastructure");
  });

  it("a genuine AI project is still detected", () => {
    // The fix must not simply disable the category.
    const text =
      "Agente LLM con prompt de sistema. Copilot para automatización. IA aplicada al soporte. AI gateway.";
    expect(detectProjectType(text).type).toBe("ai_native_execution");
  });

  it("a keyword inside a longer word does not count", () => {
    // "plan" is not a keyword, but "plant" (industrial) is — and "plant" must
    // not be found inside "planta baja"... it legitimately is "planta".
    // The narrower claim: "ai" inside "aire" is not an AI hit.
    expect(detectProjectType("aire acondicionado aireador airear").type).not.toBe(
      "ai_native_execution",
    );
  });

  it("too little evidence stays general rather than guessing", () => {
    expect(detectProjectType("Reunión de seguimiento semanal").type).toBe("general");
  });
});
