"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { respondToRequest } from "@/server/actions/requests";

/** One-click "offer this listing" on a request that matches it. The requester accepts to open a chat. */
export function OfferListingButton({ requestId, listingId, listingTitle }: { requestId: string; listingId: string; listingTitle: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) return <span role="status" className="sticker animate-pop text-sm">✓ Offer sent</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const res = await respondToRequest({ requestId, listingId });
          if (!res.ok) return setError(res.error);
          setSent(true);
        })}>
        {pending ? "Sending…" : `Offer ${listingTitle.length > 24 ? `${listingTitle.slice(0, 24)}…` : listingTitle}`}
      </Button>
      {error && <span role="alert" className="text-sm font-bold text-destructive">{error}</span>}
    </div>
  );
}
