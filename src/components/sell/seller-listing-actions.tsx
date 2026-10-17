"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateListingStatus } from "@/server/actions/listings";

/** Seller controls on one of their listings: mark sold, relist, or remove. */
export function SellerListingActions({ listingId, status }: { listingId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const set = (next: "active" | "sold" | "removed") => start(async () => {
    setError(null);
    const res = await updateListingStatus(listingId, next);
    if (!res.ok) return setError(res.error);
    setConfirmRemove(false);
    router.refresh();
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "sold" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => set("active")}>Relist</Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => set("sold")}>Mark sold</Button>
      )}
      {confirmRemove ? (
        <>
          <Button size="sm" variant="outline" className="border-destructive text-destructive" disabled={pending} onClick={() => set("removed")}>
            Yes, remove
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmRemove(false)}>Cancel</Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmRemove(true)}>Remove</Button>
      )}
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
