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
  /** Supabase service role key (server-side only — bypasses RLS) */
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  /** OpenAI API key (server-side only) */
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  /** Anthropic API key (server-side only) */
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  /**
   * Feature flag — Isabella Tool Use Runtime Gateway (server-side only).
   * Default OFF: disabled unless explicitly set to "true". When off, Isabella's
   * current pipeline (deterministic query engine + RAG) is unchanged. Rollback =
   * unset this flag (no migration). See isabella-tool-use-runtime-gateway.md.
   */
  ISABELLA_TOOL_USE_ENABLED: process.env.ISABELLA_TOOL_USE_ENABLED ?? "",
  /**
   * Feature flag — Isabella Process Intelligence routing/integration (Phase 5 ·
   * Task 6, server-side only). Default OFF. When off, Isabella's current pipeline
   * (deterministic query engine + RAG) is unchanged; the diagnosis/root-cause/
   * recommendation engines are never routed. Rollback = unset this flag (no
   * migration). See isabella-process-intelligence-ui-realtime-integration.md.
   */
  ISABELLA_PROCESS_INTELLIGENCE_ENABLED: process.env.ISABELLA_PROCESS_INTELLIGENCE_ENABLED ?? "",
  /**
   * Feature flag — Isabella Process Intelligence UI entry points (quick-action
   * chips). Default OFF. Controls only visible UI affordances; independent of the
   * runtime routing flag. Rollback = unset this flag (no migration).
   */
  ISABELLA_PROCESS_INTELLIGENCE_UI_ENABLED: process.env.ISABELLA_PROCESS_INTELLIGENCE_UI_ENABLED ?? "",
  /**
   * Feature flag — Isabella Voice (OpenAI Realtime interface layer, server-side
   * only). Default OFF. When off, the voice session/bridge endpoints return 404
   * and no live-voice UI is offered; Isabella's existing panel + browser speech
   * are unchanged. Rollback = unset this flag (no migration). See
   * docs/product-brain/isabella-voice.md.
   */
  ISABELLA_VOICE_ENABLED: process.env.ISABELLA_VOICE_ENABLED ?? "",
  /** OpenAI Realtime model for Isabella Voice (default: gpt-realtime). */
  ISABELLA_VOICE_MODEL: process.env.ISABELLA_VOICE_MODEL ?? "",
  /** OpenAI Realtime voice for Isabella (default: marin — warm female). */
  ISABELLA_VOICE_NAME: process.env.ISABELLA_VOICE_NAME ?? "",
  /**
   * Feature flag — GitHub Intelligence Layer (server-side only). Default OFF.
   * When off, the module is fully dark: no navigation entry, no dashboard/API
   * access, no webhook processing, no Isabella GitHub context. Requires BOTH
   * this flag AND project_type='software_development'. Rollback = unset this
   * flag (no migration needed; github_* data stays inert). See
   * docs/product-brain/github-intelligence-layer.md.
   */
  GITHUB_INTELLIGENCE_ENABLED: process.env.GITHUB_INTELLIGENCE_ENABLED ?? "",
  /**
   * Feature flag — Risk-to-Resolution event capture pilot (P2-T2 / PD-018,
   * server-side only). Comma-separated list of pilot project IDs, or the
   * literal "all" (local testing only). Default OFF (empty): risk writers emit
   * NO canonical risk events and current behavior is byte-identical. Rollback =
   * unset this flag (no migration needed; captured events stay inert). See
   * docs/product-brain/capabilities/CAP-045-canonical-event-contract-and-source-audit.md.
   */
  RISK_EVENT_CAPTURE_PROJECT_IDS: process.env.RISK_EVENT_CAPTURE_PROJECT_IDS ?? "",
  /**
   * Feature flag — mining-ready task and milestone event capture (P2-T2
   * remediation, server-side only). Comma-separated project IDs or "all" for
   * local testing. Default OFF. When enabled, roadmap writers emit semantic
   * lifecycle events with task/milestone cases and object references through
   * the existing PEG ingestion gateway.
   */
  PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS:
    process.env.PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS ?? "",
  /**
   * Living Graph canonical-event Relationships view. The read-only projection
   * is enabled automatically for every project. Set the global switch to false
   * for emergency rollback, or provide a comma-separated denylist to quarantine
   * individual projects. This never gates event capture or writes to the event
   * store or operational graph.
   */
  LIVING_GRAPH_EVENT_RELATIONSHIPS_ENABLED:
    process.env.LIVING_GRAPH_EVENT_RELATIONSHIPS_ENABLED ?? "true",
  LIVING_GRAPH_EVENT_RELATIONSHIPS_DISABLED_PROJECT_IDS:
    process.env.LIVING_GRAPH_EVENT_RELATIONSHIPS_DISABLED_PROJECT_IDS ?? "",
  /** Financial engine foundation. Every financial flag is server-side and default OFF. */
  FINANCIAL_FOUNDATION_ENABLED: process.env.FINANCIAL_FOUNDATION_ENABLED ?? "",
  FINANCIAL_WRITERS_ENABLED: process.env.FINANCIAL_WRITERS_ENABLED ?? "",
  FINANCIAL_PROJECTIONS_ENABLED: process.env.FINANCIAL_PROJECTIONS_ENABLED ?? "",
  FINANCIAL_UI_ENABLED: process.env.FINANCIAL_UI_ENABLED ?? "",
  FINANCIAL_ISABELLA_ENABLED: process.env.FINANCIAL_ISABELLA_ENABLED ?? "",
  /** Explicit comma-separated pilot projects; "all" is rejected in production. */
  FINANCIAL_PILOT_PROJECT_IDS: process.env.FINANCIAL_PILOT_PROJECT_IDS ?? "",
  /**
   * PMO Process Intelligence Command Center (CAP-047). Server-side, default
   * OFF. The current PMO Command Center dashboard stays the default view;
   * this flag only exposes the "Process Intelligence Beta" switcher and its
   * lazily loaded module. Never expose to the browser via NEXT_PUBLIC.
   */
  PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED:
    process.env.PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED ??
    process.env.pmo_process_intelligence_dashboard ??
    "",
  PMO_PORTFOLIO_ROLLUP_ENGINE_V1_ENABLED:
    process.env.PMO_PORTFOLIO_ROLLUP_ENGINE_V1_ENABLED ?? "",

  // ── GitHub App (Platform install flow — Mode A). All server-side only.
  // Absent in dev/tests; the config layer reports a safe "not configured"
  // status instead of throwing. NEVER expose these to the browser.
  GITHUB_APP_ID: process.env.GITHUB_APP_ID ?? "",
  GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG ?? "",
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY ?? "",
  GITHUB_APP_WEBHOOK_SECRET: process.env.GITHUB_APP_WEBHOOK_SECRET ?? "",
  GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID ?? "",
  GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET ?? "",
  /** Base URL used to build manifest redirect / callback / webhook URLs. */
  GITHUB_APP_BASE_URL: process.env.GITHUB_APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "",
  /** Optional secret used to envelope-encrypt manifest-created credentials. */
  GITHUB_INTELLIGENCE_ENCRYPTION_KEY: process.env.GITHUB_INTELLIGENCE_ENCRYPTION_KEY ?? "",
} as const;

/** True when the GitHub Intelligence feature flag is explicitly enabled. */
export function isGitHubIntelligenceFlagEnabled(): boolean {
  return process.env.GITHUB_INTELLIGENCE_ENABLED === "true";
}

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
