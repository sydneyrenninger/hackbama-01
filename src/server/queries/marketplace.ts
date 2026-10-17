import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ListingFilters = {
  tenantIds: string[]; q?: string; category?: string; kind?: string;
  maxPriceCents?: number; sort?: "new" | "price_asc" | "price_desc"; limit?: number;
};

const LISTING_CARD = `id, title, category, kind, price_cents, condition, status, available_from, available_until,
  semester_moments, created_at, tenant:tenants(id, short_name, primary_color),
  seller:profiles!listings_seller_id_fkey(id, display_name, completed_trades),
  images:listing_images(storage_path, position)`;

export async function searchListings(f: ListingFilters) {
  const supabase = await createClient();
  if (f.tenantIds.length === 0) return [];
  let q = supabase.from("listings").select(LISTING_CARD).eq("status", "active").in("tenant_id", f.tenantIds);
  if (f.q?.trim()) q = q.textSearch("search", f.q.trim().slice(0, 100), { type: "websearch", config: "english" });
  if (f.category) q = q.eq("category", f.category);
  if (f.kind) q = q.eq("kind", f.kind);
  if (f.maxPriceCents != null) q = q.lte("price_cents", f.maxPriceCents);
  q = f.sort === "price_asc" ? q.order("price_cents", { ascending: true, nullsFirst: true })
    : f.sort === "price_desc" ? q.order("price_cents", { ascending: false, nullsFirst: false })
    : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(Math.min(f.limit ?? 40, 100));
  if (error) throw new Error("listings_query_failed");
  return data;
}

export async function getListing(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select(`${LISTING_CARD}, description, pickup_notes, trade_wants_categories, trade_wants_text, seller_id, tenant_id`).eq("id", id).maybeSingle();
  return data;
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
    .select("id, title, description, category, budget_cents, visibility, status, needed_by, created_at, tenant:tenants(id, short_name), requester:profiles!requests_requester_id_fkey(id, display_name)")
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
