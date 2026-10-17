"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const valid = pw.length >= 10 && /[a-zA-Z]/.test(pw) && /\d/.test(pw) && pw === pw2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/auth/password", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw, confirmPassword: pw2 }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !body?.ok) { setError(body?.error ?? "Check your connection and try again."); return; }
    setPw(""); setPw2("");
    router.replace(body.redirect);
    router.refresh();
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-6">
        <div>
          <p className="eyebrow text-muted-foreground">Fresh start</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.05em]">Choose a new <span className="font-serif font-normal italic text-primary">password</span></h2>
        </div>
        <PasswordField label="New password" value={pw} onChange={setPw} autoComplete="new-password" />
        <p className="eyebrow -mt-3 text-muted-foreground">10+ characters with letters and numbers.</p>
        <PasswordField label="Confirm password" value={pw2} onChange={setPw2} autoComplete="new-password"
          error={mismatch ? "Passwords don't match" : undefined} />
        {error && <p role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={!valid || busy}>{busy ? "Saving…" : "Save password"}</Button>
      </form>
    </AuthShell>
  );
}
