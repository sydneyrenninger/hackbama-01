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
    return <p>This link isn&apos;t valid. <Link className="text-primary underline" href="/forgot-password">Request a new one</Link>.</p>;
  }
  return (
    <div className="space-y-5">
      <h2 className="font-display text-3xl font-bold">Continue to reset</h2>
      <p className="text-muted-foreground">Confirm to open the password reset form. The link works once.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={go} disabled={busy}>{busy ? "Checking link…" : "Continue"}</Button>
    </div>
  );
}

export default function ConfirmPage() {
  return <AuthShell><Suspense><Confirm /></Suspense></AuthShell>;
}
