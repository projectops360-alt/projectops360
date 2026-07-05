// ============================================================================
// GitHub Intelligence — webhook signature verification + parsing
// ============================================================================
// Server-only. Verifies the GitHub `x-hub-signature-256` HMAC over the raw
// body. NEVER logs the secret or the signature. Pure verification logic is
// exported for unit tests (given a raw body + secret).
// ============================================================================

import crypto from "node:crypto";
import { SUPPORTED_GITHUB_EVENTS, type GitHubEventType } from "./types";

/**
 * Compute the expected `sha256=...` signature for a raw body.
 * Exported so tests can generate valid signatures without hitting GitHub.
 */
export function computeSignature(rawBody: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody, "utf8");
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Timing-safe comparison of the provided signature against the expected one.
 * Returns false for missing/malformed signatures (never throws).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!secret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = computeSignature(rawBody, secret);
  const a = Buffer.from(signatureHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isSupportedEvent(eventType: string | null | undefined): eventType is GitHubEventType {
  return !!eventType && (SUPPORTED_GITHUB_EVENTS as readonly string[]).includes(eventType);
}

export interface ParsedWebhook {
  eventType: string;
  deliveryId: string | null;
  installationId: number | null;
  repositoryGithubId: number | null;
  repositoryFullName: string | null;
  action: string | null;
  payload: Record<string, unknown>;
}

/** Extract the routing fields common to every GitHub event payload. */
export function parseWebhookEnvelope(
  headers: { event: string | null; deliveryId: string | null },
  payload: Record<string, unknown>,
): ParsedWebhook {
  const installation = payload.installation as { id?: number } | undefined;
  const repository = payload.repository as { id?: number; full_name?: string } | undefined;

  return {
    eventType: headers.event ?? "",
    deliveryId: headers.deliveryId,
    installationId: installation?.id ?? null,
    repositoryGithubId: repository?.id ?? null,
    repositoryFullName: repository?.full_name ?? null,
    action: (payload.action as string | undefined) ?? null,
    payload,
  };
}
