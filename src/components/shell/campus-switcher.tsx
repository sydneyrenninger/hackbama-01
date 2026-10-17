"use client";
import { usePathname, useRouter } from "next/navigation";

export type CampusOption = { slug: string; name: string; short_name: string };

/** Campus dropdown. Keeps you on the same tab (/c/ua/requests -> /c/auburn/requests). */
export function CampusSwitcher({ current, options }: { current: string; options: CampusOption[] }) {
  const router = useRouter();
  const path = usePathname();

  function go(slug: string) {
    const m = /^\/c\/[^/]+(\/(?:swipe|reels|sell|requests|matches))?/.exec(path);
    router.push(`/c/${slug}${m?.[1] ?? ""}`);
  }

  return (
    <div className="relative w-[8.75rem] min-w-0 sm:w-60">
      <label htmlFor="campus-switcher" className="sr-only">Campus</label>
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-ink bg-primary" />
      <select id="campus-switcher" value={current} onChange={(e) => go(e.target.value)}
        className="field h-10 truncate rounded-full pl-8 font-display text-sm font-bold">
        {options.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
      </select>
    </div>
  );
}
