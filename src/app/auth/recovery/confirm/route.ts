import { NextResponse } from "next/server";

import { sanitizeAuthNextPath } from "@/lib/auth/email-redirects";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const requestedNext = searchParams.get("next");
  const next = sanitizeAuthNextPath(requestedNext, "/change-password?recovery=1");

  if (!tokenHash) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("authError", "recovery_link_invalid");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("authError", "recovery_link_invalid");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, origin));
}
