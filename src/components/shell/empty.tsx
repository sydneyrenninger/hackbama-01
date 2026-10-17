import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dashed "nothing pinned here yet" slot. */
export function Empty({ children, className, mark = "✶" }: { children: ReactNode; className?: string; mark?: string }) {
  return (
    <div className={cn("relative rounded-2xl border-2 border-dashed border-ink/25 bg-card/40 px-6 py-12 text-center text-muted-foreground", className)}>
      <span aria-hidden className="mx-auto mb-3 grid h-10 w-10 rotate-[-8deg] place-items-center rounded-full border-2 border-ink bg-pop font-display text-lg font-extrabold text-ink shadow-brut-sm">
        {mark}
      </span>
      <div className="mx-auto max-w-sm">{children}</div>
    </div>
  );
}
