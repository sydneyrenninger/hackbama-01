import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass, ListChecks, LogOut, Plus, Settings, Users } from "lucide-react";
import { IncomingOfferActions } from "@/components/inbox/offer-actions";
import { ListingGrid, type GridListing } from "@/components/listing/listing-grid";
import { AppFrame } from "@/components/shell/app-frame";
import { Avatar } from "@/components/shell/avatar";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { formatPrice } from "@/lib/utils";
import { getAppContext } from "@/server/queries/context";
import { getConversations, getMyListings, getMyOffers, getMyRequests, getSavedListings } from "@/server/queries/marketplace";

type Offer = {
  id: string; kind: string; status: string; amount_cents: number | null; message: string | null; created_at: string;
  listing: { title: string } | null; request: { title: string } | null; offerer: { id: string; display_name: string } | null;
};
type Conversation = { conversation_id: string; listing_title: string | null; participants: { display_name: string }[]; last_message: string | null; last_message_at: string; unread_count: number };

// Dashboard (top-right avatar): your numbers, what needs a reply, shortcuts, and your listings.
export default async function DashboardPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");
  const p = ctx.profile;
  const campus = ctx.activeTenant ?? ctx.homeTenant;
  const slug = campus?.slug ?? "";

  const [listings, offers, conversations, saved, requests] = await Promise.all([
    getMyListings(), getMyOffers(), getConversations(), getSavedListings(), getMyRequests(),
  ]);
  const mine = listings as unknown as (GridListing & { status: string })[];
  const active = mine.filter((l) => l.status === "active" || l.status === "reserved");
  const soldCount = mine.filter((l) => l.status === "sold").length;
  const toReview = (offers.incoming as unknown as Offer[]).filter((o) => o.status === "pending");
  const unreadChats = (conversations as Conversation[]).filter((c) => c.unread_count > 0);
  const unread = unreadChats.reduce((n, c) => n + c.unread_count, 0);
  const openRequests = (requests as unknown as { status: string }[]).filter((r) => r.status === "open").length;
  const firstName = p.display_name.split(/\s+/)[0];

  const stats = [
    { label: "Active listings", value: active.length, href: `/c/${slug}/sell` },
    { label: "Sold", value: soldCount, href: `/c/${slug}/sell?tab=sold` },
    { label: "Offers to review", value: toReview.length, href: `/c/${slug}/matches`, alert: toReview.length > 0 },
    { label: "Unread messages", value: unread, href: `/c/${slug}/matches`, alert: unread > 0 },
    { label: "Saved", value: saved.length, href: "/account#saved" },
    { label: "Open requests", value: openRequests, href: "/account#requests" },
  ];
  const actions = [
    { label: "New post", href: `/c/${slug}/sell/new`, icon: Plus, primary: true },
    { label: "Post a request", href: `/c/${slug}/requests`, icon: ListChecks },
    { label: "Browse listings", href: `/c/${slug}`, icon: Compass },
    { label: "Campuses", href: "/communities", icon: Users },
  ];

  return (
    <AppFrame>
      <div className="space-y-8">
        <section className="flex flex-wrap items-center gap-4">
          <Avatar name={p.display_name} path={p.avatar_path} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold">Hi, {firstName}</h1>
            <p className="text-muted-foreground">{ctx.homeTenant?.name} · {p.completed_trades} completed trade{p.completed_trades === 1 ? "" : "s"}</p>
          </div>
          <Button asChild variant="outline"><Link href="/account"><Settings className="h-4 w-4" aria-hidden />Profile &amp; settings</Link></Button>
        </section>

        <section aria-label="Your numbers">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="block rounded-lg border border-border bg-card p-4 hover:bg-muted">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className={`block font-display text-3xl font-bold ${s.alert ? "text-primary" : ""}`}>{s.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Shortcuts">
          <ul className="flex flex-wrap gap-2">
            {actions.map(({ label, href, icon: Icon, primary }) => (
              <li key={label}>
                <Link href={href} className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ${primary ? "bg-primary text-primary-foreground hover:brightness-110" : "border border-border bg-card hover:bg-muted"}`}>
                  <Icon className="h-4 w-4" aria-hidden />{label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="attention-h" className="space-y-3">
          <h2 id="attention-h" className="font-display text-xl font-bold">Needs your attention</h2>
          {toReview.length === 0 && unreadChats.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="space-y-2">
              {toReview.slice(0, 3).map((o) => (
                <li key={o.id} className="rounded-lg border-2 border-primary/40 bg-card p-4">
                  <p className="font-semibold">
                    {o.offerer?.display_name ?? "Someone"} {o.kind === "listing_interest" ? `wants ${o.listing?.title ?? "your listing"}` : `can help with ${o.request?.title ?? "your request"}`}
                    {o.amount_cents != null && <span className="text-muted-foreground"> · {formatPrice(o.amount_cents, "sale")}</span>}
                  </p>
                  {o.message && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">&ldquo;{o.message}&rdquo;</p>}
                  <div className="mt-3"><IncomingOfferActions offerId={o.id} campusSlug={slug} /></div>
                </li>
              ))}
              {unreadChats.slice(0, 3).map((c) => (
                <li key={c.conversation_id}>
                  <Link href={`/c/${slug}/matches/${c.conversation_id}`} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted">
                    <Avatar name={c.participants[0]?.display_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.participants.map((x) => x.display_name).join(", ")}{c.listing_title && <span className="font-normal text-muted-foreground"> · {c.listing_title}</span>}</span>
                      <span className="block truncate text-sm">{c.last_message}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                      <span className="sr-only">{c.unread_count} unread</span>{c.unread_count}
                    </span>
                  </Link>
                </li>
              ))}
              {(toReview.length > 3 || unreadChats.length > 3) && (
                <li><Link href={`/c/${slug}/matches`} className="text-sm font-semibold text-primary hover:underline">See everything in your inbox</Link></li>
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="listings-h" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="listings-h" className="font-display text-xl font-bold">Your listings</h2>
            <Link href={`/c/${slug}/sell`} className="text-sm font-semibold text-primary hover:underline">Manage all</Link>
          </div>
          <ListingGrid listings={active.slice(0, 4)} linkQuery={`seller=${p.id}`}
            emptyText="You haven't posted anything yet. Tap New post to sell something." />
        </section>

        <form action="/api/auth/signout" method="post">
          <Button type="submit" variant="ghost"><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
        </form>
      </div>
    </AppFrame>
  );
}
