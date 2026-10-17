import type { ReactNode } from "react";
import { Avatar } from "./avatar";

/** Profile header styled as a student ID card. */
export function IdCard({ name, avatarPath, campus, major, gradYear, trades, email, children }: {
  name: string; avatarPath: string | null; campus?: ReactNode; major?: string | null; gradYear?: number | null;
  trades: number; email?: string | null; children?: ReactNode;
}) {
  const rows: [string, ReactNode][] = [
    ["Major", major || "Undeclared"],
    ["Class", gradYear ? `’${String(gradYear).slice(-2)}` : "—"],
    ["Trades", trades],
  ];
  return (
    <section className="relative overflow-hidden rounded-[1.4rem] border-2 border-ink bg-card shadow-brut-lg">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-primary px-5 py-2.5 text-primary-foreground">
        <p className="eyebrow truncate">Student · {campus}</p>
        <p className="eyebrow shrink-0 opacity-80">Bama Buy ID</p>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="relative w-fit">
          <Avatar name={name} path={avatarPath} size="xl" className="rounded-2xl" />
          <span aria-hidden className="sticker absolute -bottom-2 -right-4 rotate-[8deg] text-[11px]">✓ verified</span>
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-extrabold leading-none tracking-[-0.045em] sm:text-5xl">{name}</h1>
          {email && <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">{email}</p>}
          <dl className="mt-4 grid max-w-md grid-cols-3 divide-x-2 divide-ink/10 rounded-xl border-2 border-ink/10">
            {rows.map(([k, v]) => (
              <div key={k} className="min-w-0 px-3 py-2">
                <dt className="eyebrow text-[10px] text-muted-foreground">{k}</dt>
                <dd className="truncate font-display text-lg font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {children && <div className="relative z-10 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-ink/20 px-5 py-4 sm:px-6">{children}</div>}
      <div aria-hidden className="pointer-events-none absolute right-5 top-14 hidden h-10 w-28 opacity-60 md:block"
        style={{ background: "repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 4px, var(--ink) 4px 5px, transparent 5px 8px, var(--ink) 8px 11px, transparent 11px 13px)" }} />
    </section>
  );
}
