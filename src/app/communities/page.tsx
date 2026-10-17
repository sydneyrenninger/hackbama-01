import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AppFrame } from "@/components/shell/app-frame";
import { getAppContext } from "@/server/queries/context";

// Community tab: directory of campuses. Every campus is browsable; membership comes from your .edu email.
export default async function CommunitiesPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/login");

  const memberIds = new Set(ctx.memberships.map((m) => m.tenant_id));
  const campuses = ctx.tenants.filter((t) => t.status === "active" || memberIds.has(t.id));
  // Your campus first, then alphabetical.
  campuses.sort((a, b) => Number(b.id === ctx.profile.home_tenant_id) - Number(a.id === ctx.profile.home_tenant_id) || a.name.localeCompare(b.name));

  return (
    <AppFrame>
      <h1 className="font-display text-3xl font-bold">Campuses</h1>
      <p className="mt-1 max-w-prose text-muted-foreground">
        Browse any campus&apos;s listings and requests. Visiting doesn&apos;t make you a member, and some campuses limit who can send offers.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {campuses.map((t) => {
          const home = t.id === ctx.profile.home_tenant_id;
          return (
            <li key={t.id}>
              <Link href={`/c/${t.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
                <div className="h-16" style={{ background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})` }} aria-hidden />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-bold">{t.name}</h2>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                      {home ? "Your campus" : memberIds.has(t.id) ? "Member" : "Visitor"}
                    </span>
                  </div>
                  {t.welcome_text && <p className="line-clamp-2 text-sm text-muted-foreground">{t.welcome_text}</p>}
                  <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-semibold text-primary">
                    Browse {t.short_name} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Don&apos;t see your school? Anyone with a .edu email can sign up, and the campus is added automatically.
      </p>
    </AppFrame>
  );
}
