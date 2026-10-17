# Bama Buy

The student marketplace for your campus: scroll listings like reels, post what you need, and buy, sell and trade across campuses.

**Stack:** Next.js 15 (App Router) · Tailwind v4 · Supabase (Postgres, Auth, RLS, Storage, Realtime) · zod · Framer Motion · Vercel

Backend schema, auth routes and server actions come from the `quad-backend` branch; project
structure, routes, tooling and deploy config come from `main`.

## Setup

1. Create a Supabase project.
2. `cp .env.example .env.local` and fill it in (see the comments in the file):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`
   - `SUPABASE_SECRET_KEY` (server only, creates accounts) and `VERIFICATION_PEPPER` (32+ random chars)
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD` (team Gmail + 16-char App Password; sends codes and reset links)
   - `SUPABASE_DB_URL` (local only, for `db:setup`)
3. `npm run db:setup` runs every file in `supabase/migrations/` in order, then `supabase/seed.sql`.
   It's for a **fresh** database only. For a new change, add the next numbered migration and run just that file.
4. `npm install && npm run dev`
5. Optional demo data: set `DEMO_USER_PASSWORD`, then `npm run seed:demo -- --yes`.
6. `npm run db:test` runs the database tests in `supabase/tests/` (rolled back, leaves no data).

**Vercel env vars:** the same ones as `.env.local`, **except** `SUPABASE_DB_URL` and `DEMO_USER_PASSWORD`.
Set `NEXT_PUBLIC_APP_URL=https://hackbama-01.vercel.app`, and mark `SUPABASE_SECRET_KEY` and `VERIFICATION_PEPPER` as Sensitive.

## Structure

```
src/
  app/
    page.tsx                  landing page (pitch, campuses, sign up / sign in)
    (auth)/login/             .edu email + password sign-in
    signup/                   signup: .edu email → 6-digit code → display name + password
    forgot-password/, reset-password/, auth/confirm/   password reset by email link
    onboarding/               first-run profile: name, major, grad year, bio (required once)
    app/                      post-login router: onboarding or your campus
    dashboard/                top-right avatar: stats, offers/unread to handle, shortcuts, my listings
    account/                  my profile (edit, photo), saved listings, my requests, sign out
    listing/[id]/             reel-style viewer: scroll the search results; View / Buy / Save / Comment
    communities/              Community tab: directory of campuses
    u/[id]/                   someone else's public profile + their listings
    c/[campus]/               everything campus-scoped (/c/ua, /c/auburn)
      layout.tsx              app frame: campus theme, header + campus switcher, bottom tabs
      page.tsx                Buy feed
      swipe/  reels/                                            (to build: stubs)
      sell/                   Sell tab: my listings (active/sold), mark sold / relist / remove,
                              requests I could fill (one-click offer)
      sell/new/               New post: photos (up to 8) or a reel (video), tags, price, trade wants
      requests/               channels, search, post a request, "I can help"
      requests/[channel]/     one channel's requests
      matches/                Inbox: offers to review, conversations, pending offers
      matches/[id]/           private chat (live via Realtime)
    api/
      auth/signup/start|verify|complete   send code → check code → create account
      auth/signin, signout    password auth
      auth/recovery/*, auth/password      password reset
      swipe/                  swipe a listing (pass / save / interest) or respond to a request
  components/
    shell/                    AppFrame (header, switcher, tabs), Avatar
    requests/                 request card + forms (new channel, post, respond, owner actions)
    inbox/                    offer accept/decline/withdraw, chat view
    sell/                     new-post form (uploads), seller listing actions, offer-a-listing button
    account/                  profile form (with photo upload)
    listing/                  ListingGrid: compact tiles for profile/saved lists
    auth/                     sign-in, signup, password field, auth layout
    ui/                       button, input, label (shadcn style)
    campus-theme.tsx          applies a campus's colors as CSS variables
  lib/
    format.ts                 timeAgo, money/budget parsing, initials, tag splitting
    media/                    upload helpers + public URLs for photos, videos, avatars
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
tests/                        unit tests (`npm test`)
prototype/                    click-through UI mockup (design reference; open index.html)
```

## Accounts

Sign up with any `.edu` email: we email a 6-digit code (Gmail SMTP), then you set a display name and
password. The account is tied to that school's campus. First login goes to `/onboarding` (name, major,
grad year, bio), which is required before using the app (`requireAccount()` and `AppFrame` enforce it).
Every route except `/`, `/login`, `/signup`, password reset and `/api/auth/*` requires an account.
In server code, call `requireAccount()` to get `{ userId, email, profile, campus }`, or `getAppContext()`
for browse scope, memberships and the active campus.

**Email** goes through a team Gmail account (`GMAIL_USER`, `GMAIL_APP_PASSWORD`). Without those set,
signup can't send codes (the start route returns a clear 503) and password reset sends nothing.
Gmail allows roughly 500 emails a day.

## How the backend works

- **Campuses (multi-tenant):** `tenants` + `tenant_domains` (subdomains match: crimson.ua.edu → ua.edu).
  A new `.edu` school gets an active campus automatically on its first signup. Branding it means updating one row.
- **Cross-campus:** a user's home campus and memberships are server-controlled. Browsing other campuses
  is a user setting (`user_settings`), and RLS decides what's visible and where you can post or make offers.
- **Search:** `searchListings()` ranks by relevance when there's text. `#tags` typed in the query
  become tag filters; it also sorts by newest or price. The same results feed the swipe deck.
- **Tags:** every listing needs 1–10 tags (requests optional). Stored lowercase without `#` (`#ECE` → `ece`).
- **Photos, videos and reels:** sellers upload their own files from the browser with `uploadListingMedia()`
  (`lib/media/upload.ts`): photos go to `listing-images` (5 MB), videos to `listing-videos` (50 MB),
  each in the uploader's own folder. A reel is a listing with `is_reel` and its video at position 0.
  `mediaUrl()` builds the public URL.
- **Swiping:** `swipe()` records pass / save / interest. Interest creates an **offer** to the seller.
  Saved listings: `getSavedListings()`.
- **Request channels:** Reddit-style topics anyone can browse (`getChannels`, `getChannel`) or create
  (`createChannel`, max 5 a day, unique names). Five starter channels ship with the migration.
  A seller responds to a request with a listing or a message (`respond_to_request`).
- **Conversations:** accepting an offer (on a listing or a request) opens a private chat between the two
  people (`respond_to_offer`). No chat exists until the recipient accepts. Messages are live via Realtime.
- **Seller tab / profiles:** `getMyListings`, `getMyRequests`, `getRequestsForMyListings`, `getPublicProfile`.
- **Trades:** `find_trade_matches` / `propose_exchange` support 2–3 person trades across campuses.
- **Security:** RLS on every exposed table; privileged logic runs in `security definer` SQL functions.
  The secret key is used only in server code (`lib/supabase/admin.ts`).
