"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";

function Confirm() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  async function go() {
    setBusy(true); setError(null);
    const res = await fetch("/api/auth/recovery/confirm", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenHash, type }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !body?.ok) { setError(body?.error ?? "Check your connection and try again."); return; }
    router.replace(body.redirect);
  }

  if (!tokenHash || type !== "recovery") {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-4xl font-extrabold tracking-[-0.05em]">Link <span className="font-serif font-normal italic text-primary">expired</span></h2>
        <p className="text-muted-foreground">This link isn&apos;t valid. <Link className="font-bold text-primary underline decoration-2 underline-offset-4" href="/forgot-password">Request a new one</Link>.</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-muted-foreground">Almost there</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.05em]">Continue to <span className="font-serif font-normal italic text-primary">reset</span></h2>
        <p className="mt-2 text-muted-foreground">Confirm to open the password reset form. The link works once.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}
      <Button size="lg" className="w-full" onClick={go} disabled={busy}>{busy ? "Checking link…" : "Continue"}</Button>
    </div>
  );
}

export default function ConfirmPage() {
  return <AuthShell><Suspense><Confirm /></Suspense></AuthShell>;
}
