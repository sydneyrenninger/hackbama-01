import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CampusTheme } from "@/components/campus-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccount } from "@/lib/auth";
import { completeOnboarding } from "./actions";

// First-run profile setup. Required before using the app (see requireAccount / AppFrame).
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.profile.onboarded) redirect(`/c/${account.campus.slug}`);
  const { error } = await searchParams;

  return (
    <CampusTheme tenant={account.campus}>
      <AuthShell aside={<p className="text-sm opacity-80">Joining {account.campus.name}</p>}>
        <form action={completeOnboarding} className="space-y-5">
          <div>
            <h2 className="font-display text-3xl font-bold">Set up your profile</h2>
            <p className="mt-1 text-muted-foreground">Other students see this when you post or message them.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" name="display_name" required minLength={2} maxLength={40}
              defaultValue={account.profile.display_name} autoComplete="nickname" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="major">Major <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="major" name="major" maxLength={80} placeholder="Electrical engineering" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grad_year">Graduation year <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="grad_year" name="grad_year" type="number" inputMode="numeric" min={1950} max={2100} placeholder="2028" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <textarea id="bio" name="bio" rows={3} maxLength={280} placeholder="Selling dorm stuff, tutoring calc II."
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary" />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">Continue</Button>
        </form>
      </AuthShell>
    </CampusTheme>
  );
}
