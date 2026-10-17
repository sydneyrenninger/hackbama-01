"use client";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/** Six tiles: auto-advance, paste a full code, backspace walks back, arrows move. */
export function CodeInput({ value, onChange, onComplete, invalid, disabled }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; invalid?: boolean; disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };
  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  return (
    <div className="flex gap-2 sm:gap-3" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} pattern="\d*" maxLength={6}
          aria-label={`Digit ${i + 1}`} aria-invalid={invalid} disabled={disabled} value={d}
          className={cn(
            "h-16 w-12 rounded-lg border-2 bg-card text-center font-display text-3xl font-bold tabular-nums outline-none transition-colors sm:h-[4.5rem] sm:w-14",
            d ? "border-primary" : "border-border", "focus:border-primary focus:bg-secondary",
            invalid && "border-destructive",
          )}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return;
            if (typed.length > 1) { set(typed); focus(typed.length); return; }
            const arr = digits.slice(); arr[i] = typed; set(arr.join("").slice(0, 6));
            focus(i + 1);
          }}
          onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text"); set(t); focus(t.replace(/\D/g, "").length); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              const arr = digits.slice();
              if (arr[i]) { arr[i] = ""; set(arr.join("")); } else { arr[i - 1] = ""; set(arr.join("")); focus(i - 1); }
            } else if (e.key === "ArrowLeft") focus(i - 1);
            else if (e.key === "ArrowRight") focus(i + 1);
          }}
        />
      ))}
    </div>
  );
}
