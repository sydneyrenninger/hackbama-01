import { redirect } from "next/navigation";
import { CampusTheme } from "@/components/campus-theme";
import { Button } from "@/components/ui/button";
import { setActiveCampus } from "@/server/actions/campus";
import { getAppContext } from "@/server/queries/context";

export default async function AppHome() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/?next=/app");
  if (!ctx.profile) {
    return <main className="p-8">Your account setup didn't finish. Sign out and sign up again, or contact support.</main>;
  }
  const memberIds = new Set(ctx.memberships.map((m) => m.tenant_id));
  const active = ctx.activeTenant;
  const canPostHere = active ? memberIds.has(active.id) && active.status === "active" : false;

  return (
    <CampusTheme tenant={active} className="min-h-dvh">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="font-display text-xl font-bold">Quad Exchange</p>
            <p className="text-sm opacity-90">Browsing {active?.name ?? "your campus"}</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <Button variant="secondary" size="sm" type="submit">Sign out</Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        <section>
          <h1 className="font-display text-3xl font-bold">Hi, {ctx.profile.display_name}</h1>
          <p className="mt-1 text-muted-foreground">
            Home campus: {ctx.homeTenant?.name ?? "Unknown"}
            {ctx.homeTenant?.status === "pending" && " (under review: browsing only for now)"}
          </p>
          {active?.welcome_text && <p className="mt-3 max-w-prose">{active.welcome_text}</p>}
        </section>

        <section aria-labelledby="campus-h" className="rounded-lg border border-border bg-card p-5">
          <h2 id="campus-h" className="font-display text-xl font-bold">Choose a campus to browse</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browsing another campus lets you see its listings. It doesn't make you a member there.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {ctx.tenants.filter((t) => t.status === "active" || memberIds.has(t.id)).map((t) => (
              <li key={t.id}>
                <form action={setActiveCampus}>
                  <input type="hidden" name="tenantId" value={t.id} />
                  <input type="hidden" name="scope" value={t.id === ctx.profile!.home_tenant_id ? "home" : "network"} />
                  <button type="submit" aria-current={t.id === active?.id}
                    className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-muted aria-[current=true]:border-primary aria-[current=true]:bg-secondary">
                    <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: t.primary_color }} aria-hidden />
                    <span>
                      <span className="block font-semibold">{t.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {memberIds.has(t.id) ? "Verified member" : "Visitor: browse and make offers where allowed"}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            {canPostHere ? "You can post listings and requests on this campus." : "You can browse this campus. Posting requires membership."}
          </p>
        </section>
      </div>
    </CampusTheme>
  );
}
