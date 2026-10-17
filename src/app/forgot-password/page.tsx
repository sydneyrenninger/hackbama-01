"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/auth/recovery/request", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    setMsg(body?.message ?? body?.error ?? "Check your connection and try again.");
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h2 className="font-display text-3xl font-bold">Reset your password</h2>
          <p className="mt-1 text-muted-foreground">We'll email you a one-time link.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fp-email">University email</Label>
          <Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {msg && <p role="status" className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy || !email}>{busy ? "Sending…" : "Send reset link"}</Button>
        <p className="text-center text-sm"><Link href="/" className="text-primary hover:underline">Back to sign in</Link></p>
      </form>
    </AuthShell>
  );
}
