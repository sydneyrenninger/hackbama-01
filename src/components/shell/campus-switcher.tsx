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
    <>
      <label htmlFor="campus-switcher" className="sr-only">Campus</label>
      <select id="campus-switcher" value={current} onChange={(e) => go(e.target.value)}
        className="h-10 max-w-[11rem] truncate rounded-full border border-border bg-card px-3 text-sm font-semibold outline-none focus-visible:border-primary sm:max-w-xs">
        {options.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
      </select>
    </>
  );
}
