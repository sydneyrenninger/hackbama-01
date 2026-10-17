import Link from "next/link";
import { redirect } from "next/navigation";
import { IncomingOfferActions, WithdrawOfferButton } from "@/components/inbox/offer-actions";
import { Avatar } from "@/components/shell/avatar";
import { Empty } from "@/components/shell/empty";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
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
  const unread = chats.reduce((n, c) => n + c.unread_count, 0);

  return (
    <div className="space-y-10">
      <PageHeader kicker="Inbox" title="Deals" accent="in motion.">
        {toReview.length + unread > 0
          ? <><span className="hl font-bold text-ink">{toReview.length} offer{toReview.length === 1 ? "" : "s"}</span> to review and <span className="hl font-bold text-ink">{unread} unread</span>.</>
          : "You're all caught up."}
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <section aria-labelledby="chats-h" className="space-y-4">
          <SectionTitle id="chats-h">Messages</SectionTitle>
          {chats.length === 0 ? (
            <Empty mark="✉">No conversations yet. A chat opens once someone accepts an offer.</Empty>
          ) : (
            <ul className="overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-brut">
              {chats.map((c, i) => {
                const name = c.participants.map((p) => p.display_name).join(", ") || "Conversation";
                const hot = c.unread_count > 0;
                return (
                  <li key={c.conversation_id} className={cn(i > 0 && "border-t-2 border-ink/10")}>
                    <Link href={`/c/${slug}/matches/${c.conversation_id}`}
                      className={cn("group flex items-center gap-3.5 p-4 transition-colors hover:bg-paper-deep/60", hot && "bg-secondary/60")}>
                      <span className="relative">
                        <Avatar name={c.participants[0]?.display_name} />
                        {hot && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn("truncate font-display tracking-[-0.01em]", hot ? "font-extrabold" : "font-bold")}>{name}</span>
                          <time className="eyebrow shrink-0 text-[9px] text-muted-foreground">{timeAgo(c.last_message_at)}</time>
                        </span>
                        {c.listing_title && <span className="eyebrow mt-0.5 block truncate text-[9px] text-primary">Re: {c.listing_title}</span>}
                        <span className={cn("mt-0.5 block truncate text-sm", hot ? "font-bold text-ink" : "text-muted-foreground")}>
                          {c.last_message ?? "No messages yet"}
                        </span>
                      </span>
                      {hot && (
                        <span className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink bg-pop px-1.5 font-mono text-[11px] font-bold">
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

        <div className="order-first space-y-10 lg:order-last">
          {toReview.length > 0 && (
            <section aria-labelledby="review-h" className="space-y-4">
              <SectionTitle id="review-h">Offers to review <span className="sticker ml-1 -rotate-3 text-sm">{toReview.length}</span></SectionTitle>
              <div className="space-y-4">
                {toReview.map((o, i) => (
                  <article key={o.id} style={{ "--i": i } as React.CSSProperties}
                    className="rise relative overflow-hidden rounded-2xl border-2 border-ink bg-card p-4 pl-6 shadow-brut">
                    <span aria-hidden className="absolute inset-y-0 left-0 w-2 bg-primary" />
                    <div className="flex items-start gap-3">
                      <Avatar name={o.offerer?.display_name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold leading-snug tracking-[-0.01em]">{offerLine(o, false)}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          {o.offerer && <Link href={`/u/${o.offerer.id}`} className="font-bold underline decoration-2 underline-offset-2 hover:text-ink">View profile</Link>}
                          <span>{timeAgo(o.created_at)}</span>
                          {money(o.amount_cents) && <span className="sticker text-xs">{money(o.amount_cents)}</span>}
                        </p>
                      </div>
                    </div>
                    {o.message && <p className="mt-3 rounded-xl rounded-tl-sm bg-paper-deep p-3 text-sm italic">&ldquo;{o.message}&rdquo;</p>}
                    <div className="mt-4"><IncomingOfferActions offerId={o.id} campusSlug={slug} /></div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {waiting.length > 0 && (
            <section aria-labelledby="waiting-h" className="space-y-4">
              <SectionTitle id="waiting-h">Waiting for a reply</SectionTitle>
              <ul className="space-y-3">
                {waiting.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-ink/40 bg-card/50 p-4">
                    <div className="min-w-0">
                      <p className="font-bold leading-snug">{offerLine(o, true)}</p>
                      <p className="eyebrow mt-1 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />Sent {timeAgo(o.created_at)}
                      </p>
                    </div>
                    <WithdrawOfferButton offerId={o.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
