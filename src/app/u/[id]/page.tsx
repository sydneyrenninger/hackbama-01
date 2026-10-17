import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingGrid, type GridListing } from "@/components/listing/listing-grid";
import { AppFrame } from "@/components/shell/app-frame";
import { IdCard } from "@/components/shell/id-card";
import { SectionTitle } from "@/components/shell/page-header";
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
      <div className="space-y-12">
        <IdCard name={profile.display_name} avatarPath={profile.avatar_path}
          campus={campus ? <Link href={`/c/${campus.slug}`} className="underline decoration-2 underline-offset-2">{campus.name}</Link> : undefined}
          major={profile.major} gradYear={profile.grad_year} trades={profile.completed_trades}>
          {profile.bio && <p className="max-w-prose whitespace-pre-line font-serif text-xl italic leading-snug">&ldquo;{profile.bio}&rdquo;</p>}
        </IdCard>

        <section aria-labelledby="their-listings" className="space-y-5">
          <SectionTitle id="their-listings" n={String(listings.length).padStart(2, "0")}>Listings</SectionTitle>
          <ListingGrid listings={listings as unknown as GridListing[]} emptyText={`${profile.display_name} has no active listings.`} linkQuery={`seller=${profile.id}`} />
        </section>
      </div>
    </AppFrame>
  );
}
