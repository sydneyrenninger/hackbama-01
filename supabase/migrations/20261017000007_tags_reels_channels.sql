-- =====================================================================
-- 0007 Tags, video reels, request channels, relevance search.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tags: lowercase, no '#', a-z0-9 and dashes, max 30 chars, max 10, unique.
-- Required (1+) on listings, optional on requests.
-- ---------------------------------------------------------------------
create or replace function public.normalize_tags(p_tags text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct t order by t) filter (where t <> ''), '{}')
  from (select lower(regexp_replace(btrim(x), '^#+', '')) as t from unnest(p_tags) as x) s;
$$;

create or replace function public.tags_valid(p_tags text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(p_tags) <= 10
     and not exists (select 1 from unnest(p_tags) t where t !~ '^[a-z0-9][a-z0-9-]{0,29}$');
$$;

create or replace function public.normalize_row_tags() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.tags := public.normalize_tags(coalesce(new.tags, '{}'));
  return new;
end $$;

alter table public.listings
  add column tags text[] not null default '{}',
  add constraint listing_tags_valid check (public.tags_valid(tags)),
  add constraint listing_tags_required check (cardinality(tags) >= 1);
alter table public.requests
  add column tags text[] not null default '{}',
  add constraint request_tags_valid check (public.tags_valid(tags));

-- Runs before CHECK constraints, so "#ECE " is stored as "ece".
create trigger listings_normalize_tags before insert or update of tags on public.listings
  for each row execute function public.normalize_row_tags();
create trigger requests_normalize_tags before insert or update of tags on public.requests
  for each row execute function public.normalize_row_tags();

create index listings_tags_idx on public.listings using gin (tags);
create index requests_tags_idx on public.requests using gin (tags);

-- Most-used tags on active listings the caller can see (RLS applies: security invoker).
create or replace function public.popular_tags(p_limit integer default 20)
returns table (tag text, uses bigint)
language sql stable set search_path = '' as $$
  select t, count(*) from public.listings l, unnest(l.tags) t
  where l.status = 'active'
  group by t order by count(*) desc, t
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------
-- Reels: a listing flagged is_reel whose media includes a video.
-- listing_images now holds images and videos (media_type); videos live in
-- the listing-videos bucket, images in listing-images.
-- ---------------------------------------------------------------------
alter table public.listings add column is_reel boolean not null default false;
create index listings_reels_idx on public.listings (tenant_id, created_at desc) where status = 'active' and is_reel;

alter table public.listing_images
  add column media_type text not null default 'image' check (media_type in ('image', 'video'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-videos', 'listing-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "listing-videos: upload to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "listing-videos: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Request channels (Reddit-style topics). Network-wide: anyone signed in can
-- browse; anyone can create one through create_channel(). Requests inside a
-- channel keep their own campus/network visibility rules.
-- ---------------------------------------------------------------------
create table public.request_channels (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name        text not null check (char_length(btrim(name)) between 2 and 40),
  description text not null default '' check (char_length(description) <= 280),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index request_channels_name_ci on public.request_channels (lower(btrim(name)));

alter table public.requests add column channel_id uuid references public.request_channels(id) on delete set null;
create index requests_channel_idx on public.requests (channel_id, status, created_at desc);

alter table public.request_channels enable row level security;
create policy "channels: signed-in users browse"
  on public.request_channels for select to authenticated using (true);
revoke insert, update, delete on public.request_channels from anon, authenticated;

create or replace function public.create_channel(p_name text, p_description text default '')
returns public.request_channels
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
  v_row public.request_channels;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'channel_name_invalid' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_description, '')) > 280 then raise exception 'channel_description_too_long' using errcode = 'P0001'; end if;

  v_slug := left(btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-'), 40);
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,39}$' then raise exception 'channel_name_invalid' using errcode = 'P0001'; end if;

  if (select count(*) from public.request_channels c
      where c.created_by = v_uid and c.created_at > now() - interval '1 day') >= 5 then
    raise exception 'channel_rate_limited' using errcode = 'P0001';
  end if;

  insert into public.request_channels (slug, name, description, created_by)
  values (v_slug, v_name, btrim(coalesce(p_description, '')), v_uid)
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'channel_exists' using errcode = 'P0001';
end $$;
revoke execute on function public.create_channel(text, text) from public, anon;
grant execute on function public.create_channel(text, text) to authenticated;

-- Browse/search channels with the number of open requests the caller can see.
create or replace function public.list_channels(p_query text default null, p_limit integer default 50)
returns table (id uuid, slug text, name text, description text, open_requests bigint, created_at timestamptz)
language sql stable set search_path = '' as $$
  select c.id, c.slug, c.name, c.description,
         (select count(*) from public.requests r where r.channel_id = c.id and r.status = 'open'),
         c.created_at
  from public.request_channels c
  where p_query is null or btrim(p_query) = ''
     or c.name ilike '%' || btrim(p_query) || '%' or c.slug ilike '%' || btrim(p_query) || '%'
  order by 5 desc, c.name
  limit least(greatest(p_limit, 1), 100);
$$;

-- Starter channels (fixed ids so demo data can reference them).
insert into public.request_channels (id, slug, name, description) values
  ('dddddddd-0000-4000-8000-000000000001', 'tutoring',  'Tutoring',  'Find or offer help with classes.'),
  ('dddddddd-0000-4000-8000-000000000002', 'rides',     'Rides',     'Airport runs, road trips, rides home.'),
  ('dddddddd-0000-4000-8000-000000000003', 'tickets',   'Tickets',   'Gameday, concerts and events.'),
  ('dddddddd-0000-4000-8000-000000000004', 'textbooks', 'Textbooks', 'Course books and lab kits.'),
  ('dddddddd-0000-4000-8000-000000000005', 'housing',   'Housing',   'Subleases, roommates, move-out furniture.')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Listing search with relevance ranking. Returns ordered ids; the app loads
-- cards for them. Security invoker: listing RLS (browsable tenants) applies.
-- ---------------------------------------------------------------------
create or replace function public.search_listing_ids(
  p_tenant_ids uuid[],
  p_query      text default null,
  p_tags       text[] default '{}',
  p_category   public.listing_category default null,
  p_kind       public.listing_kind default null,
  p_max_price  integer default null,
  p_reels_only boolean default false,
  p_sort       text default 'relevance',
  p_limit      integer default 40)
returns table (id uuid, rank real)
language sql stable set search_path = '' as $$
  with q as (
    select case when nullif(btrim(coalesce(p_query, '')), '') is null then null
                else websearch_to_tsquery('english'::regconfig, left(p_query, 100)) end as tsq
  )
  select l.id, coalesce(ts_rank(l.search, q.tsq), 0)::real
  from public.listings l, q
  where l.status = 'active'
    and l.tenant_id = any (p_tenant_ids)
    and (q.tsq is null or l.search @@ q.tsq)
    and (cardinality(coalesce(p_tags, '{}')) = 0 or l.tags @> public.normalize_tags(p_tags))
    and (p_category is null or l.category = p_category)
    and (p_kind is null or l.kind = p_kind)
    and (p_max_price is null or coalesce(l.price_cents, 0) <= p_max_price)
    and (not p_reels_only or l.is_reel)
  order by
    case when p_sort = 'price_asc'  then coalesce(l.price_cents, 0) end asc,
    case when p_sort = 'price_desc' then coalesce(l.price_cents, 0) end desc,
    case when p_sort = 'relevance'  then coalesce(ts_rank(l.search, q.tsq), 0) end desc,
    l.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.search_listing_ids(uuid[], text, text[], public.listing_category, public.listing_kind, integer, boolean, text, integer) to authenticated;
