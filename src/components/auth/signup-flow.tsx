"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CodeInput } from "./code-input";
import { PasswordField } from "./password-field";

type Step = "email" | "code" | "password";
type Campus = { name: string | null; status: string };

const STEPS: { key: Step; label: string }[] = [{ key: "email", label: "Email" }, { key: "code", label: "Code" }, { key: "password", label: "Password" }];

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

function Heading({ kicker, children, sub }: { kicker: string; children: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow text-muted-foreground">{kicker}</p>
      <h2 className="mt-2 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.05em]">{children}</h2>
      <p className="mt-2 text-muted-foreground">{sub}</p>
    </div>
  );
}

const alert = "rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-sm font-bold text-destructive";

export function SignupFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [masked, setMasked] = useState("");
  const [campus, setCampus] = useState<Campus | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const s = useMemo(() => strength(pw), [pw]);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = s.valid && pw === pw2 && name.trim().length >= 2 && !busy;

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setError(null);
    const { ok, body } = await post("/api/auth/signup/start", { email });
    setBusy(false);
    if (body.retryAfter) setCooldown(body.retryAfter);
    if (!ok) { setError(body.error); return; }
    setMasked(body.maskedEmail); setCampus(body.campus); setCode(""); setStep("code");
    setCooldown(body.resendAfter ?? 60);
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setError(null);
    const { ok, body } = await post("/api/auth/signup/verify", { code: value });
    setBusy(false);
    if (!ok) {
      setError(body.attemptsRemaining != null ? `${body.error} ${body.attemptsRemaining} tries left.` : body.error);
      setCode("");
      if (body.restart) setStep("email");
      return;
    }
    setStep("password");
  }

  async function complete(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError(null);
    const { ok, body } = await post("/api/auth/signup/complete", { displayName: name, password: pw, confirmPassword: pw2 });
    setBusy(false);
    if (!ok) {
      setError(body.error);
      if (body.restart) { setStep("email"); setPw(""); setPw2(""); }
      if (body.signIn) { setPw(""); setPw2(""); }
      return;
    }
    setPw(""); setPw2("");
    router.replace(body.redirect);
    router.refresh();
  }

  const current = STEPS.findIndex((x) => x.key === step);

  return (
    <div className="space-y-7">
      <ol className="grid grid-cols-3 gap-2" aria-label="Sign-up progress">
        {STEPS.map((st, i) => (
          <li key={st.key} className="space-y-1.5">
            <span className={cn("block h-2 rounded-full border-2 border-ink transition-colors duration-500", current >= i ? "bg-primary" : "bg-card")} />
            <span className={cn("eyebrow block text-[10px]", current >= i ? "text-ink" : "text-muted-foreground")} aria-hidden>0{i + 1} {st.label}</span>
            <span className="sr-only">{`Step ${i + 1} of 3${st.key === step ? " (current)" : ""}`}</span>
          </li>
        ))}
      </ol>

      {step === "email" && (
        <form onSubmit={requestCode} className="space-y-6" noValidate>
          <Heading kicker="Join your campus" sub={<>We&apos;ll email a 6-digit code to confirm you&apos;re a student.</>}>
            Create your <span className="font-serif font-normal italic text-primary">account</span>
          </Heading>
          <div className="space-y-2">
            <Label htmlFor="su-email">University email</Label>
            <Input id="su-email" type="email" autoComplete="email" inputMode="email" placeholder="you@school.edu"
              value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} />
          </div>
          {error && <p role="alert" className={alert}>{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || !email || cooldown > 0}>
            {busy ? "Sending code…" : cooldown > 0 ? `Send code in ${cooldown}s` : "Send code"}
          </Button>
          <p className="border-t-2 border-dashed border-ink/20 pt-5 text-center text-sm text-muted-foreground">
            Have an account? <Link href="/login" className="font-display font-bold text-primary underline decoration-pop decoration-[3px] underline-offset-4">Sign in</Link>
          </p>
        </form>
      )}

      {step === "code" && (
        <div className="space-y-6">
          <Heading kicker="Step two" sub={<>Enter the code we sent to <span className="font-bold text-ink">{masked}</span>.</>}>
            Check your <span className="font-serif font-normal italic text-primary">email</span>
          </Heading>
          {campus?.status === "new" && (
            <p className="rounded-xl border-2 border-ink bg-pop p-3 text-sm font-bold shadow-brut-sm">
              Your school is new here. You can browse right away; posting opens once your campus is reviewed.
            </p>
          )}
          {campus?.name && campus.status === "active" && <p className="eyebrow text-muted-foreground">✶ Joining {campus.name}</p>}
          <CodeInput value={code} onChange={setCode} onComplete={verify} invalid={Boolean(error)} disabled={busy} />
          {error && <p role="alert" className={alert}>{error}</p>}
          <Button size="lg" className="w-full" onClick={() => verify()} disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Verify code"}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="font-bold text-muted-foreground underline decoration-2 underline-offset-4 hover:text-ink" onClick={() => { setStep("email"); setError(null); }}>Change email</button>
            <button type="button" className="font-bold text-primary underline decoration-2 underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
              disabled={cooldown > 0 || busy} onClick={() => requestCode()}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {step === "password" && (
        <form onSubmit={complete} className="space-y-6" noValidate>
          <Heading kicker="Last step" sub="Email confirmed. One more step.">
            Set your <span className="font-serif font-normal italic text-primary">password</span>
          </Heading>
          <div className="space-y-2">
            <Label htmlFor="su-name">Display name</Label>
            <Input id="su-name" autoComplete="nickname" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="new-password" describedBy="pw-rules" />
          <ul id="pw-rules" className="space-y-1.5 text-sm">
            {s.checks.map((c) => (
              <li key={c.label} className={cn("flex items-center gap-2 transition-colors", c.ok ? "font-bold text-success" : "text-muted-foreground")}>
                <span aria-hidden className={cn("grid h-5 w-5 place-items-center rounded-full border-2 text-[10px] transition-all",
                  c.ok ? "scale-110 border-success bg-success text-white" : "border-ink/25")}>{c.ok ? "✓" : ""}</span>
                <span><span className="sr-only">{c.ok ? "Done: " : "To do: "}</span>{c.label}</span>
              </li>
            ))}
          </ul>
          <PasswordField label="Confirm password" value={pw2} onChange={setPw2} autoComplete="new-password"
            error={mismatch ? "Passwords don't match" : undefined} />
          {error && <p role="alert" className={alert}>{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>{busy ? "Creating account…" : "Create account"}</Button>
        </form>
      )}
    </div>
  );
}
