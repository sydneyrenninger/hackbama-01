import Link from "next/link";
import { ArrowRight, Film, Hand, PlaySquare, School } from "lucide-react";
import { CampusTheme } from "@/components/campus-theme";
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

export default async function Home() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: campuses }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("tenants").select("slug, name, short_name, primary_color").eq("status", "active").order("name").limit(24),
  ]);
  const list = (campuses ?? []) as { slug: string; name: string; short_name: string; primary_color: string }[];

  return (
    <CampusTheme tenant={BRAND} className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="font-display text-2xl font-extrabold text-primary">Bama Buy</span>
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
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
            <p className="text-sm font-semibold uppercase tracking-widest opacity-80">The campus marketplace</p>
            <h1 className="mt-3 max-w-3xl font-display text-5xl font-extrabold leading-[1.02] sm:text-7xl">
              Buy, sell and trade on campus.
            </h1>
            <p className="mt-5 max-w-xl text-lg opacity-90">
              The student marketplace for your campus. Scroll listings like reels, post what you need, and deal with students at your school and beyond.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Button asChild variant="secondary" size="lg"><Link href="/app">Open Bama Buy <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
              ) : (
                <>
                  <Button asChild variant="secondary" size="lg"><Link href="/signup">Create your account <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
                  <Button asChild variant="outline" size="lg" className="border-white/40 bg-transparent text-primary-foreground hover:bg-white/10">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-14" aria-labelledby="how">
          <h2 id="how" className="font-display text-3xl font-bold">Made for campus</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-lg border border-border bg-card p-5">
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                <h3 className="mt-3 font-display text-xl font-bold">{title}</h3>
                <p className="mt-1 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {list.length > 0 && (
          <section className="mx-auto max-w-5xl px-5 pb-20" aria-labelledby="campuses">
            <h2 id="campuses" className="font-display text-3xl font-bold">Live on {list.length} campus{list.length === 1 ? "" : "es"}</h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {list.map((c) => (
                <li key={c.slug} className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold">
                  <span className="h-3 w-3 rounded-full" style={{ background: c.primary_color }} aria-hidden />{c.name}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-muted-foreground">Don&apos;t see yours? Sign up with your .edu email and your campus is added automatically.</p>
          </section>
        )}
      </main>
    </CampusTheme>
  );
}
