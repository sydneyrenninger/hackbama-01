import { createClient } from "@/lib/supabase/server";
import { isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { newPasswordBody } from "@/lib/validation";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Request blocked.");
  const parsed = newPasswordBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Check your password.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Your reset session expired. Request a new link.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "same_password") return jsonError(400, "Choose a password you haven't used here before.");
    if (code === "weak_password") return jsonError(400, "Choose a stronger password.");
    return jsonError(400, "We couldn't update your password. Try again.");
  }
  return jsonOk({ redirect: "/app" });
}
