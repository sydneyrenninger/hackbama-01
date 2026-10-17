"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div>
        <p className="eyebrow text-muted-foreground">Welcome back</p>
        <h2 className="mt-2 font-display text-5xl font-extrabold tracking-[-0.05em]">Sign <span className="font-serif font-normal italic text-primary">in</span></h2>
        <p className="mt-2 text-muted-foreground">Use your university email.</p>
      </div>
      {notice && <p role="status" className="rounded-xl border-2 border-ink bg-pop p-3 text-sm font-bold shadow-brut-sm">{notice}</p>}
      <div className="space-y-2">
        <Label htmlFor="email">University email</Label>
        <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@school.edu"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      {error && <p role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy || !email || !password}>
        {busy ? "Signing in…" : <>Sign in <ArrowRight className="h-4 w-4" aria-hidden /></>}
      </Button>
      <div className="flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-5 text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline decoration-2 underline-offset-4 hover:text-ink">Forgot password?</Link>
        <Link href="/signup" className="font-display font-bold text-primary underline decoration-pop decoration-[3px] underline-offset-4">Create an account</Link>
      </div>
    </form>
  );
}
