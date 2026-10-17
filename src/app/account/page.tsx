import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { ProfileForm } from "@/components/account/profile-form";
import { ListingGrid, type GridListing } from "@/components/listing/listing-grid";
import { RequestOwnerActions } from "@/components/requests/request-forms";
import { AppFrame } from "@/components/shell/app-frame";
import { Avatar } from "@/components/shell/avatar";
import { Button } from "@/components/ui/button";
import { formatBudget, timeAgo } from "@/lib/format";
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
      <div className="space-y-10">
        <section className="flex flex-wrap items-center gap-4">
          <Avatar name={p.display_name} path={p.avatar_path} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold">{p.display_name}</h1>
            <p className="text-muted-foreground">
              {ctx.homeTenant?.name}
              {p.major && <> · {p.major}</>}
              {p.grad_year && <> · Class of {p.grad_year}</>}
            </p>
            <p className="text-sm text-muted-foreground">{ctx.user.email} · {p.completed_trades} completed trade{p.completed_trades === 1 ? "" : "s"}</p>
          </div>
          <div className="flex gap-2">
            {campus && <Button asChild variant="outline"><Link href={`/c/${campus.slug}/sell`}>My listings</Link></Button>}
            <form action="/api/auth/signout" method="post">
              <Button type="submit" variant="ghost"><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
            </form>
          </div>
        </section>

        <section aria-labelledby="edit-h" className="max-w-xl">
          <h2 id="edit-h" className="mb-4 font-display text-xl font-bold">Edit profile</h2>
          <ProfileForm initial={{ displayName: p.display_name, bio: p.bio, major: p.major, gradYear: p.grad_year, avatarPath: p.avatar_path }} />
        </section>

        <section id="saved" aria-labelledby="saved-h" className="scroll-mt-20 space-y-3">
          <h2 id="saved-h" className="font-display text-xl font-bold">Saved</h2>
          <ListingGrid listings={saved as unknown as GridListing[]} emptyText="Listings you save will show up here." linkQuery="saved=1" />
        </section>

        <section id="requests" aria-labelledby="reqs-h" className="scroll-mt-20 space-y-3">
          <h2 id="reqs-h" className="font-display text-xl font-bold">My requests</h2>
          {myRequests.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              You haven&apos;t posted any requests.{campus && <> <Link href={`/c/${campus.slug}/requests`} className="font-semibold text-primary hover:underline">Post one</Link>.</>}
            </p>
          ) : (
            <ul className="space-y-2">
              {myRequests.map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{r.title}</p>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold capitalize text-secondary-foreground">{r.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.channel ? `${r.channel.name} · ` : ""}{formatBudget(r.budget_cents)} · {timeAgo(r.created_at)}
                  </p>
                  {r.status === "open" && <div className="mt-3"><RequestOwnerActions requestId={r.id} /></div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppFrame>
  );
}
