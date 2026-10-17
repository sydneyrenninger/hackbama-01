import { redirect } from "next/navigation";
import { ListingTile } from "@/components/listing-tile";
import { getAppContext } from "@/server/queries/context";
import { searchListings } from "@/server/queries/marketplace";

const CATS = ["textbooks", "dorm", "lab", "tickets", "tutoring", "rides", "electronics", "furniture", "clothing", "other"];

export default async function BuyFeed({
  params, searchParams,
}: {
  params: Promise<{ campus: string }>;
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const { campus } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext();
  if (!ctx?.profile) redirect("/login");

  const tenant = ctx.tenants.find((t) => t.slug === campus);
  const sort = sp.sort === "price_asc" || sp.sort === "price_desc" ? sp.sort : "new";
  const listings = await searchListings({
    tenantIds: tenant ? [tenant.id] : ctx.scope,
    q: sp.q, category: sp.category || undefined, sort,
  }).catch(() => []);

  // Tapping a tile opens the reel viewer on these same results.
  const ctxParams = new URLSearchParams({ c: campus });
  if (sp.q) ctxParams.set("q", sp.q);
  if (sp.category) ctxParams.set("category", sp.category);
  ctxParams.set("sort", sort); // same order as this feed

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <form method="get" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search textbooks, dorm gear, rides…"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3" />
        <select name="category" defaultValue={sp.category ?? ""} className="h-11 rounded-md border border-border bg-card px-2">
          <option value="">All categories</option>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="sort" defaultValue={sort} className="h-11 rounded-md border border-border bg-card px-2">
          <option value="new">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        <button className="h-11 rounded-md bg-primary px-5 font-semibold text-primary-foreground">Search</button>
      </form>

      {listings.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No listings match. Try another search or campus.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => <ListingTile key={l.id} l={l as never} href={`/listing/${l.id}?${ctxParams}`} />)}
        </div>
      )}
    </div>
  );
}