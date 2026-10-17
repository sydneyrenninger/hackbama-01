"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";

// Saves first-time profile info and marks the account onboarded.
export async function completeOnboarding(formData: FormData) {
  const account = await getAccount();
  if (!account) redirect("/login");

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      display_name: String(formData.get("display_name") ?? account.profile.display_name),
      major: formData.get("major") || null,
      grad_year: formData.get("grad_year") ? Number(formData.get("grad_year")) : null,
      onboarded: true,
    })
    .eq("id", account.userId);

  redirect(`/c/${account.campus.slug}/swipe`);
}
