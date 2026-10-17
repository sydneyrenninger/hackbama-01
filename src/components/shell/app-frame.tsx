import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { CampusTheme } from "@/components/campus-theme";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/server/queries/context";
import { Avatar } from "./avatar";
import { BottomNav } from "./bottom-nav";
import { CampusSwitcher } from "./campus-switcher";

/**
 * Signed-in page frame: campus theme, header (logo, campus switcher, account), bottom tabs.
 * - campusSlug: the campus being viewed (/c/[campus]); omit on /account, /u/[id], /communities
 *   and the user's active campus is used.
 * - Sends signed-out users to /login and un-onboarded users to /onboarding.
 */
export async function AppFrame({ campusSlug, children }: { campusSlug?: string; children: React.ReactNode }) {
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

  return (
    <CampusTheme tenant={tenant} className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href={`/c/${tenant.slug}`} className="whitespace-nowrap font-display text-xl font-extrabold text-primary sm:text-2xl">Bama Buy</Link>
          <CampusSwitcher current={tenant.slug} options={options} />
          <span className="flex-1" />
          <Link href="/communities" aria-label="All campuses" className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <Users className="h-5 w-5" aria-hidden />
          </Link>
          <Link href="/dashboard" aria-label="Your dashboard">
            <Avatar name={ctx.profile.display_name} path={ctx.profile.avatar_path} size="sm" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6">{children}</main>
      <BottomNav slug={tenant.slug} inboxBadge={(pending.count ?? 0) + unread} />
    </CampusTheme>
  );
}
