import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Compass, ListChecks, LogOut, Plus, Settings, Users } from "lucide-react";
import { IncomingOfferActions } from "@/components/inbox/offer-actions";
import { ListingGrid, type GridListing } from "@/components/listing/listing-grid";
import { AppFrame } from "@/components/shell/app-frame";
import { Avatar } from "@/components/shell/avatar";
import { Empty } from "@/components/shell/empty";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { cn, formatPrice } from "@/lib/utils";
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
      <div className="space-y-10">
        <PageHeader kicker={`Dashboard · ${ctx.homeTenant?.name ?? ""}`} title="Hey," accent={`${firstName}.`}
          actions={<Button asChild variant="outline"><Link href="/account"><Settings className="h-4 w-4" aria-hidden />Profile &amp; settings</Link></Button>}>
          {p.completed_trades} completed trade{p.completed_trades === 1 ? "" : "s"} so far. Here&apos;s the scoreboard.
        </PageHeader>

        <section aria-label="Your numbers" className="overflow-hidden rounded-[1.6rem] border-2 border-ink bg-ink text-paper shadow-[6px_6px_0_0_var(--campus)]">
          <div className="flex items-center justify-between gap-3 border-b-2 border-paper/10 px-5 py-3">
            <p className="eyebrow flex items-center gap-2 text-pop"><span className="h-2 w-2 animate-pulse rounded-full bg-pop" aria-hidden />Scoreboard</p>
            <p className="eyebrow truncate text-paper/50">{campus?.short_name}</p>
          </div>
          <ul className="grid grid-cols-2 gap-px bg-paper/10 sm:grid-cols-3">
            {stats.map((s) => (
              <li key={s.label} className="bg-ink">
                <Link href={s.href} className="group relative block p-5 transition-colors hover:bg-paper/[0.06] sm:p-6">
                  <span className="eyebrow text-[10px] text-paper/55">{s.label}</span>
                  <span className={cn("mt-1 block font-display text-6xl font-extrabold leading-none tracking-[-0.06em] tabular-nums sm:text-7xl", s.alert ? "text-pop" : "text-paper")}>
                    {String(s.value).padStart(2, "0")}
                  </span>
                  <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-paper/30 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-pop" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Shortcuts">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {actions.map(({ label, href, icon: Icon, primary }) => (
              <li key={label}>
                <Link href={href} className={cn("lift flex h-full flex-col justify-between gap-6 rounded-2xl border-2 border-ink p-4 shadow-brut-sm",
                  primary ? "bg-primary text-primary-foreground" : "bg-card")}>
                  <Icon className="h-6 w-6" aria-hidden />
                  <span className="font-display text-lg font-extrabold leading-tight tracking-[-0.02em]">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="attention-h" className="space-y-4">
          <SectionTitle id="attention-h" n="01">Needs your attention</SectionTitle>
          {toReview.length === 0 && unreadChats.length === 0 ? (
            <Empty mark="✓">You&apos;re all caught up.</Empty>
          ) : (
            <ul className="space-y-3">
              {toReview.slice(0, 3).map((o) => (
                <li key={o.id} className="relative overflow-hidden rounded-2xl border-2 border-ink bg-card p-4 pl-6 shadow-brut">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-2 bg-pop" />
                  <p className="font-display font-bold leading-snug">
                    {o.offerer?.display_name ?? "Someone"} {o.kind === "listing_interest" ? `wants ${o.listing?.title ?? "your listing"}` : `can help with ${o.request?.title ?? "your request"}`}
                    {o.amount_cents != null && <span className="sticker ml-2 text-xs">{formatPrice(o.amount_cents, "sale")}</span>}
                  </p>
                  {o.message && <p className="mt-1.5 line-clamp-2 text-sm italic text-muted-foreground">&ldquo;{o.message}&rdquo;</p>}
                  <div className="mt-3"><IncomingOfferActions offerId={o.id} campusSlug={slug} /></div>
                </li>
              ))}
              {unreadChats.slice(0, 3).map((c) => (
                <li key={c.conversation_id}>
                  <Link href={`/c/${slug}/matches/${c.conversation_id}`} className="lift flex items-center gap-3 rounded-2xl border-2 border-ink bg-card p-3.5 shadow-brut-sm">
                    <Avatar name={c.participants[0]?.display_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display font-bold">{c.participants.map((x) => x.display_name).join(", ")}{c.listing_title && <span className="font-sans font-normal text-muted-foreground"> · {c.listing_title}</span>}</span>
                      <span className="block truncate text-sm">{c.last_message}</span>
                    </span>
                    <span className="eyebrow text-[9px] text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                    <span className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink bg-pop px-1.5 font-mono text-[11px] font-bold">
                      <span className="sr-only">{c.unread_count} unread</span>{c.unread_count}
                    </span>
                  </Link>
                </li>
              ))}
              {(toReview.length > 3 || unreadChats.length > 3) && (
                <li><Link href={`/c/${slug}/matches`} className="font-display text-sm font-bold text-primary underline decoration-pop decoration-[3px] underline-offset-4">See everything in your inbox</Link></li>
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="listings-h" className="space-y-5">
          <SectionTitle id="listings-h" n="02"
            aside={<Link href={`/c/${slug}/sell`} className="font-display text-sm font-bold text-primary underline decoration-pop decoration-[3px] underline-offset-4">Manage all</Link>}>
            Your listings
          </SectionTitle>
          <ListingGrid listings={active.slice(0, 4)} linkQuery={`seller=${p.id}`}
            emptyText="You haven't posted anything yet. Tap New post to sell something." />
        </section>

        <form action="/api/auth/signout" method="post" className="border-t-2 border-dashed border-ink/20 pt-6">
          <Button type="submit" variant="ghost"><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
        </form>
      </div>
    </AppFrame>
  );
}
