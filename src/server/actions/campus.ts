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

export async function updateProfile(input: { displayName: string; bio?: string }): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = z.object({ displayName: z.string().trim().min(2).max(40), bio: z.string().trim().max(280).optional() }).safeParse(input);
  if (!p.success) return fail("Display name must be 2 to 40 characters.");
  const { error } = await supabase.from("profiles").update({ display_name: p.data.displayName, bio: p.data.bio ?? null }).eq("id", user.id);
  if (error) return fail(error);
  revalidatePath("/app", "layout");
  return { ok: true };
}
