// ============================================================================
// ISABELLA-FRICTION-RADAR-READ — tool registration, validation and boundaries
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";

const h = vi.hoisted(() => ({ getRadar: vi.fn() }));

vi.mock("@/lib/isabella/friction-radar/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/isabella/friction-radar/service")>();
  return { ...actual, getFrictionRadarForIsabella: h.getRadar };
});

import { executeIsabellaTool } from "../runtime";
import { getTool, listToolSpecs } from "../registry";
import { frictionRadarArgsSchema } from "../schemas";
import { executeGetFrictionRadar } from "../friction-executors";

const AURORA = "a40a7436-c63f-4e3b-94cd-041447ee54d4";
const ORG_CTX = { userId: "u1", organizationId: "org1", role: "member" } as OrgContext;
const SCOPE: IsabellaProjectScope = {
  projectId: AURORA,
  organizationId: "org1",
  userId: "u1",
  locale: "en",
};

function view(over: Record<string, unknown> = {}) {
  return {
    project_id: AURORA,
    project_title: "Aurora",
    global_score: null,
    global_score_reason: "no aggregation policy validated",
    version: "friction-radar-v1",
    read_only: true,
    categories: [],
    signals: [{ signal_id: "s1", evidence_status: "confirmed", score: 62 }],
    matched_signal_count: 1,
    promoted_signal_count: 1,
    truncated: false,
    applied_filters: { scope: "top20", limit: 20 },
    evidence_gaps: [],
    rejected_evidence_count: 0,
    limitations: [],
    screen_href: `/projects/${AURORA}/friction-radar`,
    ...over,
  };
}

beforeEach(() => h.getRadar.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe("tool registration", () => {
  it("registers get_friction_radar and offers it to the model", () => {
    expect(getTool("get_friction_radar")).not.toBeNull();
    const spec = listToolSpecs().find((t) => t.name === "get_friction_radar");
    expect(spec).toBeDefined();
    expect(spec!.parameters).toHaveProperty("properties");
  });

  it("describes the semantics the model must not infer on its own", () => {
    const d = getTool("get_friction_radar")!.description;
    expect(d).toMatch(/read-only/i);
    expect(d).toMatch(/no global or per-category friction score/i);
    expect(d).toMatch(/TaskStarted/);
    expect(d).toMatch(/insufficient_evidence/);
  });

  it("offers no argument that could request an aggregate or a global score", () => {
    const keys = Object.keys(frictionRadarArgsSchema.shape);
    expect(keys).not.toContain("aggregate");
    expect(keys).not.toContain("global_score");
    expect(keys).not.toContain("group_by");
  });
});

describe("argument validation", () => {
  it("accepts the supported filters", () => {
    expect(
      frictionRadarArgsSchema.safeParse({ category: "resource", severity: "high", scope: "all", limit: 10 })
        .success,
    ).toBe(true);
  });

  it("rejects an unknown category, an unknown field and an oversized limit", () => {
    expect(frictionRadarArgsSchema.safeParse({ category: "morale" }).success).toBe(false);
    expect(frictionRadarArgsSchema.safeParse({ drop_table: "x" }).success).toBe(false);
    expect(frictionRadarArgsSchema.safeParse({ limit: 5000 }).success).toBe(false);
  });

  it("is rejected by the runtime before the executor runs", async () => {
    const { result, audit } = await executeIsabellaTool(ORG_CTX, SCOPE, "get_friction_radar", {
      category: "morale",
    });
    expect(result.status).toBe("invalid_args");
    expect(audit.status).toBe("invalid_args");
    expect(h.getRadar).not.toHaveBeenCalled();
  });
});

describe("executor result", () => {
  it("passes the whole view through and attaches the no-global-score limitation", async () => {
    h.getRadar.mockResolvedValue({ ok: true, data: view() });
    const res = await executeGetFrictionRadar(ORG_CTX, SCOPE, {});
    expect(res.status).toBe("success");
    expect(res.entity).toBe("friction_signal");
    expect(res.limitations?.[0]).toMatch(/no aggregation policy validated/);
    const payload = JSON.parse(res.message!);
    expect(payload.global_score).toBeNull();
    expect(payload.screen_href).toBe(`/projects/${AURORA}/friction-radar`);
  });

  it("states that zero promoted signals is not zero friction", async () => {
    h.getRadar.mockResolvedValue({
      ok: true,
      data: view({ signals: [], matched_signal_count: 0, promoted_signal_count: 0 }),
    });
    const res = await executeGetFrictionRadar(ORG_CTX, SCOPE, {});
    expect(res.status).toBe("empty");
    expect(res.limitations!.join(" ")).toMatch(/not evidence of zero friction/i);
  });

  it("discloses evidence gaps and rejected contracts as limitations", async () => {
    h.getRadar.mockResolvedValue({
      ok: true,
      data: view({
        evidence_gaps: [{ signal_type: "decision_wait", status: "unknown" }],
        rejected_evidence_count: 3,
      }),
    });
    const res = await executeGetFrictionRadar(ORG_CTX, SCOPE, {});
    const text = res.limitations!.join(" ");
    expect(text).toMatch(/evidence gap/i);
    expect(text).toMatch(/never mean zero friction/i);
    expect(text).toMatch(/3 signal\(s\) were rejected/);
  });

  it("tells the model not to imply signals exist when the pilot is off", async () => {
    h.getRadar.mockResolvedValue({ ok: false, reason: "not_enabled" });
    const res = await executeGetFrictionRadar(ORG_CTX, SCOPE, {});
    expect(res.status).toBe("unauthorized");
    expect(res.message).toMatch(/do not imply signals exist/i);
    expect(res.rowCount).toBe(0);
  });

  it("returns a bare unauthorized for a foreign project, leaking nothing", async () => {
    h.getRadar.mockResolvedValue({ ok: false, reason: "not_authorized" });
    const res = await executeGetFrictionRadar(ORG_CTX, SCOPE, {});
    expect(res.status).toBe("unauthorized");
    expect(JSON.stringify(res)).not.toContain("Aurora");
  });

  it("degrades to unavailable, with no invented signals, when the read path fails", async () => {
    h.getRadar.mockResolvedValue({ ok: false, reason: "unavailable" });
    const { result, audit } = await executeIsabellaTool(ORG_CTX, SCOPE, "get_friction_radar", {});
    expect(result.status).toBe("unavailable");
    expect(result.rows).toBeUndefined();
    expect(result.rowCount).toBe(0);
    expect(audit.status).toBe("unavailable");
  });
});

describe("read-only import boundaries", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  const serviceDir = fileURLToPath(new URL("../../friction-radar/", import.meta.url));
  const read = (p: string) => readFileSync(p, "utf8");
  /**
   * Match CODE, not prose. Both modules document in comments what they must
   * never do ("no service-role bypass"), and a naive scan would flag the very
   * sentence promising the guarantee.
   */
  const code = (p: string) =>
    read(p)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\/\/.*$/gm, "");

  it("performs no mutation and opens no Supabase client of its own", () => {
    for (const file of [`${dir}friction-executors.ts`, `${serviceDir}service.ts`]) {
      const src = code(file);
      expect(src, file).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
      expect(src, file).not.toMatch(/createAdminClient|service[_-]?role|SERVICE_ROLE/i);
      expect(src, file).not.toMatch(/from\(["'][a-z_]+["']\)/);
    }
  });

  it("consumes the canonical read model instead of duplicating the engine", () => {
    const src = read(`${serviceDir}service.ts`);
    expect(src).toContain('from "@/lib/friction-radar/load-production"');
    expect(src).toContain("loadFrictionRadarFromProduction");
    // Reuses the screen's scorer and pure filter projection...
    expect(src).toContain("scoreFrictionSignal");
    expect(src).toContain("filterAndSortFrictionSignals");
    // ...and never re-runs a detector or rebuilds the read model.
    expect(src).not.toMatch(/frictionSignalsFrom[A-Za-z]+\(/);
    expect(src).not.toContain("buildFrictionRadarReadModel");
    expect(src).not.toContain("buildTaskFrictionEvidenceDataset");
  });

  it("checks the pilot flag before reaching the loader", () => {
    const src = read(`${serviceDir}service.ts`);
    expect(src.indexOf("isFrictionRadarEnabledForProject")).toBeLessThan(
      src.indexOf("loadFrictionRadarFromProduction(projectId"),
    );
  });
});
