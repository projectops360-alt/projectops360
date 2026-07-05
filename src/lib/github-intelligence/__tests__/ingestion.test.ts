import { describe, it, expect, vi } from "vitest";
import { ingestWebhookEvent, type ConnectedRepository, type IngestionStore } from "../ingestion";
import { parseWebhookEnvelope } from "../webhooks";

function makeStore(repo: ConnectedRepository | null, opts: { duplicate?: boolean } = {}) {
  const inserted: Record<string, unknown>[] = [];
  const snapshots: Array<{ table: string; row: Record<string, unknown> }> = [];
  const store: IngestionStore = {
    findRepository: vi.fn(async () => repo),
    deliveryExists: vi.fn(async () => Boolean(opts.duplicate)),
    insertEvent: vi.fn(async (row) => { inserted.push(row); }),
    upsertSnapshot: vi.fn(async (table, row) => { snapshots.push({ table, row }); }),
    markDelivery: vi.fn(async () => {}),
  };
  return { store, inserted, snapshots };
}

const softwareRepo: ConnectedRepository = {
  id: "repo-uuid", organization_id: "org-A", project_id: "proj-A",
  default_branch: "main", project_type: "software_development", project_deleted: false,
};

function pushEnvelope(deliveryId: string | null, repoId = 999) {
  return parseWebhookEnvelope(
    { event: "push", deliveryId },
    { ref: "refs/heads/feature/x", after: "abc", repository: { id: repoId, full_name: "acme/app" }, commits: [{ message: "c" }] },
  );
}

describe("ingestWebhookEvent", () => {
  it("ingests a supported event for a software project (scoped)", async () => {
    const { store, inserted, snapshots } = makeStore(softwareRepo);
    const res = await ingestWebhookEvent(store, pushEnvelope("d1"));
    expect(res.handled).toBe(true);
    // tenant scope injected on the event + snapshot rows
    expect(inserted[0].organization_id).toBe("org-A");
    expect(inserted[0].project_id).toBe("proj-A");
    expect(inserted[0].repository_id).toBe("repo-uuid");
    expect(inserted[0].github_delivery_id).toBe("d1");
    expect(snapshots[0].row.organization_id).toBe("org-A");
    expect(store.markDelivery).toHaveBeenCalledOnce();
  });

  it("is idempotent — a duplicate delivery is ignored", async () => {
    const { store, inserted } = makeStore(softwareRepo, { duplicate: true });
    const res = await ingestWebhookEvent(store, pushEnvelope("d1"));
    expect(res).toEqual({ handled: false, reason: "duplicate" });
    expect(inserted).toHaveLength(0);
    expect(store.insertEvent).not.toHaveBeenCalled();
  });

  it("ignores events for repositories not connected to any project", async () => {
    const { store } = makeStore(null);
    const res = await ingestWebhookEvent(store, pushEnvelope("d1"));
    expect(res).toEqual({ handled: false, reason: "repo_not_connected" });
  });

  it("ignores events mapped to a NON-software project", async () => {
    const nonSoftware = { ...softwareRepo, project_type: "residential_construction" };
    const { store } = makeStore(nonSoftware);
    const res = await ingestWebhookEvent(store, pushEnvelope("d1"));
    expect(res).toEqual({ handled: false, reason: "non_software_project" });
    expect(store.insertEvent).not.toHaveBeenCalled();
  });

  it("ignores events for a deleted project", async () => {
    const deleted = { ...softwareRepo, project_deleted: true };
    const { store } = makeStore(deleted);
    const res = await ingestWebhookEvent(store, pushEnvelope("d1"));
    expect(res).toEqual({ handled: false, reason: "non_software_project" });
  });

  it("rejects unsupported events", async () => {
    const { store } = makeStore(softwareRepo);
    const env = parseWebhookEnvelope({ event: "issues", deliveryId: "d1" }, { repository: { id: 999 } });
    const res = await ingestWebhookEvent(store, env);
    expect(res).toEqual({ handled: false, reason: "unsupported_event" });
  });

  it("rejects events without a delivery id", async () => {
    const { store } = makeStore(softwareRepo);
    const res = await ingestWebhookEvent(store, pushEnvelope(null));
    expect(res).toEqual({ handled: false, reason: "missing_delivery_id" });
  });
});
