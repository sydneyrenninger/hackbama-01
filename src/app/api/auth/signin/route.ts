import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirect";
import { normalizeEduEmail } from "@/lib/email/normalize";
import { allow } from "@/lib/rate-limit";
import { clientIp, isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { signInBody } from "@/lib/validation";

const GENERIC = "Email or password is incorrect.";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Request blocked.");
  const parsed = signInBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, GENERIC);
  const email = normalizeEduEmail(parsed.data.email);
  if (!email.ok) return jsonError(400, GENERIC);

  const ip = clientIp(req);
  const [ipOk, emailOk] = await Promise.all([
    allow("signin-ip", ip, 30, 900),
    allow("signin-email", email.canonical, 10, 900),
  ]);
  if (!ipOk || !emailOk) return jsonError(429, "Too many sign-in attempts. Try again in 15 minutes.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.email, password: parsed.data.password });
  if (error) return jsonError(401, GENERIC);
  return jsonOk({ redirect: safeNext(parsed.data.next) });
}
