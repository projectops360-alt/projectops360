import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events/ingestion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/events/ingestion")>();
  return { ...actual, emitProjectEvents: vi.fn() };
});

import { emitProjectEvents, type EmitEventInput } from "@/lib/events/ingestion";
import { captureProcessMiningEvents } from "@/lib/events/process-mining-capture";

const PROJECT = "22222222-2222-2222-2222-222222222222";
const OTHER_PROJECT = "33333333-3333-3333-3333-333333333333";
const mockedEmitProjectEvents = vi.mocked(emitProjectEvents);

function event(projectId = PROJECT, eventType = "TaskCreated"): EmitEventInput {
  return {
    organizationId: "11111111-1111-1111-1111-111111111111",
    projectId,
    eventType,
    subjectId: "44444444-4444-4444-4444-444444444444",
    actorType: "system",
    sourceModule: "test",
    payload: eventType === "TaskCreated" ? { title: "Test" } : {},
  };
}

afterEach(() => {
  delete process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS;
  mockedEmitProjectEvents.mockReset();
});

describe("process-mining capture gateway", () => {
  it("is a no-op while the project flag is off", async () => {
    const result = await captureProcessMiningEvents([event()]);

    expect(result).toEqual({ enabled: false, complete: false, results: [] });
    expect(mockedEmitProjectEvents).not.toHaveBeenCalled();
  });

  it("routes an enabled batch through the single PEG ingestion gateway", async () => {
    process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS = PROJECT;
    mockedEmitProjectEvents.mockResolvedValue([
      { ok: true, eventId: "event-1" },
      { ok: true, eventId: "event-2" },
    ]);
    const events = [event(PROJECT, "TaskCreated"), event(PROJECT, "TaskStarted")];

    const result = await captureProcessMiningEvents(events);

    expect(mockedEmitProjectEvents).toHaveBeenCalledOnce();
    expect(mockedEmitProjectEvents).toHaveBeenCalledWith(events);
    expect(result).toMatchObject({ enabled: true, complete: true });
  });

  it("reports partial gateway failure without throwing into the business write", async () => {
    process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS = PROJECT;
    mockedEmitProjectEvents.mockResolvedValue([{ ok: false, error: "insert_failed" }]);

    await expect(captureProcessMiningEvents([event()])).resolves.toMatchObject({
      enabled: true,
      complete: false,
    });
  });

  it("contains an unexpected gateway exception so legacy fallback remains available", async () => {
    process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS = PROJECT;
    mockedEmitProjectEvents.mockRejectedValue(new Error("network unavailable"));

    await expect(captureProcessMiningEvents([event()])).resolves.toMatchObject({
      enabled: true,
      complete: false,
      results: [{ ok: false, error: "exception" }],
    });
  });

  it("rejects mixed-project batches before ingestion", async () => {
    process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS = "all";

    const result = await captureProcessMiningEvents([event(), event(OTHER_PROJECT)]);

    expect(result).toMatchObject({ enabled: true, complete: false });
    expect(result.results[0]).toMatchObject({ ok: false, error: "mixed_project_batch" });
    expect(mockedEmitProjectEvents).not.toHaveBeenCalled();
  });
});
