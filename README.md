# Swapp

Campus Tinder for stuff: swipe on what you need, and what you need swipes back.

**Stack:** Next.js 15 (App Router) · Tailwind v4 · Supabase (Postgres, Auth, RLS, Storage, Realtime) · zod · Framer Motion · Vercel

Backend schema, auth routes and server actions come from the `quad-backend` branch; project
structure, routes, tooling and deploy config come from `main`.

## Setup

1. Create a Supabase project.
2. `cp .env.example .env.local` and fill it in (see the comments in the file):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`
   - `SUPABASE_SECRET_KEY` (server only, creates accounts) and `VERIFICATION_PEPPER` (32+ random chars)
   - `SUPABASE_DB_URL` (local only, for `db:setup`)
3. `npm run db:setup` runs every file in `supabase/migrations/` in order, then `supabase/seed.sql`.
   It's for a **fresh** database only. For a new change, add the next numbered migration and run just that file.
4. `npm install && npm run dev`
5. Optional demo data: set `DEMO_USER_PASSWORD`, then `npm run seed:demo -- --yes`.

**Vercel env vars:** the same ones as `.env.local`, **except** `SUPABASE_DB_URL` and `DEMO_USER_PASSWORD`.
Set `NEXT_PUBLIC_APP_URL=https://hackbama-01.vercel.app`, and mark `SUPABASE_SECRET_KEY` and `VERIFICATION_PEPPER` as Sensitive.

## Structure

```
src/
  app/
    page.tsx                  landing (empty)
    (auth)/login/             .edu email + password sign-in
    signup/                   one-step signup (email, display name, password)
    forgot-password/, reset-password/, auth/confirm/   password reset (needs email; see below)
    onboarding/               first-run profile: major, grad year (actions.ts: completeOnboarding)
    app/                      signed-in home + campus switcher
    account/                  my profile, listings, requests
    communities/              Community tab: directory of campuses
    u/[id]/                   someone else's public profile
    c/[campus]/               everything campus-scoped (/c/ua, /c/auburn)
      layout.tsx              requires an onboarded account, applies the campus theme
      swipe/ reels/ requests/ matches/ sell/
    api/
      auth/signup             one-step signup (no email code)
      auth/signin, signout    password auth
      auth/signup/start|verify|complete, recovery/*   email-based flows, unused until email is on
      swipe/                  swipe a listing (pass / save / interest) or respond to a request
  components/
    auth/                     sign-in, signup, password field, auth layout
    ui/                       button, input, label (shadcn style)
    campus-theme.tsx          applies a campus's colors as CSS variables
  lib/
    auth.ts                   getAccount() / requireAccount(): user + profile + home campus
    tenant.ts                 campus lookup by slug / email
    supabase/                 browser, server, admin (secret key), middleware clients
    validation.ts             zod schemas for every input
    env.ts                    server env validation
    email/, auth/codes.ts     email sending + verification codes (inactive)
  server/
    actions/                  listings, requests, offers/swipes, messages, trades, campus
    queries/                  app context, search, swipe deck, offers, conversations
  types/db.ts                 TS types for the main tables
  middleware.ts               refreshes session, sends signed-out users to /login
supabase/
  migrations/                 schema, RLS, functions, storage (run in order)
  seed.sql                    UA, Auburn, Riverbend (demo) campuses
  tests/security.test.sql     RLS tests (pgTAP via `npm run test:db`)
scripts/
  db-setup.sh                 runs migrations + seed against SUPABASE_DB_URL
  seed-demo.ts                demo users + listings
tests/core.test.ts            unit tests (`npm test`)
```

## Accounts

Sign up with any `.edu` email and a password. The account is created right away (no email check yet)
and tied to that school's campus. Then `/onboarding`, then the app.
Every route except `/`, `/login`, `/signup`, password reset and `/api/auth/*` requires an account.
In server code, call `requireAccount()` to get `{ userId, email, profile, campus }`, or `getAppContext()`
for browse scope, memberships and the active campus.

**Email is skipped for now.** Signup doesn't verify the inbox, and password reset won't send
anything until Resend is configured (`RESEND_API_KEY`, `EMAIL_FROM` with a verified domain).
To turn verification on, point the signup form back at `/api/auth/signup/start` → `verify` → `complete`.

## How the backend works

- **Campuses (multi-tenant):** `tenants` + `tenant_domains` (subdomains match: crimson.ua.edu → ua.edu).
  A new `.edu` school gets an active campus automatically on its first signup. Branding it means updating one row.
- **Cross-campus:** a user's home campus and memberships are server-controlled. Browsing other campuses
  is a user setting (`user_settings`), and RLS decides what's visible and where you can post or make offers.
- **Swiping:** `swipe()` records pass / save / interest. Interest creates an **offer** to the seller.
  A seller can respond to a **request** with one of their listings (`respond_to_request`).
- **Conversations:** accepting an offer opens a private conversation (`respond_to_offer`). Messages are live via Realtime.
- **Trades:** `find_trade_matches` / `propose_exchange` support 2–3 person trades across campuses.
- **Security:** RLS on every exposed table; privileged logic runs in `security definer` SQL functions.
  The secret key is used only in server code (`lib/supabase/admin.ts`).
