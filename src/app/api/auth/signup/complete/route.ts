import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashToken, parseSignupCookie } from "@/lib/auth/codes";
import { allow } from "@/lib/rate-limit";
import { SIGNUP_TOKEN_COOKIE, clientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { completeBody } from "@/lib/validation";

/**
 * Server-side handoff:
 * 1. Atomically consume the one-time signup token (proves code verification).
 * 2. Create an email-confirmed Supabase Auth user with the secret key.
 * 3. Provision profile + membership + settings in one DB transaction.
 * 4. Sign in with the documented password grant to set SSR session cookies.
 * Steps 2-3 are compensated on failure so no half-created account remains.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Request blocked.");
  if (!(await allow("complete-ip", clientIp(req), 20, 3600))) return jsonError(429, "Too many attempts. Try again later.");

  const parsed = completeBody.safeParse(await readJson(req));
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Check your details.", {
      field: parsed.error.issues[0]?.path.join("."),
    });
  }

  const jar = await cookies();
  const signup = parseSignupCookie(jar.get(SIGNUP_TOKEN_COOKIE)?.value);
  if (!signup) return jsonError(401, "Your verification expired. Start again.", { restart: true });

  const admin = createAdminClient();
  const { data: consumed, error: consumeError } = await admin.rpc("consume_signup_token", {
    p_id: signup.challengeId, p_token_hash: hashToken(signup.token),
  });
  const claim = Array.isArray(consumed) ? consumed[0] : null;
  if (consumeError || !claim?.email) return jsonError(401, "Your verification expired. Start again.", { restart: true });

  const release = () => admin.rpc("release_signup_token", { p_id: signup.challengeId });
  const { displayName, password } = parsed.data;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: claim.email,
    password,
    email_confirm: true, // Custom 6-digit verification already succeeded above.
    user_metadata: { display_name: displayName },
  });

  if (createError || !created?.user) {
    const code = (createError as { code?: string } | null)?.code;
    if (code === "email_exists" || code === "user_already_exists") {
      jar.delete({ name: SIGNUP_TOKEN_COOKIE, path: "/api/auth/signup" });
      return jsonError(409, "You already have an account. Sign in or reset your password.", { signIn: true });
    }
    await release();
    if (code === "weak_password") return jsonError(400, "Choose a stronger password.", { field: "password" });
    console.error("[signup] createUser failed", code ?? "unknown");
    return jsonError(500, "We couldn't create your account. Try again.");
  }

  const userId = created.user.id;
  const { error: provisionError } = await admin.rpc("provision_account", { p_user_id: userId, p_display_name: displayName });
  if (provisionError) {
    console.error("[signup] provisioning failed", provisionError.code);
    await admin.auth.admin.deleteUser(userId);
    await release();
    return jsonError(500, "We couldn't finish setting up your account. Try again.");
  }

  jar.delete({ name: SIGNUP_TOKEN_COOKIE, path: "/api/auth/signup" });

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: claim.email, password });
  if (signInError) return jsonOk({ redirect: "/login?created=1" });
  return jsonOk({ redirect: "/app" });
}
