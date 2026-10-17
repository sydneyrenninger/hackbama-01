import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Film, Plus } from "lucide-react";
import { OfferListingButton } from "@/components/sell/offer-listing-button";
import { SellerListingActions } from "@/components/sell/seller-listing-actions";
import { formatBudget } from "@/lib/format";
import { mediaUrl, type MediaType } from "@/lib/media/url";
import { cn, formatPrice } from "@/lib/utils";
import { ids } from "@/lib/validation";
import { getAppContext } from "@/server/queries/context";
import { getMyListings, getMyOffers, getRequestsForMyListings } from "@/server/queries/marketplace";

type MyListing = {
  id: string; title: string; kind: string; status: string; price_cents: number | null; is_reel: boolean; tags: string[];
  tenant: { id: string; short_name: string } | null;
  images: { storage_path: string; position: number; media_type?: MediaType }[] | null;
};
type Suggestion = {
  request_id: string; request_title: string; budget_cents: number | null; tenant_short_name: string;
  my_listing_id: string; my_listing_title: string;
};

const tab = "rounded-full px-4 py-2 text-sm font-semibold transition-colors";

// Sell tab: your listings (active / sold), requests you could fill, and a way to post.
export default async function SellPage({ params, searchParams }: {
  params: Promise<{ campus: string }>; searchParams: Promise<{ tab?: string; posted?: string }>;
}) {
  const { campus: slug } = await params;
  const { tab: tabParam, posted } = await searchParams;
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");
  if (!ctx.tenants.some((t) => t.slug === slug)) notFound();

  const [listings, suggestions, offers] = await Promise.all([getMyListings(), getRequestsForMyListings(), getMyOffers()]);
  const mine = listings as unknown as MyListing[];
  const showSold = tabParam === "sold";
  const active = mine.filter((l) => l.status === "active" || l.status === "reserved");
  const sold = mine.filter((l) => l.status === "sold");
  const shown = showSold ? sold : active;
  const toReview = (offers.incoming as unknown as { status: string }[]).filter((o) => o.status === "pending").length;
  const matches = (suggestions as unknown as Suggestion[]).slice(0, 5);
  const postedId = posted && ids.uuid.safeParse(posted).success ? posted : null;
  const home = ctx.homeTenant;
  const canPost = home?.status === "active" && ctx.memberships.some((m) => m.tenant_id === home.id);
  const base = `/c/${slug}/sell`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Sell</h1>
          <p className="mt-1 text-muted-foreground">Your listings, and requests you could fill.</p>
        </div>
        {canPost && (
          <Link href={`${base}/new`} className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-110">
            <Plus className="h-4 w-4" aria-hidden />New post
          </Link>
        )}
      </div>

      {postedId && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />Your listing is live.
          <Link href={`/listing/${postedId}`} className="underline">View it</Link>
        </p>
      )}

      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">Active</dt><dd className="font-display text-2xl font-bold">{active.length}</dd></div>
        <div className="rounded-lg border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">Sold</dt><dd className="font-display text-2xl font-bold">{sold.length}</dd></div>
        <Link href={`/c/${slug}/matches`} className="rounded-lg border border-border bg-card p-4 hover:bg-muted">
          <dt className="text-sm text-muted-foreground">Offers to review</dt><dd className="font-display text-2xl font-bold">{toReview}</dd>
        </Link>
      </dl>

      {matches.length > 0 && (
        <section aria-labelledby="fill-h" className="space-y-3">
          <h2 id="fill-h" className="font-display text-xl font-bold">Requests you could fill</h2>
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.request_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{m.request_title}</p>
                  <p className="text-sm text-muted-foreground">{m.tenant_short_name} · {formatBudget(m.budget_cents)}</p>
                </div>
                <OfferListingButton requestId={m.request_id} listingId={m.my_listing_id} listingTitle={m.my_listing_title} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="mine-h" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="mine-h" className="font-display text-xl font-bold">My listings</h2>
          <nav aria-label="Listing status" className="flex gap-1 rounded-full border border-border bg-card p-1">
            <Link href={base} aria-current={!showSold ? "page" : undefined} className={cn(tab, !showSold ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Active</Link>
            <Link href={`${base}?tab=sold`} aria-current={showSold ? "page" : undefined} className={cn(tab, showSold ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Sold</Link>
          </nav>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            {showSold ? "Nothing sold yet." : canPost ? "No active listings. Post something to get started." : "No active listings."}
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((l) => {
              const cover = [...(l.images ?? [])].sort((a, b) => a.position - b.position)[0];
              const price = formatPrice(l.price_cents, l.kind);
              return (
                <li key={l.id} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                  <Link href={`/listing/${l.id}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-secondary">
                    {cover?.media_type === "video" ? (
                      <video src={mediaUrl(cover.storage_path, "video")} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- public storage URL
                      <img src={mediaUrl(cover.storage_path, "image")} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center font-display text-3xl font-bold text-secondary-foreground/40" aria-hidden>{l.title.charAt(0).toUpperCase()}</span>
                    )}
                    {l.is_reel && <Film className="absolute left-1.5 top-1.5 h-4 w-4 text-white drop-shadow" aria-label="Reel" />}
                  </Link>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <Link href={`/listing/${l.id}`} className="block truncate font-semibold hover:underline">{l.title}</Link>
                      <p className="text-sm text-muted-foreground">
                        {price && <span className="font-semibold text-foreground">{price}</span>}
                        {price && " · "}{l.tenant?.short_name}
                        {l.status === "reserved" && " · Reserved"}
                      </p>
                      {l.tags?.length > 0 && <p className="truncate text-xs text-muted-foreground">{l.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}</p>}
                    </div>
                    <SellerListingActions listingId={l.id} status={l.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
