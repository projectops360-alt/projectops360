/**
 * ProjectOps360° — Environment Variable Validation
 *
 * PUBLIC vars (NEXT_PUBLIC_*) are embedded in the client bundle.
 * PRIVATE vars (no prefix) are only accessible server-side.
 *
 * This module:
 *  1. Validates required vars exist at runtime
 *  2. Throws clear errors when vars are missing
 *  3. Serves as a single source of truth for all env var names
 */

// ── PUBLIC — safe for browser code ────────────────────────
export const env = {
  /** Supabase project URL (public — anon key is designed to be visible) */
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  /** Supabase publishable (anon) key (public — restricted by RLS policies) */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",

  // ── PRIVATE — server-side only, NEVER expose to browser ──
  /** Database connection string (server-side only — contains password) */
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  /** OpenAI API key (server-side only) */
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  /** Anthropic API key (server-side only) */
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
} as const;

/** List of env vars that MUST be present for the app to start */
const requiredPublicVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const requiredServerVars = ["DATABASE_URL"] as const;

/**
 * Validates that required public env vars exist.
 * Call this in layout.tsx or a top-level client component.
 */
export function validatePublicEnv(): void {
  const missing = requiredPublicVars.filter(
    (key) => !process.env[key]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required public env vars: ${missing.join(", ")}. ` +
        `Check your .env.local file against .env.example`
    );
  }
}

/**
 * Validates that required server-only env vars exist.
 * Call this ONLY in server-side code (API routes, Server Actions, etc.).
 */
export function validateServerEnv(): void {
  const missing = requiredServerVars.filter(
    (key) => !process.env[key]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required server env vars: ${missing.join(", ")}. ` +
        `Check your .env.local file against .env.example`
    );
  }
}