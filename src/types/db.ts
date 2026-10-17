// Mirrors supabase/migrations/*.sql (hand-written; `npm run db:types` can generate full types once linked)

export type Category =
  | "textbooks" | "dorm" | "lab" | "tickets" | "tutoring" | "rides" | "electronics" | "furniture" | "clothing" | "other";
export type SemesterMoment = "move_in" | "semester_start" | "midterms" | "finals" | "move_out" | "anytime";

// A campus is a row in `tenants`; its .edu domains live in `tenant_domains`.
export type Campus = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  status: "active" | "pending" | "suspended";
  primary_color: string;
  secondary_color: string;
  logo_path: string | null;
  banner_path: string | null;
  welcome_text: string | null;
  settings: Record<string, unknown>;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  home_tenant_id: string;
  completed_trades: number;
  major: string | null;
  grad_year: number | null;
  onboarded: boolean;
  created_at: string;
};

export type Listing = {
  id: string;
  tenant_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: Category;
  kind: "sale" | "free" | "trade" | "borrow" | "service";
  price_cents: number | null;
  condition: "new" | "like_new" | "good" | "fair" | "worn" | null;
  status: "active" | "reserved" | "sold" | "removed";
  available_from: string | null;
  available_until: string | null;
  pickup_notes: string | null;
  semester_moments: SemesterMoment[];
  trade_wants_categories: Category[];
  trade_wants_text: string | null;
  created_at: string;
};

export type ListingImage = {
  id: string;
  listing_id: string;
  storage_path: string;
  position: number;
};

// "Wanted" posts
export type WantedRequest = {
  id: string;
  tenant_id: string;
  requester_id: string;
  title: string;
  description: string;
  category: Category;
  budget_cents: number | null;
  visibility: "campus" | "network";
  status: "open" | "fulfilled" | "closed";
  needed_by: string | null;
  created_at: string;
};

// A swipe: pass (left), save, or interest (right → creates an offer to the seller)
export type ListingInteraction = {
  user_id: string;
  listing_id: string;
  action: "pass" | "save" | "interest";
  created_at: string;
};

export type Offer = {
  id: string;
  kind: "listing_interest" | "request_response";
  listing_id: string | null;
  request_id: string | null;
  offerer_id: string;
  recipient_id: string;
  amount_cents: number | null;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  conversation_id: string | null;
  created_at: string;
};

// Opened when an offer (or trade) is accepted; replaces main's old `matches` table
export type Conversation = {
  id: string;
  context: "offer" | "exchange";
  offer_id: string | null;
  exchange_id: string | null;
  listing_id: string | null;
  request_id: string | null;
  created_at: string;
  last_message_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
};
