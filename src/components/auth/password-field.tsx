"use client";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string;
  error?: string; describedBy?: string; name?: string;
};

export function PasswordField({ label, value, onChange, autoComplete, error, describedBy, name }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const errId = `${id}-err`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} name={name} type={visible ? "text" : "password"} value={value} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)}
          aria-describedby={[error ? errId : null, describedBy].filter(Boolean).join(" ") || undefined}
          className="pr-12" />
        <button type="button" onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-1 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-ink"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p id={errId} className="text-sm font-bold text-destructive">{error}</p>}
    </div>
  );
}
