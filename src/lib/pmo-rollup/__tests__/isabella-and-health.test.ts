import { describe, expect, it } from "vitest";
import {
  answerIsabellaPmoAggregateQuestion,
  buildIsabellaPmoAggregateContext,
} from "../isabella-context";
import { buildIsabellaPmoAggregateFeedbackRecord } from "../isabella-feedback";
import { getPmoAggregateSnapshot } from "../engine";
import {
  BASE_REQUEST,
  financialSeparationFixture,
  processFixture,
  scheduleFixture,
  sharedRiskFixture,
} from "../__fixtures__/canonical-fixtures";

describe("Isabella PMO aggregate context and health", () => {
  it("answers accumulated delay from structured metrics with evidence", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, scheduleFixture());
    const context = buildIsabellaPmoAggregateContext(snapshot, 4);
    const answer = answerIsabellaPmoAggregateQuestion(
      "¿Cuántos días acumulados de retraso tenemos?",
      context,
      "es",
    );
    expect(answer.metricIds).toEqual(["accumulated_delay_days"]);
    expect(answer.text).toContain("30");
    expect(answer.text).toContain("separados");
    expect(answer.evidence[0]).toMatchObject({
      metricId: "accumulated_delay_days",
      value: 30,
      asOf: BASE_REQUEST.asOf,
    });
  });

  it("distinguishes actual delay, future risk exposure, and process waiting", () => {
    const input = processFixture();
    input.projects = scheduleFixture().projects.filter((project) => project.projectId === "p-a");
    input.riskFacts = sharedRiskFixture().riskFacts?.map((risk) => ({
      ...risk,
      affectedProjectIds: ["p-a"],
    }));
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, input);
    const context = buildIsabellaPmoAggregateContext(snapshot, 1);
    const actual = answerIsabellaPmoAggregateQuestion("días acumulados", context);
    const risk = answerIsabellaPmoAggregateQuestion("exposición por riesgos en días", context);
    const waiting = answerIsabellaPmoAggregateQuestion("espera de proceso", context);
    expect(actual.metricIds).toEqual(["accumulated_delay_days"]);
    expect(risk.metricIds).toEqual(["expected_risk_delay_days"]);
    expect(waiting.metricIds).toEqual(["average_waiting_time_days"]);
  });

  it("never falls back to 'I may not have context' for a valid snapshot", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, scheduleFixture());
    const context = buildIsabellaPmoAggregateContext(snapshot, 4);
    const answer = answerIsabellaPmoAggregateQuestion("pregunta no registrada", context);
    expect(answer.text).toContain(snapshot.snapshotId);
    expect(answer.text).not.toMatch(/puede que no tenga el contexto/i);
  });

  it("builds governed tenant-bound feedback without changing the snapshot", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, scheduleFixture());
    const context = buildIsabellaPmoAggregateContext(snapshot, 4);
    const answer = answerIsabellaPmoAggregateQuestion(
      "¿Cuántos días acumulados de retraso tenemos?",
      context,
    );
    const before = JSON.stringify(snapshot);
    const feedback = buildIsabellaPmoAggregateFeedbackRecord({
      context,
      answer,
      question: "¿Cuántos días acumulados de retraso tenemos?",
      decision: "accepted",
      recordedAt: BASE_REQUEST.asOf,
      knowledgeVersion: "pmo-rollup-knowledge-1.0.0",
      outcome: "Validated by PMO.",
    });
    expect(feedback).toMatchObject({
      organizationId: BASE_REQUEST.organizationId,
      snapshotId: snapshot.snapshotId,
      metricIds: ["accumulated_delay_days"],
      decision: "accepted",
      knowledgeVersion: "pmo-rollup-knowledge-1.0.0",
    });
    expect(feedback.evidence[0]?.value).toBe(30);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("rejects feedback evidence outside the authorized snapshot", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, scheduleFixture());
    const context = buildIsabellaPmoAggregateContext(snapshot, 4);
    expect(() => buildIsabellaPmoAggregateFeedbackRecord({
      context,
      answer: {
        snapshotId: snapshot.snapshotId,
        text: "invalid",
        metricIds: ["foreign_metric"],
        confidenceScore: 1,
        evidence: [],
      },
      question: "invalid",
      decision: "rejected",
      recordedAt: BASE_REQUEST.asOf,
      knowledgeVersion: "pmo-rollup-knowledge-1.0.0",
    })).toThrow("outside the authorized snapshot");
  });

  it("recalculates health from atomic aggregates and exposes configuration", () => {
    const input = financialSeparationFixture();
    input.riskFacts = sharedRiskFixture().riskFacts?.map((risk) => ({
      ...risk,
      affectedProjectIds: ["p-a"],
    }));
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, input);
    expect(snapshot.health.score).not.toBeNull();
    expect(snapshot.health.configVersion).toBe("1.0.0");
    expect(snapshot.health.formula).toContain("atomic subscore");
    expect(snapshot.health.subscores.financial).not.toBeNull();
    expect(snapshot.metrics.health_score.value).toBe(snapshot.health.score);
  });

  it("changes health weights through configuration rather than component code", () => {
    const input = financialSeparationFixture();
    input.healthConfiguration = {
      version: "custom-1",
      weights: {
        schedule: 0,
        financial: 1,
        risk: 0,
        delivery: 0,
        resource: 0,
        dataQuality: 0,
      },
      thresholds: {},
    };
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, input);
    expect(snapshot.health.configVersion).toBe("custom-1");
    expect(snapshot.health.score).toBe(snapshot.health.subscores.financial);
  });
});
