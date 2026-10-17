import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";

// POST { listing_id?, request_id?, direction: "left" | "right" }
// Matching happens in the DB trigger `handle_swipe`.
export async function POST(req: Request) {
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { listing_id = null, request_id = null, direction } = await req.json();
  const { error } = await supabase
    .from("swipes")
    .insert({ swiper_id: account.userId, listing_id, request_id, direction });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
