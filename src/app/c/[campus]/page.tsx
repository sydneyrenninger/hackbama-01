import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { ListingTile } from "@/components/listing-tile";
import { Empty } from "@/components/shell/empty";
import { cn } from "@/lib/utils";
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

  // Category chips: same GET params the form would submit.
  const catHref = (category: string) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (category) p.set("category", category);
    if (sort !== "new") p.set("sort", sort);
    return `/c/${campus}${p.size ? `?${p}` : ""}`;
  };
  const chip = "shrink-0 rounded-full border-2 px-3.5 py-1.5 font-display text-sm font-bold capitalize transition-all";

  return (
    <div className="space-y-7">
      <header className="relative">
        <p className="eyebrow flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />Buy · {tenant?.name ?? "All campuses"}
        </p>
        <h1 className="mt-2 font-display text-[2.8rem] font-extrabold leading-[0.88] tracking-[-0.05em] sm:text-7xl">
          What do you <span className="font-serif font-normal italic text-primary">need</span> today?
        </h1>
      </header>

      <div className="space-y-4">
        <form method="get" className="flex flex-col gap-2.5 sm:flex-row">
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="feed-q" className="sr-only">Search listings</label>
            <input id="feed-q" name="q" defaultValue={sp.q} placeholder="Search textbooks, dorm gear, rides…"
              className="field h-14 pl-12 text-[17px] shadow-brut" />
          </div>
          <div className="flex gap-2.5">
            <label htmlFor="feed-sort" className="sr-only">Sort</label>
            <select id="feed-sort" name="sort" defaultValue={sort} className="field h-14 min-w-0 flex-1 font-display font-bold sm:w-48">
              <option value="new">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
            <button className="lift h-14 shrink-0 rounded-[0.85rem] border-2 border-ink bg-primary px-6 font-display font-bold text-primary-foreground shadow-brut">Search</button>
          </div>
        </form>

        <nav aria-label="Categories" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
          <Link href={catHref("")} aria-current={!sp.category ? "page" : undefined}
            className={cn(chip, !sp.category ? "border-ink bg-ink text-paper" : "border-ink/15 bg-card hover:border-ink")}>All</Link>
          {CATS.map((c) => (
            <Link key={c} href={catHref(c)} aria-current={sp.category === c ? "page" : undefined}
              className={cn(chip, sp.category === c ? "border-ink bg-pop text-ink shadow-brut-sm" : "border-ink/15 bg-card hover:border-ink")}>
              {c}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <p className="eyebrow">{listings.length} listing{listings.length === 1 ? "" : "s"}{sp.q ? ` for “${sp.q}”` : ""}</p>
        <p className="eyebrow text-muted-foreground">Tap to scroll ↓</p>
      </div>

      {listings.length === 0 ? (
        <Empty mark="?">No listings match. Try another search or campus.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l, i) => <ListingTile key={l.id} index={i} l={l as never} href={`/listing/${l.id}?${ctxParams}`} />)}
        </div>
      )}
    </div>
  );
}
