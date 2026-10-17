import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Film, Plus } from "lucide-react";
import { OfferListingButton } from "@/components/sell/offer-listing-button";
import { SellerListingActions } from "@/components/sell/seller-listing-actions";
import { Empty } from "@/components/shell/empty";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
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

const tab = "rounded-xl px-4 py-2 font-display text-sm font-bold transition-all";

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
    <div className="space-y-10">
      <PageHeader kicker="Sell · your shop" title="Sell" accent="your stuff."
        actions={canPost && (
          <Button asChild size="lg"><Link href={`${base}/new`}><Plus className="h-5 w-5" aria-hidden />New post</Link></Button>
        )}>
        Your listings, and requests you could fill.
      </PageHeader>

      {postedId && (
        <p role="status" className="flex animate-pop flex-wrap items-center gap-2 rounded-2xl border-2 border-ink bg-pop p-4 font-display font-bold shadow-brut">
          <CheckCircle2 className="h-5 w-5" aria-hidden />Your listing is live.
          <Link href={`/listing/${postedId}`} className="underline decoration-2 underline-offset-4">View it</Link>
        </p>
      )}

      <dl className="grid grid-cols-3 divide-x-2 divide-ink overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-brut">
        <div className="p-4 sm:p-6"><dt className="eyebrow text-[10px] text-muted-foreground">Active</dt><dd className="mt-1 font-display text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">{active.length}</dd></div>
        <div className="p-4 sm:p-6"><dt className="eyebrow text-[10px] text-muted-foreground">Sold</dt><dd className="mt-1 font-display text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">{sold.length}</dd></div>
        <Link href={`/c/${slug}/matches`} className={cn("group relative p-4 transition-colors sm:p-6", toReview > 0 ? "bg-pop" : "hover:bg-paper-deep")}>
          <dt className="eyebrow text-[10px] text-muted-foreground">Offers to review</dt>
          <dd className="mt-1 font-display text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">{toReview}</dd>
          <ArrowUpRight className="absolute right-3 top-3 h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </dl>

      {matches.length > 0 && (
        <section aria-labelledby="fill-h" className="space-y-4">
          <SectionTitle id="fill-h" n="01">Requests you could fill</SectionTitle>
          <ul className="space-y-3">
            {matches.map((m, i) => (
              <li key={m.request_id} style={{ "--i": i } as React.CSSProperties}
                className="rise relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-ink bg-card py-4 pl-14 pr-4">
                <span aria-hidden className="eyebrow absolute inset-y-0 left-0 grid w-10 place-items-center border-r-2 border-dashed border-ink bg-primary text-[9px] text-primary-foreground [writing-mode:vertical-rl]">Match</span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold leading-tight tracking-[-0.02em]">{m.request_title}</p>
                  <p className="eyebrow mt-1 text-[10px] text-muted-foreground">{m.tenant_short_name} · {formatBudget(m.budget_cents)}</p>
                </div>
                <OfferListingButton requestId={m.request_id} listingId={m.my_listing_id} listingTitle={m.my_listing_title} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="mine-h" className="space-y-4">
        <SectionTitle id="mine-h" n={matches.length > 0 ? "02" : "01"}
          aside={
            <nav aria-label="Listing status" className="flex gap-1 rounded-2xl border-2 border-ink bg-card p-1">
              <Link href={base} aria-current={!showSold ? "page" : undefined} className={cn(tab, !showSold ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink")}>Active</Link>
              <Link href={`${base}?tab=sold`} aria-current={showSold ? "page" : undefined} className={cn(tab, showSold ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink")}>Sold</Link>
            </nav>
          }>
          My listings
        </SectionTitle>

        {shown.length === 0 ? (
          <Empty>
            {showSold ? "Nothing sold yet." : canPost ? "No active listings. Post something to get started." : "No active listings."}
          </Empty>
        ) : (
          <ul className="overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-brut">
            {shown.map((l, i) => {
              const cover = [...(l.images ?? [])].sort((a, b) => a.position - b.position)[0];
              const price = formatPrice(l.price_cents, l.kind);
              return (
                <li key={l.id} className={cn("flex gap-4 p-3 sm:p-4", i > 0 && "border-t-2 border-ink/10")}>
                  <Link href={`/listing/${l.id}`} className={cn("relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-paper-deep sm:h-28 sm:w-28", l.status === "sold" && "grayscale")}>
                    {cover?.media_type === "video" ? (
                      <video src={mediaUrl(cover.storage_path, "video")} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- public storage URL
                      <img src={mediaUrl(cover.storage_path, "image")} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center font-serif text-4xl italic text-primary/60" aria-hidden>{l.title.charAt(0).toUpperCase()}</span>
                    )}
                    {l.is_reel && <Film className="absolute left-1.5 top-1.5 h-4 w-4 text-white drop-shadow" aria-label="Reel" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/listing/${l.id}`} className="truncate font-display text-lg font-bold leading-tight tracking-[-0.02em] hover:underline">{l.title}</Link>
                        {price && <span className="sticker shrink-0 rotate-2 text-sm">{price}</span>}
                      </div>
                      <p className="eyebrow mt-1 text-[10px] text-muted-foreground">
                        {l.tenant?.short_name}
                        {l.status === "reserved" && <span className="ml-1.5 rounded bg-ink px-1.5 py-px text-paper">Reserved</span>}
                      </p>
                      {l.tags?.length > 0 && <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{l.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}</p>}
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
