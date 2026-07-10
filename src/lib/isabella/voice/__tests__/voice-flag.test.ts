// ============================================================================
// Isabella Voice — feature flag boundary (ISABELLA-VOICE-REALTIME-BRIDGE)
// ============================================================================
// The voice layer must be FULLY dark by default: flag unset/false/anything
// other than "true" → disabled. This protects the existing Isabella pipeline
// (no voice UI, endpoints return 404) unless explicitly enabled.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL = process.env.ISABELLA_VOICE_ENABLED;

describe("isabella voice flag", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ISABELLA_VOICE_ENABLED;
    else process.env.ISABELLA_VOICE_ENABLED = ORIGINAL;
  });

  async function flagValue(envValue: string | undefined): Promise<boolean> {
    if (envValue === undefined) delete process.env.ISABELLA_VOICE_ENABLED;
    else process.env.ISABELLA_VOICE_ENABLED = envValue;
    vi.resetModules();
    const { isIsabellaVoiceEnabled } = await import("@/lib/isabella/voice/flag");
    return isIsabellaVoiceEnabled();
  }

  it("is OFF by default (unset)", async () => {
    expect(await flagValue(undefined)).toBe(false);
  });

  it("is OFF for empty / false / random values", async () => {
    expect(await flagValue("")).toBe(false);
    expect(await flagValue("false")).toBe(false);
    expect(await flagValue("1")).toBe(false);
    expect(await flagValue("yes")).toBe(false);
  });

  it('is ON only for explicit "true" (case-insensitive)', async () => {
    expect(await flagValue("true")).toBe(true);
    expect(await flagValue("TRUE")).toBe(true);
  });
});
