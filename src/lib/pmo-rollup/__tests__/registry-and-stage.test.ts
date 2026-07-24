import { afterEach, describe, expect, it } from "vitest";
import { PMO_METRIC_REGISTRY } from "../metric-registry";
import {
  DEFAULT_PMO_STAGE_ONTOLOGY,
  PMO_STAGE_ONTOLOGY_VERSION,
  resolveProjectStage,
} from "../stage-ontology";
import { isPmoPortfolioRollupEngineEnabled } from "../flags";
import { project } from "../__fixtures__/canonical-fixtures";

const FLAG = "PMO_PORTFOLIO_ROLLUP_ENGINE_V1_ENABLED";
const original = process.env[FLAG];

afterEach(() => {
  if (original === undefined) delete process.env[FLAG];
  else process.env[FLAG] = original;
});

describe("PMO roll-up registries", () => {
  it("publishes a versioned metric registry with complete formula metadata", () => {
    expect(PMO_METRIC_REGISTRY.length).toBeGreaterThan(80);
    expect(new Set(PMO_METRIC_REGISTRY.map((metric) => metric.id)).size)
      .toBe(PMO_METRIC_REGISTRY.length);
    expect(PMO_METRIC_REGISTRY.every((metric) =>
      metric.formulaVersion
      && metric.sourceGrain
      && metric.missingDataPolicy
      && metric.aggregationMethod)).toBe(true);
    expect(PMO_METRIC_REGISTRY.find((metric) => metric.id === "portfolio_cpi"))
      .toMatchObject({ aggregationMethod: "ratio-of-sums", numeratorMetricId: "earned_value" });
  });

  it("publishes the five semantic stages plus explicit unmapped", () => {
    expect(PMO_STAGE_ONTOLOGY_VERSION).toBe("1.0.0");
    expect(DEFAULT_PMO_STAGE_ONTOLOGY.map((stage) => stage.id))
      .toEqual(["initiate", "plan", "execute", "control", "close", "unmapped"]);
    expect(DEFAULT_PMO_STAGE_ONTOLOGY.every((stage) =>
      stage.description && stage.whyItMatters && stage.entryCriteria.length > 0 && stage.exitCriteria.length > 0))
      .toBe(true);
  });

  it("uses explicit stage first and preserves unmapped classifications", () => {
    expect(resolveProjectStage(project("p-a", { currentStageId: "control" })).stageId)
      .toBe("control");
    const custom = DEFAULT_PMO_STAGE_ONTOLOGY.map((stage) => ({ ...stage, mappingRules: [] }));
    expect(resolveProjectStage(project("p-a", { currentStageId: null }), custom).stageId)
      .toBe("unmapped");
  });

  it("keeps the independent server flag OFF by default", () => {
    delete process.env[FLAG];
    expect(isPmoPortfolioRollupEngineEnabled()).toBe(false);
    process.env[FLAG] = "TRUE";
    expect(isPmoPortfolioRollupEngineEnabled()).toBe(false);
    process.env[FLAG] = "true";
    expect(isPmoPortfolioRollupEngineEnabled()).toBe(true);
  });
});
