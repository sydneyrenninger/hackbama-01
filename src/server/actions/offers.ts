"use server";
import { revalidatePath } from "next/cache";
import { ids, swipeInput } from "@/lib/validation";
import { z } from "zod";
import { authed, fail, type ActionResult } from "./_shared";

export async function swipe(input: z.input<typeof swipeInput>): Promise<ActionResult<{ offerId: string | null }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = swipeInput.safeParse(input);
  if (!p.success) return fail("Invalid action.");
  const { data, error } = await supabase.rpc("swipe", {
    p_listing_id: p.data.listingId, p_action: p.data.action, p_message: p.data.message ?? null,
  });
  if (error) return fail(error);
  return { ok: true, data: { offerId: (data as { offer_id: string | null })?.offer_id ?? null } };
}

/** Like or unlike a listing (the heart in the reel viewer). */
export async function setLiked(listingId: string, liked: boolean): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(listingId).success) return fail("Listing not found.");
  const { error } = liked
    ? await supabase.from("listing_likes").upsert({ user_id: user.id, listing_id: listingId }, { onConflict: "user_id,listing_id", ignoreDuplicates: true })
    : await supabase.from("listing_likes").delete().eq("user_id", user.id).eq("listing_id", listingId);
  if (error) return fail(error);
  return { ok: true };
}

/** Save or unsave a listing (the bookmark in the reel viewer). */
export async function setSaved(listingId: string, saved: boolean): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(listingId).success) return fail("Listing not found.");
  if (saved) {
    const { error } = await supabase.rpc("swipe", { p_listing_id: listingId, p_action: "save", p_message: null });
    if (error) return fail(error);
  } else {
    // RLS lets users clear their own interactions.
    const { error } = await supabase.from("listing_interactions").delete()
      .eq("user_id", user.id).eq("listing_id", listingId).eq("action", "save");
    if (error) return fail(error);
  }
  revalidatePath("/account");
  return { ok: true };
}

export async function respondToOffer(offerId: string, accept: boolean): Promise<ActionResult<{ conversationId?: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(offerId).success) return fail("Offer not found.");
  const { data, error } = await supabase.rpc("respond_to_offer", { p_offer_id: offerId, p_accept: accept });
  if (error) return fail(error);
  revalidatePath("/app");
  return { ok: true, data: { conversationId: (data as { conversation_id?: string })?.conversation_id } };
}

export async function withdrawOffer(offerId: string): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(offerId).success) return fail("Offer not found.");
  const { error } = await supabase.rpc("withdraw_offer", { p_offer_id: offerId });
  if (error) return fail(error);
  return { ok: true };
}
