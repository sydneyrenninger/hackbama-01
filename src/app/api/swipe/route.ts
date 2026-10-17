import { NextResponse } from "next/server";
import { getAccount } from "@/lib/auth";
import { friendlyDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

// POST { listing_id?, request_id?, direction: "left" | "right" | "save", message? }
// Buyer swiping a listing:  right → offer to seller (SQL swipe 'interest'), left → pass, save → saved.
// Seller swiping a request: right → respond with listing_id as the offered item (SQL respond_to_request).
// The seller accepting an offer (respondToOffer) opens the conversation.
export async function POST(req: Request) {
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { listing_id = null, request_id = null, direction, message = null } = await req.json();

  if (request_id) {
    if (direction !== "right") return NextResponse.json({ ok: true }); // passing on a request isn't stored
    const { data, error } = await supabase.rpc("respond_to_request", {
      p_request_id: request_id, p_listing_id: listing_id, p_message: message,
    });
    if (error) return NextResponse.json({ error: friendlyDbError(error) }, { status: 400 });
    return NextResponse.json({ ok: true, offer_id: data });
  }

  const action = direction === "right" ? "interest" : direction === "save" ? "save" : "pass";
  const { data, error } = await supabase.rpc("swipe", { p_listing_id: listing_id, p_action: action, p_message: message });
  if (error) return NextResponse.json({ error: friendlyDbError(error) }, { status: 400 });
  return NextResponse.json({ ok: true, offer_id: (data as { offer_id: string | null })?.offer_id ?? null });
}
