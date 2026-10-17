-- Swapp schema. Run in the Supabase SQL editor (or `supabase db push`).

-- ========== Tenants ==========
create table campuses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,               -- used in URL: /c/ua
  name text not null,
  email_domain text unique not null,       -- e.g. crimson.ua.edu
  logo_url text,
  theme jsonb not null default '{"primary":"#9E1B32","secondary":"#FFFFFF"}',
  pickup_spots text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ========== Users ==========
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  campus_id uuid not null references campuses,
  display_name text not null,
  avatar_url text,
  major text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup; campus resolved from email domain.
-- Signups from unknown domains are rejected (= .edu verification).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from campuses where email_domain = lower(split_part(new.email, '@', 2));
  if cid is null then
    raise exception 'Email domain not registered with any campus';
  end if;
  insert into profiles (id, campus_id, display_name)
  values (new.id, cid, split_part(new.email, '@', 1));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ========== Communities (campus or cross-campus) ==========
create table communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  campus_id uuid references campuses   -- null = spans schools (Gameday, Pre-Med...)
);

create table community_members (
  community_id uuid references communities on delete cascade,
  user_id uuid references profiles on delete cascade,
  primary key (community_id, user_id)
);

-- ========== Supply & demand ==========
create table listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles on delete cascade,
  campus_id uuid not null references campuses,
  title text not null,
  description text,
  price_cents int not null default 0,
  category text not null,
  tags text[] not null default '{}',
  media_urls text[] not null default '{}',
  is_reel boolean not null default false,
  status text not null default 'active' check (status in ('active','sold')),
  created_at timestamptz not null default now()
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles on delete cascade,
  campus_id uuid not null references campuses,
  title text not null,
  max_price_cents int,
  category text not null,
  tags text[] not null default '{}',
  status text not null default 'open' check (status in ('open','filled')),
  created_at timestamptz not null default now()
);

-- ========== Matching ==========
-- Buyer swipes on a listing (listing_id only), OR
-- seller swipes on a request (request_id + listing_id = the item they're offering).
create table swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references profiles on delete cascade,
  listing_id uuid references listings on delete cascade,
  request_id uuid references requests on delete cascade,
  direction text not null check (direction in ('left','right')),
  created_at timestamptz not null default now(),
  check (listing_id is not null or request_id is not null)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  buyer_id uuid not null references profiles,
  seller_id uuid not null references profiles,
  request_id uuid references requests,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches on delete cascade,
  sender_id uuid not null references profiles,
  body text not null,
  created_at timestamptz not null default now()
);

-- Right swipe => match (opens a chat between buyer and seller).
create or replace function handle_swipe() returns trigger
language plpgsql security definer set search_path = public as $$
declare l listings; r requests;
begin
  if new.direction <> 'right' then return new; end if;

  if new.request_id is null then
    -- buyer -> listing
    select * into l from listings where id = new.listing_id;
    insert into matches (listing_id, buyer_id, seller_id)
    values (l.id, new.swiper_id, l.seller_id) on conflict do nothing;
  elsif new.listing_id is not null then
    -- seller -> request, offering a listing
    select * into r from requests where id = new.request_id;
    insert into matches (listing_id, buyer_id, seller_id, request_id)
    values (new.listing_id, r.buyer_id, new.swiper_id, r.id) on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_swipe after insert on swipes
  for each row execute function handle_swipe();

-- ========== Row-level security ==========
alter table campuses enable row level security;
alter table profiles enable row level security;
alter table communities enable row level security;
alter table community_members enable row level security;
alter table listings enable row level security;
alter table requests enable row level security;
alter table swipes enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;

-- Reads (cross-campus browsing is a feature, so any signed-in user can read)
create policy "read campuses" on campuses for select using (true);
create policy "read communities" on communities for select using (true);
create policy "read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "read listings" on listings for select using (auth.role() = 'authenticated');
create policy "read requests" on requests for select using (auth.role() = 'authenticated');
create policy "read memberships" on community_members for select using (auth.role() = 'authenticated');

-- Own rows
create policy "update own profile" on profiles for update using (id = auth.uid());
create policy "manage own listings" on listings for all using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "manage own requests" on requests for all using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy "own swipes" on swipes for all using (swiper_id = auth.uid()) with check (swiper_id = auth.uid());
create policy "own memberships" on community_members for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Matches & messages: only the two parties
create policy "match parties" on matches for select using (auth.uid() in (buyer_id, seller_id));
create policy "read match messages" on messages for select using (
  exists (select 1 from matches m where m.id = match_id and auth.uid() in (m.buyer_id, m.seller_id))
);
create policy "send match messages" on messages for insert with check (
  sender_id = auth.uid() and
  exists (select 1 from matches m where m.id = match_id and auth.uid() in (m.buyer_id, m.seller_id))
);

-- ========== Storage (photos / reels) ==========
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict do nothing;
