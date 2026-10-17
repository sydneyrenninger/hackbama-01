"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./password-field";

// One-step signup: .edu email + display name + password (POST /api/auth/signup).
// Email-code verification is skipped for now; the 3-step version used
// /api/auth/signup/start → verify → complete (routes still exist) with ./code-input.

async function post(url: string, data: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
  const body = await res?.json().catch(() => null);
  return { ok: Boolean(res?.ok && body?.ok), body: body ?? { error: "Check your connection and try again." } };
}

function strength(p: string) {
  const checks = [
    { ok: p.length >= 10, label: "10+ characters" },
    { ok: /[a-zA-Z]/.test(p) && /\d/.test(p), label: "Letters and numbers" },
    { ok: p.length >= 14 || /[^a-zA-Z0-9]/.test(p), label: "A symbol or 14+ characters (stronger)" },
  ];
  return { checks, valid: checks[0].ok && checks[1].ok && new TextEncoder().encode(p).length <= 72 };
}

export function SignupFlow() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const s = useMemo(() => strength(pw), [pw]);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = email.length > 0 && s.valid && pw === pw2 && name.trim().length >= 2 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError(null);
    const { ok, body } = await post("/api/auth/signup", { email, displayName: name, password: pw, confirmPassword: pw2 });
    setBusy(false);
    if (!ok) {
      setError(body.error);
      if (body.signIn) { setPw(""); setPw2(""); }
      return;
    }
    setPw(""); setPw2("");
    router.replace(body.redirect);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <h2 className="font-display text-3xl font-bold">Create your account</h2>
        <p className="mt-1 text-muted-foreground">Use your university (.edu) email.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">University email</Label>
        <Input id="su-email" type="email" autoComplete="email" inputMode="email" placeholder="you@school.edu"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Display name</Label>
        <Input id="su-name" autoComplete="nickname" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </div>
      <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="new-password" describedBy="pw-rules" />
      <ul id="pw-rules" className="space-y-1 text-sm">
        {s.checks.map((c) => (
          <li key={c.label} className={c.ok ? "text-success" : "text-muted-foreground"}>{c.ok ? "✓" : "○"} {c.label}</li>
        ))}
      </ul>
      <PasswordField label="Confirm password" value={pw2} onChange={setPw2} autoComplete="new-password"
        error={mismatch ? "Passwords don't match" : undefined} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={!canSubmit}>{busy ? "Creating account…" : "Create account"}</Button>
      <p className="text-center text-sm text-muted-foreground">
        Have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
