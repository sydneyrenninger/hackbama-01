"use server";
import { ids } from "@/lib/validation";
import { getComments, type ListingComment } from "@/server/queries/marketplace";
import { authed, fail, type ActionResult } from "./_shared";

/** Loads a listing's comments (for the comment sheet in the reel viewer). */
export async function listComments(listingId: string): Promise<ActionResult<ListingComment[]>> {
  const { user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(listingId).success) return fail("Listing not found.");
  return { ok: true, data: await getComments(listingId) };
}

/** Posts a comment. RLS: you can only comment as yourself on listings you can see; rate limited in SQL. */
export async function addComment(listingId: string, body: string): Promise<ActionResult<ListingComment>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(listingId).success) return fail("Listing not found.");
  const text = body.trim();
  if (text.length < 1 || text.length > 500) return fail("Comments must be 1 to 500 characters.");
  const { data, error } = await supabase.from("listing_comments")
    .insert({ listing_id: listingId, author_id: user.id, body: text })
    .select("id, body, created_at, author:profiles(id, display_name, avatar_path)").single();
  if (error) return fail(error.code === "42501" ? "You can't comment on this listing." : error);
  return { ok: true, data: data as unknown as ListingComment };
}

/** Deletes a comment (your own, or any comment on your listing). */
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(commentId).success) return fail("Comment not found.");
  const { data, error } = await supabase.from("listing_comments").delete().eq("id", commentId).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail("You can't delete that comment.");
  return { ok: true };
}
