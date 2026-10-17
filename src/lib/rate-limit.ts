import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimitKey } from "@/lib/auth/codes";
import { serverEnv } from "@/lib/env";

/** Fixed-window limiter backed by Postgres. Fails closed. */
export async function allow(scope: string, value: string, max: number, windowSeconds: number): Promise<boolean> {
  const key = rateLimitKey(serverEnv().verificationPepper, scope, value);
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_key: key, p_window_seconds: windowSeconds, p_max: max,
  });
  if (error) {
    console.error("[rate-limit] check failed", error.code);
    return false;
  }
  return data === true;
}
