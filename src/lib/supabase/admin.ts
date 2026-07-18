import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Creates a Supabase admin client that bypasses Row Level Security.
 *
 * ⚠️  This client uses the service role key and is NOT subject to RLS policies.
 * Only use this in trusted server-side contexts:
 *   - Server Actions that need to bypass RLS for admin operations
 *   - Background jobs / cron tasks
 *   - Database seeding scripts
 *   - Migration data transforms
 *
 * NEVER import this module in client-side code.
 * NEVER expose the service role key to the browser.
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Add it to your .env.local file (server-side only)."
    );
  }

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
