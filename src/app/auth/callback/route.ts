import { createClient } from "@/lib/supabase/server";
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
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If the code is missing or exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}