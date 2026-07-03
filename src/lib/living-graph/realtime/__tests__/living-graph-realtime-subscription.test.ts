// ============================================================================
// Phase 4 · Task 2 — Living Graph Realtime Event Subscription Layer guards
// ============================================================================
// Protects the LGRE subscription layer (LGRE-SUBSCRIPTION): authorization
// before attachment (deny ⇒ NO channel), duplicate-subscription prevention
// (same consumer+scope+topics ⇒ same handle, one channel), typed read-only
// notice stream (frozen; malformed/wrong-scope rows rejected and counted,
// never interpreted), at-least-once dedup that SURVIVES reconnects, reconnect
// re-authorization (permission loss detaches the feed), stale detection,
// observability events for every lifecycle step, engine delegation, and the
// canonical-truth import boundary: the pure core never references a DB client
// and the Supabase adapter is a strictly read-only INSERT listener on
// project_event_log (no query builder, no writes, no process_nodes/
// process_edges).
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createLivingGraphSubscriptionManager,
  createLivingGraphRealtimeEngine,
  mapProjectEventRowToNotice,
  noticeDedupKey,
  LgreUnauthorizedAccessError,
  LgreInvalidSubscriptionTopicError,
  type LivingGraphRealtimeAccessContext,
  type LivingGraphSubscriptionRequest,
  type LivingGraphRealtimeTransport,
  type LivingGraphTransportChannelParams,
  type LivingGraphTransportStatus,
  type LivingGraphNoticeDelivery,
  type LivingGraphSubscriptionObservabilityEvent,
  type ProjectEventLogRowLike,
} from "@/lib/living-graph/realtime";
import {
  createSupabaseLivingGraphTransport,
  mapSupabaseChannelStatus,
} from "@/lib/living-graph/realtime/supabase-transport";

const ORG = "org-aaaa";
const OTHER_ORG = "org-bbbb";
const PROJ = "proj-1111";

function access(
  overrides: Partial<LivingGraphRealtimeAccessContext> = {},
): LivingGraphRealtimeAccessContext {
  return {
    userId: "user-1",
    organizationId: ORG,
    scope: "pm",
    authorizedProjectIds: [PROJ],
    ...overrides,
  };
}

function request(
  overrides: Partial<LivingGraphSubscriptionRequest> = {},
): LivingGraphSubscriptionRequest {
  return {
    consumerId: "living-graph-ui",
    scope: { organizationId: ORG, projectId: PROJ },
    topics: ["project_events"],
    access: access(),
    ...overrides,
  };
}

function eventRow(overrides: Partial<Record<string, unknown>> = {}): ProjectEventLogRowLike {
  return {
    event_id: "e1",
    organization_id: ORG,
    project_id: PROJ,
    event_type: "TaskCompleted",
    occurred_at: "2026-07-03T09:00:00.000Z",
    sequence_number: 7,
    invalidation_tags: [`project:${PROJ}`, "subject:task:t1"],
    event_lifecycle_class: "BUSINESS_EVENT",
    is_compensating_event: false,
    ...overrides,
  };
}

// ── Fake transport (no network, fully deterministic) ─────────────────────────

interface FakeChannelEntry {
  params: LivingGraphTransportChannelParams;
  closed: boolean;
}

class FakeTransport implements LivingGraphRealtimeTransport {
  channels: FakeChannelEntry[] = [];

  openChannel(params: LivingGraphTransportChannelParams) {
    const entry: FakeChannelEntry = { params, closed: false };
    this.channels.push(entry);
    return {
      channelKey: params.channelKey,
      close: () => {
        entry.closed = true;
      },
    };
  }

  get openCount(): number {
    return this.channels.length;
  }

  get openChannels(): FakeChannelEntry[] {
    return this.channels.filter((c) => !c.closed);
  }

  pushRow(row: ProjectEventLogRowLike, index = this.channels.length - 1): void {
    const ch = this.channels[index];
    if (ch && !ch.closed) ch.params.onEventRow(row);
  }

  pushStatus(status: LivingGraphTransportStatus, index = this.channels.length - 1): void {
    const ch = this.channels[index];
    if (ch && !ch.closed) ch.params.onStatus(status);
  }
}

function setup(opts: {
  reauthorize?: (req: LivingGraphSubscriptionRequest) => { allowed: boolean; reason: string };
  staleAfterMs?: number;
} = {}) {
  const transport = new FakeTransport();
  let t = new Date("2026-07-03T10:00:00.000Z").getTime();
  const clock = { advance: (ms: number) => (t += ms) };
  const deliveries: LivingGraphNoticeDelivery[] = [];
  const events: LivingGraphSubscriptionObservabilityEvent[] = [];
  const manager = createLivingGraphSubscriptionManager({
    transport,
    now: () => new Date(t),
    subscriptionIdSeed: "t",
    reauthorize: opts.reauthorize,
    staleAfterMs: opts.staleAfterMs,
  });
  manager.onNotice((d) => deliveries.push(d));
  manager.onObservability((e) => events.push(e));
  const kinds = () => events.map((e) => e.kind);
  return { transport, manager, deliveries, events, kinds, clock };
}

// ── Subscription creation ─────────────────────────────────────────────────────

describe("LGRE subscription — creation", () => {
  it("attaches an authorized subscription: one project-scoped channel, live on connect", () => {
    const { transport, manager, kinds } = setup();
    const handle = manager.subscribe(request());

    expect(handle.subscriptionId).toBe("lgre-sub-t-1");
    expect(handle.state).toBe("connecting");
    expect(transport.openCount).toBe(1);
    expect(transport.channels[0].params.projectId).toBe(PROJ);
    expect(transport.channels[0].params.organizationId).toBe(ORG);
    expect(kinds()).toContain("subscription_attached");

    transport.pushStatus("connected");
    expect(manager.getSubscription(handle.subscriptionId)?.handle.state).toBe("live");
  });

  it("rejects unregistered topics loudly and validateTopics agrees", () => {
    const { manager } = setup();
    expect(manager.validateTopics(["project_events"])).toBe(true);
    expect(manager.validateTopics([])).toBe(false);
    expect(manager.validateTopics(["nope" as never])).toBe(false);
    expect(() => manager.subscribe(request({ topics: ["nope" as never] }))).toThrow(
      LgreInvalidSubscriptionTopicError,
    );
  });
});

// ── Authorized scope / unauthorized denial ────────────────────────────────────

describe("LGRE subscription — RBAC (deny ⇒ no channel, ever)", () => {
  it("denies an unauthorized project WITHOUT opening a channel", () => {
    const { transport, manager } = setup();
    expect(() => manager.subscribe(request({ access: access({ authorizedProjectIds: [] }) }))).toThrow(
      LgreUnauthorizedAccessError,
    );
    expect(transport.openCount).toBe(0);
    expect(manager.listSubscriptions()).toEqual([]);
  });

  it("denies cross-organization subscriptions", () => {
    const { transport, manager } = setup();
    expect(() =>
      manager.subscribe(request({ access: access({ organizationId: OTHER_ORG }) })),
    ).toThrow(LgreUnauthorizedAccessError);
    expect(transport.openCount).toBe(0);
  });

  it("delivers only rows for the subscribed scope — foreign rows are rejected and counted", () => {
    const { transport, manager, deliveries, kinds } = setup();
    const handle = manager.subscribe(request());
    transport.pushStatus("connected");

    transport.pushRow(eventRow());
    transport.pushRow(eventRow({ event_id: "e2", project_id: "proj-other" }));
    transport.pushRow(eventRow({ event_id: "e3", organization_id: OTHER_ORG }));

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].notice.eventId).toBe("e1");
    const snap = manager.getSubscription(handle.subscriptionId)!;
    expect(snap.noticesDelivered).toBe(1);
    expect(snap.noticesRejected).toBe(2);
    expect(kinds().filter((k) => k === "notice_rejected")).toHaveLength(2);
  });
});

// ── Typed, read-only notice stream ────────────────────────────────────────────

describe("LGRE subscription — typed read-only notices (never raw rows)", () => {
  it("maps rows to frozen typed notices with sequence + invalidation tags", () => {
    const { transport, manager, deliveries } = setup();
    manager.subscribe(request());
    transport.pushRow(eventRow());

    const delivery = deliveries[0];
    expect(delivery.consumerId).toBe("living-graph-ui");
    const n = delivery.notice;
    expect(n.source).toBe("project_event_graph");
    expect(n.noticeId).toBe("peg:e1");
    expect(n.eventType).toBe("TaskCompleted");
    expect(n.sequence).toBe(7);
    expect(n.invalidationTags).toContain("subject:task:t1");
    expect(n.lifecycleClass).toBe("BUSINESS_EVENT");
    expect(Object.isFrozen(n)).toBe(true);
    expect(Object.isFrozen(n.invalidationTags)).toBe(true);
  });

  it("rejects malformed rows (no identity ⇒ no guess, no crash) and never mutates the row", () => {
    const { transport, manager, deliveries, kinds } = setup();
    manager.subscribe(request());
    const malformed = eventRow({ event_id: undefined });
    const snapshot = JSON.parse(JSON.stringify(malformed));
    transport.pushRow(malformed);

    expect(deliveries).toHaveLength(0);
    expect(kinds()).toContain("notice_rejected");
    expect(malformed).toEqual(snapshot);
    expect(mapProjectEventRowToNotice(malformed)).toBeNull();
  });

  it("drops duplicate rows (at-least-once upstream ⇒ deduped downstream)", () => {
    const { transport, manager, deliveries, kinds } = setup();
    const handle = manager.subscribe(request());
    transport.pushRow(eventRow());
    transport.pushRow(eventRow());

    expect(deliveries).toHaveLength(1);
    expect(kinds()).toContain("duplicate_notice_dropped");
    expect(manager.getSubscription(handle.subscriptionId)?.duplicatesDropped).toBe(1);
    expect(noticeDedupKey(deliveries[0].notice)).toBe("event:e1");
  });
});

// ── Duplicate subscription prevention ─────────────────────────────────────────

describe("LGRE subscription — duplicate prevention", () => {
  it("same consumer+scope+topics returns the SAME handle and opens no second channel", () => {
    const { transport, manager, kinds } = setup();
    const first = manager.subscribe(request());
    const second = manager.subscribe(request({ topics: ["project_events"] }));

    expect(second.subscriptionId).toBe(first.subscriptionId);
    expect(transport.openCount).toBe(1);
    expect(kinds()).toContain("subscription_deduplicated");
    expect(manager.listSubscriptions()).toHaveLength(1);
  });

  it("a different topic set is a different subscription (not a false dedup)", () => {
    const { transport, manager } = setup();
    const first = manager.subscribe(request());
    const second = manager.subscribe(request({ topics: ["project_events", "milestone_flow"] }));
    expect(second.subscriptionId).not.toBe(first.subscriptionId);
    expect(transport.openCount).toBe(2);
  });
});

// ── Reconnect behavior ────────────────────────────────────────────────────────

describe("LGRE subscription — reconnects", () => {
  it("channel failure degrades honestly (state + fallback), reconnect re-attaches and recovers", () => {
    const { transport, manager, kinds } = setup();
    const handle = manager.subscribe(request());
    transport.pushStatus("connected");
    transport.pushStatus("channel_error");

    let snap = manager.getSubscription(handle.subscriptionId)!;
    expect(snap.handle.state).toBe("degraded_polling");
    expect(snap.fallbackMode).toBe("polling");
    expect(snap.consecutiveFailures).toBe(1);
    expect(kinds()).toContain("fallback_mode_changed");

    const result = manager.reconnect(handle.subscriptionId);
    expect(result.outcome).toBe("reconnected");
    expect(transport.channels[0].closed).toBe(true);
    expect(transport.openCount).toBe(2);
    expect(kinds()).toContain("reconnect_authorized");

    transport.pushStatus("connected", 1);
    snap = manager.getSubscription(handle.subscriptionId)!;
    expect(snap.handle.state).toBe("live");
    expect(snap.consecutiveFailures).toBe(0);
    expect(snap.fallbackMode).toBe("realtime");
  });

  it("dedup memory SURVIVES a reconnect — replayed rows never double-deliver", () => {
    const { transport, manager, deliveries } = setup();
    const handle = manager.subscribe(request());
    transport.pushRow(eventRow());
    manager.reconnect(handle.subscriptionId);
    transport.pushRow(eventRow(), 1); // replay after re-attach (at-least-once)

    expect(deliveries).toHaveLength(1);
    expect(manager.getSubscription(handle.subscriptionId)?.duplicatesDropped).toBe(1);
  });

  it("reconnecting an unknown subscription reports not_found (no fabricated channel)", () => {
    const { transport, manager } = setup();
    expect(manager.reconnect("nope").outcome).toBe("not_found");
    expect(transport.openCount).toBe(0);
  });
});

// ── Permission loss ───────────────────────────────────────────────────────────

describe("LGRE subscription — permission loss detaches the feed", () => {
  it("a reconnect after revocation closes the channel and removes the subscription", () => {
    const { transport, manager, deliveries, kinds } = setup({
      reauthorize: () => ({ allowed: false, reason: "membership_revoked" }),
    });
    const handle = manager.subscribe(request());
    transport.pushRow(eventRow());
    expect(deliveries).toHaveLength(1);

    const result = manager.reconnect(handle.subscriptionId);
    expect(result.outcome).toBe("permission_revoked");
    expect(result.decision?.reason).toBe("membership_revoked");
    expect(kinds()).toContain("permission_revoked_on_reconnect");
    expect(manager.getSubscription(handle.subscriptionId)).toBeNull();
    expect(transport.openChannels).toHaveLength(0);

    // A late row on the dead channel delivers nothing.
    transport.pushRow(eventRow({ event_id: "e9" }), 0);
    expect(deliveries).toHaveLength(1);
  });
});

// ── Stale subscriptions ───────────────────────────────────────────────────────

describe("LGRE subscription — stale detection", () => {
  it("a silent live subscription past the threshold degrades to polling (honest, never fake-live)", () => {
    const { transport, manager, kinds, clock } = setup({ staleAfterMs: 1_000 });
    const handle = manager.subscribe(request());
    transport.pushStatus("connected");

    clock.advance(500);
    expect(manager.sweepStale()).toEqual([]);

    clock.advance(1_000);
    expect(manager.sweepStale()).toEqual([handle.subscriptionId]);
    const snap = manager.getSubscription(handle.subscriptionId)!;
    expect(snap.handle.state).toBe("degraded_polling");
    expect(snap.fallbackMode).toBe("polling");
    expect(kinds()).toContain("stale_subscription_detected");
  });
});

// ── Release / lifecycle ───────────────────────────────────────────────────────

describe("LGRE subscription — release", () => {
  it("unsubscribe closes the channel, stops delivery, and is idempotent", () => {
    const { transport, manager, deliveries, kinds } = setup();
    const handle = manager.subscribe(request());
    manager.unsubscribe(handle.subscriptionId);

    expect(transport.channels[0].closed).toBe(true);
    expect(manager.getSubscription(handle.subscriptionId)).toBeNull();
    expect(kinds()).toContain("subscription_released");

    transport.pushRow(eventRow(), 0);
    expect(deliveries).toHaveLength(0);

    expect(() => manager.unsubscribe(handle.subscriptionId)).not.toThrow();
  });
});

// ── Engine delegation (Task 1 contract fulfilled) ─────────────────────────────

describe("LGRE subscription — engine delegation", () => {
  it("engine.registerSubscription delegates to the manager (authorization still first)", () => {
    const { transport, manager } = setup();
    const engine = createLivingGraphRealtimeEngine({ subscriptionManager: manager });

    const handle = engine.registerSubscription(request());
    expect(handle.subscriptionId).toBe("lgre-sub-t-1");
    expect(transport.openCount).toBe(1);

    expect(() =>
      engine.registerSubscription(request({ access: access({ authorizedProjectIds: [] }) })),
    ).toThrow(LgreUnauthorizedAccessError);

    engine.releaseSubscription(handle.subscriptionId);
    expect(manager.getSubscription(handle.subscriptionId)).toBeNull();
  });
});

// ── Supabase transport adapter (structural, no network) ──────────────────────

describe("LGRE subscription — Supabase transport adapter (read-only listener)", () => {
  function fakeClient() {
    const calls: {
      channelName?: string;
      config?: { event: string; schema: string; table: string; filter: string };
      rowCb?: (payload: { new: Record<string, unknown> }) => void;
      statusCb?: (status: string) => void;
      removed: unknown[];
    } = { removed: [] };
    const channel = {
      on(_type: "postgres_changes", config: never, cb: never) {
        calls.config = config;
        calls.rowCb = cb;
        return channel;
      },
      subscribe(cb?: (status: string) => void) {
        calls.statusCb = cb;
        return channel;
      },
    };
    const client = {
      channel(name: string) {
        calls.channelName = name;
        return channel;
      },
      removeChannel(ch: unknown) {
        calls.removed.push(ch);
        return "ok";
      },
    };
    return { client, calls };
  }

  it("opens an INSERT-only, project-filtered channel on project_event_log and maps statuses", () => {
    const { client, calls } = fakeClient();
    const transport = createSupabaseLivingGraphTransport(client);
    const rows: ProjectEventLogRowLike[] = [];
    const statuses: LivingGraphTransportStatus[] = [];

    const channel = transport.openChannel({
      channelKey: "lgre:proj-1111:sub-1",
      organizationId: ORG,
      projectId: PROJ,
      onEventRow: (r) => rows.push(r),
      onStatus: (s) => statuses.push(s),
    });

    expect(calls.channelName).toBe("lgre:proj-1111:sub-1");
    expect(calls.config).toEqual({
      event: "INSERT",
      schema: "public",
      table: "project_event_log",
      filter: `project_id=eq.${PROJ}`,
    });

    calls.rowCb?.({ new: eventRow() as Record<string, unknown> });
    expect(rows).toHaveLength(1);

    calls.statusCb?.("SUBSCRIBED");
    calls.statusCb?.("CHANNEL_ERROR");
    expect(statuses).toEqual(["connected", "channel_error"]);

    channel.close();
    expect(calls.removed).toHaveLength(1);
  });

  it("maps every Supabase channel status onto the normalized set (unknown ⇒ reconnecting)", () => {
    expect(mapSupabaseChannelStatus("SUBSCRIBED")).toBe("connected");
    expect(mapSupabaseChannelStatus("TIMED_OUT")).toBe("reconnecting");
    expect(mapSupabaseChannelStatus("CHANNEL_ERROR")).toBe("channel_error");
    expect(mapSupabaseChannelStatus("CLOSED")).toBe("closed");
    expect(mapSupabaseChannelStatus("SOMETHING_NEW")).toBe("reconnecting");
  });
});

// ── Canonical protection (no mutation, no write path) ─────────────────────────

describe("LGRE subscription — canonical protection", () => {
  function codeOf(file: string): string {
    const src = readFileSync(join(process.cwd(), "src/lib/living-graph/realtime", file), "utf8");
    return src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
  }

  it("the pure core (manager/mapper/types) never references a DB client, a write path, or the process graph", () => {
    for (const f of ["subscription-manager.ts", "subscription-types.ts", "notice-mapper.ts"]) {
      const code = codeOf(f);
      expect(code).not.toMatch(/supabase|createAdminClient|createClient|service_role/i);
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']|from\s+["']@\/lib\/events\/dual-write["']|from\s+["']@\/lib\/graph\/emit-event["']/);
      expect(code).not.toMatch(/process_nodes|process_edges/);
      expect(code).not.toMatch(/graph-layout-storage|localStorage/);
    }
  });

  it("the Supabase adapter is a LISTENER only: no query builder, no writes, INSERT-only listen", () => {
    const code = codeOf("supabase-transport.ts");
    // No reads or writes through the data API — channels only.
    expect(code).not.toMatch(/\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
    expect(code).not.toMatch(/createAdminClient|service_role/);
    expect(code).not.toMatch(/process_nodes|process_edges/);
    // Listens to INSERT only — the ledger is append-only; never wider.
    expect(code).toMatch(/event:\s*"INSERT"/);
    expect(code).not.toMatch(/"UPDATE"|"DELETE"|event:\s*"\*"/);
  });

  it("the package barrel does NOT export the DB transport (pure core stays client-free)", () => {
    const code = codeOf("index.ts");
    expect(code).not.toMatch(/supabase-transport/);
  });
});
