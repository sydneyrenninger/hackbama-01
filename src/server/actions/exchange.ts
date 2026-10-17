"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ids } from "@/lib/validation";
import { authed, fail, type ActionResult } from "./_shared";

export async function proposeExchange(listingIds: string[]): Promise<ActionResult<{ proposalId: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!z.array(ids.uuid).min(2).max(3).safeParse(listingIds).success) return fail("Trades need 2 or 3 listings.");
  const { data, error } = await supabase.rpc("propose_exchange", { p_listing_ids: listingIds });
  if (error) return fail(error);
  revalidatePath("/app");
  return { ok: true, data: { proposalId: data as string } };
}

export async function respondExchange(proposalId: string, accept: boolean): Promise<ActionResult<{ status: string; conversationId?: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(proposalId).success) return fail("Trade not found.");
  const { data, error } = await supabase.rpc("respond_exchange", { p_proposal_id: proposalId, p_accept: accept });
  if (error) return fail(error);
  revalidatePath("/app");
  const d = data as { status: string; conversation_id?: string };
  return { ok: true, data: { status: d.status, conversationId: d.conversation_id } };
}

export async function confirmHandoff(proposalId: string): Promise<ActionResult<{ status: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(proposalId).success) return fail("Trade not found.");
  const { data, error } = await supabase.rpc("confirm_exchange_handoff", { p_proposal_id: proposalId });
  if (error) return fail(error);
  revalidatePath("/app");
  return { ok: true, data: { status: (data as { status: string }).status } };
}
