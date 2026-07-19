import "server-only";

import { headers } from "next/headers";

import { buildAuthCallbackUrl, resolveAuthSiteUrl } from "./email-redirects";

export async function getAuthEmailCallbackUrl(nextPath?: string) {
  const baseUrl = resolveAuthSiteUrl({
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    requestOrigin: (await headers()).get("origin"),
    deploymentEnvironment: process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV,
  });
  return buildAuthCallbackUrl(baseUrl, nextPath);
}
