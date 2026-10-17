import { createClient } from "@/lib/supabase/server";
import type { Campus } from "@/types/db";

// Look up a campus (tenant) by its URL slug, e.g. /c/ua
export async function getCampus(slug: string): Promise<Campus | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("campuses").select("*").eq("slug", slug).single();
  return data;
}

// School domain for an email: "x@crimson.ua.edu" -> "ua.edu". Null if not .edu.
// Keep in sync with handle_new_user in 0001_init.sql.
export function schoolDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain.endsWith(".edu")) return null;
  return domain.split(".").slice(-2).join(".");
}

// Campus row for an email (may not exist yet; it's created on that school's first signup)
export async function getCampusForEmail(email: string): Promise<Campus | null> {
  const school = schoolDomain(email);
  if (!school) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("campuses").select("*").eq("email_domain", school).maybeSingle();
  return data;
}
