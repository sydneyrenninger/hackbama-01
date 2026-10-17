import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChatView, type ChatMessage } from "@/components/inbox/chat-view";
import { Avatar } from "@/components/shell/avatar";
import { ids } from "@/lib/validation";
import { getAppContext } from "@/server/queries/context";
import { getConversationMessages, getConversations } from "@/server/queries/marketplace";

type Conversation = { conversation_id: string; listing_title: string | null; participants: { id: string; display_name: string }[] };

// One private conversation. RLS only returns it to its participants; anyone else gets a 404.
export default async function ChatPage({ params }: { params: Promise<{ campus: string; id: string }> }) {
  const { campus: slug, id } = await params;
  if (!ids.uuid.safeParse(id).success) notFound();
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");

  const conversations = (await getConversations()) as Conversation[];
  const conv = conversations.find((c) => c.conversation_id === id);
  if (!conv) notFound();
  const messages = (await getConversationMessages(id)) as ChatMessage[];
  const other = conv.participants[0];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/c/${slug}/matches`} aria-label="Back to inbox" className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <Avatar name={other?.display_name} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">
            {other
              ? <Link href={`/u/${other.id}`} className="hover:underline">{conv.participants.map((p) => p.display_name).join(", ")}</Link>
              : "Conversation"}
          </p>
          {conv.listing_title && <p className="truncate text-sm text-muted-foreground">About: {conv.listing_title}</p>}
        </div>
      </div>
      <ChatView conversationId={id} currentUserId={ctx.user.id} initialMessages={messages} />
    </div>
  );
}
