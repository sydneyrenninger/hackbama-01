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
