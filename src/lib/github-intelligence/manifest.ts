// ============================================================================
// GitHub Intelligence — GitHub App manifest builder (Mode B setup wizard)
// ============================================================================
// Generates a GitHub App manifest with MINIMAL, READ-ONLY permissions and the
// webhook events this layer consumes. Pure (URL in → manifest object out) so it
// can be unit-tested. The manifest is POSTed to GitHub's registration flow; the
// callback exchange + secret storage happen server-side (see actions/config).
// ============================================================================

export interface GitHubAppManifest {
  name: string;
  url: string;
  redirect_url: string;
  callback_urls: string[];
  setup_url: string;
  hook_attributes: { url: string; active: boolean };
  public: boolean;
  request_oauth_on_install: boolean;
  setup_on_update: boolean;
  default_permissions: Record<string, string>;
  default_events: string[];
}

export const GITHUB_MANIFEST_ROUTES = {
  redirect: "/api/integrations/github/manifest/callback",
  callback: "/api/integrations/github/install/callback",
  setup: "/api/integrations/github/install/callback",
  webhook: "/api/integrations/github/webhook",
} as const;

/** Minimal READ-ONLY permission set. No write scopes are ever requested. */
export const READ_ONLY_PERMISSIONS: Record<string, string> = {
  contents: "read",
  metadata: "read",
  pull_requests: "read",
  actions: "read",
  deployments: "read",
  checks: "read",
};

export const MANIFEST_EVENTS = [
  "push",
  "pull_request",
  "pull_request_review",
  "workflow_run",
  "deployment",
  "release",
  "create",
  "delete",
] as const;

export interface BuildManifestOptions {
  baseUrl: string;
  name?: string;
}

export function buildGitHubAppManifest(options: BuildManifestOptions): GitHubAppManifest {
  const base = options.baseUrl.replace(/\/$/, "");
  return {
    name: options.name ?? "ProjectOps360 GitHub Intelligence",
    url: base,
    redirect_url: base + GITHUB_MANIFEST_ROUTES.redirect,
    callback_urls: [base + GITHUB_MANIFEST_ROUTES.callback],
    setup_url: base + GITHUB_MANIFEST_ROUTES.setup,
    hook_attributes: { url: base + GITHUB_MANIFEST_ROUTES.webhook, active: true },
    public: false,
    request_oauth_on_install: false,
    setup_on_update: true,
    default_permissions: READ_ONLY_PERMISSIONS,
    default_events: [...MANIFEST_EVENTS],
  };
}
