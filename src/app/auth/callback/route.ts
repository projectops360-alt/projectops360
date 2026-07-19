import { createClient } from "@/lib/supabase/server";
import { sanitizeAuthNextPath } from "@/lib/auth/email-redirects";
import { NextResponse } from "next/server";

/**
 * Auth callback route handler for Supabase email confirmation.
 *
 * Supabase redirects users here after they click the confirmation link
 * in their signup email. This handler exchanges the auth code for a
 * session and redirects to the dashboard.
 *
 * This route is placed at /auth/callback (outside [locale]) because
 * Supabase redirect URLs are simpler without locale prefixes.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const next = sanitizeAuthNextPath(requestedNext, "/?auth=confirmed");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set(
    "authError",
    requestedNext?.includes("recovery=1") ? "recovery_link_invalid" : "confirmation_failed",
  );
  return NextResponse.redirect(loginUrl);
}
