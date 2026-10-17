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

/** One wanted request, styled as a pinned "wanted" flyer. Others get "I can help"; the requester gets fulfil/close controls. */
export function RequestCard({ request: r, campusSlug, currentUserId, myListings, homeTenantId, showChannel = true, index = 0 }: {
  request: RequestItem; campusSlug: string; currentUserId: string; myListings: MyListingOption[];
  homeTenantId?: string; showChannel?: boolean; index?: number;
}) {
  const mine = r.requester?.id === currentUserId;
  const otherCampus = r.tenant && homeTenantId && r.tenant.id !== homeTenantId ? r.tenant.short_name : null;

  return (
    <article style={{ "--i": index, rotate: index % 2 ? "0.4deg" : "-0.4deg" } as React.CSSProperties}
      className="rise tape relative mb-7 break-inside-avoid rounded-2xl border-2 border-ink bg-card p-5 shadow-brut">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="eyebrow rounded-md bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">{mine ? "Your ask" : "Wanted"}</span>
          {showChannel && r.channel && (
            <Link href={`/c/${campusSlug}/requests/${r.channel.slug}`} className="font-mono text-xs font-bold text-muted-foreground hover:text-ink hover:underline">#{r.channel.name}</Link>
          )}
          {otherCampus && <span className="eyebrow rounded-full border-2 border-ink/15 px-2 py-px text-[9px]">{otherCampus}</span>}
        </div>
        <span className="shrink-0 rotate-[5deg] rounded-lg border-2 border-dashed border-ink bg-pop/70 px-2 py-0.5 font-display text-sm font-extrabold">
          {formatBudget(r.budget_cents)}
        </span>
      </div>

      <h3 className="mt-3 font-display text-2xl font-extrabold leading-[1.05] tracking-[-0.035em]">{r.title}</h3>
      {r.description && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink/80">{r.description}</p>}
      {r.tags?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {r.tags.map((t) => <li key={t} className="rounded-full bg-paper-deep px-2.5 py-0.5 font-mono text-xs font-bold">#{t}</li>)}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2.5 border-t-2 border-dashed border-ink/15 pt-3.5">
        <Avatar name={r.requester?.display_name} size="sm" />
        <p className="min-w-0 flex-1 truncate text-sm">
          {r.requester ? <Link href={`/u/${r.requester.id}`} className="font-bold hover:underline">{r.requester.display_name}</Link> : <span className="font-bold">Someone</span>}
          <span className="text-muted-foreground"> · {timeAgo(r.created_at)}</span>
        </p>
      </div>
      <div className="mt-3">
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
