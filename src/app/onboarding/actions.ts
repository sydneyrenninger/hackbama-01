"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";

const blank = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};

const schema = z.object({
  displayName: z.string().trim().min(2, "Use at least 2 characters for your name").max(40, "Keep your name under 40 characters"),
  major: z.string().max(80, "Keep your major under 80 characters").optional(),
  gradYear: z.coerce.number().int("Enter a year like 2028").min(1950, "Enter a year like 2028").max(2100, "Enter a year like 2028").optional(),
  bio: z.string().max(280, "Keep your bio under 280 characters").optional(),
});

// Saves first-time profile info, marks the account onboarded, and sends the user to their campus.
export async function completeOnboarding(formData: FormData) {
  const account = await getAccount();
  if (!account) redirect("/login");

  const parsed = schema.safeParse({
    displayName: formData.get("display_name"),
    major: blank(formData.get("major")),
    gradYear: blank(formData.get("grad_year")),
    bio: blank(formData.get("bio")),
  });
  if (!parsed.success) redirect(`/onboarding?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the form.")}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      major: parsed.data.major ?? null,
      grad_year: parsed.data.gradYear ?? null,
      bio: parsed.data.bio ?? null,
      onboarded: true,
    })
    .eq("id", account.userId);
  if (error) redirect(`/onboarding?error=${encodeURIComponent("We couldn't save your profile. Try again.")}`);

  redirect(`/c/${account.campus.slug}`);
}
