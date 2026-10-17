import { createClient } from "@/lib/supabase/server";
import { isSameOrigin, jsonError, jsonOk, readJson } from "@/lib/http";
import { z } from "zod";

// POST (not GET) so email link scanners can't burn the one-time token.
const body = z.object({ tokenHash: z.string().min(10).max(200), type: z.literal("recovery") });

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Request blocked.");
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "This reset link isn't valid.");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: parsed.data.tokenHash });
  if (error) return jsonError(400, "This reset link expired or was already used. Request a new one.");
  return jsonOk({ redirect: "/reset-password" });
}
