import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

// Create the next-intl middleware for locale routing
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // ── Step 1: Handle internationalization routing ──
  const intlResponse = intlMiddleware(request);

  // ── Step 2: Handle Supabase auth session refresh ──
  // Only apply to non-static paths
  const response = await updateSession(request);

  // Merge: use intl response headers + supabase cookies
  // If intl redirected (locale prefix), use that response as base
  if (intlResponse.headers.get("x-middleware-rewrite") || intlResponse.status === 307) {
    // intl middleware wants to redirect/rewrite — respect it, but copy cookies
    response.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie.name, cookie.value);
    });
    return intlResponse;
  }

  // No intl redirect — use the Supabase response but copy intl cookies
  intlResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and API
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};