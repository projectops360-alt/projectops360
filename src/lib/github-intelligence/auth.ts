// ============================================================================
// GitHub Intelligence — GitHub App auth (SERVER ONLY, read-only usage)
// ============================================================================
// Generates a short-lived App JWT (RS256) and exchanges it for an installation
// access token. Tokens are short-lived and NEVER persisted. Never exposed to
// the client. No token is used for any write operation (the client has no write
// methods).
// ============================================================================

import "server-only";
import crypto from "node:crypto";
import { loadEnvAppConfig } from "./config";

const GITHUB_API = "https://api.github.com";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Build a GitHub App JWT signed with the App private key (RS256). Valid for a
 * short window (< 10 min per GitHub limits). Kept in-memory only.
 */
export function generateAppJwt(appId: string, privateKey: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: nowSeconds - 30, // clock-skew guard
    exp: nowSeconds + 9 * 60,
    iss: appId,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Exchange the App JWT for a short-lived installation access token.
 * Returns { token, expiresAt } — the token is never stored.
 */
export async function getInstallationToken(installationId: number): Promise<{ token: string; expiresAt: string }> {
  const config = loadEnvAppConfig();
  if (!config) {
    throw new Error("GitHub App is not configured (env). Cannot mint installation token.");
  }
  const jwt = generateAppJwt(config.appId, config.privateKey);

  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    // Do not include the JWT or any secret in the error.
    throw new Error(`GitHub installation token request failed (${res.status}).`);
  }
  const data = (await res.json()) as { token: string; expires_at: string };
  return { token: data.token, expiresAt: data.expires_at };
}

/**
 * Fetch installation metadata (account login/type) using the App JWT.
 * Used by the install callback to record which account was connected.
 */
export async function getInstallationAccount(
  installationId: number,
): Promise<{ accountLogin: string | null; accountType: string | null }> {
  const config = loadEnvAppConfig();
  if (!config) throw new Error("GitHub App is not configured (env).");
  const jwt = generateAppJwt(config.appId, config.privateKey);

  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub installation lookup failed (${res.status}).`);
  const data = (await res.json()) as { account?: { login?: string; type?: string } };
  return { accountLogin: data.account?.login ?? null, accountType: data.account?.type ?? null };
}
