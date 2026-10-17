import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Editorial page title: mono kicker, oversized display heading with an optional serif-italic accent. */
export function PageHeader({ kicker, title, accent, actions, children, className }: {
  kicker?: ReactNode; title: ReactNode; accent?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b-2 border-ink pb-5", className)}>
      <div className="min-w-0">
        {kicker && (
          <p className="eyebrow flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary ring-2 ring-ink/10" aria-hidden />{kicker}
          </p>
        )}
        <h1 className="mt-2 font-display text-[2.6rem] font-extrabold leading-[0.92] tracking-[-0.045em] sm:text-6xl">
          {title}
          {accent && <> <span className="font-serif font-normal italic tracking-[-0.02em] text-primary">{accent}</span></>}
        </h1>
        {children && <div className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Section heading with a numbered tab, used down the page. */
export function SectionTitle({ id, n, children, aside }: { id?: string; n?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 id={id} className="flex items-baseline gap-2.5 font-display text-2xl font-extrabold tracking-[-0.03em]">
        {n && <span className="eyebrow -translate-y-[3px] rounded-md bg-ink px-1.5 py-0.5 text-[10px] text-paper">{n}</span>}
        {children}
      </h2>
      {aside}
    </div>
  );
}
