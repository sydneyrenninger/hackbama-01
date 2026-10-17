import { notFound, redirect } from "next/navigation";
import { CampusTheme } from "@/components/campus-theme";
import type { ReelItem } from "@/components/reels/reel-panels";
import { ReelViewer } from "@/components/reels/reel-viewer";
import { ids } from "@/lib/validation";
import { getAppContext } from "@/server/queries/context";
import {
  getCommentCounts, getListing, getSavedIds, getSavedListings, getSellerListings, searchListings,
} from "@/server/queries/marketplace";

type SP = { c?: string; q?: string; category?: string; sort?: string; reels?: string; seller?: string; saved?: string };
const SORTS = ["relevance", "new", "price_asc", "price_desc"] as const;
type Sort = (typeof SORTS)[number];

/**
 * Listing viewer (reel style). The query string says which list you came from so you can keep
 * scrolling through it: a feed search (?c=ua&q=dress&sort=…), a profile (?seller=…) or your saved items (?saved=1).
 */
export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  if (!ids.uuid.safeParse(id).success) notFound();
  const sp = await searchParams;
  const ctx = await getAppContext();
  if (!ctx) redirect(`/login?next=/listing/${id}`);
  if (!ctx.profile) redirect("/login");
  if (!ctx.profile.onboarded) redirect("/onboarding");

  const clicked = (await getListing(id)) as unknown as ReelItem & { tenant: { slug: string; short_name: string; primary_color: string; secondary_color: string } | null } | null;
  if (!clicked) notFound();

  const campusSlug = (sp.c && ctx.tenants.some((t) => t.slug === sp.c) ? sp.c : null) ?? clicked.tenant?.slug ?? ctx.activeTenant?.slug ?? "";
  const tenant = ctx.tenants.find((t) => t.slug === campusSlug);
  const sort: Sort = SORTS.includes(sp.sort as Sort) ? (sp.sort as Sort) : sp.q ? "relevance" : "new";
  const sellerId = sp.seller && ids.uuid.safeParse(sp.seller).success ? sp.seller : null;

  const list = (sp.saved === "1"
    ? await getSavedListings()
    : sellerId
      ? await getSellerListings(sellerId)
      : await searchListings({
        tenantIds: tenant ? [tenant.id] : ctx.scope, q: sp.q, category: sp.category || undefined,
        sort, reelsOnly: sp.reels === "1", limit: 40,
      }).catch(() => [])) as unknown as ReelItem[];

  let items = list;
  let start = items.findIndex((l) => l.id === id);
  if (start < 0) { items = [clicked, ...items]; start = 0; }

  const listIds = items.map((l) => l.id);
  const [savedIds, commentCounts] = await Promise.all([getSavedIds(listIds), getCommentCounts(listIds)]);

  const keep = new URLSearchParams();
  for (const key of ["c", "q", "category", "sort", "reels", "seller", "saved"] as const) if (sp[key]) keep.set(key, sp[key]!);
  const feed = new URLSearchParams();
  for (const key of ["q", "category", "sort"] as const) if (sp[key]) feed.set(key, sp[key]!);
  const backHref = sp.saved === "1" ? "/account" : sellerId ? `/u/${sellerId}` : `/c/${campusSlug}${feed.size ? `?${feed}` : ""}`;

  const theme = tenant ?? clicked.tenant;
  return (
    <CampusTheme tenant={theme ? { primary_color: theme.primary_color, secondary_color: theme.secondary_color } : null}>
      <ReelViewer items={items} startIndex={start} currentUserId={ctx.user.id} savedIds={savedIds} commentCounts={commentCounts}
        backHref={backHref} inboxHref={`/c/${campusSlug}/matches`} query={keep.toString()} />
    </CampusTheme>
  );
}
