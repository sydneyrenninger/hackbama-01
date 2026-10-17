import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AppFrame } from "@/components/shell/app-frame";
import { PageHeader } from "@/components/shell/page-header";
import { readableOn } from "@/lib/theme/colors";
import { cn } from "@/lib/utils";
import { getAppContext } from "@/server/queries/context";

const safeOn = (hex: string) => { try { return readableOn(hex); } catch { return "#FFFFFF"; } };

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
      <div className="space-y-10">
        <PageHeader kicker={`${campuses.length} campus${campuses.length === 1 ? "" : "es"}`} title="Pick a" accent="campus.">
          Browse any campus&apos;s listings and requests. Visiting doesn&apos;t make you a member, and some campuses limit who can send offers.
        </PageHeader>
        <ul className="grid gap-6 sm:grid-cols-2">
          {campuses.map((t, i) => {
            const home = t.id === ctx.profile.home_tenant_id;
            const on = safeOn(t.primary_color);
            return (
              <li key={t.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                <Link href={`/c/${t.slug}`}
                  className="lift group flex h-full overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-brut">
                  {/* Pennant */}
                  <div className="relative w-28 shrink-0 border-r-2 border-ink sm:w-32" style={{ background: t.secondary_color }} aria-hidden>
                    <div className="absolute inset-y-3 left-0 right-2 grid place-items-center pr-6 transition-transform duration-500 [clip-path:polygon(0_0,100%_50%,0_100%)] group-hover:-rotate-3"
                      style={{ background: t.primary_color, color: on }}>
                      <span className="font-display text-xl font-extrabold tracking-[-0.04em]">{t.short_name}</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-xl font-extrabold leading-tight tracking-[-0.03em]">{t.name}</h2>
                      <span className={cn("eyebrow shrink-0 rounded-md px-1.5 py-0.5 text-[9px]",
                        home ? "bg-pop text-ink" : memberIds.has(t.id) ? "bg-ink text-paper" : "border-2 border-ink/15 text-muted-foreground")}>
                        {home ? "Your campus" : memberIds.has(t.id) ? "Member" : "Visitor"}
                      </span>
                    </div>
                    {t.welcome_text && <p className="line-clamp-2 text-sm text-muted-foreground">{t.welcome_text}</p>}
                    <span className="mt-auto flex items-center gap-1 pt-2 font-display text-sm font-bold">
                      Browse {t.short_name} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="eyebrow text-muted-foreground">
          ✶ Don&apos;t see your school? Anyone with a .edu email can sign up, and the campus is added automatically.
        </p>
      </div>
    </AppFrame>
  );
}
