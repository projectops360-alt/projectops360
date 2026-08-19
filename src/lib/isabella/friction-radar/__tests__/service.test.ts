// ============================================================================
// ISABELLA-FRICTION-RADAR-READ — service contract
// ============================================================================
// These tests exist because the failure mode of a friction radar is not a
// missing signal, it is a confident sentence built on a missing row. Each case
// below pins one way that could happen.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrictionSignal } from "@/lib/friction-radar/types";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";

const h = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock("@/lib/friction-radar/load-production", () => ({
  loadFrictionRadarFromProduction: h.load,
}));

import { getFrictionRadarForIsabella, NO_GLOBAL_SCORE_REASON } from "../service";

const AURORA = "a40a7436-c63f-4e3b-94cd-041447ee54d4";
const ORG = "11111111-1111-1111-1111-111111111111";

// Real validation contracts from the Aurora pilot.
const REWORK_TASK = "b0ca5ded-efdc-455d-abf7-671eb3fd8670";
const COMPLETED_NO_START_TASK = "93dff1de-c356-403e-9701-a1d184d5105e";
const QUEUE_TASK = "dd29a954-0d12-4ee0-a750-b4a73c0cdb75";

const scope = (over: Partial<IsabellaProjectScope> = {}): IsabellaProjectScope => ({
  projectId: AURORA,
  organizationId: ORG,
  userId: "user-1",
  locale: "en",
  ...over,
});

function signal(over: Partial<FrictionSignal> = {}): FrictionSignal {
  return {
    signalId: "sig-1",
    organizationId: ORG,
    projectId: AURORA,
    source: "process_mining",
    signalType: "queue_friction",
    category: "process",
    taskId: QUEUE_TASK,
    milestoneId: null,
    severity: "medium",
    confidence: "medium",
    score: 45,
    observedValue: 12,
    expectedOrBaseline: 3,
    evidenceStatus: "confirmed",
    evidenceTimestampStart: "2026-08-01T00:00:00Z",
    evidenceTimestampEnd: "2026-08-13T00:00:00Z",
    evidenceDescription: "Observed start 12 days after the planned start.",
    evidenceRefs: [{ kind: "project_event_log", id: "evt-1" }],
    ...over,
  };
}

function loaded(over: Record<string, unknown> = {}) {
  const signals = (over.signals as FrictionSignal[]) ?? [signal()];
  return {
    status: "ok",
    projectTitle: "Aurora",
    milestoneCount: 1,
    eventCount: 10,
    taskCount: 3,
    dependencyCount: 0,
    timeEntryCount: 5,
    signalCount: signals.length,
    signals,
    signalGaps: [],
    milestones: [{ id: "m-1", title: "Discovery" }],
    evidenceEvents: [],
    rejectedEvidenceCount: 0,
    taskEvidence: [
      { taskId: QUEUE_TASK, title: "Site survey" },
      { taskId: REWORK_TASK, title: "Structural review" },
      { taskId: COMPLETED_NO_START_TASK, title: "Permit filing" },
    ],
    sourceAudit: [],
    limitations: [],
    radar: {
      organizationId: ORG,
      projectId: AURORA,
      score: null,
      severity: null,
      trend: "unknown",
      confidence: "medium",
      categories: [],
      clusters: [],
      topSignalIds: signals.map((s) => s.signalId),
      generatedFromSignalCount: signals.length,
      version: "friction-radar-v1",
    },
    ...over,
  };
}

beforeEach(() => {
  h.load.mockReset();
  vi.stubEnv("FRICTION_RADAR_ENABLED", "true");
  vi.stubEnv("FRICTION_RADAR_PROJECT_IDS", AURORA);
  vi.stubEnv("VERCEL_ENV", "production");
});

afterEach(() => vi.unstubAllEnvs());

describe("feature flag and tenancy gating", () => {
  it("reads nothing at all when the project is not in the pilot", async () => {
    const res = await getFrictionRadarForIsabella(scope({ projectId: "00000000-0000-0000-0000-000000000000" }));
    expect(res).toEqual({ ok: false, reason: "not_enabled" });
    // The gate runs BEFORE any query — not merely filtering the result after.
    expect(h.load).not.toHaveBeenCalled();
  });

  it("is off by default even for Aurora when the global switch is off", async () => {
    vi.stubEnv("FRICTION_RADAR_ENABLED", "");
    const res = await getFrictionRadarForIsabella(scope());
    expect(res).toEqual({ ok: false, reason: "not_enabled" });
    expect(h.load).not.toHaveBeenCalled();
  });

  it("does not reveal whether a cross-organization project exists", async () => {
    h.load.mockResolvedValue({ status: "unauthorized" });
    const res = await getFrictionRadarForIsabella(scope());
    expect(res).toEqual({ ok: false, reason: "not_authorized" });
    // No project title, no counts, nothing that could confirm existence.
    expect(JSON.stringify(res)).not.toContain("Aurora");
  });

  it("returns a failure instead of throwing when the read path breaks", async () => {
    h.load.mockRejectedValue(new Error("boom"));
    await expect(getFrictionRadarForIsabella(scope())).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("requires a project in context", async () => {
    const res = await getFrictionRadarForIsabella(scope({ projectId: "" }));
    expect(res).toEqual({ ok: false, reason: "no_project" });
    expect(h.load).not.toHaveBeenCalled();
  });
});

describe("no global or category friction score is ever produced", () => {
  it("returns a null global score with the reason attached", async () => {
    h.load.mockResolvedValue(loaded());
    const res = await getFrictionRadarForIsabella(scope());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.global_score).toBeNull();
    expect(res.data.global_score_reason).toBe(NO_GLOBAL_SCORE_REASON);
    expect(res.data.global_score_reason.toLowerCase()).toContain("independent");
  });

  it("keeps every category score null and reports counts, not totals", async () => {
    h.load.mockResolvedValue(
      loaded({
        signals: [
          signal({ signalId: "a", category: "process", score: 70 }),
          signal({ signalId: "b", category: "process", score: 40 }),
        ],
      }),
    );
    const res = await getFrictionRadarForIsabella(scope());
    if (!res.ok) throw new Error("expected ok");
    const process = res.data.categories.find((c) => c.category === "process")!;
    expect(process.score).toBeNull();
    // The highest INDEPENDENT score, never the sum (110) or the mean (55).
    expect(process.highest_independent_score).toBe(70);
    expect(res.data.categories.every((c) => c.score === null)).toBe(true);
  });

  it("exposes all eight categories even when they carry no signals", async () => {
    h.load.mockResolvedValue(loaded());
    const res = await getFrictionRadarForIsabella(scope());
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.categories.map((c) => c.category)).toEqual([
      "process",
      "resource",
      "dependency",
      "schedule",
      "cost",
      "risk",
      "decision",
      "quality",
    ]);
    // An empty category reports null, not 0 — "no aggregate", not "no friction".
    expect(res.data.categories.find((c) => c.category === "cost")!.highest_independent_score).toBeNull();
  });
});

describe("evidence semantics survive the projection", () => {
  it("preserves the full evidence contract of a signal", async () => {
    h.load.mockResolvedValue(loaded());
    const res = await getFrictionRadarForIsabella(scope());
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.signals[0]).toMatchObject({
      signal_id: "sig-1",
      project_id: AURORA,
      task_id: QUEUE_TASK,
      task_title: "Site survey",
      category: "process",
      signal_type: "queue_friction",
      severity: "medium",
      confidence: "medium",
      evidence_status: "confirmed",
      observed_value: 12,
      expected_or_baseline: 3,
      evidence_event_ids: ["evt-1"],
      evidence_timestamp_start: "2026-08-01T00:00:00Z",
      evidence_timestamp_end: "2026-08-13T00:00:00Z",
      source_engine: "process_mining",
    });
    expect(res.data.signals[0].evidence_description).toBeTruthy();
  });

  it("keeps UNKNOWN and INSUFFICIENT_EVIDENCE visible instead of normalising them", async () => {
    h.load.mockResolvedValue(
      loaded({
        signals: [
          signal({ signalId: "u", evidenceStatus: "unknown", confidence: "unknown" }),
          signal({ signalId: "i", evidenceStatus: "insufficient_evidence" }),
        ],
      }),
    );
    const res = await getFrictionRadarForIsabella(scope());
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.signals.map((s) => s.evidence_status).sort()).toEqual([
      "insufficient_evidence",
      "unknown",
    ]);
    expect(res.data.signals.find((s) => s.signal_id === "u")!.confidence).toBe("unknown");
  });

  it("surfaces detector evidence gaps rather than dropping them", async () => {
    h.load.mockResolvedValue(
      loaded({
        signalGaps: [
          {
            signalType: "decision_wait",
            category: "decision",
            status: "insufficient_evidence",
            reason: "no_qualified_decision_records",
            sourceTables: ["decisions"],
          },
        ],
      }),
    );
    const res = await getFrictionRadarForIsabella(scope());
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.evidence_gaps).toEqual([
      {
        signal_type: "decision_wait",
        category: "decision",
        status: "insufficient_evidence",
        reason: "no_qualified_decision_records",
        source_tables: ["decisions"],
      },
    ]);
  });

  it("reports zero promoted signals without implying zero friction", async () => {
    h.load.mockResolvedValue(loaded({ signals: [], rejectedEvidenceCount: 4 }));
    const res = await getFrictionRadarForIsabella(scope());
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.promoted_signal_count).toBe(0);
    expect(res.data.global_score).toBeNull();
    // Rejected contracts are disclosed, not silently swallowed.
    expect(res.data.rejected_evidence_count).toBe(4);
  });
});

describe("protected false positives", () => {
  it("never turns a completed task with no TaskStarted into a waiting signal", async () => {
    // The engine emits no signal for this task; the service must not invent one.
    h.load.mockResolvedValue(loaded({ signals: [] }));
    const res = await getFrictionRadarForIsabella(scope({ locale: "es" }));
    if (!res.ok) throw new Error("expected ok");
    const serialized = JSON.stringify(res.data);
    expect(serialized).not.toContain(COMPLETED_NO_START_TASK);
    expect(serialized).not.toMatch(/waiting_to_start/i);
    expect(res.data.signals).toHaveLength(0);
  });

  it("reports a rework signal only with the signal type the engine gave it", async () => {
    h.load.mockResolvedValue(
      loaded({
        signals: [
          signal({
            signalId: "rework-1",
            signalType: "completed_then_reopened",
            category: "process",
            taskId: REWORK_TASK,
            observedValue: "done -> blocked",
            expectedOrBaseline: null,
            evidenceDescription: "TaskCompleted followed by TaskReopened.",
          }),
        ],
      }),
    );
    const res = await getFrictionRadarForIsabella(scope());
    if (!res.ok) throw new Error("expected ok");
    const s = res.data.signals[0];
    expect(s.signal_type).toBe("completed_then_reopened");
    expect(s.task_id).toBe(REWORK_TASK);
    // No baseline exists — it stays null rather than being assumed.
    expect(s.expected_or_baseline).toBeNull();
  });
});

describe("filters reuse the screen projection", () => {
  it("applies category, scope and limit and reports truncation honestly", async () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      signal({ signalId: `s${i}`, category: "resource", score: 90 - i }),
    );
    h.load.mockResolvedValue(loaded({ signals: many }));
    const res = await getFrictionRadarForIsabella(scope(), { category: "resource", scope: "all", limit: 2 });
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.signals).toHaveLength(2);
    expect(res.data.matched_signal_count).toBe(5);
    expect(res.data.truncated).toBe(true);
    // Ranked by the canonical scorer, highest first.
    expect(res.data.signals.map((s) => s.signal_id)).toEqual(["s0", "s1"]);
    expect(res.data.applied_filters).toMatchObject({ category: "resource", scope: "all", limit: 2 });
  });

  it("finds a signal by id even when it is outside the Top 20 default", async () => {
    const target = signal({ signalId: "deep", score: 5 });
    h.load.mockResolvedValue(
      loaded({
        signals: [signal({ signalId: "top", score: 99 }), target],
        radar: { ...loaded().radar, topSignalIds: ["top"] },
      }),
    );
    const res = await getFrictionRadarForIsabella(scope(), { signalId: "deep" });
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.signals.map((s) => s.signal_id)).toEqual(["deep"]);
  });

  it("clamps an oversized limit instead of trusting the caller", async () => {
    h.load.mockResolvedValue(loaded());
    const res = await getFrictionRadarForIsabella(scope(), { limit: 5000 });
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.applied_filters.limit).toBe(50);
  });
});

describe("localized navigation", () => {
  it("builds an English href with the project id and no locale prefix", async () => {
    h.load.mockResolvedValue(loaded());
    const res = await getFrictionRadarForIsabella(scope({ locale: "en" }));
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.screen_href).toBe(`/projects/${AURORA}/friction-radar`);
  });

  it("prefixes the Spanish href and passes the locale to the loader", async () => {
    h.load.mockResolvedValue(loaded());
    const res = await getFrictionRadarForIsabella(scope({ locale: "es" }));
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.screen_href).toBe(`/es/projects/${AURORA}/friction-radar`);
    expect(h.load).toHaveBeenCalledWith(AURORA, "es");
  });
});
