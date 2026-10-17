import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Secret-key client. Bypasses RLS. Use ONLY in trusted server code for:
 * verification challenges, rate limits, account provisioning, recovery links.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
