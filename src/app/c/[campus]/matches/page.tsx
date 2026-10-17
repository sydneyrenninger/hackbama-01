import Link from "next/link";
import { redirect } from "next/navigation";
import { IncomingOfferActions, WithdrawOfferButton } from "@/components/inbox/offer-actions";
import { Avatar } from "@/components/shell/avatar";
import { timeAgo } from "@/lib/format";
import { cn, formatPrice } from "@/lib/utils";
import { getAppContext } from "@/server/queries/context";
import { getConversations, getMyOffers } from "@/server/queries/marketplace";

type Offer = {
  id: string; kind: "listing_interest" | "request_response"; status: string; amount_cents: number | null;
  message: string | null; created_at: string;
  listing: { id: string; title: string } | null;
  request: { id: string; title: string } | null;
  offerer: { id: string; display_name: string } | null;
  recipient: { id: string; display_name: string } | null;
};
type Conversation = {
  conversation_id: string; listing_title: string | null; participants: { id: string; display_name: string }[];
  last_message: string | null; last_message_at: string; unread_count: number;
};

const money = (cents: number | null) => (cents == null ? "" : formatPrice(cents, "sale"));

function offerLine(o: Offer, mine: boolean) {
  const who = mine ? o.recipient?.display_name ?? "the seller" : o.offerer?.display_name ?? "Someone";
  if (o.kind === "listing_interest") {
    return mine
      ? `You offered ${money(o.amount_cents) || "interest"} on ${o.listing?.title ?? "a listing"}`
      : `${who} is interested in ${o.listing?.title ?? "your listing"}`;
  }
  const offering = o.listing?.title ? ` (offering ${o.listing.title})` : "";
  return mine
    ? `You offered to help with ${o.request?.title ?? "a request"}${offering}`
    : `${who} can help with ${o.request?.title ?? "your request"}${offering}`;
}

// Inbox tab: offers waiting for you, conversations, and offers you're waiting on.
export default async function InboxPage({ params }: { params: Promise<{ campus: string }> }) {
  const { campus: slug } = await params;
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");

  const [{ incoming, outgoing }, conversations] = await Promise.all([getMyOffers(), getConversations()]);
  const toReview = (incoming as unknown as Offer[]).filter((o) => o.status === "pending");
  const waiting = (outgoing as unknown as Offer[]).filter((o) => o.status === "pending");
  const chats = conversations as Conversation[];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold">Inbox</h1>

      {toReview.length > 0 && (
        <section aria-labelledby="review-h" className="space-y-3">
          <h2 id="review-h" className="font-display text-xl font-bold">
            Offers to review <span className="text-muted-foreground">({toReview.length})</span>
          </h2>
          {toReview.map((o) => (
            <article key={o.id} className="rounded-lg border-2 border-primary/40 bg-card p-4">
              <div className="flex items-start gap-3">
                <Avatar name={o.offerer?.display_name} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{offerLine(o, false)}</p>
                  <p className="text-sm text-muted-foreground">
                    {o.offerer && <Link href={`/u/${o.offerer.id}`} className="hover:underline">View profile</Link>} · {timeAgo(o.created_at)}
                    {money(o.amount_cents) && <> · {money(o.amount_cents)}</>}
                  </p>
                  {o.message && <p className="mt-2 rounded-md bg-muted p-3 text-sm">&ldquo;{o.message}&rdquo;</p>}
                </div>
              </div>
              <div className="mt-3"><IncomingOfferActions offerId={o.id} campusSlug={slug} /></div>
            </article>
          ))}
        </section>
      )}

      <section aria-labelledby="chats-h" className="space-y-3">
        <h2 id="chats-h" className="font-display text-xl font-bold">Messages</h2>
        {chats.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            No conversations yet. A chat opens once someone accepts an offer.
          </p>
        ) : (
          <ul className="space-y-2">
            {chats.map((c) => {
              const name = c.participants.map((p) => p.display_name).join(", ") || "Conversation";
              return (
                <li key={c.conversation_id}>
                  <Link href={`/c/${slug}/matches/${c.conversation_id}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted">
                    <Avatar name={c.participants[0]?.display_name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate", c.unread_count > 0 ? "font-bold" : "font-semibold")}>{name}</span>
                        <time className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</time>
                      </span>
                      {c.listing_title && <span className="block truncate text-xs text-muted-foreground">{c.listing_title}</span>}
                      <span className={cn("block truncate text-sm", c.unread_count > 0 ? "text-foreground" : "text-muted-foreground")}>
                        {c.last_message ?? "No messages yet"}
                      </span>
                    </span>
                    {c.unread_count > 0 && (
                      <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                        <span className="sr-only">{c.unread_count} unread</span>{c.unread_count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="waiting-h" className="space-y-3">
          <h2 id="waiting-h" className="font-display text-xl font-bold">Waiting for a reply</h2>
          {waiting.map((o) => (
            <article key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div>
                <p className="font-semibold">{offerLine(o, true)}</p>
                <p className="text-sm text-muted-foreground">Sent {timeAgo(o.created_at)}</p>
              </div>
              <WithdrawOfferButton offerId={o.id} />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
