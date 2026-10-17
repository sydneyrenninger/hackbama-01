"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Send, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/shell/avatar";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { cn, formatPrice } from "@/lib/utils";
import { addComment, deleteComment, listComments } from "@/server/actions/comments";
import { swipe } from "@/server/actions/offers";
import type { ListingComment } from "@/server/queries/marketplace";

export type ReelItem = {
  id: string; title: string; description: string; kind: string; category: string; condition: string | null; status: string;
  price_cents: number | null; tags: string[]; is_reel: boolean; pickup_notes: string | null;
  trade_wants_categories: string[]; trade_wants_text: string | null; seller_id: string; created_at: string;
  tenant: { slug: string; short_name: string } | null;
  seller: { id: string; display_name: string; avatar_path: string | null; completed_trades: number } | null;
  images: { storage_path: string; position: number; media_type?: "image" | "video" }[] | null;
};

const CONDITION: Record<string, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", worn: "Worn" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const BUY_LABEL: Record<string, string> = { sale: "Buy", free: "Get it", trade: "Trade", borrow: "Borrow", service: "Book" };

/** Pre-filled first message for an offer (editable). */
export function defaultBuyMessage(item: ReelItem): string {
  const t = `“${item.title}”`;
  switch (item.kind) {
    case "free": return `Hi! Is ${t} still available? I'd love to take it.`;
    case "trade": return `Hi! I'm interested in trading for ${t}. Here's what I could offer: `;
    case "borrow": return `Hi! Could I borrow ${t}? I'm thinking from ___ to ___.`;
    case "service": return `Hi! I'm interested in ${t}. When are you available?`;
    default: return `Hi! Is ${t} still available? I'd like to buy it for ${formatPrice(item.price_cents, item.kind) || "your asking price"}.`;
  }
}

/** Bottom sheet used by the viewer's View / Buy / Comments panels. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] flex items-end justify-center">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-[2px]" />
      <div className="relative flex max-h-[85dvh] w-full max-w-[480px] animate-sheet flex-col rounded-t-[1.75rem] border-2 border-b-0 border-ink bg-paper text-foreground shadow-2xl">
        <span aria-hidden className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-ink/20" />
        <div className="flex items-center justify-between border-b-2 border-ink px-5 pb-3 pt-2">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.03em]">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-card shadow-brut-sm transition-transform hover:rotate-90">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/** "View": everything about the listing. */
export function ViewPanel({ item }: { item: ReelItem }) {
  const price = formatPrice(item.price_cents, item.kind);
  return (
    <div className="space-y-5">
      <div>
        {price && <p className="sticker -rotate-2 text-2xl">{price}</p>}
        <h3 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-[-0.03em]">{item.title}</h3>
        <p className="eyebrow mt-2 text-[10px] text-muted-foreground">
          {[cap(item.category), item.condition ? CONDITION[item.condition] : null, item.tenant?.short_name, `posted ${timeAgo(item.created_at)}`]
            .filter(Boolean).join(" · ")}
        </p>
      </div>
      {item.status === "sold" && <p className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive">This item has been sold.</p>}
      {item.description && <p className="whitespace-pre-line leading-relaxed">{item.description}</p>}
      {item.kind === "trade" && (item.trade_wants_categories.length > 0 || item.trade_wants_text) && (
        <p className="rounded-xl border-2 border-dashed border-ink/30 p-3 text-sm"><span className="eyebrow mr-1 text-[10px]">Wants in trade</span>{" "}
          {[item.trade_wants_categories.map(cap).join(", "), item.trade_wants_text].filter(Boolean).join(" · ")}</p>
      )}
      {item.pickup_notes && <p className="text-sm"><span className="eyebrow mr-1 text-[10px]">Pickup</span> {item.pickup_notes}</p>}
      {item.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">{item.tags.map((t) => <li key={t} className="rounded-full border-2 border-ink/15 bg-card px-2.5 py-0.5 font-mono text-xs font-bold">#{t}</li>)}</ul>
      )}
      {item.seller && (
        <Link href={`/u/${item.seller.id}`} className="lift flex items-center gap-3 rounded-2xl border-2 border-ink bg-card p-3 shadow-brut-sm">
          <Avatar name={item.seller.display_name} path={item.seller.avatar_path} />
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold">{item.seller.display_name}</span>
            <span className="block text-sm text-muted-foreground">{item.seller.completed_trades} completed trade{item.seller.completed_trades === 1 ? "" : "s"} · View profile</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** "Buy": send the seller an offer with a pre-filled message. Accepting it opens a chat. */
export function BuyPanel({ item, inboxHref }: { item: ReelItem; inboxHref: string }) {
  const [message, setMessage] = useState(() => defaultBuyMessage(item));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const price = formatPrice(item.price_cents, item.kind);

  if (sent) {
    return (
      <div className="space-y-4 py-4 text-center">
        <span aria-hidden className="mx-auto grid h-16 w-16 animate-pop place-items-center rounded-full border-2 border-ink bg-pop text-3xl shadow-brut">✓</span>
        <p role="status" className="font-display text-2xl font-extrabold tracking-[-0.03em]">Offer sent!</p>
        <p className="mx-auto max-w-xs text-muted-foreground">
          {item.seller?.display_name ?? "The seller"} will see it in their inbox. Once they accept, your message opens a chat between you two.
        </p>
        <Button asChild variant="outline"><Link href={inboxHref}>Go to inbox <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
    );
  }
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const res = await swipe({ listingId: item.id, action: "interest", message: message.trim() || undefined });
        if (!res.ok) return setError(res.error);
        setSent(true);
      });
    }}>
      <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-card px-3 py-2.5">
        <p className="truncate text-sm font-bold">{item.title}</p>
        {price && <span className="sticker shrink-0 text-sm">{price}</span>}
      </div>
      <div className="space-y-2">
        <label htmlFor={`buy-msg-${item.id}`} className="block font-display text-sm font-bold">Message to {item.seller?.display_name ?? "the seller"}</label>
        <textarea id={`buy-msg-${item.id}`} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={1000}
          className="field py-3" />
        <p className="text-xs text-muted-foreground">This becomes the first message in your chat once they accept.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Sending…" : <>Send offer <Send className="h-4 w-4" aria-hidden /></>}</Button>
    </form>
  );
}

/** "Comment": public comments on the listing. Authors and the seller can delete. */
export function CommentsPanel({ item, currentUserId, onCount }: { item: ReelItem; currentUserId: string; onCount: (n: number) => void }) {
  const [comments, setComments] = useState<ListingComment[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isSeller = item.seller_id === currentUserId;

  useEffect(() => {
    let live = true;
    listComments(item.id).then((res) => {
      if (!live) return;
      if (res.ok) { setComments(res.data ?? []); onCount(res.data?.length ?? 0); } else setError(res.error);
    });
    return () => { live = false; };
  }, [item.id, onCount]);

  return (
    <div className="space-y-4">
      {comments === null && !error && <p className="eyebrow animate-pulse py-8 text-center text-muted-foreground">Loading comments…</p>}
      {comments?.length === 0 && <p className="py-8 text-center text-muted-foreground"><span className="block font-serif text-3xl italic text-ink">Quiet in here.</span>No comments yet. Ask a question!</p>}
      {comments && comments.length > 0 && (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author?.display_name} path={c.author?.avatar_path} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-bold">{c.author?.display_name ?? "Someone"}</span>
                  {c.author?.id === item.seller_id && <span className="eyebrow ml-1.5 rounded border-[1.5px] border-ink bg-pop px-1.5 py-px text-[9px]">Seller</span>}
                  <span className="ml-2 text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
              {(c.author?.id === currentUserId || isSeller) && (
                <button type="button" aria-label="Delete comment" disabled={pending}
                  onClick={() => start(async () => {
                    const res = await deleteComment(c.id);
                    if (!res.ok) return setError(res.error);
                    setComments((cur) => { const next = (cur ?? []).filter((x) => x.id !== c.id); onCount(next.length); return next; });
                  })}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
      <form className="sticky bottom-0 flex gap-2 bg-paper pt-3" onSubmit={(e) => {
        e.preventDefault();
        const text = body.trim();
        if (!text) return;
        setError(null);
        start(async () => {
          const res = await addComment(item.id, text);
          if (!res.ok) return setError(res.error);
          setBody("");
          setComments((cur) => { const next = [...(cur ?? []), res.data!]; onCount(next.length); return next; });
        });
      }}>
        <label htmlFor={`comment-${item.id}`} className="sr-only">Add a comment</label>
        <input id={`comment-${item.id}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} autoComplete="off"
          placeholder={isSeller ? "Reply to buyers…" : "Ask about size, pickup, condition…"}
          className="field h-12 min-w-0 flex-1 rounded-full" />
        <Button type="submit" size="icon" className={cn("h-12 w-12 rounded-full")} disabled={pending || !body.trim()} aria-label="Post comment">
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
