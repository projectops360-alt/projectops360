import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { isUnlocalizedPath } from "@/lib/i18n/unlocalized-paths";
import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

// Create the next-intl middleware for locale routing
const intlMiddleware = createMiddleware(routing);

// Paths that do NOT require authentication
const publicPaths = ["/login", "/signup", "/forgot-password", "/auth/callback"];

/**
 * Check if a pathname is a public (unauthenticated) path.
 * Strips the locale prefix before matching (e.g., /es/login → /login).
 */
function isPublicPath(pathname: string): boolean {
  // Remove locale prefix if present (e.g., /es/login → /login)
  const pathWithoutLocale = pathname.replace(
    new RegExp(`^/(${routing.locales.join("|")})`),
    ""
  ) || "/";

  return publicPaths.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );
}

/**
 * Get the login path for a given locale.
 * English (default): /login
 * Other locales: /{locale}/login
 */
function getLoginPath(locale: string): string {
  return locale === routing.defaultLocale ? "/login" : `/${locale}/login`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Routes OUTSIDE the [locale] segment ──
  // These routes live outside [locale]. next-intl would otherwise rewrite
  // them to /en/<path>, which does not exist. The auth callback must also
  // remain untouched so Supabase can exchange its confirmation code. The
  // Navigator route is handled separately because it requires authentication.
  if (isUnlocalizedPath(pathname) && !pathname.startsWith("/navigator-preview")) {
    return NextResponse.next();
  }

  // The temporary Navigator harness also lives outside [locale], but it is an
  // internal surface. Keep the direct route while requiring a verified session.
  if (pathname === "/navigator-preview" || pathname.startsWith("/navigator-preview/")) {
    const { response, user } = await updateSession(request);
    if (user) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {});
    });
    return redirectResponse;
  }

  // ── API routes: not localized, not auth-guarded at the edge ──
  // Must run BEFORE next-intl — otherwise the i18n middleware rewrites
  // /api/* → /<locale>/api/* which does not exist, returning 404 for every API
  // route (including webhook endpoints that must be reachable unauthenticated).
  // Route handlers perform their own auth/verification. Fixes both the GitHub
  // Intelligence webhook and the pre-existing /api/webhooks/drawings endpoint.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── Step 1: Handle internationalization routing ──
  const intlResponse = intlMiddleware(request);

  // ── Step 2: Handle Supabase auth session refresh ──
  const { response: supabaseResponse, user } = await updateSession(request);

  // ── Merge cookies from both responses ──
  let finalResponse: NextResponse;

  if (
    intlResponse.headers.get("x-middleware-rewrite") ||
    intlResponse.status === 307
  ) {
    // intl middleware wants to redirect/rewrite — respect it, but copy cookies
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie.name, cookie.value);
    });
    finalResponse = intlResponse;
  } else {
    // No intl redirect — use the Supabase response but copy intl cookies
    intlResponse.cookies.getAll().forEach((cookie) => {
      supabaseResponse.cookies.set(cookie.name, cookie.value);
    });
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      supabaseResponse.cookies.set(cookie.name, cookie.value);
    });
    finalResponse = supabaseResponse;
  }

  // ── Step 3: Auth guard ──

  // Skip auth checks for Next.js internals (API routes already returned early
  // above, before next-intl).
  if (pathname.startsWith("/_next/")) {
    return finalResponse;
  }

  const pathIsPublic = isPublicPath(pathname);

  // Detect locale from pathname or default
  const localeMatch = pathname.match(
    new RegExp(`^/(${routing.locales.join("|")})(/|$)`)
  );
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Anonymous visitors hitting the site root see the marketing landing instead
  // of being bounced to /login. The root is "/" (default locale) or "/<locale>".
  const pathWithoutLocale =
    pathname.replace(new RegExp(`^/(${routing.locales.join("|")})`), "") || "/";
  if (!user && pathWithoutLocale === "/") {
    const landingUrl = request.nextUrl.clone();
    landingUrl.pathname = "/landing";
    const redirectResponse = NextResponse.redirect(landingUrl);
    finalResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {});
    });
    return redirectResponse;
  }

  if (!user && !pathIsPublic) {
    // Unauthenticated user accessing a protected route → redirect to login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = getLoginPath(locale);
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Copy all cookies to the redirect response
    finalResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {});
    });
    return redirectResponse;
  }

  if (user && pathIsPublic && !pathname.startsWith("/auth/callback")) {
    // Authenticated user accessing login/signup → redirect to dashboard
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = locale === routing.defaultLocale ? "/" : `/${locale}`;
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    finalResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {});
    });
    return redirectResponse;
  }

  return finalResponse;
}

export const config = {
  matcher: [
    // Match all paths except static files and images.
    //
    // The PWA entry points (sw.js, manifest.webmanifest, offline.html) must be
    // excluded too: next-intl would rewrite them to /<locale>/… (404) and the
    // auth guard would bounce anonymous visitors to /login, which silently
    // breaks service worker registration and therefore installability.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
