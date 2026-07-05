// ============================================================================
// GitHub Intelligence — envelope encryption (PURE, node:crypto only)
// ============================================================================
// AES-256-GCM envelope used to protect manifest-created credentials at rest
// (private key, webhook secret, client secret). Key material is passed in so
// this module is framework-free and unit-testable (never reads env directly).
// ============================================================================

import crypto from "node:crypto";

const ENC_PREFIX = "gh1:"; // versioned envelope marker

/** Derive a 32-byte key from hex / base64 / passphrase input. */
export function deriveKey(raw: string): Buffer | null {
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  return crypto.createHash("sha256").update(raw).digest();
}

/** Encrypt plaintext with derived key material. Returns null when no key. */
export function encryptWithKey(plaintext: string, key: Buffer | null): string | null {
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt an envelope. Returns null on any failure (never throws/leaks). */
export function decryptWithKey(envelope: string | null | undefined, key: Buffer | null): string | null {
  if (!envelope || !envelope.startsWith(ENC_PREFIX) || !key) return null;
  try {
    const raw = Buffer.from(envelope.slice(ENC_PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** True when a value is an encrypted envelope (never plaintext). */
export function isEncryptedEnvelope(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(ENC_PREFIX));
}
