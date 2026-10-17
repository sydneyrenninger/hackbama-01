"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { schoolDomain } from "@/lib/tenant";

// Sends a magic link to any .edu email. The DB trigger also enforces this and creates the campus.
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/account");
  if (!schoolDomain(email)) redirect(`/login?error=${encodeURIComponent("Use your .edu email")}`);
  const origin = (await headers()).get("origin");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/verify");
}
