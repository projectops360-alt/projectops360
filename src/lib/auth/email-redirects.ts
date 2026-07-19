const PRODUCTION_SITE_URL = "https://projectops360.com";
const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function resolveAuthSiteUrl(input: {
  configuredSiteUrl?: string;
  requestOrigin?: string | null;
  deploymentEnvironment?: string;
}): string {
  const configured = normalizeOrigin(input.configuredSiteUrl);
  const requestOrigin = normalizeOrigin(input.requestOrigin);

  if (input.deploymentEnvironment === "production") {
    return configured ?? PRODUCTION_SITE_URL;
  }

  return requestOrigin ?? configured ?? LOCAL_SITE_URL;
}

export function sanitizeAuthNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function buildAuthCallbackUrl(baseUrl: string, nextPath?: string): string {
  const callbackUrl = new URL("/auth/callback", baseUrl);
  if (nextPath) callbackUrl.searchParams.set("next", sanitizeAuthNextPath(nextPath));
  return callbackUrl.toString();
}
