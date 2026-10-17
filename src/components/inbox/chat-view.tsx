"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clockTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { markConversationRead, sendMessage } from "@/server/actions/messages";

export type ChatMessage = { id: string; sender_id: string | null; body: string; created_at: string };

/** Message thread with live updates (Supabase Realtime on `messages`; RLS limits it to participants). */
export function ChatView({ conversationId, currentUserId, initialMessages }: {
  conversationId: string; currentUserId: string; initialMessages: ChatMessage[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const add = (m: ChatMessage) => setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
    markConversationRead(conversationId);
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          add(m);
          if (m.sender_id !== currentUserId) markConversationRead(conversationId);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, conversationId, currentUserId]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError(null);
    start(async () => {
      const res = await sendMessage({ conversationId, body: text });
      if (!res.ok) return setError(res.error);
      setBody("");
      // Realtime delivers it too; de-duped by id.
      setMessages((cur) => (cur.some((x) => x.id === res.data!.id) ? cur
        : [...cur, { id: res.data!.id, sender_id: currentUserId, body: text, created_at: new Date().toISOString() }]));
    });
  }

  return (
    <div className="flex min-h-[62vh] flex-col">
      <ol className="flex flex-1 flex-col gap-2.5 pb-6" aria-label="Messages" aria-live="polite">
        {messages.length === 0 && (
          <li className="py-14 text-center text-muted-foreground">
            <span className="block font-serif text-4xl italic text-ink">Say hi.</span>
            Say hi and work out the details.
          </li>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <li key={m.id} className={cn("flex max-w-[80%] animate-fade flex-col gap-0.5 rounded-2xl border-2 border-ink px-4 py-2.5",
              mine ? "self-end rounded-br-md bg-primary text-primary-foreground shadow-brut-sm" : "self-start rounded-bl-md bg-card")}>
              <span className="whitespace-pre-wrap break-words">{m.body}</span>
              <time dateTime={m.created_at} className={cn("self-end font-mono text-[10px]", mine ? "opacity-75" : "text-muted-foreground")}>
                {clockTime(m.created_at)}
              </time>
            </li>
          );
        })}
        <li ref={bottom} aria-hidden className="h-0" />
      </ol>
      <form onSubmit={submit} className="sticky bottom-4 space-y-2 rounded-2xl border-2 border-ink bg-card p-2 shadow-brut">
        {error && <p role="alert" className="px-2 text-sm font-bold text-destructive">{error}</p>}
        <div className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <input id="chat-input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} autoComplete="off" placeholder="Message…"
            className="h-12 min-w-0 flex-1 rounded-xl bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground" />
          <Button type="submit" size="icon" className="h-12 w-12 rounded-xl" disabled={pending || !body.trim()} aria-label="Send">
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </form>
    </div>
  );
}
