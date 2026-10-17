// Mirrors supabase/migrations/*.sql

export type Campus = {
  id: string;
  slug: string;
  name: string;
  email_domain: string;
  logo_url: string | null;
  theme: { primary: string; secondary: string };
  pickup_spots: string[];
  created_at: string;
};

export type Profile = {
  id: string;
  campus_id: string;
  display_name: string;
  avatar_url: string | null;
  major: string | null;
  bio: string | null;
  grad_year: number | null;
  onboarded: boolean;
  created_at: string;
};

export type Community = {
  id: string;
  slug: string;
  name: string;
  campus_id: string | null; // null = cross-campus interest community
};

export type Listing = {
  id: string;
  seller_id: string;
  campus_id: string;
  title: string;
  description: string | null;
  price_cents: number;
  category: string;
  tags: string[];
  media_urls: string[];
  is_reel: boolean;
  status: "active" | "sold";
  created_at: string;
};

export type WantedRequest = {
  id: string;
  buyer_id: string;
  campus_id: string;
  title: string;
  max_price_cents: number | null;
  category: string;
  tags: string[];
  status: "open" | "filled";
  created_at: string;
};

export type Swipe = {
  id: string;
  swiper_id: string;
  listing_id: string | null;
  request_id: string | null;
  direction: "left" | "right";
  created_at: string;
};

export type Match = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  request_id: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
