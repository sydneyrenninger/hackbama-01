import { createClient } from "@/lib/supabase/server";
import type { Campus } from "@/types/db";

// Look up a campus (tenant) by its URL slug, e.g. /c/ua
export async function getCampus(slug: string): Promise<Campus | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("campuses").select("*").eq("slug", slug).single();
  return data;
}

// Map an .edu email to its campus via email_domain
export async function getCampusForEmail(email: string): Promise<Campus | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("campuses").select("*").eq("email_domain", domain).single();
  return data;
}
