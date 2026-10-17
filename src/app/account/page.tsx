import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { ProfileForm } from "@/components/account/profile-form";
import { ListingGrid, type GridListing } from "@/components/listing/listing-grid";
import { RequestOwnerActions } from "@/components/requests/request-forms";
import { AppFrame } from "@/components/shell/app-frame";
import { Empty } from "@/components/shell/empty";
import { IdCard } from "@/components/shell/id-card";
import { SectionTitle } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { formatBudget, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAppContext } from "@/server/queries/context";
import { getMyRequests, getSavedListings } from "@/server/queries/marketplace";

type MyRequest = {
  id: string; title: string; status: string; budget_cents: number | null; created_at: string;
  channel: { id: string; slug: string; name: string } | null;
};

// My account: profile, saved listings, my requests, sign out.
export default async function AccountPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");
  const p = ctx.profile;

  const [saved, requests] = await Promise.all([getSavedListings(), getMyRequests()]);
  const campus = ctx.activeTenant ?? ctx.homeTenant;
  const myRequests = requests as unknown as MyRequest[];

  return (
    <AppFrame>
      <div className="space-y-12">
        <IdCard name={p.display_name} avatarPath={p.avatar_path} campus={ctx.homeTenant?.name} major={p.major}
          gradYear={p.grad_year} trades={p.completed_trades} email={ctx.user.email}>
          {campus && <Button asChild variant="outline" size="sm"><Link href={`/c/${campus.slug}/sell`}>My listings</Link></Button>}
          <form action="/api/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm"><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
          </form>
        </IdCard>

        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <section aria-labelledby="edit-h" className="space-y-5">
            <SectionTitle id="edit-h" n="01">Edit profile</SectionTitle>
            <div className="rounded-2xl border-2 border-ink bg-card p-5 shadow-brut sm:p-6">
              <ProfileForm initial={{ displayName: p.display_name, bio: p.bio, major: p.major, gradYear: p.grad_year, avatarPath: p.avatar_path }} />
            </div>
          </section>

          <section id="requests" aria-labelledby="reqs-h" className="scroll-mt-24 space-y-5">
            <SectionTitle id="reqs-h" n="02">My requests</SectionTitle>
            {myRequests.length === 0 ? (
              <Empty>
                You haven&apos;t posted any requests.{campus && <> <Link href={`/c/${campus.slug}/requests`} className="font-bold text-primary underline decoration-2 underline-offset-4">Post one</Link>.</>}
              </Empty>
            ) : (
              <ul className="overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-brut">
                {myRequests.map((r, i) => (
                  <li key={r.id} className={cn("p-4", i > 0 && "border-t-2 border-ink/10")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-display text-lg font-bold leading-tight tracking-[-0.02em]">{r.title}</p>
                      <span className={cn("eyebrow rounded-md px-1.5 py-0.5 text-[9px]", r.status === "open" ? "bg-pop text-ink" : "bg-ink text-paper")}>{r.status}</span>
                    </div>
                    <p className="eyebrow mt-1 text-[9px] text-muted-foreground">
                      {r.channel ? `#${r.channel.name} · ` : ""}{formatBudget(r.budget_cents)} · {timeAgo(r.created_at)}
                    </p>
                    {r.status === "open" && <div className="mt-3"><RequestOwnerActions requestId={r.id} /></div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section id="saved" aria-labelledby="saved-h" className="scroll-mt-24 space-y-5">
          <SectionTitle id="saved-h" n="03">Saved</SectionTitle>
          <ListingGrid listings={saved as unknown as GridListing[]} emptyText="Listings you save will show up here." linkQuery="saved=1" />
        </section>
      </div>
    </AppFrame>
  );
}
