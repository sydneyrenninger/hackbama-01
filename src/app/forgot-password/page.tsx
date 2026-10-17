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
      <form onSubmit={submit} className="space-y-6">
        <div>
          <p className="eyebrow text-muted-foreground">Locked out?</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.05em]">Reset your <span className="font-serif font-normal italic text-primary">password</span></h2>
          <p className="mt-2 text-muted-foreground">We&apos;ll email you a one-time link.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fp-email">University email</Label>
          <Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {msg && <p role="status" className="rounded-xl border-2 border-ink bg-pop p-3 text-sm font-bold shadow-brut-sm">{msg}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy || !email}>{busy ? "Sending…" : "Send reset link"}</Button>
        <p className="border-t-2 border-dashed border-ink/20 pt-5 text-center text-sm">
          <Link href="/login" className="font-display font-bold text-primary underline decoration-pop decoration-[3px] underline-offset-4">Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
