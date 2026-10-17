import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CampusTheme } from "@/components/campus-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccount } from "@/lib/auth";
import { completeOnboarding } from "./actions";

const opt = <span className="font-sans text-xs font-normal text-muted-foreground"> (optional)</span>;

// First-run profile setup. Required before using the app (see requireAccount / AppFrame).
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.profile.onboarded) redirect(`/c/${account.campus.slug}`);
  const { error } = await searchParams;

  return (
    <CampusTheme tenant={account.campus}>
      <AuthShell aside={<p>✶ Joining {account.campus.name}</p>}>
        <form action={completeOnboarding} className="space-y-5">
          <div>
            <p className="eyebrow text-muted-foreground">Welcome aboard</p>
            <h2 className="mt-2 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.05em]">Set up your <span className="font-serif font-normal italic text-primary">profile</span></h2>
            <p className="mt-2 text-muted-foreground">Other students see this when you post or message them.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" name="display_name" required minLength={2} maxLength={40}
              defaultValue={account.profile.display_name} autoComplete="nickname" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-2">
              <Label htmlFor="major">Major{opt}</Label>
              <Input id="major" name="major" maxLength={80} placeholder="Electrical engineering" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grad_year">Class of{opt}</Label>
              <Input id="grad_year" name="grad_year" type="number" inputMode="numeric" min={1950} max={2100} placeholder="2028" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio{opt}</Label>
            <textarea id="bio" name="bio" rows={3} maxLength={280} placeholder="Selling dorm stuff, tutoring calc II."
              className="field py-3" />
          </div>
          {error && <p role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full">Continue</Button>
        </form>
      </AuthShell>
    </CampusTheme>
  );
}
