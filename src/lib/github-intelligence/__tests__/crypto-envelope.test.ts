import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { deriveKey, encryptWithKey, decryptWithKey, isEncryptedEnvelope } from "../crypto-envelope";

describe("crypto-envelope", () => {
  const key = deriveKey(crypto.randomBytes(32).toString("hex"));

  it("round-trips a secret", () => {
    const secret = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
    const env = encryptWithKey(secret, key);
    expect(env).toBeTruthy();
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(decryptWithKey(env, key)).toBe(secret);
  });

  it("never stores plaintext in the envelope", () => {
    const secret = "super-secret-webhook-value";
    const env = encryptWithKey(secret, key)!;
    expect(env).not.toContain(secret);
  });

  it("returns null when no key is configured (refuses plaintext storage)", () => {
    expect(encryptWithKey("x", null)).toBeNull();
    expect(deriveKey("")).toBeNull();
  });

  it("fails closed on a wrong key or tampered envelope", () => {
    const env = encryptWithKey("value", key)!;
    const otherKey = deriveKey(crypto.randomBytes(32).toString("hex"));
    expect(decryptWithKey(env, otherKey)).toBeNull();
    expect(decryptWithKey(env.slice(0, -4) + "0000", key)).toBeNull();
  });

  it("accepts hex, base64 and passphrase key material", () => {
    expect(deriveKey("a".repeat(64))).toHaveLength(32);
    expect(deriveKey(Buffer.alloc(32).toString("base64"))).toHaveLength(32);
    expect(deriveKey("a-passphrase")).toHaveLength(32);
  });
});
