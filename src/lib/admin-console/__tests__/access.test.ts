import { describe, it, expect, beforeEach, vi } from "vitest";

// `server-only` is a Next.js build-time guard not resolvable under vitest; stub
// it so the server-only access module can be imported in the node-env test.
vi.mock("server-only", () => ({}));

// ============================================================================
// Admin Console — platform-admin access gate
// ============================================================================
// Executes the exact server logic (access.server.ts) the /admin route and the
// sidebar flag both rely on. Asserts: only authorized emails pass, comparison
// is case-insensitive/trimmed, the table allowlist wins, and the temporary
// fallback (pmo@xxx-demo.io) authorizes when the table is empty/absent.
// ============================================================================

// ── Mocked Supabase admin client ──────────────────────────────────────────────
const h = vi.hoisted(() => {
  let tableEmails: string[] = [];
  let queryError: unknown = null;
  let throwOnClient = false;
  // Records that a query was attempted, so we can assert the table was consulted.
  let consulted = false;
  function makeBuilder() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b,
      eq: () => { consulted = true; return b; },
      is: () => b,
      order: () => b,
      // thenable — resolves to the configured list result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (resolve: any, reject: any) =>
        Promise.resolve({
          data: queryError ? null : tableEmails.map((e) => ({ email: e })),
          error: queryError,
        }).then(resolve, reject),
    };
    return b;
  }
  return {
    client: { from: () => makeBuilder() },
    tableWasConsulted: () => consulted,
    setActiveEmails(list: string[]) { tableEmails = list; },
    setQueryError(e: unknown) { queryError = e; },
    setThrow(t: boolean) { throwOnClient = t; },
    reset() { tableEmails = []; queryError = null; throwOnClient = false; consulted = false; },
    // expose throw flag for the client factory
    shouldThrow: () => throwOnClient,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (h.shouldThrow()) throw new Error("service role not configured");
    return h.client;
  },
}));

import { isPlatformAdmin, requirePlatformAdmin, FALLBACK_ADMIN_EMAIL } from "@/lib/admin-console/access.server";

beforeEach(() => h.reset());

describe("isPlatformAdmin — who may access the Admin Console", () => {
  it("authorizes the temporary fallback email (empty table)", async () => {
    expect(await isPlatformAdmin("pmo@xxx-demo.io")).toBe(true);
  });

  it("authorizes the fallback case-insensitively and trimmed", async () => {
    expect(await isPlatformAdmin("  PMO@XXX-DEMO.IO ")).toBe(true);
  });

  it("authorizes an active row in admin_authorized_users", async () => {
    h.setActiveEmails(["owner@enterprise.io"]);
    expect(await isPlatformAdmin("owner@enterprise.io")).toBe(true);
  });

  it("authorizes a table email case-insensitively", async () => {
    h.setActiveEmails(["Owner@Enterprise.io"]);
    expect(await isPlatformAdmin("owner@enterprise.IO")).toBe(true);
  });

  it("denies any other authenticated user", async () => {
    expect(await isPlatformAdmin("someone@else.io")).toBe(false);
    expect(await isPlatformAdmin("attacker@evil.com")).toBe(false);
  });

  it("denies empty / null / undefined emails", async () => {
    expect(await isPlatformAdmin("")).toBe(false);
    expect(await isPlatformAdmin(null)).toBe(false);
    expect(await isPlatformAdmin(undefined)).toBe(false);
    expect(await isPlatformAdmin("   ")).toBe(false);
  });

  it("consults the table BEFORE applying the fallback (table-first)", async () => {
    h.setActiveEmails(["explicit@allowed.io"]);
    // Fallback email is NOT in the table; it should still pass via fallback.
    expect(await isPlatformAdmin("pmo@xxx-demo.io")).toBe(true);
    // And a non-fallback, non-table email is denied.
    expect(await isPlatformAdmin("nope@nowhere.io")).toBe(false);
    // The table query was actually issued (gate is table-first).
    expect(h.tableWasConsulted()).toBe(true);
  });

  it("falls back gracefully when the table is absent (query error)", async () => {
    h.setQueryError({ code: "42P01", message: "relation does not exist" });
    // Table query failed → fallback path still authorizes the fallback email.
    expect(await isPlatformAdmin("pmo@xxx-demo.io")).toBe(true);
    // ...and denies everyone else (no table, not the fallback).
    expect(await isPlatformAdmin("someone@else.io")).toBe(false);
  });

  it("falls back gracefully when createAdminClient throws (no service role)", async () => {
    h.setThrow(true);
    expect(await isPlatformAdmin("pmo@xxx-demo.io")).toBe(true);
    expect(await isPlatformAdmin("someone@else.io")).toBe(false);
  });
});

describe("requirePlatformAdmin — denial logging", () => {
  it("returns false for a denied user (does not throw)", async () => {
    const ok = await requirePlatformAdmin("intruder@bad.io", "/admin");
    expect(ok).toBe(false);
  });

  it("returns true for the fallback admin", async () => {
    const ok = await requirePlatformAdmin("pmo@xxx-demo.io", "/admin");
    expect(ok).toBe(true);
  });
});

describe("FALLBACK_ADMIN_EMAIL", () => {
  it("is the documented PMO address", () => {
    expect(FALLBACK_ADMIN_EMAIL).toBe("pmo@xxx-demo.io");
  });
});