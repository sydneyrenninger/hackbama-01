import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TENANT_PUBLIC } from "@/server/queries/context";
import type { Campus, Profile } from "@/types/db";

export type Account = {
  userId: string;
  email: string;
  profile: Profile;
  campus: Campus; // home campus (from the .edu email)
};

// Current signed-in account, or null. Use in Server Components / Route Handlers / Server Actions.
// For browse scope / memberships / active campus, use getAppContext() from @/server/queries/context.
export async function getAccount(): Promise<Account | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(`*, campus:tenants!profiles_home_tenant_id_fkey(${TENANT_PUBLIC})`)
    .eq("id", user.id)
    .single();
  if (!data) return null;

  const { campus, ...profile } = data;
  return { userId: user.id, email: user.email!, profile: profile as Profile, campus: campus as Campus };
}

// Same as getAccount, but redirects to /login if signed out and /onboarding if profile isn't set up.
export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (!account.profile.onboarded) redirect("/onboarding");
  return account;
}
