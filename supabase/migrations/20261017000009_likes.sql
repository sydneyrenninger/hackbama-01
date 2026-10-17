-- =====================================================================
-- 0009 Likes on listings (the heart in the reel viewer). Public counts, private-to-you "liked" state.
-- =====================================================================
create table public.listing_likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index listing_likes_listing_idx on public.listing_likes (listing_id);

alter table public.listing_likes enable row level security;
create policy "likes: visible with the listing"
  on public.listing_likes for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "likes: like as yourself on listings you can see"
  on public.listing_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.listings l where l.id = listing_id));
create policy "likes: unlike your own"
  on public.listing_likes for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.listing_likes from anon;
revoke update on public.listing_likes from authenticated;

-- Like counts plus whether the caller liked each listing.
create or replace function public.like_state(p_listing_ids uuid[])
returns table (listing_id uuid, likes bigint, liked boolean)
language sql stable security invoker set search_path = '' as $$
  select k.listing_id, count(*), bool_or(k.user_id = (select auth.uid()))
  from public.listing_likes k
  where k.listing_id = any (p_listing_ids)
  group by k.listing_id;
$$;
revoke execute on function public.like_state(uuid[]) from public, anon;
grant execute on function public.like_state(uuid[]) to authenticated;
