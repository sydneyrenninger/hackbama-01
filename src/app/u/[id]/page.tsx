import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingGrid, type GridListing } from "@/components/listing/listing-grid";
import { AppFrame } from "@/components/shell/app-frame";
import { Avatar } from "@/components/shell/avatar";
import { ids } from "@/lib/validation";
import { getAppContext } from "@/server/queries/context";
import { getPublicProfile } from "@/server/queries/marketplace";

type Campus = { id: string; slug: string; name: string; short_name: string; primary_color: string };

// Someone else's public profile: name, campus, major, bio and their active listings.
export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ids.uuid.safeParse(id).success) notFound();
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (id === ctx.user.id) redirect("/account");

  const found = await getPublicProfile(id);
  if (!found) notFound();
  const { profile, listings } = found;
  const campus = profile.campus as unknown as Campus | null;

  return (
    <AppFrame>
      <div className="space-y-8">
        <section className="flex flex-wrap items-center gap-4">
          <Avatar name={profile.display_name} path={profile.avatar_path} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold">{profile.display_name}</h1>
            <p className="text-muted-foreground">
              {campus && <Link href={`/c/${campus.slug}`} className="font-semibold hover:underline">{campus.name}</Link>}
              {profile.major && <> · {profile.major}</>}
              {profile.grad_year && <> · Class of {profile.grad_year}</>}
            </p>
            <p className="text-sm text-muted-foreground">{profile.completed_trades} completed trade{profile.completed_trades === 1 ? "" : "s"}</p>
          </div>
        </section>
        {profile.bio && <p className="max-w-prose whitespace-pre-line">{profile.bio}</p>}

        <section aria-labelledby="their-listings" className="space-y-3">
          <h2 id="their-listings" className="font-display text-xl font-bold">Listings</h2>
          <ListingGrid listings={listings as unknown as GridListing[]} emptyText={`${profile.display_name} has no active listings.`} />
        </section>
      </div>
    </AppFrame>
  );
}
