import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

// Create the next-intl middleware for locale routing
const intlMiddleware = createMiddleware(routing);

// Paths that do NOT require authentication
const publicPaths = ["/login", "/signup", "/auth/callback"];

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

  // ── Public marketing landing ──
  // /landing lives OUTSIDE the [locale] segment and manages its own EN/ES via
  // react-i18next. Bypass next-intl rewriting + the auth guard entirely so it
  // renders for anyone (authenticated or not).
  if (pathname === "/landing" || pathname.startsWith("/landing/")) {
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

  // Skip auth checks for API routes, static files, and Next.js internals
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return finalResponse;
  }

  const pathIsPublic = isPublicPath(pathname);

  // Detect locale from pathname or default
  const localeMatch = pathname.match(
    new RegExp(`^/(${routing.locales.join("|")})(/|$)`)
  );
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  if (!user && !pathIsPublic) {
    // Unauthenticated user accessing a protected route → redirect to login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = getLoginPath(locale);
    // Preserve cookies on redirect
    finalResponse.cookies.getAll().forEach((cookie) => {
      loginUrl; // cookies are set on the response, not the URL
    });
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
    // Match all paths except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};