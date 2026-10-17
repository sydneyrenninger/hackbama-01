import { createClient } from "@/lib/supabase/server";
import { TENANT_PUBLIC } from "@/server/queries/context";
import { normalizeEduEmail, registrableEduDomain } from "@/lib/email/normalize";
import type { Campus } from "@/types/db";

// Look up a campus (tenant) by its URL slug, e.g. /c/ua
export async function getCampus(slug: string): Promise<Campus | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select(TENANT_PUBLIC).eq("slug", slug).maybeSingle();
  return data as Campus | null;
}

// School domain for an email: "x@crimson.ua.edu" -> "ua.edu". Null if not .edu.
export function schoolDomain(email: string): string | null {
  const e = normalizeEduEmail(email);
  return e.ok ? registrableEduDomain(e.domain) : null;
}

// Campus for an email (may not exist yet; it's created on that school's first signup).
// Server-side resolution with subdomain rules is the SQL resolve_tenant_for_domain().
export async function getCampusForEmail(email: string): Promise<Campus | null> {
  const school = schoolDomain(email);
  if (!school) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_domains")
    .select(`tenant:tenants(${TENANT_PUBLIC})`)
    .eq("domain", school)
    .maybeSingle();
  return (data?.tenant as unknown as Campus) ?? null;
}
