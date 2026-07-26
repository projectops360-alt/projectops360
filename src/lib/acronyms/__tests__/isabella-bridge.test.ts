// ============================================================================
// Acronym Intelligence — Isabella handoff (ACRONYM-ISABELLA-*)
// ============================================================================
// The guard that matters here is contradiction. The panel shows the registry's
// definition; Isabella must receive THAT definition, not a paraphrase written
// into a prompt string that will drift the first time the entry is corrected.
// ============================================================================

import { describe, expect, it } from "vitest";
import {
  buildIsabellaPayload,
  serializeIsabellaQuery,
} from "../isabella-bridge";
import { buildPanelModel } from "../presentation";
import { getAcronym, localize } from "../registry";
import { EAC_FORMULA_IDS } from "../registry-forecast";

// ── ACRONYM-ISABELLA-CODE ───────────────────────────────────────────────────

describe("ACRONYM-ISABELLA-CODE: the right term is sent", () => {
  it("sends the code that was asked about", () => {
    const payload = buildIsabellaPayload("EAC", "en", "What does this mean?")!;
    expect(payload.code).toBe("EAC");
    expect(payload.fullName).toBe("Estimate at Completion");
  });

  it("returns null for an unknown code instead of asking about nothing", () => {
    // Asking Isabella about a term the product cannot define invites an
    // invented answer, which is what the whole corpus exists to prevent.
    expect(buildIsabellaPayload("NOT_A_CODE", "en", "?")).toBeNull();
  });

  it("sends the registry version so a stale cached answer is detectable", () => {
    expect(buildIsabellaPayload("EAC", "en", "?")!.registryVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ── ACRONYM-ISABELLA-DEFINITION ─────────────────────────────────────────────

describe("ACRONYM-ISABELLA-DEFINITION: no contradiction with the panel", () => {
  it("sends the registry's definition VERBATIM", () => {
    const entry = getAcronym("SV")!;
    const payload = buildIsabellaPayload("SV", "en", "?")!;
    expect(payload.officialDefinition).toBe(entry.fullDefinition.en);
  });

  it("sends exactly what the panel displays, for every mapped term", () => {
    // The specific regression: panel and Isabella describing the same acronym
    // differently on the same screen.
    for (const code of ["EAC", "SV", "CPI", "VAC", "TF", "EMV", "BAC"]) {
      for (const locale of ["en", "es"]) {
        const panel = buildPanelModel(code, locale)!;
        const payload = buildIsabellaPayload(code, locale, "?")!;
        expect(
          payload.officialDefinition,
          `${code} (${locale}) differs between panel and Isabella`,
        ).toBe(panel.fullDefinition);
        expect(payload.fullName).toBe(panel.fullName);
      }
    }
  });

  it("sends the Spanish definition in a Spanish session", () => {
    const entry = getAcronym("EAC")!;
    const payload = buildIsabellaPayload("EAC", "es", "?")!;
    expect(payload.officialDefinition).toBe(localize(entry.fullDefinition, "es"));
    expect(payload.officialDefinition).not.toBe(entry.fullDefinition.en);
  });
});

// ── ACRONYM-ISABELLA-FORMULA ────────────────────────────────────────────────

describe("ACRONYM-ISABELLA-FORMULA: the formula actually used travels with it", () => {
  it("sends the engine's variant as confirmed, plus the alternatives", () => {
    const payload = buildIsabellaPayload("EAC", "en", "?", {
      formulaId: EAC_FORMULA_IDS.cpiEac,
    })!;
    expect(payload.formula?.replace(/\s+/g, "")).toBe("EAC=AC+(BAC−EV)/CPI");
    expect(payload.formulaConfirmed).toBe(true);
    expect(payload.alternativeFormulas.length).toBeGreaterThan(0);
  });

  it("marks a fallback as unconfirmed so Isabella does not overclaim", () => {
    const payload = buildIsabellaPayload("EAC", "en", "?")!;
    expect(payload.formulaConfirmed).toBe(false);
  });

  it("says in the serialized query which case applies", () => {
    const confirmed = serializeIsabellaQuery(
      buildIsabellaPayload("EAC", "en", "?", { formulaId: EAC_FORMULA_IDS.cpiEac })!,
    );
    expect(confirmed).toContain("Formula used by the engine");

    const fallback = serializeIsabellaQuery(buildIsabellaPayload("EAC", "en", "?")!);
    expect(fallback).toContain("did not report which");
  });
});

// ── ACRONYM-ISABELLA-CONTEXT ────────────────────────────────────────────────

describe("ACRONYM-ISABELLA-CONTEXT: authorized context only, gaps declared", () => {
  it("passes through baseline, simulated, delta and provenance", () => {
    const payload = buildIsabellaPayload("EAC", "en", "Why did this move?", {
      baseline: 1_000_000,
      simulated: 1_250_000,
      delta: 250_000,
      provenance: "OBSERVED",
      confidence: "high",
      computedAt: "2026-07-24T10:00:00Z",
      dataCoverage: { available: ["budget_items"], unavailable: ["risks"] },
    })!;
    expect(payload.context?.baseline).toBe(1_000_000);
    expect(payload.context?.delta).toBe(250_000);
    expect(payload.context?.provenance).toBe("OBSERVED");
    expect(payload.context?.dataCoverage?.unavailable).toEqual(["risks"]);
  });

  it("sends no context block when the caller had none", () => {
    expect(buildIsabellaPayload("EAC", "en", "?")!.context).toBeNull();
  });

  it("renders a missing value as 'Data unavailable', never as 0", () => {
    const query = serializeIsabellaQuery(
      buildIsabellaPayload("EAC", "en", "?", {
        baseline: null,
        simulated: null,
        delta: null,
      })!,
    );
    expect(query).toContain("Baseline: Data unavailable");
    expect(query).not.toContain("Baseline: 0");
  });

  it("instructs the model not to estimate a missing value", () => {
    const query = serializeIsabellaQuery(
      buildIsabellaPayload("EAC", "en", "?", { baseline: 100 })!,
    );
    expect(query).toContain("Data unavailable, say so rather than estimating");
  });

  it("includes the question the user actually asked", () => {
    const query = serializeIsabellaQuery(
      buildIsabellaPayload("EAC", "en", "Why is EAC above BAC?")!,
    );
    expect(query).toContain("Why is EAC above BAC?");
  });

  it("includes the definition in the serialized query", () => {
    const entry = getAcronym("SV")!;
    const query = serializeIsabellaQuery(buildIsabellaPayload("SV", "en", "?")!);
    expect(query).toContain(entry.fullDefinition.en);
    // And therefore carries the units warning with it.
    expect(query.toLowerCase()).toContain("monetary");
  });

  it("carries only the values it was given — it reads no data source itself", () => {
    // The bridge cannot widen visibility: it has no query of its own, so RLS
    // and RBAC stay enforced wherever these numbers were originally read.
    const payload = buildIsabellaPayload("EAC", "en", "?", { baseline: 42 })!;
    expect(payload.context?.baseline).toBe(42);
    expect(payload.context?.simulated).toBeNull();
    expect(payload.context?.inputs).toEqual([]);
  });
});
