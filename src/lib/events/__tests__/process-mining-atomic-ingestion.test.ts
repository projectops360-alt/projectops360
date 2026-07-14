import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { emitProcessMiningEventAtomic, type EmitEventInput } from "@/lib/events/ingestion";

const input: EmitEventInput = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  eventType: "TaskStarted",
  subjectId: "33333333-3333-4333-8333-333333333333",
  caseId: "33333333-3333-4333-8333-333333333333",
  actorType: "system",
  sourceModule: "roadmap",
  sourceEntityType: "roadmap_tasks",
  sourceEntityId: "33333333-3333-4333-8333-333333333333",
  provenance: { capture_method: "direct" },
  objectRefs: [
    { objectType: "task", objectId: "33333333-3333-4333-8333-333333333333", role: "focal" },
    { objectType: "project", objectId: "22222222-2222-4222-8222-222222222222", role: "context" },
  ],
};

beforeEach(() => rpc.mockReset());

describe("P2-T3 atomic process ingestion", () => {
  it("passes the normalized event and refs to the service-role RPC", async () => {
    rpc.mockResolvedValue({ data: { ok: true, event_id: "event-1", deduped: false }, error: null });
    await expect(emitProcessMiningEventAtomic(input)).resolves.toEqual({ ok: true, eventId: "event-1", deduped: false });
    expect(rpc).toHaveBeenCalledWith("append_process_event_atomic", expect.objectContaining({
      p_event: expect.objectContaining({ project_id: input.projectId, case_id: input.caseId, event_type: "TaskStarted" }),
      p_refs: expect.arrayContaining([expect.objectContaining({ object_type: "task", role: "focal" })]),
    }));
  });

  it("fails before the RPC when the event contract is invalid", async () => {
    const result = await emitProcessMiningEventAtomic({ ...input, eventType: "UnknownEvent" });
    expect(result).toMatchObject({ ok: false, error: "validation_failed" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("pins the SQL scope, OCEL and service-role boundary", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260846000000_process_event_capture_atomic.sql"), "utf8");
    expect(sql).toContain("p_event->>'case_id' <> p_event->>'subject_id'");
    expect(sql).toContain("_process_event_refs_ok");
    expect(sql).toContain("invariant_subject_not_in_scope");
    expect(sql).toContain("invariant_dependency_not_in_scope");
    expect(sql).toContain("invariant_payload_mismatch");
    expect(sql).toContain("FROM public.roadmap_tasks task");
    expect(sql).toContain("FROM public.milestones milestone");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.append_process_event_atomic");
    expect(sql).toContain("TO service_role");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.append_process_event_atomic");
  });
});
