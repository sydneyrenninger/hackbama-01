import type { ReactNode } from "react";

/** Split layout: campus-colored story panel + form. Stacks on mobile. */
export function AuthShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground lg:p-14">
        <p className="font-display text-xl font-bold">Swapp</p>
        <div className="my-10 max-w-md lg:my-0">
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] lg:text-6xl">
            Swap what you have for what your semester needs.
          </h1>
          <p className="mt-5 text-lg opacity-90">
            Textbooks, dorm gear, lab kits, rides. Matched across campuses, timed to move-in and finals.
          </p>
        </div>
        {aside ?? <p className="text-sm opacity-80">Students only. Sign up with your .edu email.</p>}
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
