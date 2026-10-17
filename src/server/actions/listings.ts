"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listingInput, ids } from "@/lib/validation";
import { authed, fail, type ActionResult } from "./_shared";

const ALLOWED_PATH = {
  image: /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/,
  video: /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|webm|mov)$/,
};

export async function createListing(input: z.input<typeof listingInput>): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = listingInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.", p.error.issues[0]?.path.join("."));
  const v = p.data;

  let tenantId = v.tenantId;
  if (!tenantId) {
    const { data } = await supabase.from("profiles").select("home_tenant_id").eq("id", user.id).single();
    tenantId = data?.home_tenant_id;
  }
  // RLS (can_post_in) decides whether this tenant accepts the post; tenantId is not trusted.
  const { data, error } = await supabase.from("listings").insert({
    tenant_id: tenantId, seller_id: user.id, title: v.title, description: v.description, category: v.category,
    kind: v.kind, price_cents: v.kind === "sale" || v.kind === "service" ? v.priceCents ?? null : null,
    condition: v.condition ?? null, available_from: v.availableFrom ?? null, available_until: v.availableUntil ?? null,
    pickup_notes: v.pickupNotes ?? null, semester_moments: v.semesterMoments,
    trade_wants_categories: v.kind === "trade" ? v.tradeWantsCategories : [],
    trade_wants_text: v.kind === "trade" ? v.tradeWantsText ?? null : null,
    tags: v.tags, is_reel: v.isReel,
  }).select("id").single();
  if (error) return fail(error.code === "42501" ? "You can't post on this campus yet." : error);
  revalidatePath("/app");
  return { ok: true, data: { id: data.id } };
}

export async function updateListingStatus(listingId: string, status: "active" | "sold" | "removed"): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(listingId).success) return fail("Listing not found.");
  const { data, error } = await supabase.from("listings").update({ status }).eq("id", listingId).eq("seller_id", user.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("Listing not found.");
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Browser uploads to storage (policy limits to own folder), then registers the path here.
 * Images go in the listing-images bucket, videos (reels) in listing-videos. See lib/media/upload.ts.
 */
export async function attachListingMedia(
  listingId: string, storagePath: string, position: number, mediaType: "image" | "video" = "image",
): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const pattern = ALLOWED_PATH[mediaType];
  if (!pattern || !ids.uuid.safeParse(listingId).success || !pattern.test(storagePath) || !storagePath.startsWith(`${user.id}/`)) {
    return fail(`That ${mediaType === "video" ? "video" : "image"} can't be attached.`);
  }
  if (!Number.isInteger(position) || position < 0 || position > 7) return fail("Up to 8 photos or videos per listing.");
  const { error } = await supabase.from("listing_images")
    .insert({ listing_id: listingId, storage_path: storagePath, position, media_type: mediaType });
  if (error) return fail(error);
  revalidatePath("/app");
  return { ok: true };
}

export async function attachListingImage(listingId: string, storagePath: string, position: number): Promise<ActionResult> {
  return attachListingMedia(listingId, storagePath, position, "image");
}
