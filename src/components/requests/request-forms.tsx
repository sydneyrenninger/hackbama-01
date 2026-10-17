"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dollarsToCents, splitTags } from "@/lib/format";
import { formatPrice } from "@/lib/utils";
import { createChannel } from "@/server/actions/channels";
import { createRequest, respondToRequest, setRequestStatus } from "@/server/actions/requests";

const CATEGORIES = ["textbooks", "dorm", "lab", "tickets", "tutoring", "rides", "electronics", "furniture", "clothing", "other"] as const;
const textarea = "w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary";
const select = "h-11 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:border-primary";

export type ChannelOption = { id: string; name: string };
export type MyListingOption = { id: string; title: string; price_cents: number | null; kind: string };

/** "+ Request channel": any signed-in user can create a topic. */
export function NewChannelForm({ campusSlug }: { campusSlug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form className="space-y-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await createChannel({ name: String(f.get("name") ?? ""), description: String(f.get("description") ?? "") });
          if (!res.ok) return setError(res.error);
          router.push(`/c/${campusSlug}/requests/${res.data!.slug}`);
        });
      }}>
      <div className="space-y-1.5">
        <Label htmlFor="ch-name">Channel name</Label>
        <Input id="ch-name" name="name" required minLength={2} maxLength={40} placeholder="Gameday Tickets" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ch-desc">What is it for? <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="ch-desc" name="description" maxLength={280} placeholder="Buy and sell game tickets" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create channel"}</Button>
    </form>
  );
}

/** Post a "wanted" request. Needs a channel; tags and budget are optional. */
export function NewRequestForm({ channels, tenantId, defaultChannelId, lockChannel }: {
  channels: ChannelOption[]; tenantId: string; defaultChannelId?: string; lockChannel?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <form className="space-y-4 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setError(null); setDone(false);
        start(async () => {
          const res = await createRequest({
            tenantId,
            channelId: String(f.get("channel") ?? "") || null,
            title: String(f.get("title") ?? ""),
            description: String(f.get("description") ?? ""),
            category: String(f.get("category") ?? "other") as (typeof CATEGORIES)[number],
            budgetCents: dollarsToCents(f.get("budget")),
            visibility: String(f.get("visibility") ?? "campus") as "campus" | "network",
            tags: splitTags(String(f.get("tags") ?? "")),
          });
          if (!res.ok) return setError(res.error);
          form.reset();
          setDone(true);
          router.refresh();
        });
      }}>
      <div className="space-y-1.5">
        <Label htmlFor="rq-channel">Channel</Label>
        <select id="rq-channel" name="channel" required defaultValue={defaultChannelId ?? ""} disabled={lockChannel && Boolean(defaultChannelId)} className={select}>
          {!defaultChannelId && <option value="" disabled>Pick a channel…</option>}
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {lockChannel && defaultChannelId && <input type="hidden" name="channel" value={defaultChannelId} />}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rq-title">What do you need?</Label>
        <Input id="rq-title" name="title" required minLength={3} maxLength={90} placeholder="Looking for an ECE tutor" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rq-desc">Details <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <textarea id="rq-desc" name="description" rows={3} maxLength={2000} className={textarea} placeholder="Weekends work best." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rq-tags">Tags <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="rq-tags" name="tags" placeholder="#ece #weekend" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rq-budget">Budget ($) <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="rq-budget" name="budget" inputMode="decimal" placeholder="25" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rq-category">Category</Label>
          <select id="rq-category" name="category" defaultValue="other" className={select}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rq-vis">Who can see it?</Label>
          <select id="rq-vis" name="visibility" defaultValue="campus" className={select}>
            <option value="campus">My campus only</option>
            <option value="network">All campuses</option>
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {done && <p role="status" className="text-sm text-success">Posted. Sellers can see it now.</p>}
      <Button type="submit" disabled={pending}>{pending ? "Posting…" : "Post request"}</Button>
    </form>
  );
}

/** "I can help": sends an offer to the requester. They accept it to open a private chat. */
export function RespondForm({ requestId, listings }: { requestId: string; listings: MyListingOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) return <p role="status" className="text-sm font-semibold text-success">Offer sent. They&apos;ll see it in their inbox.</p>;
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}>I can help</Button>;

  return (
    <form className="mt-1 space-y-3 rounded-md border border-border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await respondToRequest({
            requestId,
            listingId: String(f.get("listing") ?? "") || null,
            amountCents: dollarsToCents(f.get("price")),
            message: String(f.get("message") ?? "").trim() || undefined,
          });
          if (!res.ok) return setError(res.error);
          setSent(true);
        });
      }}>
      {listings.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor={`rs-l-${requestId}`}>Offer one of your listings <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <select id={`rs-l-${requestId}`} name="listing" defaultValue="" className={select}>
            <option value="">No listing, just a message</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title} {formatPrice(l.price_cents, l.kind) && `(${formatPrice(l.price_cents, l.kind)})`}</option>)}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`rs-p-${requestId}`}>Your price ($) <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id={`rs-p-${requestId}`} name="price" inputMode="decimal" placeholder="20" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`rs-m-${requestId}`}>Message</Label>
        <textarea id={`rs-m-${requestId}`} name="message" rows={2} maxLength={1000} className={textarea}
          placeholder="Hi! I tutored ECE 301 last year and I'm free Saturdays." />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Sending…" : "Send offer"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

/** Requester controls on their own request. */
export function RequestOwnerActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (status: "fulfilled" | "closed") => start(async () => {
    setError(null);
    const res = await setRequestStatus(requestId, status);
    if (!res.ok) return setError(res.error);
    router.refresh();
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Your request</span>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => set("fulfilled")}>Mark fulfilled</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("closed")}>Close</Button>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
