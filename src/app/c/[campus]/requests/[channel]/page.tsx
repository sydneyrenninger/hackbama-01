import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { RequestCard, type RequestItem } from "@/components/requests/request-card";
import { NewRequestForm } from "@/components/requests/request-forms";
import { cn } from "@/lib/utils";
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
    <div className="space-y-6">
      <Link href={`/c/${slug}/requests`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />All requests
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold">{channel.name}</h1>
        {channel.description && <p className="mt-1 max-w-prose text-muted-foreground">{channel.description}</p>}
        {creator && <p className="mt-1 text-sm text-muted-foreground">Created by {creator.display_name}</p>}
      </div>

      {canPost ? (
        <details>
          <summary className={cn("inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 [&::-webkit-details-marker]:hidden")}>
            <Plus className="h-4 w-4" aria-hidden />Post in {channel.name}
          </summary>
          <div className="mt-3 max-w-xl">
            <NewRequestForm channels={[{ id: channel.id, name: channel.name }]} tenantId={tenant.id} defaultChannelId={channel.id} lockChannel />
          </div>
        </details>
      ) : (
        <p className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">
          You&apos;re visiting {tenant.name}. Switch to your own campus to post in this channel.
        </p>
      )}

      <section aria-labelledby="ch-feed" className="space-y-3">
        <h2 id="ch-feed" className="sr-only">Requests in {channel.name}</h2>
        {requests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            Nothing here yet. Be the first to post in {channel.name}.
          </p>
        ) : (requests as unknown as RequestItem[]).map((r) => (
          <RequestCard key={r.id} request={r} campusSlug={slug} currentUserId={ctx.user.id} myListings={offerable}
            homeTenantId={tenant.id} showChannel={false} />
        ))}
      </section>
    </div>
  );
}
