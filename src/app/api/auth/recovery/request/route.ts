import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEduEmail } from "@/lib/email/normalize";
import { sendPasswordReset } from "@/lib/email/send";
import { serverEnv } from "@/lib/env";
import { allow } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { emailBody } from "@/lib/validation";

/**
 * Generates a Supabase recovery token server-side and delivers it through
 * Resend, so recovery doesn't consume Supabase's built-in email quota.
 * Always returns the same response to prevent account enumeration.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Request blocked.");
  const parsed = emailBody.safeParse(await readJson(req));
  const email = parsed.success ? normalizeEduEmail(parsed.data.email) : null;
  const generic = jsonOk({ message: "If an account exists for that email, a reset link is on its way." });
  if (!email?.ok) return generic;

  const [ipOk, emailOk] = await Promise.all([
    allow("recovery-ip", clientIp(req), 10, 3600),
    allow("recovery-email", email.canonical, 3, 3600),
  ]);
  if (!ipOk || !emailOk) return generic;

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email: email.email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return generic; // Unknown user or provider error: same response.

  const url = new URL("/auth/confirm", serverEnv().appUrl);
  url.searchParams.set("token_hash", hashed);
  url.searchParams.set("type", "recovery");
  const sent = await sendPasswordReset(email.email, url.toString());
  if (!sent.ok) console.error("[recovery] delivery failed", sent.reason);
  return generic;
}
