import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { matchesQuery, RequestCard, type RequestItem } from "@/components/requests/request-card";
import { NewChannelForm, NewRequestForm } from "@/components/requests/request-forms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAppContext } from "@/server/queries/context";
import { getChannels, getMyListings, getRequests } from "@/server/queries/marketplace";

const summary = "cursor-pointer list-none rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted [&::-webkit-details-marker]:hidden";

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
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Requests</h1>
        <p className="mt-1 text-muted-foreground">Post what you need. Sellers see it and send you offers.</p>
      </div>

      <form role="search" action={base} className="flex gap-2">
        <label htmlFor="rq-search" className="sr-only">Search requests and channels</label>
        <input id="rq-search" name="q" defaultValue={q} placeholder="Search requests or channels"
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary" />
        <Button type="submit"><Search className="h-4 w-4" aria-hidden />Search</Button>
      </form>

      <section aria-labelledby="channels-h" className="space-y-3">
        <h2 id="channels-h" className="font-display text-xl font-bold">Channels</h2>
        <ul className="flex flex-wrap gap-2">
          <li><Link href={base} className={cn(summary, "inline-block", !q && "bg-primary text-primary-foreground hover:bg-primary")}>All</Link></li>
          {channels.map((c) => (
            <li key={c.id}>
              <Link href={`${base}/${c.slug}`} className={cn(summary, "inline-block")}>
                {c.name}{c.open_requests > 0 && <span className="ml-1.5 text-muted-foreground">{c.open_requests}</span>}
              </Link>
            </li>
          ))}
          {channels.length === 0 && <li className="text-sm text-muted-foreground">No channel matches &ldquo;{q}&rdquo;. Create it below.</li>}
        </ul>
        <details className="group">
          <summary className={cn(summary, "inline-flex items-center gap-1.5")}><Plus className="h-4 w-4" aria-hidden />New channel</summary>
          <div className="mt-3 max-w-md"><NewChannelForm campusSlug={slug} /></div>
        </details>
      </section>

      <section aria-labelledby="post-h">
        <h2 id="post-h" className="sr-only">Post a request</h2>
        {canPost ? (
          <details>
            <summary className={cn(summary, "inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary hover:brightness-110")}>
              <Plus className="h-4 w-4" aria-hidden />Post a request
            </summary>
            <div className="mt-3 max-w-xl"><NewRequestForm channels={channels.length ? channels : await getChannels()} tenantId={tenant.id} /></div>
          </details>
        ) : (
          <p className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
            You&apos;re visiting {tenant.name}. You can offer to help on requests here, but you&apos;ll need to switch to your own campus to post one.
          </p>
        )}
      </section>

      <section aria-labelledby="feed-h" className="space-y-3">
        <h2 id="feed-h" className="font-display text-xl font-bold">{q ? `Results for “${q}”` : `Open requests at ${tenant.short_name}`}</h2>
        {requests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            {q ? "No requests match your search." : "No open requests yet. Be the first to post one."}
          </p>
        ) : requests.map((r) => (
          <RequestCard key={r.id} request={r} campusSlug={slug} currentUserId={ctx.user.id} myListings={offerable} homeTenantId={tenant.id} />
        ))}
      </section>
    </div>
  );
}
