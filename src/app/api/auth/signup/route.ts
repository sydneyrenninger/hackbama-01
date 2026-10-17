import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeEduEmail } from "@/lib/email/normalize";
import { allow } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { signupBody } from "@/lib/validation";

/**
 * One-step .edu + password signup with NO email verification (email is skipped for now).
 * Same handoff as /signup/complete minus the code/token step:
 * create a confirmed Auth user -> provision_account -> sign in. Compensated on failure.
 * To turn verification back on, point the signup form at /signup/start → verify → complete.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Request blocked.");
  if (!(await allow("signup-ip", clientIp(req), 15, 3600))) return jsonError(429, "Too many attempts. Try again later.");

  const parsed = signupBody.safeParse(await readJson(req));
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Check your details.", {
      field: parsed.error.issues[0]?.path.join("."),
    });
  }
  const email = normalizeEduEmail(parsed.data.email);
  if (!email.ok) {
    return jsonError(400, email.reason === "not_edu" ? "Use your university (.edu) email." : "That email address isn't valid.", { field: "email" });
  }
  const { displayName, password } = parsed.data;

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.email,
    password,
    email_confirm: true, // No verification step yet; provision_account requires a confirmed email.
    user_metadata: { display_name: displayName },
  });

  if (createError || !created?.user) {
    const code = (createError as { code?: string } | null)?.code;
    if (code === "email_exists" || code === "user_already_exists") {
      return jsonError(409, "You already have an account. Sign in instead.", { signIn: true });
    }
    if (code === "weak_password") return jsonError(400, "Choose a stronger password.", { field: "password" });
    console.error("[signup] createUser failed", code ?? "unknown");
    return jsonError(500, "We couldn't create your account. Try again.");
  }

  const userId = created.user.id;
  const { error: provisionError } = await admin.rpc("provision_account", { p_user_id: userId, p_display_name: displayName });
  if (provisionError) {
    console.error("[signup] provisioning failed", provisionError.code);
    await admin.auth.admin.deleteUser(userId);
    return jsonError(500, "We couldn't finish setting up your account. Try again.");
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.email, password });
  if (signInError) return jsonOk({ redirect: "/login?created=1" });
  return jsonOk({ redirect: "/onboarding" });
}
