import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";

/** Split layout: campus-colored poster panel + form. Stacks on mobile. */
export function AuthShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden border-b-2 border-ink bg-primary p-7 text-primary-foreground lg:border-b-0 lg:border-r-2 lg:p-14">
        <Link href="/" aria-label="Bama Buy home" className="relative z-10 w-fit"><Logo compact={false} onColor /></Link>

        <div className="relative z-10 my-10 max-w-lg lg:my-0">
          <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.9] tracking-[-0.05em] lg:text-[4.6rem]">
            Swap what you have for what your <span className="font-serif font-normal italic">semester</span> needs.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed opacity-90">
            Textbooks, dorm gear, lab kits, rides. Matched across campuses, timed to move-in and finals.
          </p>
        </div>

        <div className="relative z-10 eyebrow opacity-85">{aside ?? <p>Students only ✶ Sign up with your .edu email</p>}</div>

        {/* Decorative stickers */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
          <span className="sticker absolute right-14 top-24 animate-float px-3 py-1 text-2xl" style={{ "--r": "10deg" } as React.CSSProperties}>$25</span>
          <span className="absolute right-28 top-56 animate-float rounded-full border-2 border-ink bg-card px-3 py-1.5 font-display text-sm font-extrabold text-ink shadow-brut" style={{ "--r": "-6deg", animationDelay: "-3s" } as React.CSSProperties}>FREE ✶ pickup today</span>
          <span className="absolute -bottom-24 -right-16 font-serif text-[22rem] italic leading-none opacity-[0.08]">b</span>
        </div>
      </section>
      <section className="flex items-center justify-center p-6 py-12 sm:p-10">
        <div className="w-full max-w-sm rise">{children}</div>
      </section>
    </main>
  );
}
