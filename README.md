# Quad Exchange

A multi-campus student marketplace. One deployment, one database, many universities.
Launches with a UA theme plus a fictional "Riverbend State (demo)" tenant.

> **Status, stated plainly.** Everything in this repo was written in a sandbox with **no network access**.
> The 9 pure-logic unit tests were run and pass. **Nothing else has been executed**: no `npm install`,
> type check, lint, Next build, migration run, pgTAP run, email send, or deployment. Expect a short round
> of fixes when you first install and build. See *Verification status* below.

## Architecture

```
Browser ──► Next.js (App Router, Vercel)
              ├─ proxy.ts ............ refreshes Supabase session cookies, guards /app
              ├─ /api/auth/* ......... signup handoff, sign-in, recovery (Route Handlers, Origin-checked)
              ├─ server actions ...... marketplace mutations (run as the user → RLS applies)
              └─ server components ... reads via cookie-bound client (RLS applies)
                     │
                     ├──► Supabase Postgres  (RLS on every exposed table; security-definer RPCs)
                     ├──► Supabase Auth      (identity + sessions; the only session authority)
                     ├──► Supabase Storage   (listing images, avatars)
                     └──► Resend             (verification codes + password reset links)
```

**Signup handoff (Screens B→E).** The 6-digit code proves inbox ownership; it does *not* create a session.

1. `POST /api/auth/signup/start`: validates `.edu`, rate-limits by IP and canonical email, resolves the
   tenant, stores `HMAC(pepper, challengeId:code)` with a 10-minute expiry (older challenges superseded,
   60 s cooldown, 5/hour cap, advisory lock against races), sends via Resend, and marks delivery `sent`
   only on provider success. An httpOnly, SameSite=Strict cookie scoped to `/api/auth/signup` holds the challenge ID.
2. `POST /api/auth/signup/verify`: `verify_challenge()` row-locks, counts the attempt, and compares hashes
   (5-attempt lockout). On success it stores the hash of a random one-time **signup token**. The token goes
   only into an httpOnly cookie (15 minutes).
3. `POST /api/auth/signup/complete`: validates passwords server-side, then **atomically consumes** the token
   (one `UPDATE … RETURNING`, so concurrent requests can't both win). Next, `auth.admin.createUser({ email_confirm: true })`
   runs with the secret key on the server only, followed by `provision_account()` (profile, membership and settings
   in one transaction). Failures are compensated (`deleteUser` and token release). Finally `signInWithPassword` on
   the SSR client sets real Supabase session cookies.

**Password reset** uses `auth.admin.generateLink({ type: "recovery" })` and sends the link through Resend,
so it doesn't consume Supabase's built-in email quota. The link opens a page that **POSTs** the token to
`verifyOtp`, so email scanners that prefetch links can't burn it. Responses are identical whether or not
the account exists.

**Multi-tenancy.** `tenants` (UUID) ← `tenant_domains` (explicit mapping, `include_subdomains`, aliases).
Home tenant, memberships, browsing scope and authorization are separate:

| Concept | Where | Who can change it |
|---|---|---|
| Home tenant | `profiles.home_tenant_id` | Nobody from the client (column grant) |
| Membership | `tenant_memberships` | Server only (verified by email domain) |
| Browsing scope | `user_settings` | User, validated by trigger (`tenant_is_browsable`) |
| Authorization | `can_post_in`, `can_transact_in`, RLS | Derived from memberships and tenant settings |

Unknown `.edu` domains (policy `provision_pending`, the default) create a **pending** tenant with an
**unverified** domain. Members can browse the network but can't post until an operator sets `status='active'`
(or sets `settings.pending_members_can_post`). Set `UNKNOWN_DOMAIN_POLICY=reject` to refuse instead.

**Adding a university** takes only data, with no code change and no new deployment:
```sql
insert into tenants (slug, name, short_name, status, primary_color, secondary_color)
values ('auburn', 'Auburn University', 'Auburn', 'active', '#0C2340', '#E87722');
insert into tenant_domains (domain, tenant_id, is_primary, verified)
values ('auburn.edu', (select id from tenants where slug = 'auburn'), true, true);
```

## Innovation: Smart Campus Exchange

- **Trade matching** (`find_trade_matches`): transparent rules that cover category wants, keyword hints,
  and campus trade policies. It finds **direct swaps** and **3-way cycles** across campuses (A→B→C→A).
  `propose_exchange` re-validates the whole chain server-side. Every participant must accept their own leg.
  Only then are the listings reserved and a group conversation opened. Each person confirms the handoff,
  after which listings are marked sold and everyone's `completed_trades` reputation goes up.
- **Semester-aware discovery** (`discovery_deck`): ranks by tenant calendar events (midterms, finals,
  move-out, move-in), your open requests and budget, your arrival date, and recency. It returns
  human-readable **reasons** ("Timed for fall finals", "Matches one of your requests") so the UI can show
  *why* a card appears.
- **Request ↔ listing linking**: `matches_for_request` and `requests_for_my_listings` connect requests to listings.

## Database

Migrations in `supabase/migrations/` (apply in order):

| File | Contents |
|---|---|
| `…0001_foundation.sql` | tenants, domains, calendar, profiles, memberships, settings, private verification + rate-limit tables, auth helpers, provisioning |
| `…0002_marketplace.sql` | listings (FTS), images, requests, offers, interactions, RLS |
| `…0003_messaging_and_offers.sql` | conversations, participants, messages (Realtime), swipe/offer RPCs, discovery deck, request matching |
| `…0004_smart_exchange.sql` | exchange proposals and legs, matching, propose/respond/confirm |
| `…0005_storage.sql` | `listing-images` (5 MB) and `avatars` (2 MB) buckets, own-folder write policies |

`supabase/seed.sql` holds the demo tenants, domains and an approximate calendar. `supabase/tests/security.test.sql` holds the pgTAP tests.

All migrations only **create** objects; none drop or reset anything. If your project already has tables with
these names, they will fail rather than overwrite, so inspect first (below).

## Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `NEXT_PUBLIC_APP_URL` | public | canonical origin, used in reset links |
| `SUPABASE_SECRET_KEY` | **server-only** | or legacy `SUPABASE_SERVICE_ROLE_KEY` |
| `RESEND_API_KEY` | **server-only** | |
| `EMAIL_FROM` | server-only | address on a Resend-verified domain |
| `VERIFICATION_PEPPER` | **server-only** | ≥32 random chars; rotating it invalidates outstanding codes |
| `UNKNOWN_DOMAIN_POLICY` | server-only | `provision_pending` (default) or `reject` |
| `DEMO_USER_PASSWORD` | local only | only for `seed:demo` |

## Setup

1. **Install and inspect**
   ```bash
   npm install
   npx supabase login && npx supabase link --project-ref <ref>
   npx supabase db pull --schema public   # see what already exists before applying anything
   npx supabase migration list
   ```
2. **Apply locally first.** `npx supabase start && npx supabase db reset` applies migrations and seed to the *local* stack only. Then run `npm run test:db`.
3. **Apply to the hosted project**: `npx supabase db push` (non-destructive, but review the diff first).
4. **Supabase Auth settings**: keep email/password enabled. Signups are created server-side with `email_confirm: true`, so Supabase never sends a confirmation email. Add `NEXT_PUBLIC_APP_URL` to *Redirect URLs*.
5. **Resend**: add and verify your sending domain (SPF/DKIM DNS records), create an API key, and set `RESEND_API_KEY` and `EMAIL_FROM`. Until then, `/api/auth/signup/start` returns a clear 503. It never logs or reveals codes.
6. **Run**: `cp .env.example .env.local`, fill it in, then `npm run dev`. Optionally run `npm run seed:demo -- --yes`.
7. **Vercel**: add the variables above under Project → Settings → Environment Variables (Production and Preview), keeping server-only values unprefixed. Then deploy with `vercel --prod` or a git push.

## Verification status

| Check | Result |
|---|---|
| Unit tests (`tests/core.test.ts`: code generation, hashing, cookie parsing, email normalization, domain resolution mirror, open-redirect guard, WCAG contrast) | **9/9 pass** (run in sandbox) |
| `npm install`, `typecheck`, `lint`, `build` | **Not run** (no network in sandbox) |
| Migrations + pgTAP (`security.test.sql`, 16 assertions) | **Written, not run** |
| Live email, signup, login, Realtime, deploy | **Not run** |

## Built vs. not yet built

**Built (backend):** full schema, RLS and storage policies; the whole auth lifecycle (routes and logic);
tenant resolution and provisioning; listings, requests, offers, swipe persistence, messaging, cross-campus
rules, discovery ranking, trade matching and consent flow as SQL functions and typed server actions/queries.

**Built (UI):** Screens A–E (sign-in, email, six-digit code, password, account creation), forgot/reset
password, campus theme provider, and a signed-in home page with a working campus switcher.

**Not yet built (UI):** listing create/browse pages, the swipe-deck component, request/offer inboxes,
the chat view with Realtime subscription, and the trade-match screen. The server functions they call already exist.

## Known limitations

- The rate limiter is fixed-window in Postgres. It's adequate for a hackathon; consider Upstash or Vercel KV at scale.
- Image buckets are public-read with unguessable paths. Switch to private buckets with signed URLs if stricter image privacy is needed.
- Generated DB types aren't committed yet (`npm run db:types` once linked). Clients are currently untyped.
- Calendar dates in the seed are approximate placeholders.
- The UA colors are configurable demo data. No logos are included and no affiliation is claimed.

## Demo script (once the UI pages are added)

1. Sign up with a `.edu` address and show the code email, a wrong code (attempts left), then a correct code, mismatched passwords, and finally success.
2. Land on the UA-themed home page. Switch to Riverbend and watch the theme change, with the label "Visitor", not "member".
3. Sign in as `qx-demo-alex`. Trade matches show the 3-way cycle (Alex → Blair → Casey, across two campuses).
4. Propose it. As Blair, then Casey, accept. A group chat opens and the listings show as reserved.
5. Open the discovery deck and point at the "Timed for fall finals" and "Matches your request" reasons.
