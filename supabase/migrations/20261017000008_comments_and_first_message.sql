-- =====================================================================
-- 0008 Listing comments, and keep an offer's message as the first chat message.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Comments on listings (public to anyone who can see the listing).
-- ---------------------------------------------------------------------
create table public.listing_comments (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index listing_comments_listing_idx on public.listing_comments (listing_id, created_at);
create index listing_comments_author_idx  on public.listing_comments (author_id, created_at desc);

create or replace function public.comments_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.listing_comments c
      where c.author_id = new.author_id and c.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'comment_rate_limited' using errcode = 'P0001';
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
create trigger comments_before_insert before insert on public.listing_comments
  for each row execute function public.comments_before_insert();

alter table public.listing_comments enable row level security;

-- The subquery runs with the caller's rights, so listing visibility rules (campus/network) apply.
create policy "comments: visible with the listing"
  on public.listing_comments for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "comments: author posts on listings they can see"
  on public.listing_comments for insert to authenticated
  with check (author_id = (select auth.uid())
              and exists (select 1 from public.listings l where l.id = listing_id and l.status <> 'removed'));
create policy "comments: author or the listing's seller deletes"
  on public.listing_comments for delete to authenticated
  using (author_id = (select auth.uid())
         or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())));

revoke all on public.listing_comments from anon;
revoke update on public.listing_comments from authenticated;  -- comments are immutable

create or replace function public.comment_counts(p_listing_ids uuid[])
returns table (listing_id uuid, comments bigint)
language sql stable security invoker set search_path = '' as $$
  select c.listing_id, count(*)
  from public.listing_comments c
  where c.listing_id = any (p_listing_ids)
  group by c.listing_id;
$$;
revoke execute on function public.comment_counts(uuid[]) from public, anon;
grant execute on function public.comment_counts(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- The message typed with an offer ("Hi, is this still available?") used to be stored on the
-- offer only, so the chat opened empty and it looked like the first message vanished.
-- Now accepting an offer copies it into the chat as the offerer's first message, dated when
-- it was actually sent.
-- ---------------------------------------------------------------------
create or replace function public.respond_to_offer(p_offer_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  o public.offers; v_conv uuid; v_msg uuid; v_listing_status public.listing_status;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or o.recipient_id is distinct from v_uid then raise exception 'offer_not_found' using errcode = 'P0001'; end if;
  if o.status <> 'pending' then raise exception 'offer_not_pending' using errcode = 'P0001'; end if;

  if not p_accept then
    update public.offers set status = 'declined', responded_at = now() where id = o.id;
    return jsonb_build_object('status', 'declined');
  end if;

  if o.kind = 'listing_interest' then
    select status into v_listing_status from public.listings where id = o.listing_id;
    if v_listing_status is distinct from 'active' then raise exception 'listing_unavailable' using errcode = 'P0001'; end if;
  end if;

  v_conv := public._create_conversation('offer', o.id, null, o.listing_id, o.request_id, array[o.offerer_id, o.recipient_id]);
  update public.offers set status = 'accepted', responded_at = now(), conversation_id = v_conv where id = o.id;

  if nullif(btrim(coalesce(o.message, '')), '') is not null then
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, o.offerer_id, btrim(o.message)) returning id into v_msg;
    update public.messages set created_at = o.created_at where id = v_msg;  -- keep the original send time
  end if;

  return jsonb_build_object('status', 'accepted', 'conversation_id', v_conv);
end $$;

-- Restore the first message in conversations that were already opened (idempotent).
do $$
declare r record; v_msg uuid;
begin
  for r in
    select o.conversation_id, o.offerer_id, btrim(o.message) as body, o.created_at
    from public.offers o
    where o.status = 'accepted' and o.conversation_id is not null
      and nullif(btrim(coalesce(o.message, '')), '') is not null
      and not exists (select 1 from public.messages m
                      where m.conversation_id = o.conversation_id and m.sender_id = o.offerer_id and m.body = btrim(o.message))
  loop
    insert into public.messages (conversation_id, sender_id, body) values (r.conversation_id, r.offerer_id, r.body) returning id into v_msg;
    update public.messages set created_at = r.created_at where id = v_msg;
    update public.conversations c
       set last_message_at = (select max(m.created_at) from public.messages m where m.conversation_id = c.id)
     where c.id = r.conversation_id;
  end loop;
end $$;
