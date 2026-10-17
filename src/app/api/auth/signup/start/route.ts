import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateVerificationCode, hashVerificationCode, rateLimitKey } from "@/lib/auth/codes";
import { maskEmail, normalizeEduEmail } from "@/lib/email/normalize";
import { sendVerificationCode } from "@/lib/email/send";
import { emailConfigured, serverEnv } from "@/lib/env";
import { allow } from "@/lib/rate-limit";
import { SIGNUP_CHALLENGE_COOKIE, SIGNUP_TOKEN_COOKIE, clientIp, isSameOrigin, jsonError, jsonOk, readJson, signupCookieOptions } from "@/lib/http";
import { emailBody } from "@/lib/validation";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Request blocked.");
  const parsed = emailBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "Enter your university email.");

  const email = normalizeEduEmail(parsed.data.email);
  if (!email.ok) {
    return jsonError(400, email.reason === "not_edu" ? "Use your university (.edu) email." : "That email address isn't valid.");
  }
  if (!emailConfigured()) {
    console.error("[signup] email provider not configured");
    return jsonError(503, "Sign-up email isn't set up yet. Contact the site admin.");
  }

  const ip = clientIp(req);
  if (!(await allow("signup-ip", ip, 15, 3600))) return jsonError(429, "Too many attempts. Try again later.");

  const env = serverEnv();
  const admin = createAdminClient();

  const { data: resolved, error: resolveError } = await admin.rpc("resolve_tenant_for_domain", { p_domain: email.domain });
  if (resolveError) return jsonError(500, "Something went wrong. Try again.");
  const tenant = Array.isArray(resolved) ? resolved[0] : null;
  if (tenant?.status === "suspended") return jsonError(403, "Sign-ups for this school are paused.");
  if (!tenant && env.unknownDomainPolicy === "reject") {
    return jsonError(403, "Your school isn't on Quad Exchange yet.");
  }

  const challengeId = randomUUID();
  const code = generateVerificationCode();
  const { data: created, error: createError } = await admin.rpc("create_verification_challenge", {
    p_id: challengeId,
    p_email: email.email,
    p_email_canonical: email.canonical,
    p_domain: email.domain,
    p_code_hash: hashVerificationCode(env.verificationPepper, challengeId, code),
    p_ip_hash: rateLimitKey(env.verificationPepper, "ip", ip),
  });
  if (createError) return jsonError(500, "Something went wrong. Try again.");

  const row = Array.isArray(created) ? created[0] : created;
  if (row?.status === "cooldown") {
    return jsonError(429, "Wait before requesting another code.", { retryAfter: row.retry_after_seconds });
  }
  if (row?.status === "limited") return jsonError(429, "Too many codes requested. Try again in an hour.");

  const sent = await sendVerificationCode(email.email, code, tenant?.name ?? null);
  await admin.rpc("mark_challenge_delivery", { p_id: challengeId, p_status: sent.ok ? "sent" : "failed" });
  if (!sent.ok) return jsonError(502, "We couldn't send the code. Try again in a minute.", { retryAfter: 60 });

  const jar = await cookies();
  jar.set(SIGNUP_CHALLENGE_COOKIE, challengeId, signupCookieOptions(600));
  jar.delete({ name: SIGNUP_TOKEN_COOKIE, path: "/api/auth/signup" });

  return jsonOk({
    maskedEmail: maskEmail(email.email),
    campus: tenant ? { name: tenant.name, status: tenant.status } : { name: null, status: "new" },
    resendAfter: 60,
  });
}
