import { describe, it, expect } from "vitest";
import { normalizeEmail, emailInAllowlist, resolveAllowlist } from "../access";

// ============================================================================
// TASK 10A — Product Brain Control Center strict email allowlist
// ============================================================================
// These tests execute the exact pure logic the server gate uses
// (access.server.ts wires process.env + defaults into resolveAllowlist +
// emailInAllowlist). They fail if the allowlist behavior is weakened.
// ============================================================================

// Mirrors DEFAULT_PRODUCT_BRAIN_ALLOWED_EMAILS in access.server.ts.
const ALLOW = ["efrain.pradas@gmail.com", "pmo@xxx-demo.io"] as const;

describe("Product Brain allowlist — who may access", () => {
  it("allows efrain.pradas@gmail.com", () => {
    expect(emailInAllowlist("efrain.pradas@gmail.com", ALLOW)).toBe(true);
  });

  it("allows the PMO address", () => {
    expect(emailInAllowlist("pmo@xxx-demo.io", ALLOW)).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(emailInAllowlist("  Efrain.Pradas@Gmail.com ", ALLOW)).toBe(true);
  });

  it("denies any other authenticated user", () => {
    expect(emailInAllowlist("someone.else@gmail.com", ALLOW)).toBe(false);
    expect(emailInAllowlist("attacker@evil.com", ALLOW)).toBe(false);
  });

  it("denies an unauthenticated / empty / null email", () => {
    expect(emailInAllowlist("", ALLOW)).toBe(false);
    expect(emailInAllowlist(null, ALLOW)).toBe(false);
    expect(emailInAllowlist(undefined, ALLOW)).toBe(false);
  });

  it("denies everyone when the allowlist is empty", () => {
    expect(emailInAllowlist("efrain.pradas@gmail.com", [])).toBe(false);
  });

  it("normalizeEmail lowercases and trims", () => {
    expect(normalizeEmail("  A@B.COM ")).toBe("a@b.com");
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("Product Brain allowlist — env resolution", () => {
  it("uses the defaults when env is unset/empty", () => {
    expect(resolveAllowlist(undefined, ALLOW)).toEqual([...ALLOW]);
    expect(resolveAllowlist("", ALLOW)).toEqual([...ALLOW]);
    expect(resolveAllowlist("   ", ALLOW)).toEqual([...ALLOW]);
  });

  it("parses a comma-separated env value (normalized, de-duped)", () => {
    const list = resolveAllowlist("Owner@X.io, owner@x.io , pmo@y.io", ALLOW);
    expect(list).toEqual(["owner@x.io", "pmo@y.io"]);
  });

  it("env overrides defaults entirely", () => {
    const list = resolveAllowlist("only@allowed.io", ALLOW);
    expect(list).toEqual(["only@allowed.io"]);
    expect(emailInAllowlist("efrain.pradas@gmail.com", list)).toBe(false);
    expect(emailInAllowlist("only@allowed.io", list)).toBe(true);
  });
});
