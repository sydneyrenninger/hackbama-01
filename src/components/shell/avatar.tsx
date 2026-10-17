import { avatarUrl } from "@/lib/media/url";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Round avatar: photo if set, otherwise initials on the campus color. */
export function Avatar({ name, path, size = "md", className }: {
  name: string | null | undefined; path?: string | null; size?: "sm" | "md" | "lg" | "xl"; className?: string;
}) {
  const dims = { sm: "h-8 w-8 text-[11px]", md: "h-11 w-11 text-sm", lg: "h-14 w-14 text-lg", xl: "h-24 w-24 text-3xl" }[size];
  const url = avatarUrl(path ?? null);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- public storage URL, no Next image config needed
    <img src={url} alt="" className={cn("shrink-0 rounded-full border-2 border-ink object-cover", dims, className)} />
  ) : (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full border-2 border-ink bg-primary font-display font-extrabold tracking-tight text-primary-foreground", dims, className)}>
      {initials(name)}
    </span>
  );
}
