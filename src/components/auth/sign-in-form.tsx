"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./password-field";

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/auth/signin", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, next }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !body?.ok) { setError(body?.error ?? "Check your connection and try again."); return; }
    setPassword("");
    router.replace(body.redirect);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <h2 className="font-display text-3xl font-bold">Sign in</h2>
        <p className="mt-1 text-muted-foreground">Use your university email.</p>
      </div>
      {notice && <p role="status" className="rounded-md bg-secondary p-3 text-sm text-secondary-foreground">{notice}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="email">University email</Label>
        <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@school.edu"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || !email || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
        <Link href="/signup" className="font-semibold text-primary hover:underline">Create an account</Link>
      </div>
    </form>
  );
}
