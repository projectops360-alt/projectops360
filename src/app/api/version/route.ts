// ============================================================================
// Build identity endpoint — powers PWA auto-update
// ============================================================================
// Returns the build id of the deployment currently serving traffic. An
// installed app compares it against the id compiled into its own bundle to
// decide whether it is running a stale version.
//
// Deliberately public and contentless: it exposes a commit sha and nothing
// else, so it needs no session and leaks no tenant data. It must never be
// cached — a cached answer is indistinguishable from "no new version".
// ============================================================================

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "development" },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    },
  );
}
