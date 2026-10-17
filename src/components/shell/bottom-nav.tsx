"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, ListChecks, Mail, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Floating bottom dock: Buy / Sell / Requests / Inbox. Hidden inside a chat so the message box owns the bottom. */
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
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-3 pb-[env(safe-area-inset-bottom)]">
      <ul className="pointer-events-auto flex gap-1 rounded-[1.35rem] border-2 border-ink bg-ink p-1.5 shadow-[4px_4px_0_0_var(--campus)]">
        {tabs.map(({ label, href, icon: Icon, active, badge }) => (
          <li key={label}>
            <Link href={href} aria-current={active ? "page" : undefined}
              className={cn("relative flex items-center gap-1.5 rounded-2xl px-3 py-2.5 font-display text-[13px] font-bold tracking-[-0.01em] transition-all duration-200 sm:px-4 sm:text-sm",
                active ? "bg-pop text-ink" : "text-paper/70 hover:bg-paper/10 hover:text-paper")}>
              <Icon className={cn("h-4 w-4 transition-transform duration-300", active && "-rotate-6 scale-110")} aria-hidden strokeWidth={active ? 2.6 : 2} />
              <span>{label}</span>
              {badge ? (
                <span className="absolute -right-1 -top-1.5 grid h-5 min-w-5 animate-pop place-items-center rounded-full border-2 border-ink bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
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
