import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSignupToken, hashToken, hashVerificationCode } from "@/lib/auth/codes";
import { serverEnv } from "@/lib/env";
import { allow } from "@/lib/rate-limit";
import { SIGNUP_CHALLENGE_COOKIE, SIGNUP_TOKEN_COOKIE, clientIp, isSameOrigin, jsonError, jsonOk, readJson, signupCookieOptions } from "@/lib/http";
import { codeBody } from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Request blocked.");
  const parsed = codeBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "Enter the 6-digit code.");

  const jar = await cookies();
  const challengeId = jar.get(SIGNUP_CHALLENGE_COOKIE)?.value;
  if (!challengeId || !UUID.test(challengeId)) return jsonError(400, "Your code expired. Request a new one.", { restart: true });

  if (!(await allow("verify-ip", clientIp(req), 30, 600))) return jsonError(429, "Too many attempts. Try again later.");

  const env = serverEnv();
  const token = generateSignupToken();
  const { data, error } = await createAdminClient().rpc("verify_challenge", {
    p_id: challengeId,
    p_code_hash: hashVerificationCode(env.verificationPepper, challengeId, parsed.data.code),
    p_token_hash: hashToken(token),
  });
  if (error) return jsonError(500, "Something went wrong. Try again.");

  const row = Array.isArray(data) ? data[0] : data;
  switch (row?.status) {
    case "ok":
      jar.set(SIGNUP_TOKEN_COOKIE, `${challengeId}.${token}`, signupCookieOptions(900));
      jar.delete({ name: SIGNUP_CHALLENGE_COOKIE, path: "/api/auth/signup" });
      return jsonOk();
    case "invalid":
      return jsonError(400, "That code isn't right.", { attemptsRemaining: row.attempts_remaining });
    case "locked":
      return jsonError(400, "Too many wrong codes. Request a new one.", { restart: true });
    default:
      return jsonError(400, "Your code expired. Request a new one.", { restart: true });
  }
}
