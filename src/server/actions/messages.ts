"use server";
import { ids, messageInput } from "@/lib/validation";
import { z } from "zod";
import { authed, fail, type ActionResult } from "./_shared";

export async function sendMessage(input: z.input<typeof messageInput>): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  const p = messageInput.safeParse(input);
  if (!p.success) return fail("Messages must be 1 to 4,000 characters.");
  // RLS requires sender_id = auth.uid() AND participant membership.
  const { data, error } = await supabase.from("messages")
    .insert({ conversation_id: p.data.conversationId, sender_id: user.id, body: p.data.body }).select("id").single();
  if (error) return fail(error.code === "42501" ? "You're not part of this conversation." : error);
  return { ok: true, data: { id: data.id } };
}

export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!user) return fail("Sign in to continue.");
  if (!ids.uuid.safeParse(conversationId).success) return fail("Conversation not found.");
  const { error } = await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
  if (error) return fail(error);
  return { ok: true };
}
