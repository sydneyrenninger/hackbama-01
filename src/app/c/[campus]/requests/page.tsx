import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { matchesQuery, RequestCard, type RequestItem } from "@/components/requests/request-card";
import { NewChannelForm, NewRequestForm } from "@/components/requests/request-forms";
import { Empty } from "@/components/shell/empty";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { cn } from "@/lib/utils";
import { getAppContext } from "@/server/queries/context";
import { getChannels, getMyListings, getRequests } from "@/server/queries/marketplace";

const summary = "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl border-2 border-ink px-4 py-2.5 font-display text-sm font-bold shadow-brut-sm lift [&::-webkit-details-marker]:hidden";
const chip = "inline-flex items-center rounded-full border-2 px-3.5 py-1.5 font-mono text-[13px] font-bold transition-all";

// Requests tab: browse/search channels, post a "wanted" request, offer to help on others'.
export default async function RequestsPage({ params, searchParams }: {
  params: Promise<{ campus: string }>; searchParams: Promise<{ q?: string }>;
}) {
  const { campus: slug } = await params;
  const { q = "" } = await searchParams;
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");
  const tenant = ctx.tenants.find((t) => t.slug === slug);
  if (!tenant) notFound();

  const canPost = ctx.memberships.some((m) => m.tenant_id === tenant.id) && tenant.status === "active";
  const [channels, all, myListings] = await Promise.all([getChannels(q), getRequests([tenant.id]), getMyListings()]);
  const requests = (all as unknown as RequestItem[]).filter((r) => matchesQuery(r, q));
  const offerable = (myListings as { id: string; title: string; price_cents: number | null; kind: string; status: string }[])
    .filter((l) => l.status === "active");
  const base = `/c/${slug}/requests`;

  return (
    <div className="space-y-10">
      <PageHeader kicker={`Requests · ${tenant.short_name}`} title="The" accent="wanted board.">
        Post what you need. Sellers see it and send you offers.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6 lg:order-2 lg:sticky lg:top-24">
          <form role="search" action={base} className="relative">
            <label htmlFor="rq-search" className="sr-only">Search requests and channels</label>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input id="rq-search" name="q" defaultValue={q} placeholder="Search requests or channels"
              className="field h-13 pl-12 pr-24 shadow-brut-sm" />
            <button type="submit" className="absolute right-2 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-ink px-3.5 font-display text-sm font-bold text-paper transition-transform active:scale-95">Search</button>
          </form>

          <section aria-labelledby="channels-h" className="space-y-3">
            <h2 id="channels-h" className="eyebrow text-muted-foreground">Channels</h2>
            <ul className="flex flex-wrap gap-2">
              <li><Link href={base} className={cn(chip, !q ? "border-ink bg-ink text-paper" : "border-ink/15 bg-card hover:border-ink")}>#all</Link></li>
              {channels.map((c) => (
                <li key={c.id}>
                  <Link href={`${base}/${c.slug}`} className={cn(chip, "border-ink/15 bg-card hover:-rotate-2 hover:border-ink")}>
                    #{c.name}{c.open_requests > 0 && <span className="ml-1.5 rounded-full bg-pop px-1.5 text-[11px] text-ink">{c.open_requests}</span>}
                  </Link>
                </li>
              ))}
              {channels.length === 0 && <li className="text-sm text-muted-foreground">No channel matches &ldquo;{q}&rdquo;. Create it below.</li>}
            </ul>
            <details className="group">
              <summary className={cn(summary, "bg-card")}><Plus className="h-4 w-4 transition-transform group-open:rotate-45" aria-hidden />New channel</summary>
              <div className="mt-4"><NewChannelForm campusSlug={slug} /></div>
            </details>
          </section>
        </div>

        <div className="space-y-8 lg:order-1">
          <section aria-labelledby="post-h">
            <h2 id="post-h" className="sr-only">Post a request</h2>
            {canPost ? (
              <details className="group">
                <summary className={cn(summary, "bg-primary text-primary-foreground")}>
                  <Plus className="h-4 w-4 transition-transform group-open:rotate-45" aria-hidden />Post a request
                </summary>
                <div className="mt-4 max-w-xl"><NewRequestForm channels={channels.length ? channels : await getChannels()} tenantId={tenant.id} /></div>
              </details>
            ) : (
              <p className="rounded-2xl border-2 border-ink bg-pop p-4 text-sm font-bold shadow-brut-sm">
                You&apos;re visiting {tenant.name}. You can offer to help on requests here, but you&apos;ll need to switch to your own campus to post one.
              </p>
            )}
          </section>

          <section aria-labelledby="feed-h" className="space-y-6">
            <SectionTitle id="feed-h" n={String(requests.length).padStart(2, "0")}>
              {q ? `Results for “${q}”` : `Open requests at ${tenant.short_name}`}
            </SectionTitle>
            {requests.length === 0 ? (
              <Empty mark="?">{q ? "No requests match your search." : "No open requests yet. Be the first to post one."}</Empty>
            ) : (
              <div className="gap-6 pt-3 md:columns-2">
                {requests.map((r, i) => (
                  <RequestCard key={r.id} index={i} request={r} campusSlug={slug} currentUserId={ctx.user.id} myListings={offerable} homeTenantId={tenant.id} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
