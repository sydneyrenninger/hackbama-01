"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ids, requestInput } from "@/lib/validation";
import { authed, fail, type ActionResult } from "./_shared";

export async function createRequest(input: z.input<typeof requestInput>): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = requestInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.", p.error.issues[0]?.path.join("."));
  let tenantId = p.data.tenantId;
  if (!tenantId) {
    const { data } = await supabase.from("profiles").select("home_tenant_id").eq("id", user.id).single();
    tenantId = data?.home_tenant_id;
  }
  const { data, error } = await supabase.from("requests").insert({
    tenant_id: tenantId, requester_id: user.id, title: p.data.title, description: p.data.description,
    category: p.data.category, budget_cents: p.data.budgetCents ?? null, visibility: p.data.visibility,
    needed_by: p.data.neededBy ?? null,
  }).select("id").single();
  if (error) return fail(error.code === "42501" ? "You can't post on this campus yet." : error);
  revalidatePath("/app");
  return { ok: true, data: { id: data.id } };
}

export async function setRequestStatus(requestId: string, status: "open" | "fulfilled" | "closed"): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(requestId).success) return fail("Request not found.");
  const { data, error } = await supabase.from("requests").update({ status }).eq("id", requestId).eq("requester_id", user.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("Request not found.");
  return { ok: true };
}

const respondInput = z.object({
  requestId: ids.uuid, listingId: ids.uuid.nullable().optional(),
  amountCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  message: z.string().trim().max(1000).optional(),
});

export async function respondToRequest(input: z.input<typeof respondInput>): Promise<ActionResult<{ offerId: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = respondInput.safeParse(input);
  if (!p.success) return fail("Check your offer.");
  const { data, error } = await supabase.rpc("respond_to_request", {
    p_request_id: p.data.requestId, p_listing_id: p.data.listingId ?? null,
    p_amount_cents: p.data.amountCents ?? null, p_message: p.data.message ?? null,
  });
  if (error) return fail(error);
  return { ok: true, data: { offerId: data as string } };
}
