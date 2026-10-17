import { cn } from "@/lib/utils";

/** Price-tag mark + wordmark. `compact` hides the wordmark on small screens. */
export function Logo({ compact = true, className, onColor }: { compact?: boolean; className?: string; onColor?: boolean }) {
  return (
    <span className={cn("group inline-flex items-center gap-2", className)}>
      <span aria-hidden className="relative grid h-10 w-10 -rotate-6 place-items-center rounded-[0.7rem] border-2 border-ink bg-primary shadow-brut-sm transition-transform duration-300 group-hover:rotate-3">
        <span className="font-display text-xl font-extrabold leading-none tracking-[-0.06em] text-primary-foreground">B</span>
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-[1.5px] border-ink bg-pop" />
      </span>
      <span className={cn("items-baseline font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.05em]", compact ? "hidden sm:flex" : "flex", onColor ? "text-current" : "text-ink")}>
        Bama<span className="ml-1 -rotate-3 rounded-md border-2 border-ink bg-pop px-1.5 py-0.5 font-serif text-[1.2rem] font-normal italic tracking-normal text-ink">Buy</span>
      </span>
    </span>
  );
}
