import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";

// TODO: first-run profile form (display name, major, grad year, avatar) -> completeOnboarding
export default async function OnboardingPage() {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.profile.onboarded) redirect("/account");
  return null;
}
