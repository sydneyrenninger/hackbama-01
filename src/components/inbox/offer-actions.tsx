"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { respondToOffer, withdrawOffer } from "@/server/actions/offers";

/** Accept / decline an incoming offer. Accepting opens the private chat. */
export function IncomingOfferActions({ offerId, campusSlug }: { offerId: string; campusSlug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const respond = (accept: boolean) => start(async () => {
    setError(null);
    const res = await respondToOffer(offerId, accept);
    if (!res.ok) return setError(res.error);
    if (accept && res.data?.conversationId) router.push(`/c/${campusSlug}/matches/${res.data.conversationId}`);
    else router.refresh();
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={pending} onClick={() => respond(true)}>Accept &amp; chat</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => respond(false)}>Decline</Button>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </div>
  );
}

/** Take back an offer you sent that hasn't been answered. */
export function WithdrawOfferButton({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const res = await withdrawOffer(offerId);
          if (!res.ok) return setError(res.error);
          router.refresh();
        })}>
        Withdraw
      </Button>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
