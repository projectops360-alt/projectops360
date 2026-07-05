import { describe, it, expect } from "vitest";
import { computeSignature, verifyWebhookSignature, parseWebhookEnvelope, isSupportedEvent } from "../webhooks";

const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({ action: "opened", installation: { id: 123 }, repository: { id: 999, full_name: "acme/app" } });

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature", () => {
    const sig = computeSignature(BODY, SECRET);
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(verifyWebhookSignature(BODY, "sha256=deadbeef", SECRET)).toBe(false);
  });

  it("rejects a signature computed with a different secret", () => {
    const sig = computeSignature(BODY, "other-secret");
    expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyWebhookSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, undefined, SECRET)).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    expect(verifyWebhookSignature(BODY, "not-a-sha", SECRET)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    expect(verifyWebhookSignature(BODY, computeSignature(BODY, SECRET), "")).toBe(false);
  });

  it("rejects a tampered body", () => {
    const sig = computeSignature(BODY, SECRET);
    expect(verifyWebhookSignature(BODY + " ", sig, SECRET)).toBe(false);
  });
});

describe("parseWebhookEnvelope", () => {
  it("extracts routing fields", () => {
    const parsed = parseWebhookEnvelope(
      { event: "pull_request", deliveryId: "abc-123" },
      JSON.parse(BODY),
    );
    expect(parsed.eventType).toBe("pull_request");
    expect(parsed.deliveryId).toBe("abc-123");
    expect(parsed.installationId).toBe(123);
    expect(parsed.repositoryGithubId).toBe(999);
    expect(parsed.action).toBe("opened");
  });
});

describe("isSupportedEvent", () => {
  it("recognizes supported events and rejects others", () => {
    expect(isSupportedEvent("push")).toBe(true);
    expect(isSupportedEvent("workflow_run")).toBe(true);
    expect(isSupportedEvent("issues")).toBe(false);
    expect(isSupportedEvent(null)).toBe(false);
  });
});
