"use client";
import { useState, useTransition } from "react";
import { swipe } from "@/server/actions/offers";

export function ListingActions({ listingId }: { listingId: string }) {
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: "save" | "interest") =>
    start(async () => {
      const r = await swipe({ listingId, action, message: action === "interest" ? msg || undefined : undefined });
      setStatus(r.ok ? (action === "save" ? "Saved." : "Offer sent. The seller will see it on their dashboard.") : r.error);
    });

  return (
    <div className="space-y-3">
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} rows={3}
        placeholder="Add a message to the seller (optional)"
        className="w-full rounded-md border border-border bg-card p-3" />
      <div className="flex gap-2">
        <button onClick={() => run("interest")} disabled={pending}
          className="h-11 flex-1 rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-50">
          {pending ? "Sending…" : "Make offer"}
        </button>
        <button onClick={() => run("save")} disabled={pending}
          className="h-11 rounded-md border border-border bg-card px-5 font-semibold disabled:opacity-50">
          Save
        </button>
      </div>
      {status && <p role="status" className="text-sm">{status}</p>}
    </div>
  );
}