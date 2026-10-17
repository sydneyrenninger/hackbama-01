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
      <form onSubmit={submit} className="space-y-5">
        <h2 className="font-display text-3xl font-bold">Choose a new password</h2>
        <PasswordField label="New password" value={pw} onChange={setPw} autoComplete="new-password" />
        <p className="text-sm text-muted-foreground">10+ characters with letters and numbers.</p>
        <PasswordField label="Confirm password" value={pw2} onChange={setPw2} autoComplete="new-password"
          error={mismatch ? "Passwords don't match" : undefined} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={!valid || busy}>{busy ? "Saving…" : "Save password"}</Button>
      </form>
    </AuthShell>
  );
}
