// ============================================================================
// Acronym Intelligence — presentation & integration (ACRONYM-UI-*, ACRONYM-METRIC-*)
// ============================================================================

import { describe, expect, it } from "vitest";
import {
  buildPanelModel,
  buildScenarioModel,
  buildTooltipModel,
  provenanceKey,
  unitLabelKey,
} from "../presentation";
import { getAcronym } from "../registry";
import {
  METRIC_DEFINITIONS,
  definedMetricKeys,
  definitionIdForMetric,
  supportingCodesForMetric,
} from "../metric-definitions";
import { hasAcronym } from "../registry";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";

// ── ACRONYM-UI-TOOLTIP ──────────────────────────────────────────────────────

describe("ACRONYM-UI-TOOLTIP: brief by construction", () => {
  it("returns the code, full name and a short definition", () => {
    const model = buildTooltipModel("EAC", "en")!;
    expect(model.code).toBe("EAC");
    expect(model.fullName).toBe("Estimate at Completion");
    expect(model.shortDefinition.length).toBeGreaterThan(0);
    expect(model.hasDetail).toBe(true);
  });

  it("keeps every short definition genuinely short (1–2 lines)", () => {
    // ~200 chars is about two lines in the 256px tooltip. Longer means the
    // tooltip has quietly become the panel.
    for (const entry of [...new Set(definedMetricKeys().map(definitionIdForMetric))]) {
      if (!entry) continue;
      for (const locale of ["en", "es"]) {
        const model = buildTooltipModel(entry, locale)!;
        expect(
          model.shortDefinition.length,
          `${entry} (${locale}) short definition is too long`,
        ).toBeLessThanOrEqual(200);
      }
    }
  });

  it("localizes into Spanish", () => {
    expect(buildTooltipModel("EAC", "es")!.fullName).toBe("Estimación a la Conclusión");
  });

  it("returns null for an unknown code so the caller can render plain text", () => {
    expect(buildTooltipModel("NOT_A_CODE", "en")).toBeNull();
  });
});

// ── ACRONYM-UI-PANEL ────────────────────────────────────────────────────────

describe("ACRONYM-UI-PANEL: the full definition assembles", () => {
  it("carries definition, formula, caveats and provenance of the formula choice", () => {
    const model = buildPanelModel("EAC", "en", { formulaId: "eac_cpi" })!;
    expect(model.fullDefinition.length).toBeGreaterThan(100);
    expect(model.formula.used?.expression).toContain("EAC");
    expect(model.formula.isConfirmed).toBe(true);
    expect(model.formula.alternatives.length).toBeGreaterThan(0);
    expect(model.caveats.length).toBeGreaterThan(0);
    expect(model.variables.length).toBeGreaterThan(0);
    expect(model.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has no scenario section when no context was supplied", () => {
    expect(buildPanelModel("EAC", "en")!.scenario).toBeNull();
    expect(buildPanelModel("EAC", "en", null)!.scenario).toBeNull();
  });

  it("returns null for an unknown code", () => {
    expect(buildPanelModel("NOT_A_CODE", "en")).toBeNull();
  });

  it("resolves related terms to real entries", () => {
    for (const related of buildPanelModel("EAC", "en")!.related) {
      expect(hasAcronym(related.code)).toBe(true);
    }
  });
});

// ── ACRONYM-UI-CONTEXT ──────────────────────────────────────────────────────

describe("ACRONYM-UI-CONTEXT: dynamic scenario values", () => {
  const entry = getAcronym("EAC")!;

  it("formats baseline, simulated and delta in the metric's own unit", () => {
    const model = buildScenarioModel(
      entry,
      { baseline: 1_000_000, simulated: 1_250_000, delta: 250_000, unit: "currency" },
      "en",
    )!;
    expect(model.baseline.display).toBe("$1,000,000");
    expect(model.simulated.display).toBe("$1,250,000");
    // A delta is signed so the direction is readable without a mental subtraction.
    expect(model.delta.display).toBe("+$250,000");
    expect(model.hasAnyValue).toBe(true);
  });

  it("lets the context's unit override the entry's generic one", () => {
    // Risk exposure is currency OR days depending on which metric it came from.
    const re = getAcronym("RE")!;
    const days = buildScenarioModel(re, { baseline: 12, unit: "days" }, "en")!;
    expect(days.baseline.display).toBe("12");
  });

  it("carries provenance, engine, coverage, confidence and timestamp", () => {
    const model = buildScenarioModel(
      entry,
      {
        baseline: 100,
        provenance: "DERIVED_PROXY",
        engine: "evm",
        confidence: "medium",
        computedAt: "2026-07-24T10:00:00Z",
        dataCoverage: { available: ["budget_items"], unavailable: ["risks"] },
      },
      "en",
    )!;
    expect(model.provenanceKey).toBe("provenanceDerivedProxy");
    expect(model.engine).toBe("evm");
    expect(model.confidence).toBe("medium");
    expect(model.computedAt).toBe("2026-07-24T10:00:00Z");
    expect(model.dataCoverage?.unavailable).toEqual(["risks"]);
  });

  it("carries inputs with their own provenance", () => {
    const model = buildScenarioModel(
      entry,
      {
        unit: "currency",
        inputs: [
          { label: "BAC", value: 1_000_000, provenance: "OBSERVED" },
          { label: "ETC", value: null, provenance: "UNAVAILABLE" },
        ],
      },
      "en",
    )!;
    expect(model.inputs[0].value.display).toBe("$1,000,000");
    expect(model.inputs[0].provenanceKey).toBe("provenanceObserved");
    // A missing input stays missing rather than becoming zero.
    expect(model.inputs[1].value.display).toBeNull();
    expect(model.inputs[1].value.available).toBe(false);
  });
});

// ── ACRONYM-UI-UNAVAILABLE ──────────────────────────────────────────────────

describe("ACRONYM-UI-UNAVAILABLE: a missing value never becomes zero", () => {
  const entry = getAcronym("EAC")!;

  it("marks null values unavailable rather than formatting them as 0", () => {
    const model = buildScenarioModel(
      entry,
      { baseline: null, simulated: null, delta: null, unit: "currency" },
      "en",
    )!;
    for (const value of [model.baseline, model.simulated, model.delta]) {
      expect(value.display).toBeNull();
      expect(value.available).toBe(false);
      // The specific bug this guards: "$0" is a claim the data does not support.
      expect(value.display).not.toBe("$0");
    }
    expect(model.hasAnyValue).toBe(false);
  });

  it("distinguishes a real zero from an absent value", () => {
    const model = buildScenarioModel(entry, { baseline: 0, unit: "currency" }, "en")!;
    expect(model.baseline.display).toBe("$0");
    expect(model.baseline.available).toBe(true);
  });

  it("still renders the section when only some values are known", () => {
    const model = buildScenarioModel(
      entry,
      { baseline: 500, simulated: null, delta: null, unit: "currency" },
      "en",
    )!;
    expect(model.hasAnyValue).toBe(true);
    expect(model.simulated.display).toBeNull();
  });
});

// ── ACRONYM-METRIC-COVERAGE ─────────────────────────────────────────────────

describe("ACRONYM-METRIC-COVERAGE: every simulation metric has a decision", () => {
  // The keys emitted by src/lib/pmo-simulation/stages/*. A new metric added
  // upstream without a binding here fails this test rather than shipping with
  // no definition.
  const ENGINE_METRIC_KEYS = [
    "budget_contingency",
    "budget_scope_total",
    "critical_tasks",
    "open_risks",
    "portfolio_bac",
    "portfolio_cpi",
    "portfolio_eac",
    "portfolio_finish_days",
    "portfolio_vac",
    "resource_effective_hours",
    "resource_linked_tasks",
    "resource_overallocated_hours",
    "resource_status_changed",
    "resource_utilization",
    "risk_exposure_cost",
    "risk_exposure_days",
    "tasks_directly_changed",
    "tasks_moved",
  ];

  it("binds every engine metric key", () => {
    const missing = ENGINE_METRIC_KEYS.filter((key) => !(key in METRIC_DEFINITIONS));
    expect(missing).toEqual([]);
  });

  it("does not bind keys the engine never emits", () => {
    const extra = definedMetricKeys().filter((key) => !ENGINE_METRIC_KEYS.includes(key));
    expect(extra).toEqual([]);
  });

  it("points every non-null definitionId at a real entry", () => {
    for (const key of definedMetricKeys()) {
      const code = definitionIdForMetric(key);
      if (code === null) continue;
      expect(hasAcronym(code), `${key} → ${code} does not exist`).toBe(true);
    }
  });

  it("points every supporting code at a real entry", () => {
    for (const key of definedMetricKeys()) {
      for (const code of supportingCodesForMetric(key)) {
        expect(hasAcronym(code), `${key} supporting ${code} does not exist`).toBe(true);
      }
    }
  });

  it("maps the headline EVM metrics to their own terms", () => {
    expect(definitionIdForMetric("portfolio_eac")).toBe("EAC");
    expect(definitionIdForMetric("portfolio_bac")).toBe("BAC");
    expect(definitionIdForMetric("portfolio_vac")).toBe("VAC");
    expect(definitionIdForMetric("portfolio_cpi")).toBe("CPI");
  });

  it("maps the two risk exposure metrics to unit-appropriate terms", () => {
    // The monetary one gets EMV (currency by definition); the days one gets the
    // unit-agnostic parent RE. Binding both to EMV would assert days are money.
    expect(definitionIdForMetric("risk_exposure_cost")).toBe("EMV");
    expect(definitionIdForMetric("risk_exposure_days")).toBe("RE");
    expect(getAcronym("EMV")!.unit).toBe("currency");
  });

  it("returns null for an unknown metric key without throwing", () => {
    expect(definitionIdForMetric("not_a_metric")).toBeNull();
    expect(supportingCodesForMetric("not_a_metric")).toEqual([]);
  });
});

// ── ACRONYM-UI-I18N ─────────────────────────────────────────────────────────

describe("ACRONYM-UI-I18N: every key the UI asks for exists in both locales", () => {
  // Other namespaces nest objects, so the dictionary as a whole is not a
  // Record<string, Record<string, string>>. The `acronyms` namespace IS flat,
  // which is what the "no dots in keys" rule below asserts.
  const en = enMessages.acronyms as unknown as Record<string, string>;
  const es = esMessages.acronyms as unknown as Record<string, string>;

  it("has the acronyms namespace in both dictionaries", () => {
    expect(en).toBeDefined();
    expect(es).toBeDefined();
  });

  it("keeps EN and ES at exact key parity (UX-012)", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it("uses no dots in any key (I18N-KEY-FORMAT)", () => {
    for (const key of Object.keys(en)) {
      expect(key, `${key} contains a dot`).not.toContain(".");
    }
  });

  it("has no empty translations", () => {
    for (const [key, value] of Object.entries(es)) {
      expect(value.trim().length, `es.acronyms.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("defines every unit label the presentation layer can request", () => {
    for (const unit of ["currency", "days", "hours", "count", "percent", "ratio"] as const) {
      expect(en[unitLabelKey(unit)]).toBeDefined();
      expect(es[unitLabelKey(unit)]).toBeDefined();
    }
  });

  it("defines every provenance label, including the unknown fallback", () => {
    for (const provenance of ["OBSERVED", "ASSUMED", "DERIVED_PROXY", "UNAVAILABLE", "???"]) {
      expect(en[provenanceKey(provenance)]).toBeDefined();
      expect(es[provenanceKey(provenance)]).toBeDefined();
    }
  });

  it("defines a label for every category in the corpus", () => {
    for (const category of ["evm", "budget", "schedule", "risk", "resource", "simulation", "portfolio"]) {
      expect(en[`category_${category}`]).toBeDefined();
      expect(es[`category_${category}`]).toBeDefined();
    }
  });
});
