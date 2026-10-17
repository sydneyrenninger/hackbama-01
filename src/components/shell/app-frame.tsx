import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";
import { CampusTheme } from "@/components/campus-theme";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/server/queries/context";
import { Avatar } from "./avatar";
import { BottomNav } from "./bottom-nav";
import { CampusSwitcher } from "./campus-switcher";
import { Logo } from "./logo";

/**
 * Signed-in page frame: campus theme, header (logo, campus switcher, account), bottom tabs.
 * - campusSlug: the campus being viewed (/c/[campus]); omit on /account, /u/[id], /communities
 *   and the user's active campus is used.
 * - immersive: header only, children fill the rest of the screen (no bottom tabs).
 * - Sends signed-out users to /login and un-onboarded users to /onboarding.
 */
export async function AppFrame({ campusSlug, immersive = false, children }: { campusSlug?: string; immersive?: boolean; children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) {
    return <main className="p-8">Your account setup didn&apos;t finish. Sign out and sign up again, or contact support.</main>;
  }
  if (!ctx.profile.onboarded) redirect("/onboarding");

  const tenant = ctx.tenants.find((t) => t.slug === campusSlug) ?? ctx.activeTenant ?? ctx.homeTenant;
  if (!tenant) return <main className="p-8">No campus found for your account.</main>;

  const memberIds = new Set(ctx.memberships.map((m) => m.tenant_id));
  const options = ctx.tenants
    .filter((t) => t.status === "active" || memberIds.has(t.id))
    .map((t) => ({ slug: t.slug, name: t.name, short_name: t.short_name }));

  // Inbox badge: offers waiting for me + unread messages.
  const supabase = await createClient();
  const [pending, convs] = await Promise.all([
    supabase.from("offers").select("id", { count: "exact", head: true }).eq("recipient_id", ctx.user.id).eq("status", "pending"),
    supabase.rpc("my_conversations"),
  ]);
  const unread = ((convs.data ?? []) as { unread_count?: number }[]).reduce((n: number, c) => n + (c.unread_count ?? 0), 0);
  const ticker = ["Buy", "Sell", "Trade", tenant.name, "Textbooks", "Dorm gear", "Gameday tix", "Rides", "Tutoring", "Borrow it"];

  const header = (
    <header className="sticky top-0 z-30 shrink-0 border-b-2 border-ink bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-3">
        <Link href={`/c/${tenant.slug}`} aria-label="Bama Buy home" className="shrink-0"><Logo /></Link>
        <CampusSwitcher current={tenant.slug} options={options} />
        <span className="flex-1" />
        <Link href="/dashboard"
          className="flex h-10 items-center gap-1.5 rounded-full border-2 border-transparent px-2.5 font-display text-sm font-bold text-ink transition-colors hover:border-ink hover:bg-card sm:px-3">
          <LayoutDashboard className="h-5 w-5" aria-hidden /><span className="hidden sm:inline">Dashboard</span><span className="sr-only sm:hidden">Dashboard</span>
        </Link>
        <Link href="/communities" aria-label="All campuses"
          className="hidden h-10 w-10 place-items-center rounded-full border-2 border-transparent text-ink transition-colors hover:border-ink hover:bg-card sm:grid">
          <Users className="h-5 w-5" aria-hidden />
        </Link>
        <Link href="/dashboard" aria-label="Your dashboard" className="shrink-0 rounded-full transition-transform hover:-rotate-6 hover:scale-105">
          <Avatar name={ctx.profile.display_name} path={ctx.profile.avatar_path} size="md" className="h-10 w-10 shadow-brut-sm" />
        </Link>
      </div>
    </header>
  );

  // Immersive pages (the reel viewer) get the header on top and fill the rest of the screen.
  if (immersive) {
    return (
      <CampusTheme tenant={tenant} className="flex h-dvh flex-col overflow-hidden">
        {header}
        <div className="relative min-h-0 flex-1">{children}</div>
      </CampusTheme>
    );
  }

  return (
    <CampusTheme tenant={tenant} className="min-h-dvh">
      <div aria-hidden className="overflow-hidden border-b-2 border-ink bg-primary py-1 text-primary-foreground">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((k) => (
            <p key={k} className="eyebrow flex shrink-0 items-center text-[10px]">
              {ticker.map((w, i) => <span key={i} className="flex items-center"><span className="px-3">{w}</span><span className="opacity-60">✶</span></span>)}
            </p>
          ))}
        </div>
      </div>
      {header}
      <main className="mx-auto max-w-6xl px-4 pb-32 pt-7 sm:pt-10">{children}</main>
      <BottomNav slug={tenant.slug} inboxBadge={(pending.count ?? 0) + unread} />
    </CampusTheme>
  );
}
