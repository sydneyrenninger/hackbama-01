-- =====================================================================
-- 0002 Marketplace: listings, images, requests, offers, interactions,
-- discovery deck, request matching.
-- =====================================================================

create type public.listing_category as enum
  ('textbooks','dorm','lab','tickets','tutoring','rides','electronics','furniture','clothing','other');
create type public.listing_kind      as enum ('sale','free','trade','borrow','service');
create type public.item_condition    as enum ('new','like_new','good','fair','worn');
create type public.listing_status    as enum ('active','reserved','sold','removed');
create type public.semester_moment   as enum ('move_in','semester_start','midterms','finals','move_out','anytime');
create type public.request_visibility as enum ('campus','network');
create type public.request_status    as enum ('open','fulfilled','closed');
create type public.offer_kind        as enum ('listing_interest','request_response');
create type public.offer_status      as enum ('pending','accepted','declined','withdrawn');
create type public.interaction_action as enum ('pass','save','interest');

-- ---------------------------------------------------------------------
create table public.listings (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  seller_id              uuid not null references public.profiles(id) on delete cascade,
  title                  text not null check (char_length(btrim(title)) between 3 and 90),
  description            text not null default '' check (char_length(description) <= 4000),
  category               public.listing_category not null,
  kind                   public.listing_kind not null,
  price_cents            integer check (price_cents is null or price_cents between 0 and 10000000),
  condition              public.item_condition,
  status                 public.listing_status not null default 'active',
  available_from         date,
  available_until        date,
  pickup_notes           text check (char_length(pickup_notes) <= 280),
  semester_moments       public.semester_moment[] not null default '{}',
  trade_wants_categories public.listing_category[] not null default '{}',
  trade_wants_text       text check (char_length(trade_wants_text) <= 280),
  search                 tsvector generated always as (
                           setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
                           setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B')
                         ) stored,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint listing_price_matches_kind check (
       (kind = 'sale'    and price_cents is not null and price_cents > 0)
    or (kind = 'service')
    or (kind in ('free','trade','borrow') and coalesce(price_cents, 0) = 0)),
  constraint listing_trade_wants check (kind <> 'trade' or cardinality(trade_wants_categories) between 1 and 5),
  constraint listing_window check (available_until is null or available_from is null or available_until >= available_from)
);
create index listings_feed_idx   on public.listings (tenant_id, status, created_at desc);
create index listings_seller_idx on public.listings (seller_id, status);
create index listings_cat_idx    on public.listings (category) where status = 'active';
create index listings_trade_idx  on public.listings (kind) where status = 'active' and kind = 'trade';
create index listings_search_idx on public.listings using gin (search);

create or replace function public.guard_listing() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_cats jsonb;
begin
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.seller_id <> old.seller_id) then
    raise exception 'listing_owner_immutable' using errcode = 'P0001';
  end if;
  select t.settings->'categories' into v_cats from public.tenants t where t.id = new.tenant_id;
  if v_cats is not null and jsonb_typeof(v_cats) = 'array' and not (v_cats ? new.category::text) then
    raise exception 'category_not_allowed' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger listings_guard before insert or update on public.listings
  for each row execute function public.guard_listing();

create table public.listing_images (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300 and storage_path !~ '\.\.'),
  position     smallint not null default 0 check (position between 0 and 7),
  created_at   timestamptz not null default now(),
  unique (listing_id, position)
);

-- ---------------------------------------------------------------------
create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 3 and 90),
  description  text not null default '' check (char_length(description) <= 2000),
  category     public.listing_category not null,
  budget_cents integer check (budget_cents is null or budget_cents between 0 and 10000000),
  visibility   public.request_visibility not null default 'campus',
  status       public.request_status not null default 'open',
  needed_by    date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index requests_feed_idx on public.requests (tenant_id, status, created_at desc);
create index requests_requester_idx on public.requests (requester_id);

create or replace function public.guard_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.requester_id <> old.requester_id) then
    raise exception 'request_owner_immutable' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger requests_guard before insert or update on public.requests
  for each row execute function public.guard_request();

-- ---------------------------------------------------------------------
create table public.offers (
  id              uuid primary key default gen_random_uuid(),
  kind            public.offer_kind not null,
  listing_id      uuid references public.listings(id) on delete cascade,
  request_id      uuid references public.requests(id) on delete cascade,
  offerer_id      uuid not null references public.profiles(id) on delete cascade,
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  amount_cents    integer check (amount_cents is null or amount_cents between 0 and 10000000),
  message         text check (char_length(message) <= 1000),
  status          public.offer_status not null default 'pending',
  conversation_id uuid,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  check (offerer_id <> recipient_id),
  check ((kind = 'listing_interest' and listing_id is not null and request_id is null)
      or (kind = 'request_response' and request_id is not null))
);
create unique index offers_one_pending_interest on public.offers (offerer_id, listing_id)
  where status = 'pending' and kind = 'listing_interest';
create unique index offers_one_pending_response on public.offers (offerer_id, request_id)
  where status = 'pending' and kind = 'request_response';
create index offers_recipient_idx on public.offers (recipient_id, status, created_at desc);
create index offers_offerer_idx   on public.offers (offerer_id, created_at desc);

create table public.listing_interactions (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  action     public.interaction_action not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index listing_interactions_saved_idx on public.listing_interactions (user_id, updated_at desc) where action = 'save';

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.listings             enable row level security;
alter table public.listing_images       enable row level security;
alter table public.requests             enable row level security;
alter table public.offers               enable row level security;
alter table public.listing_interactions enable row level security;

create policy "listings: visible in browsable tenants, owners see all own"
  on public.listings for select to authenticated
  using (seller_id = (select auth.uid())
         or (status <> 'removed' and public.tenant_is_browsable(tenant_id)));
create policy "listings: members post in tenants that allow it"
  on public.listings for insert to authenticated
  with check (seller_id = (select auth.uid()) and status = 'active' and public.can_post_in(tenant_id));
create policy "listings: owner updates"
  on public.listings for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy "listings: owner deletes"
  on public.listings for delete to authenticated using (seller_id = (select auth.uid()));

create policy "listing_images: visible with listing"
  on public.listing_images for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "listing_images: owner adds from own storage folder"
  on public.listing_images for insert to authenticated
  with check (split_part(storage_path, '/', 1) = (select auth.uid())::text
              and exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())));
create policy "listing_images: owner removes"
  on public.listing_images for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())));

create policy "requests: members see campus, network sees network-visible"
  on public.requests for select to authenticated
  using (requester_id = (select auth.uid())
         or (status <> 'closed' and (public.is_member(tenant_id)
             or (visibility = 'network' and public.tenant_is_browsable(tenant_id)))));
create policy "requests: members post"
  on public.requests for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'open' and public.can_post_in(tenant_id));
create policy "requests: owner updates"
  on public.requests for update to authenticated
  using (requester_id = (select auth.uid())) with check (requester_id = (select auth.uid()));

create policy "offers: parties read"
  on public.offers for select to authenticated
  using (offerer_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "interactions: owner reads"
  on public.listing_interactions for select to authenticated using (user_id = (select auth.uid()));
create policy "interactions: owner clears"
  on public.listing_interactions for delete to authenticated using (user_id = (select auth.uid()));

-- Offers and interactions are written only through security-definer functions (0003).
-- Listing owner/tenant immutability is enforced by the guard_listing trigger.
revoke insert, update on public.offers from anon, authenticated;
revoke insert, update on public.listing_interactions from anon, authenticated;
