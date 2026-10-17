import Link from "next/link";
import { ArrowRight, BookOpen, Film, Hand, Lamp, PlaySquare, School, Ticket } from "lucide-react";
import { CampusTheme } from "@/components/campus-theme";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

// Bama Buy's own colors for the signed-out landing page (campus pages use each campus's theme).
const BRAND = { primary_color: "#9E1B32", secondary_color: "#828A8F" };

const FEATURES = [
  { icon: PlaySquare, title: "Scroll it like reels", body: "Search for what you need, then scroll through the results full screen. Save it, ask a question, or send an offer in one tap." },
  { icon: Hand, title: "Post what you need", body: "Request a lab kit, a ride or a tutor in a channel. Sellers see it and offer what you're looking for." },
  { icon: Film, title: "Show it off", body: "Post photos or a short video with a caption. Tag it by major, club or category so the right people find it." },
  { icon: School, title: "Every campus, verified", body: "Sign up with your .edu email and join your campus. Browse other schools to buy and sell across campuses." },
];

const BAND = ["Textbooks", "Dorm gear", "Lab kits", "Gameday tix", "Rides home", "Tutoring", "Mini fridges", "Calculators", "Formal wear"];

export default async function Home() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: campuses }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("tenants").select("slug, name, short_name, primary_color").eq("status", "active").order("name").limit(24),
  ]);
  const list = (campuses ?? []) as { slug: string; name: string; short_name: string; primary_color: string }[];

  return (
    <CampusTheme tenant={BRAND} className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo compact={false} />
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm"><Link href="/app">Open Bama Buy</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link href="/signup">Sign up</Link></Button>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 sm:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
          <div className="rise">
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-3 py-1.5 shadow-brut-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />The campus marketplace
            </p>
            <h1 className="mt-6 font-display text-[3.4rem] font-extrabold leading-[0.86] tracking-[-0.055em] sm:text-[5.5rem] lg:text-[6.4rem]">
              Buy, sell <span className="font-serif font-normal italic tracking-[-0.03em]">&amp;</span> trade
              <span className="mt-1 block font-serif font-normal italic tracking-[-0.035em] text-primary">on campus.</span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
              The student marketplace for your campus. Scroll listings like reels, post what you need, and deal with students at
              <span className="hl font-bold text-ink"> your school and beyond</span>.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {user ? (
                <Button asChild size="lg"><Link href="/app">Open Bama Buy <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
              ) : (
                <>
                  <Button asChild size="lg"><Link href="/signup">Create your account <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
                  <Button asChild variant="outline" size="lg"><Link href="/login">Sign in</Link></Button>
                </>
              )}
            </div>
            <p className="eyebrow mt-8 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>✶ .edu verified</span><span>✶ Free to use</span>{list.length > 0 && <span>✶ {list.length} campus{list.length === 1 ? "" : "es"} live</span>}
            </p>
          </div>

          <Collage />
        </section>

        {/* Category band */}
        <div aria-hidden className="relative z-10 -mx-4 -rotate-[1.5deg] overflow-hidden border-y-2 border-ink bg-ink py-4 text-paper shadow-[0_6px_0_0_var(--campus)]">
          <div className="flex w-max animate-marquee">
            {[0, 1].map((k) => (
              <p key={k} className="flex shrink-0 items-center font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
                {BAND.map((w, i) => (
                  <span key={i} className="flex items-center">
                    <span className={i % 3 === 1 ? "px-6 font-serif font-normal italic text-pop" : "px-6"}>{w}</span>
                    <span className="text-primary">✶</span>
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-24" aria-labelledby="how">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-10 lg:self-start">
              <p className="eyebrow text-muted-foreground">How it works</p>
              <h2 id="how" className="mt-3 font-display text-5xl font-extrabold leading-[0.9] tracking-[-0.045em] sm:text-6xl">
                Made for <span className="font-serif font-normal italic text-primary">campus</span>, not for strangers.
              </h2>
              <p className="mt-5 max-w-sm text-muted-foreground">Everyone here has a student email. Meet up between classes, not in a parking lot across town.</p>
            </div>
            <ol className="border-t-2 border-ink">
              {FEATURES.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="group grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-b-2 border-ink py-7 sm:grid-cols-[5rem_auto_1fr]">
                  <span className="font-display text-5xl font-extrabold leading-none tracking-[-0.06em] text-ink/15 transition-colors group-hover:text-primary sm:text-6xl">
                    0{i + 1}
                  </span>
                  <span className="row-start-1 hidden h-12 w-12 place-items-center rounded-xl border-2 border-ink bg-pop shadow-brut-sm transition-transform group-hover:-rotate-6 sm:col-start-2 sm:grid">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="sm:col-start-3">
                    <h3 className="font-display text-2xl font-extrabold tracking-[-0.03em]">{title}</h3>
                    <p className="mt-1.5 max-w-md leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {list.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 pb-20" aria-labelledby="campuses">
            <p className="eyebrow text-muted-foreground">The network</p>
            <h2 id="campuses" className="mt-3 font-display text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">
              Live on {list.length} campus{list.length === 1 ? "" : "es"}
            </h2>
            <ul className="mt-7 flex flex-wrap gap-3">
              {list.map((c, i) => (
                <li key={c.slug} style={{ "--i": i } as React.CSSProperties}
                  className="rise flex items-center gap-2.5 rounded-full border-2 border-ink bg-card py-1.5 pl-1.5 pr-4 font-display text-sm font-bold shadow-brut-sm">
                  <span aria-hidden className="h-7 w-9 border-2 border-ink [clip-path:polygon(0_0,100%_50%,0_100%)]" style={{ background: c.primary_color }} />
                  {c.name}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-muted-foreground">Don&apos;t see yours? Sign up with your .edu email and your campus is added automatically.</p>
          </section>
        )}

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-ink bg-primary px-6 py-14 text-primary-foreground shadow-brut-lg sm:px-12 sm:py-20">
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 select-none font-serif text-[16rem] italic leading-none opacity-15">$</span>
            <h2 className="relative max-w-2xl font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-6xl">
              Last semester&apos;s stuff is <span className="font-serif font-normal italic">someone&apos;s</span> next semester.
            </h2>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <Button asChild variant="secondary" size="lg">
                <Link href={user ? "/app" : "/signup"}>{user ? "Open Bama Buy" : "Start selling"} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t-2 border-ink px-5 py-6">
        <Logo compact={false} className="scale-90 origin-left" />
        <p className="eyebrow text-muted-foreground">Students only ✶ Built at Hackbama</p>
      </footer>
    </CampusTheme>
  );
}

/** Decorative pinboard of example listings. */
function Collage() {
  const cards = [
    { icon: BookOpen, title: "Calc II textbook", meta: "Ferguson Ctr", price: "$25", bg: "linear-gradient(135deg,#ffd23f,#ff8a3d)", pos: "left-[2%] top-[6%]", r: "-7deg", delay: "0s" },
    { icon: Ticket, title: "Gameday tix ×2", meta: "Bryant-Denny", price: "Trade", bg: "linear-gradient(135deg,#9e1b32,#3b0a14)", pos: "right-[0%] top-[0%]", r: "6deg", delay: "-2s" },
    { icon: Lamp, title: "Desk lamp", meta: "Tutwiler Hall", price: "Free", bg: "linear-gradient(135deg,#7fd1c7,#2f5d8a)", pos: "left-[22%] bottom-[0%]", r: "3deg", delay: "-4s" },
  ];
  return (
    <div aria-hidden className="relative mx-auto h-[400px] w-full max-w-[460px] sm:h-[480px]">
      <div className="absolute inset-6 rotate-2 rounded-[2rem] border-2 border-dashed border-ink/20" />
      {cards.map(({ icon: Icon, title, meta, price, bg, pos, r, delay }) => (
        <div key={title} className={`absolute ${pos} w-[52%] animate-float`} style={{ "--r": r, animationDelay: delay } as React.CSSProperties}>
          <div className="relative rounded-2xl border-2 border-ink bg-card p-2 shadow-brut-lg tape">
            <div className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-ink" style={{ background: bg }}>
              <Icon className="h-12 w-12 text-white drop-shadow-[2px_2px_0_var(--ink)]" strokeWidth={2.2} />
            </div>
            <div className="flex items-end justify-between gap-2 px-1 pb-1 pt-2.5">
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-extrabold leading-tight tracking-[-0.02em]">{title}</p>
                <p className="eyebrow mt-0.5 text-[9px] text-muted-foreground">{meta}</p>
              </div>
              <span className="sticker shrink-0 -rotate-6 text-sm">{price}</span>
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-[30%] right-[2%] max-w-[13rem] rotate-3 rounded-2xl rounded-br-sm border-2 border-ink bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-brut">
        Is this still available? 👀
      </div>
      <div className="absolute left-[0%] top-[52%] -rotate-3 rounded-full border-2 border-ink bg-card px-3.5 py-2 font-display text-sm font-extrabold shadow-brut">
        <span className="mr-1.5 inline-grid h-5 w-5 place-items-center rounded-full bg-success text-[11px] text-white">✓</span>Offer accepted
      </div>
    </div>
  );
}
