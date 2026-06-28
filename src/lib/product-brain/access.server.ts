import "server-only";

// ============================================================================
// ProjectOps360° — Product Brain Control Center access allowlist (SERVER-ONLY)
// ============================================================================
// TASK 10A — the Control Center is internal and highly sensitive. Access is a
// STRICT EMAIL ALLOWLIST enforced server-side, not just UI hiding. This is the
// single source of truth for who may read Product Brain content; every gate
// (page, nav flag, server actions, Isabella bridge, export) imports from here.
//
// The addresses live ONLY in this server-only module + env, so they never reach
// the client bundle. Configure in production via:
//   PRODUCT_BRAIN_ALLOWED_EMAILS=efrain.pradas@gmail.com,pmo@your-domain.io
// When the env var is unset the safe built-in defaults below are used.
// ============================================================================

import { emailInAllowlist, resolveAllowlist } from "./access";

/**
 * Built-in fallback allowlist. NOTE: `pmo@xxx-demi.io` is a placeholder for the
 * PMO address from the spec — set the real one via PRODUCT_BRAIN_ALLOWED_EMAILS.
 */
export const DEFAULT_PRODUCT_BRAIN_ALLOWED_EMAILS: readonly string[] = [
  "efrain.pradas@gmail.com",
  "pmo@xxx-demi.io",
];

/** Resolve the effective allowlist: env (comma-separated) or the defaults. */
export function getProductBrainAllowedEmails(): string[] {
  return resolveAllowlist(process.env.PRODUCT_BRAIN_ALLOWED_EMAILS, DEFAULT_PRODUCT_BRAIN_ALLOWED_EMAILS);
}

/** THE gate: is this authenticated email allowed to see Product Brain content? */
export function isProductBrainAllowedEmail(email: string | null | undefined): boolean {
  return emailInAllowlist(email, getProductBrainAllowedEmails());
}
