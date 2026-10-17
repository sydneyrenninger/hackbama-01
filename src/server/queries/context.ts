import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const TENANT_PUBLIC = "id, slug, name, short_name, status, primary_color, secondary_color, logo_path, banner_path, welcome_text, settings";

export type PublicTenant = {
  id: string; slug: string; name: string; short_name: string; status: "active" | "pending" | "suspended";
  primary_color: string; secondary_color: string; logo_path: string | null; banner_path: string | null;
  welcome_text: string | null; settings: Record<string, unknown>;
};

/** Everything the app shell needs, resolved from the session (never from client input). */
export const getAppContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, membershipsRes, settingsRes, scopeRes, tenantsRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_path, bio, major, grad_year, onboarded, home_tenant_id, completed_trades").eq("id", user.id).single(),
    supabase.from("tenant_memberships").select("tenant_id, role, status").eq("user_id", user.id).eq("status", "active"),
    supabase.from("user_settings").select("browse_scope, browse_tenant_ids, active_tenant_id, arrival_date").eq("user_id", user.id).single(),
    supabase.rpc("my_browse_tenant_ids"),
    supabase.from("tenants").select(TENANT_PUBLIC).order("name"),
  ]);

  if (!profileRes.data) return { user, profile: null } as const; // Auth user without profile: provisioning incomplete.

  const tenants = (tenantsRes.data ?? []) as PublicTenant[];
  const scope = (scopeRes.data ?? []) as string[];
  const settings = settingsRes.data;
  const homeTenant = tenants.find((t) => t.id === profileRes.data.home_tenant_id) ?? null;
  const activeId = settings?.active_tenant_id && scope.includes(settings.active_tenant_id)
    ? settings.active_tenant_id
    : scope[0] ?? profileRes.data.home_tenant_id;
  const activeTenant = tenants.find((t) => t.id === activeId) ?? homeTenant;

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: profileRes.data,
    memberships: membershipsRes.data ?? [],
    settings,
    scope,
    tenants,
    homeTenant,
    activeTenant,
  } as const;
});
