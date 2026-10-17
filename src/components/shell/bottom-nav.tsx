"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, ListChecks, Mail, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Floating bottom tabs: Buy / Sell / Requests / Inbox. Hidden inside a chat so the message box owns the bottom. */
export function BottomNav({ slug, inboxBadge = 0 }: { slug: string; inboxBadge?: number }) {
  const path = usePathname();
  const base = `/c/${slug}`;
  const tabs = [
    { label: "Buy", href: base, icon: Compass, active: path === base || path.startsWith(`${base}/swipe`) || path.startsWith(`${base}/reels`) || path.startsWith("/listing") },
    { label: "Sell", href: `${base}/sell`, icon: PlusCircle, active: path.startsWith(`${base}/sell`) },
    { label: "Requests", href: `${base}/requests`, icon: ListChecks, active: path.startsWith(`${base}/requests`) },
    { label: "Inbox", href: `${base}/matches`, icon: Mail, active: path.startsWith(`${base}/matches`), badge: inboxBadge },
  ];
  if (/\/matches\/[^/]+$/.test(path)) return null;

  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <ul className="pointer-events-auto flex gap-1 rounded-full border border-border bg-card/90 p-1.5 shadow-lg backdrop-blur">
        {tabs.map(({ label, href, icon: Icon, active, badge }) => (
          <li key={label}>
            <Link href={href} aria-current={active ? "page" : undefined}
              className={cn("relative flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-colors sm:px-4",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              <Icon className="h-4 w-4" aria-hidden />
              <span>{label}</span>
              {badge ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
                  <span className="sr-only">{badge} new, </span>{badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
