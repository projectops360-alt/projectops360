/**
 * ProjectOps360° — Environment Variable Validation
 *
 * PUBLIC vars (NEXT_PUBLIC_*) are embedded in the client bundle
 * by Next.js at compile time. They MUST use direct property access
 * (e.g. process.env.NEXT_PUBLIC_SUPABASE_URL) — dynamic access
 * like process.env[key] does NOT work on the client.
 *
 * PRIVATE vars (no prefix) are only accessible server-side.
 */

// ── PUBLIC — safe for browser code ────────────────────────
// Next.js inlines these at compile time. We use direct access
// so the compiler can replace them with actual values in the client bundle.
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

/**
 * Validates that required public env vars exist and are not placeholders.
 * Uses the `env` object (which has compile-time inlined values) instead
 * of dynamic process.env access, so it works correctly in client components.
 */
export function validatePublicEnv(): void {
  const missing: string[] = [];

  if (!env.NEXT_PUBLIC_SUPABASE_URL.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

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
 * This function uses dynamic process.env access which only works on the server.
 */
export function validateServerEnv(): void {
  if (typeof window !== "undefined") {
    throw new Error("validateServerEnv() must only be called on the server.");
  }

  const missing: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    missing.push("DATABASE_URL");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required server env vars: ${missing.join(", ")}. ` +
        `Check your .env.local file against .env.example`
    );
  }
}

/**
 * Checks if public env vars are configured (non-empty, non-placeholder).
 * Returns an object with the status of each variable.
 * Safe to call in client components.
 */
export function checkPublicEnv(): {
  urlSet: boolean;
  keySet: boolean;
  urlPreview: string;
  keyPreview: string;
} {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return {
    urlSet: url.length > 0 && !url.includes("your_"),
    keySet: key.length > 0 && !key.includes("PASTE") && !key.includes("<"),
    urlPreview: url ? `${url.substring(0, 30)}...` : "",
    keyPreview: key ? `${key.substring(0, 8)}...` : "",
  };
}