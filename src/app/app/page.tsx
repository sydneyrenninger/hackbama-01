import { redirect } from "next/navigation";
import { getAppContext } from "@/server/queries/context";

// Post-login router: signed-in users land here, then go to onboarding or their campus.
export default async function AppHome() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login?next=/app");
  if (!ctx.profile) {
    return <main className="p-8">Your account setup didn&apos;t finish. Sign out and sign up again, or contact support.</main>;
  }
  if (!ctx.profile.onboarded) redirect("/onboarding");
  const campus = ctx.activeTenant ?? ctx.homeTenant;
  if (!campus) return <main className="p-8">No campus found for your account.</main>;
  redirect(`/c/${campus.slug}`);
}
