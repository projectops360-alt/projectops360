// ============================================================================
// CAP-047 flag contract — default OFF, role-gated (guard: PMO-PI-FLAG-OFF)
// ============================================================================
// Protects the non-destructive coexistence rule: without the explicit flag
// the Process Intelligence module must be unreachable, and even with the
// flag ON only owner/admin see the switcher.
// ============================================================================

import { describe, it, expect, afterEach } from "vitest";
import { isPmoProcessIntelligenceEnabled, canAccessProcessIntelligence } from "../flags";

const KEY = "pmo_process_intelligence_dashboard";
const original = process.env[KEY];

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("PMO Process Intelligence flag (CAP-047)", () => {
  it("is OFF by default — absent, empty and non-'true' values all disable it", () => {
    delete process.env[KEY];
    expect(isPmoProcessIntelligenceEnabled()).toBe(false);
    process.env[KEY] = "";
    expect(isPmoProcessIntelligenceEnabled()).toBe(false);
    process.env[KEY] = "1";
    expect(isPmoProcessIntelligenceEnabled()).toBe(false);
    process.env[KEY] = "TRUE";
    expect(isPmoProcessIntelligenceEnabled()).toBe(false);
  });

  it("enables only with the explicit string 'true'", () => {
    process.env[KEY] = "true";
    expect(isPmoProcessIntelligenceEnabled()).toBe(true);
  });

  it("never grants access with the flag OFF, regardless of role", () => {
    delete process.env[KEY];
    for (const role of ["owner", "admin", "member", "viewer"]) {
      expect(canAccessProcessIntelligence(role)).toBe(false);
    }
  });

  it("with the flag ON, only owner/admin can access — member/viewer never", () => {
    process.env[KEY] = "true";
    expect(canAccessProcessIntelligence("owner")).toBe(true);
    expect(canAccessProcessIntelligence("admin")).toBe(true);
    expect(canAccessProcessIntelligence("member")).toBe(false);
    expect(canAccessProcessIntelligence("viewer")).toBe(false);
  });
});
