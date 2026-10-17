import "server-only";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; field?: string };

export async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export function fail(error: unknown, field?: string): ActionResult<never> {
  return { ok: false, error: typeof error === "string" ? error : friendlyDbError(error as never), field };
}
