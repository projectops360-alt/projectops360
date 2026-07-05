// ============================================================================
// GitHub Intelligence — configuration + secret handling (SERVER ONLY)
// ============================================================================
// Loads the GitHub App config from env (Mode A) and exposes ONLY a safe,
// client-shareable status. Sensitive values (private key, webhook secret,
// client secret) never leave the server and are never returned in a payload.
//
// For manifest-created config (Mode B), credentials are envelope-encrypted
// with GITHUB_INTELLIGENCE_ENCRYPTION_KEY (AES-256-GCM) before storage.
// ============================================================================

import "server-only";
import { env, isGitHubIntelligenceFlagEnabled } from "@/lib/env";
import { deriveKey, encryptWithKey, decryptWithKey } from "./crypto-envelope";

export interface GitHubAppEnvConfig {
  appId: string;
  slug: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

/** True when a usable env-based GitHub App config is present (Mode A). */
export function hasEnvAppConfig(): boolean {
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && env.GITHUB_APP_WEBHOOK_SECRET);
}

/** Load the env-based GitHub App config. Returns null when not configured. */
export function loadEnvAppConfig(): GitHubAppEnvConfig | null {
  if (!hasEnvAppConfig()) return null;
  return {
    appId: env.GITHUB_APP_ID,
    slug: env.GITHUB_APP_SLUG,
    // GitHub private keys are often provided with escaped newlines in env vars.
    privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    webhookSecret: env.GITHUB_APP_WEBHOOK_SECRET,
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientSecret: env.GITHUB_APP_CLIENT_SECRET,
    baseUrl: env.GITHUB_APP_BASE_URL,
  };
}

/** The webhook secret in effect (env config). Never logged or returned to UI. */
export function getWebhookSecret(): string | null {
  return env.GITHUB_APP_WEBHOOK_SECRET || null;
}

/** Public (client-safe) app-config status — no secrets, ever. */
export interface PublicAppConfigStatus {
  flagEnabled: boolean;
  appConfigured: boolean;
  appSlug: string | null;
  webhookConfigured: boolean;
  source: "env" | "none";
}

export function getPublicAppConfigStatus(): PublicAppConfigStatus {
  const configured = hasEnvAppConfig();
  return {
    flagEnabled: isGitHubIntelligenceFlagEnabled(),
    appConfigured: configured,
    appSlug: configured ? env.GITHUB_APP_SLUG || null : null,
    webhookConfigured: Boolean(env.GITHUB_APP_WEBHOOK_SECRET),
    source: configured ? "env" : "none",
  };
}

// ── Envelope encryption for manifest-created credentials ─────────────────────
// AES-256-GCM via the pure crypto-envelope module. The key comes from
// GITHUB_INTELLIGENCE_ENCRYPTION_KEY (32-byte hex/base64 or a passphrase).

function encryptionKey(): Buffer | null {
  return deriveKey(env.GITHUB_INTELLIGENCE_ENCRYPTION_KEY);
}

/** Encrypt a secret for at-rest storage. Returns null if no key is configured
 *  (caller must then refuse to persist manifest secrets — never store plaintext). */
export function encryptSecret(plaintext: string): string | null {
  return encryptWithKey(plaintext, encryptionKey());
}

/** Decrypt a stored secret. Returns null on any failure (never throws/leaks). */
export function decryptSecret(envelope: string | null | undefined): string | null {
  return decryptWithKey(envelope, encryptionKey());
}

export function hasEncryptionKey(): boolean {
  return encryptionKey() !== null;
}
