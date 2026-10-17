# Swapp

Campus Tinder for stuff: swipe on what you need, and what you need swipes back.

**Stack:** Next.js 15 (App Router) · Tailwind v4 · Supabase (Postgres, Auth, RLS, Storage) · Framer Motion · Vercel

## Setup

1. Create a Supabase project.
2. In its SQL editor, run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
3. `cp .env.example .env.local` and fill in your project URL + anon key.
4. `npm install && npm run dev`

## Structure

```
src/
  app/
    page.tsx                  landing (empty)
    (auth)/login, verify      .edu magic-link sign-in
    communities/              cross-campus interest communities
    c/[campus]/               everything tenant-scoped (/c/ua, /c/auburn)
      layout.tsx              loads campus row, sets theme CSS vars
      swipe/                  swipe deck (listings <-> requests)
      reels/                  vertical reels feed
      requests/               wanted requests
      matches/                matches + chat
      sell/                   create listing / reel
    api/swipe/route.ts        records a swipe (DB trigger creates matches)
  lib/
    supabase/                 browser, server, middleware clients
    tenant.ts                 campus lookup by slug / email domain
  types/db.ts                 TS types for every table
  middleware.ts               refreshes Supabase session
supabase/
  migrations/0001_init.sql    schema, triggers, RLS, storage bucket
  seed.sql                    UA + Auburn tenants, communities
```

## How it maps to the pitch

- **Multi-tenant:** each campus is a row in `campuses` (domain, theme, logo, pickup spots). Adding a school = one `insert`.
- **Campus-verified:** the `handle_new_user` trigger maps the signup email domain to a campus and rejects unknown domains.
- **Two-way matching:** a right swipe inserts into `swipes`, and the `handle_swipe` trigger creates a `matches` row (buyer → listing, or seller → request with an offered listing).
- **Cross-campus:** reads are open to every signed-in user, and `communities.campus_id = null` means a community spans schools.
- **Theming:** use Tailwind's `bg-campus` / `text-campus` classes, which read the active tenant's colors.
