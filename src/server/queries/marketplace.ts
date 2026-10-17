import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseSearch } from "@/lib/validation";

export type ListingFilters = {
  tenantIds: string[];
  q?: string;            // free text; "#tag" tokens become tag filters
  tags?: string[];
  category?: string; kind?: string; maxPriceCents?: number;
  reelsOnly?: boolean;
  sort?: "relevance" | "new" | "price_asc" | "price_desc";
  limit?: number;
};

const LISTING_CARD = `id, title, description, category, kind, price_cents, condition, status, available_from, available_until,
  semester_moments, tags, is_reel, pickup_notes, trade_wants_categories, trade_wants_text, created_at, seller_id, tenant_id,
  tenant:tenants(id, slug, short_name, primary_color, secondary_color),
  seller:profiles!listings_seller_id_fkey(id, display_name, avatar_path, completed_trades),
  images:listing_images(storage_path, position, media_type)`;

async function cardsInOrder(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("listings").select(LISTING_CARD).in("id", ids);
  if (error) throw new Error("listings_query_failed");
  const byId = new Map((data ?? []).map((l) => [l.id, l]));
  return ids.map((id) => byId.get(id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
}

/** Buyer feed + search results (also the swipe deck for a search). Ranked by relevance when there's text. */
export async function searchListings(f: ListingFilters) {
  const supabase = await createClient();
  if (f.tenantIds.length === 0) return [];
  const { text, tags } = parseSearch(f.q ?? "");
  const { data, error } = await supabase.rpc("search_listing_ids", {
    p_tenant_ids: f.tenantIds,
    p_query: text || null,
    p_tags: [...tags, ...(f.tags ?? [])],
    p_category: f.category ?? null,
    p_kind: f.kind ?? null,
    p_max_price: f.maxPriceCents ?? null,
    p_reels_only: f.reelsOnly ?? false,
    p_sort: f.sort ?? (text ? "relevance" : "new"),
    p_limit: Math.min(f.limit ?? 40, 100),
  });
  if (error) throw new Error("listings_query_failed");
  return cardsInOrder(supabase, ((data ?? []) as { id: string }[]).map((r) => r.id));
}

/** Reels feed: newest listings flagged is_reel. */
export async function getReels(tenantIds: string[], limit = 20) {
  return searchListings({ tenantIds, reelsOnly: true, sort: "new", limit });
}

/** Listings the user swiped "save" on, newest first. */
export async function getSavedListings(limit = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("listing_interactions").select("listing_id")
    .eq("user_id", user.id).eq("action", "save").order("updated_at", { ascending: false }).limit(limit);
  return cardsInOrder(supabase, (data ?? []).map((r) => r.listing_id));
}

/** Seller tab: my listings (all statuses except removed). */
export async function getMyListings() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("listings").select(LISTING_CARD)
    .eq("seller_id", user.id).neq("status", "removed").order("created_at", { ascending: false }).limit(100);
  return data ?? [];
}

/** My wanted requests. */
export async function getMyRequests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("requests")
    .select("id, title, description, category, tags, budget_cents, visibility, status, needed_by, created_at, channel:request_channels(id, slug, name)")
    .eq("requester_id", user.id).order("created_at", { ascending: false }).limit(100);
  return data ?? [];
}

/** Public profile (/u/[id]): profile, home campus, and their active listings. */
export async function getPublicProfile(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles")
    .select("id, display_name, avatar_path, bio, major, grad_year, completed_trades, created_at, campus:tenants!profiles_home_tenant_id_fkey(id, slug, name, short_name, primary_color)")
    .eq("id", userId).maybeSingle();
  if (!profile) return null;
  const { data: listings } = await supabase.from("listings").select(LISTING_CARD)
    .eq("seller_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(50);
  return { profile, listings: listings ?? [] };
}

/** Tag chips for the search bar. */
export async function getPopularTags(limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("popular_tags", { p_limit: limit });
  return (data ?? []) as { tag: string; uses: number }[];
}

// ---- Request channels ------------------------------------------------

/** Browse/search channels, busiest first. */
export async function getChannels(query?: string, limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_channels", { p_query: query ?? null, p_limit: limit });
  return (data ?? []) as { id: string; slug: string; name: string; description: string; open_requests: number; created_at: string }[];
}

/** One channel and its open requests (campus/network visibility still applies). */
export async function getChannel(slug: string) {
  const supabase = await createClient();
  const { data: channel } = await supabase.from("request_channels")
    .select("id, slug, name, description, created_at, creator:profiles(id, display_name)").eq("slug", slug).maybeSingle();
  if (!channel) return null;
  const { data: requests } = await supabase.from("requests")
    .select("id, title, description, category, tags, budget_cents, visibility, needed_by, created_at, tenant:tenants(id, short_name), requester:profiles!requests_requester_id_fkey(id, display_name)")
    .eq("channel_id", channel.id).eq("status", "open").order("created_at", { ascending: false }).limit(50);
  return { channel, requests: requests ?? [] };
}

export async function getListing(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(LISTING_CARD).eq("id", id).maybeSingle();
  return data;
}

/** A seller's active listings, newest first (the reel viewer's "from this profile" context). */
export async function getSellerListings(sellerId: string, limit = 40) {
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(LISTING_CARD)
    .eq("seller_id", sellerId).eq("status", "active").order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}

/** Which of these listings the current user has saved. */
export async function getSavedIds(listingIds: string[]): Promise<string[]> {
  if (listingIds.length === 0) return [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("listing_interactions").select("listing_id")
    .eq("user_id", user.id).eq("action", "save").in("listing_id", listingIds);
  return (data ?? []).map((r) => r.listing_id as string);
}

/** Comment counts per listing (listings you can't see count as 0). */
export async function getCommentCounts(listingIds: string[]): Promise<Record<string, number>> {
  if (listingIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.rpc("comment_counts", { p_listing_ids: listingIds });
  return Object.fromEntries(((data ?? []) as { listing_id: string; comments: number }[]).map((r) => [r.listing_id, Number(r.comments)]));
}

/** Like counts and whether the current user liked each listing. */
export async function getLikeState(listingIds: string[]): Promise<{ counts: Record<string, number>; liked: string[] }> {
  if (listingIds.length === 0) return { counts: {}, liked: [] };
  const supabase = await createClient();
  const { data } = await supabase.rpc("like_state", { p_listing_ids: listingIds });
  const rows = (data ?? []) as { listing_id: string; likes: number; liked: boolean }[];
  return { counts: Object.fromEntries(rows.map((r) => [r.listing_id, Number(r.likes)])), liked: rows.filter((r) => r.liked).map((r) => r.listing_id) };
}

export type ListingComment = {
  id: string; body: string; created_at: string;
  author: { id: string; display_name: string; avatar_path: string | null } | null;
};

/** A listing's comments, oldest first. */
export async function getComments(listingId: string, limit = 100): Promise<ListingComment[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("listing_comments")
    .select("id, body, created_at, author:profiles(id, display_name, avatar_path)")
    .eq("listing_id", listingId).order("created_at", { ascending: true }).limit(limit);
  return (data ?? []) as unknown as ListingComment[];
}

export async function getDeck(limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discovery_deck", { p_limit: limit });
  if (error) throw new Error("deck_query_failed");
  return data ?? [];
}

export async function getRequests(tenantIds: string[]) {
  const supabase = await createClient();
  const { data } = await supabase.from("requests")
    .select("id, title, description, category, tags, budget_cents, visibility, status, needed_by, created_at, channel:request_channels(id, slug, name), tenant:tenants(id, short_name), requester:profiles!requests_requester_id_fkey(id, display_name)")
    .in("tenant_id", tenantIds).eq("status", "open").order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}

export async function getMyOffers() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { incoming: [], outgoing: [] };
  const sel = "id, kind, status, amount_cents, message, created_at, conversation_id, listing:listings(id, title), request:requests(id, title), offerer:profiles!offers_offerer_id_fkey(id, display_name), recipient:profiles!offers_recipient_id_fkey(id, display_name)";
  const [incoming, outgoing] = await Promise.all([
    supabase.from("offers").select(sel).eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("offers").select(sel).eq("offerer_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  return { incoming: incoming.data ?? [], outgoing: outgoing.data ?? [] };
}

export async function getConversations() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_conversations");
  return data ?? [];
}

export async function getConversationMessages(conversationId: string, limit = 100) {
  const supabase = await createClient();
  // RLS returns nothing unless the caller is a participant.
  const { data } = await supabase.from("messages").select("id, sender_id, body, created_at")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).reverse();
}

export async function getTradeMatches() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("find_trade_matches", { p_limit: 10 });
  return data ?? [];
}

export async function getMyExchanges() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_exchanges");
  return data ?? [];
}

export async function getRequestMatches(requestId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("matches_for_request", { p_request_id: requestId, p_limit: 10 });
  return data ?? [];
}

export async function getRequestsForMyListings() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("requests_for_my_listings", { p_limit: 20 });
  return data ?? [];
}
