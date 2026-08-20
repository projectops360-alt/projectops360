import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => {
  let data: unknown = [];
  let error: unknown = null;
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  return {
    client: {
      rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return Promise.resolve({ data, error });
      }),
    },
    setResult(nextData: unknown, nextError: unknown = null) {
      data = nextData;
      error = nextError;
    },
    calls,
    reset() {
      data = [];
      error = null;
      calls.length = 0;
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.client }));

import { findAdminUserByEmail } from "@/lib/admin-console/user-integrity";

beforeEach(() => h.reset());

describe("findAdminUserByEmail", () => {
  it("normalizes email and returns the exact auth user from the RPC", async () => {
    h.setResult([{ user_id: "u-1", email: "ykade01@hotmail.com" }]);

    const result = await findAdminUserByEmail("  YKADE01@HOTMAIL.COM  ");

    expect(result).toEqual({
      status: "found",
      user: { id: "u-1", email: "ykade01@hotmail.com" },
    });
    expect(h.calls).toEqual([
      {
        fn: "admin_find_user_by_email",
        args: { p_email: "ykade01@hotmail.com" },
      },
    ]);
  });

  it("returns not_found only when the RPC succeeds with no matching user", async () => {
    h.setResult([]);
    expect(await findAdminUserByEmail("missing@example.com")).toEqual({ status: "not_found" });
  });

  it("does not convert an RPC failure into a false not_found", async () => {
    h.setResult(null, { code: "PGRST202", message: "function unavailable" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await findAdminUserByEmail("ykade01@hotmail.com")).toEqual({
      status: "error",
      code: "PGRST202",
    });
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
