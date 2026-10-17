"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { channelInput } from "@/lib/validation";
import { authed, fail, type ActionResult } from "./_shared";

/** Creates a request channel ("+ Request Channel"). Slug, uniqueness and rate limit are enforced in SQL. */
export async function createChannel(input: z.input<typeof channelInput>): Promise<ActionResult<{ id: string; slug: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = channelInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the channel name.", p.error.issues[0]?.path.join("."));
  const { data, error } = await supabase.rpc("create_channel", { p_name: p.data.name, p_description: p.data.description });
  if (error) return fail(error);
  const row = data as { id: string; slug: string };
  revalidatePath("/c", "layout");
  return { ok: true, data: { id: row.id, slug: row.slug } };
}
