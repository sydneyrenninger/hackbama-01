"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { browseInput } from "@/lib/validation";
import { authed, fail, type ActionResult } from "./_shared";

/** Changes what the user BROWSES. Never changes memberships or permissions. */
export async function setBrowseScope(input: z.input<typeof browseInput>): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = browseInput.safeParse(input);
  if (!p.success) return fail("Invalid campus selection.");
  const { error } = await supabase.from("user_settings").update({
    browse_scope: p.data.scope,
    browse_tenant_ids: p.data.scope === "custom" ? p.data.tenantIds : [],
    active_tenant_id: p.data.activeTenantId ?? null,
  }).eq("user_id", user.id);
  if (error) return fail(error); // validate_user_settings trigger rejects non-browsable tenants.
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function setActiveCampus(formData: FormData): Promise<void> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const scope = String(formData.get("scope") ?? "network") as "home" | "network";
  await setBrowseScope({ scope, activeTenantId: tenantId || null });
}

const AVATAR_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;

const profileInput = z.object({
  displayName: z.string().trim().min(2, "Display name must be 2 to 40 characters.").max(40, "Display name must be 2 to 40 characters."),
  bio: z.string().trim().max(280, "Keep your bio under 280 characters.").optional(),
  major: z.string().trim().max(80, "Keep your major under 80 characters.").optional(),
  gradYear: z.number().int().min(1950, "Enter a year like 2028.").max(2100, "Enter a year like 2028.").nullable().optional(),
  // Set after the browser uploads to the avatars bucket (see uploadAvatar in lib/media/upload.ts).
  avatarPath: z.string().regex(AVATAR_PATH).nullable().optional(),
});

/** Edits the signed-in user's own profile. Fields left undefined are not touched; "" or null clears. */
export async function updateProfile(input: z.input<typeof profileInput>): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = profileInput.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check your details.");
  const v = p.data;
  if (v.avatarPath && !v.avatarPath.startsWith(`${user.id}/`)) return fail("That photo can't be used.");

  const { error } = await supabase.from("profiles").update({
    display_name: v.displayName,
    ...(v.bio !== undefined && { bio: v.bio || null }),
    ...(v.major !== undefined && { major: v.major || null }),
    ...(v.gradYear !== undefined && { grad_year: v.gradYear }),
    ...(v.avatarPath !== undefined && { avatar_path: v.avatarPath }),
  }).eq("id", user.id);
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return { ok: true };
}
