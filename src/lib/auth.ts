import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Campus, Profile } from "@/types/db";

export type Account = {
  userId: string;
  email: string;
  profile: Profile;
  campus: Campus;
};

// Current signed-in account, or null. Use in Server Components / Route Handlers / Server Actions.
export async function getAccount(): Promise<Account | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*, campus:campuses(*)")
    .eq("id", user.id)
    .single();
  if (!data) return null;

  const { campus, ...profile } = data;
  return { userId: user.id, email: user.email!, profile, campus };
}

// Same as getAccount, but redirects to /login if signed out and /onboarding if profile isn't set up.
export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (!account.profile.onboarded) redirect("/onboarding");
  return account;
}
