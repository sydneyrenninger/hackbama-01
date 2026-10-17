import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { RequestCard, type RequestItem } from "@/components/requests/request-card";
import { NewRequestForm } from "@/components/requests/request-forms";
import { Empty } from "@/components/shell/empty";
import { PageHeader } from "@/components/shell/page-header";
import { getAppContext } from "@/server/queries/context";
import { getChannel, getMyListings } from "@/server/queries/marketplace";

// One request channel. Channels are shared by every campus; each request still follows its own
// campus/network visibility, so you only see requests you're allowed to.
export default async function ChannelPage({ params }: { params: Promise<{ campus: string; channel: string }> }) {
  const { campus: slug, channel: channelSlug } = await params;
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");
  const tenant = ctx.tenants.find((t) => t.slug === slug);
  if (!tenant) notFound();

  const [found, myListings] = await Promise.all([getChannel(channelSlug), getMyListings()]);
  if (!found) notFound();
  const { channel, requests } = found;

  const canPost = ctx.memberships.some((m) => m.tenant_id === tenant.id) && tenant.status === "active";
  const offerable = (myListings as { id: string; title: string; price_cents: number | null; kind: string; status: string }[])
    .filter((l) => l.status === "active");
  const creator = (channel as unknown as { creator?: { id: string; display_name: string } | null }).creator;

  return (
    <div className="space-y-8">
      <Link href={`/c/${slug}/requests`} className="eyebrow inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card px-3 py-1.5 shadow-brut-sm transition-transform hover:-translate-x-0.5">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />All requests
      </Link>
      <PageHeader kicker={creator ? `Channel · started by ${creator.display_name}` : "Channel"} title={<><span className="text-primary">#</span>{channel.name}</>}>
        {channel.description}
      </PageHeader>

      {canPost ? (
        <details className="group">
          <summary className="lift inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl border-2 border-ink bg-primary px-4 py-2.5 font-display text-sm font-bold text-primary-foreground shadow-brut-sm [&::-webkit-details-marker]:hidden">
            <Plus className="h-4 w-4 transition-transform group-open:rotate-45" aria-hidden />Post in {channel.name}
          </summary>
          <div className="mt-4 max-w-xl">
            <NewRequestForm channels={[{ id: channel.id, name: channel.name }]} tenantId={tenant.id} defaultChannelId={channel.id} lockChannel />
          </div>
        </details>
      ) : (
        <p className="rounded-2xl border-2 border-ink bg-pop p-4 text-sm font-bold shadow-brut-sm">
          You&apos;re visiting {tenant.name}. Switch to your own campus to post in this channel.
        </p>
      )}

      <section aria-labelledby="ch-feed" className="space-y-3">
        <h2 id="ch-feed" className="sr-only">Requests in {channel.name}</h2>
        {requests.length === 0 ? (
          <Empty>Nothing here yet. Be the first to post in {channel.name}.</Empty>
        ) : (
          <div className="gap-6 pt-3 md:columns-2 xl:columns-3">
            {(requests as unknown as RequestItem[]).map((r, i) => (
              <RequestCard key={r.id} index={i} request={r} campusSlug={slug} currentUserId={ctx.user.id} myListings={offerable}
                homeTenantId={tenant.id} showChannel={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
