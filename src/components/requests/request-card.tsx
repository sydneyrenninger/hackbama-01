import Link from "next/link";
import { Avatar } from "@/components/shell/avatar";
import { formatBudget, timeAgo } from "@/lib/format";
import { RequestOwnerActions, RespondForm, type MyListingOption } from "./request-forms";

export type RequestItem = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  budget_cents: number | null;
  visibility: string;
  created_at: string;
  channel?: { id: string; slug: string; name: string } | null;
  tenant?: { id: string; short_name: string } | null;
  requester?: { id: string; display_name: string } | null;
};

/** One wanted request. Others get "I can help"; the requester gets fulfil/close controls. */
export function RequestCard({ request: r, campusSlug, currentUserId, myListings, homeTenantId, showChannel = true }: {
  request: RequestItem; campusSlug: string; currentUserId: string; myListings: MyListingOption[];
  homeTenantId?: string; showChannel?: boolean;
}) {
  const mine = r.requester?.id === currentUserId;
  const otherCampus = r.tenant && homeTenantId && r.tenant.id !== homeTenantId ? r.tenant.short_name : null;

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Avatar name={r.requester?.display_name} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-snug">{r.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {r.requester ? <Link href={`/u/${r.requester.id}`} className="font-semibold hover:underline">{r.requester.display_name}</Link> : <span>Someone</span>}
            {showChannel && r.channel && <Link href={`/c/${campusSlug}/requests/${r.channel.slug}`} className="hover:underline">in {r.channel.name}</Link>}
            <span>{formatBudget(r.budget_cents)}</span>
            <span>{timeAgo(r.created_at)}</span>
            {otherCampus && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{otherCampus}</span>}
          </p>
        </div>
      </div>
      {r.description && <p className="mt-3 whitespace-pre-line text-sm">{r.description}</p>}
      {r.tags?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {r.tags.map((t) => <li key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">#{t}</li>)}
        </ul>
      )}
      <div className="mt-4">
        {mine ? <RequestOwnerActions requestId={r.id} /> : <RespondForm requestId={r.id} listings={myListings} />}
      </div>
    </article>
  );
}

export function matchesQuery(r: RequestItem, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${r.title} ${r.description} ${r.channel?.name ?? ""} ${(r.tags ?? []).join(" ")}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}
