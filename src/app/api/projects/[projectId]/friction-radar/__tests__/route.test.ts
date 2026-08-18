import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  enabled: true,
  result: { status: "unauthorized" } as Record<string, unknown>,
  load: vi.fn(),
}));

vi.mock("@/lib/friction-radar/flag", () => ({
  isFrictionRadarEnabledForProject: () => h.enabled,
}));
vi.mock("@/lib/friction-radar/load-production", () => ({
  loadFrictionRadarFromProduction: h.load,
}));

import { GET } from "../route";

const PROJECT = "a40a7436-c63f-4e3b-94cd-041447ee54d4";
const request = () => new NextRequest(`https://example.test/api/projects/${PROJECT}/friction-radar?locale=es`);
const context = () => ({ params: Promise.resolve({ projectId: PROJECT }) });

beforeEach(() => {
  h.enabled = true;
  h.result = { status: "unauthorized" };
  h.load.mockReset();
  h.load.mockImplementation(async () => h.result);
});

describe("GET project Friction Radar", () => {
  it("is dark when the feature flag is off and does no data read", async () => {
    h.enabled = false;
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expect(h.load).not.toHaveBeenCalled();
  });

  it("conceals cross-organization or unauthorized projects as 404", async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns only the protected read model when authorized", async () => {
    h.result = {
      status: "ok",
      projectTitle: "Aurora",
      radar: { topSignalIds: ["s1"] },
      signals: [{ signalId: "s1" }],
      signalGaps: [],
      evidenceEvents: [],
      milestoneCount: 1,
      taskCount: 2,
      eventCount: 3,
      dependencyCount: 4,
      timeEntryCount: 5,
      rejectedEvidenceCount: 0,
    };
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projectId).toBe(PROJECT);
    expect(body.signals).toEqual([{ signalId: "s1" }]);
    expect(body).not.toHaveProperty("taskEvidence");
    expect(h.load).toHaveBeenCalledWith(PROJECT, "es");
  });
});
