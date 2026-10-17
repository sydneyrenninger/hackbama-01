-- =====================================================================
-- 0003 Messaging + offer/discovery functions.
-- Conversations are only created by trusted functions after consent
-- (accepted offer or accepted exchange). Nobody can join by ID.
-- =====================================================================

create type public.conversation_context as enum ('offer', 'exchange');

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  context         public.conversation_context not null,
  offer_id        uuid unique references public.offers(id) on delete set null,
  exchange_id     uuid unique,
  listing_id      uuid references public.listings(id) on delete set null,
  request_id      uuid references public.requests(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  body            text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_recent_idx on public.messages (sender_id, created_at desc);

alter table public.offers add constraint offers_conversation_fk
  foreign key (conversation_id) references public.conversations(id) on delete set null;

create or replace function public.is_conversation_participant(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_participants cp
                 where cp.conversation_id = p_conversation and cp.user_id = (select auth.uid()));
$$;

create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages m
      where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'message_rate_limited' using errcode = 'P0001';
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_participants set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;

create policy "conversations: participants read"
  on public.conversations for select to authenticated using (public.is_conversation_participant(id));
create policy "participants: co-participants read"
  on public.conversation_participants for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy "messages: participants read"
  on public.messages for select to authenticated using (public.is_conversation_participant(conversation_id));
create policy "messages: participants send as themselves"
  on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_participant(conversation_id));

revoke insert, update, delete on public.conversations, public.conversation_participants from anon, authenticated;
revoke update, delete on public.messages from anon, authenticated;

-- Realtime (postgres_changes honours RLS). Guarded for projects without the publication.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Internal helper; callable only by other definer functions (owner).
create or replace function public._create_conversation(
  p_context public.conversation_context, p_offer uuid, p_exchange uuid,
  p_listing uuid, p_request uuid, p_participants uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.conversations (context, offer_id, exchange_id, listing_id, request_id)
  values (p_context, p_offer, p_exchange, p_listing, p_request) returning id into v_id;
  insert into public.conversation_participants (conversation_id, user_id)
  select v_id, u from (select distinct unnest(p_participants) u) s;
  return v_id;
end $$;
revoke execute on function public._create_conversation(public.conversation_context, uuid, uuid, uuid, uuid, uuid[]) from public, anon, authenticated;

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = '' as $$
  update public.conversation_participants set last_read_at = now()
  where conversation_id = p_conversation and user_id = (select auth.uid());
$$;

create or replace function public.my_conversations()
returns table (conversation_id uuid, context public.conversation_context, listing_id uuid, listing_title text,
               participants jsonb, last_message text, last_message_at timestamptz, unread_count integer)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.context, c.listing_id, l.title,
    (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name)), '[]'::jsonb)
       from public.conversation_participants cp2 join public.profiles p on p.id = cp2.user_id
      where cp2.conversation_id = c.id and cp2.user_id <> (select auth.uid())),
    (select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
    c.last_message_at,
    (select count(*)::integer from public.messages m
      where m.conversation_id = c.id and m.created_at > cp.last_read_at and m.sender_id is distinct from (select auth.uid()))
  from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  left join public.listings l on l.id = c.listing_id
  where cp.user_id = (select auth.uid())
  order by c.last_message_at desc;
$$;

-- =====================================================================
-- Offer + interaction functions (security definer, explicit checks)
-- =====================================================================
create or replace function public.swipe(p_listing_id uuid, p_action public.interaction_action, p_message text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); l public.listings; v_offer uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_message, '')) > 1000 then raise exception 'message_too_long' using errcode = 'P0001'; end if;

  select * into l from public.listings where id = p_listing_id;
  if not found or l.status <> 'active' or not public.tenant_is_browsable(l.tenant_id) then
    raise exception 'listing_unavailable' using errcode = 'P0001';
  end if;
  if l.seller_id = v_uid then raise exception 'own_listing' using errcode = 'P0001'; end if;

  if p_action = 'interest' then
    if not public.can_transact_in(l.tenant_id) then
      raise exception 'cross_campus_not_allowed' using errcode = 'P0001';
    end if;
    if (select count(*) from public.offers o where o.offerer_id = v_uid and o.created_at > now() - interval '1 hour') >= 40 then
      raise exception 'offer_rate_limited' using errcode = 'P0001';
    end if;
  end if;

  insert into public.listing_interactions (user_id, listing_id, action)
  values (v_uid, l.id, p_action)
  on conflict (user_id, listing_id) do update set action = excluded.action, updated_at = now();

  if p_action = 'interest' then
    insert into public.offers (kind, listing_id, offerer_id, recipient_id, amount_cents, message)
    values ('listing_interest', l.id, v_uid, l.seller_id,
            case when l.kind = 'sale' then l.price_cents end, nullif(btrim(p_message), ''))
    on conflict (offerer_id, listing_id) where status = 'pending' and kind = 'listing_interest' do nothing
    returning id into v_offer;
  end if;

  return jsonb_build_object('action', p_action, 'offer_id', v_offer);
end $$;

create or replace function public.respond_to_request(
  p_request_id uuid, p_listing_id uuid default null, p_amount_cents integer default null, p_message text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); r public.requests; l public.listings; v_offer uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into r from public.requests where id = p_request_id;
  if not found or r.status <> 'open'
     or not (public.is_member(r.tenant_id) or (r.visibility = 'network' and public.tenant_is_browsable(r.tenant_id))) then
    raise exception 'request_unavailable' using errcode = 'P0001';
  end if;
  if r.requester_id = v_uid then raise exception 'own_request' using errcode = 'P0001'; end if;
  if not public.can_transact_in(r.tenant_id) then raise exception 'cross_campus_not_allowed' using errcode = 'P0001'; end if;

  if p_listing_id is not null then
    select * into l from public.listings where id = p_listing_id;
    if not found or l.seller_id <> v_uid or l.status <> 'active' then
      raise exception 'listing_unavailable' using errcode = 'P0001';
    end if;
  elsif nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception 'message_required' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_message, '')) > 1000 then raise exception 'message_too_long' using errcode = 'P0001'; end if;

  insert into public.offers (kind, request_id, listing_id, offerer_id, recipient_id, amount_cents, message)
  values ('request_response', r.id, p_listing_id, v_uid, r.requester_id, p_amount_cents, nullif(btrim(p_message), ''))
  returning id into v_offer;
  return v_offer;
exception when unique_violation then
  raise exception 'offer_already_pending' using errcode = 'P0001';
end $$;

create or replace function public.respond_to_offer(p_offer_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); o public.offers; v_conv uuid; v_listing_status public.listing_status;
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
  return jsonb_build_object('status', 'accepted', 'conversation_id', v_conv);
end $$;

create or replace function public.withdraw_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.offers set status = 'withdrawn', responded_at = now()
  where id = p_offer_id and offerer_id = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'offer_not_found' using errcode = 'P0001'; end if;
end $$;

-- =====================================================================
-- Semester-aware discovery deck (security invoker: RLS applies)
-- =====================================================================
create or replace function public.discovery_deck(p_limit integer default 20)
returns table (listing_id uuid, title text, category public.listing_category, kind public.listing_kind,
               price_cents integer, condition public.item_condition, tenant_id uuid, tenant_short_name text,
               tenant_primary_color text, seller_id uuid, seller_display_name text, seller_completed_trades integer,
               image_path text, available_from date, available_until date, score numeric, reasons text[])
language sql stable security invoker set search_path = '' as $$
  with me as (
    select (select auth.uid()) as uid, public.my_browse_tenant_ids() as scope,
           (select s.arrival_date from public.user_settings s where s.user_id = (select auth.uid())) as arrival
  ),
  my_requests as (
    select r.category, r.budget_cents from public.requests r, me
    where r.requester_id = me.uid and r.status = 'open'
  ),
  upcoming as (
    select e.tenant_id, e.kind::text as kind, e.label, e.starts_on
    from public.tenant_calendar_events e
    where e.ends_on >= current_date and e.starts_on <= current_date + 60
  ),
  c as (
    select l.*, me.arrival,
      exists (select 1 from my_requests mr where mr.category = l.category) as matches_request,
      exists (select 1 from my_requests mr where mr.category = l.category and mr.budget_cents is not null
              and coalesce(l.price_cents, 0) <= mr.budget_cents) as within_budget,
      (select u.label from upcoming u where u.tenant_id = l.tenant_id
         and u.kind = any (l.semester_moments::text[]) order by u.starts_on limit 1) as moment_label,
      (me.arrival is not null and 'move_in' = any (l.semester_moments::text[])
         and (l.available_until is null or l.available_until >= me.arrival)) as arrival_fit,
      extract(epoch from (now() - l.created_at)) / 86400.0 as age_days
    from public.listings l, me
    where l.status = 'active' and l.tenant_id = any (me.scope) and l.seller_id <> me.uid
      and (l.available_until is null or l.available_until >= current_date)
      and not exists (select 1 from public.listing_interactions i where i.user_id = me.uid and i.listing_id = l.id)
  )
  select c.id, c.title, c.category, c.kind, c.price_cents, c.condition, c.tenant_id, t.short_name, t.primary_color,
         c.seller_id, p.display_name, p.completed_trades,
         (select li.storage_path from public.listing_images li where li.listing_id = c.id order by li.position limit 1),
         c.available_from, c.available_until,
         round(( (case when c.matches_request then 3 else 0 end)
               + (case when c.within_budget then 1 else 0 end)
               + (case when c.moment_label is not null then 2 else 0 end)
               + (case when c.arrival_fit then 1.5 else 0 end)
               + greatest(0, 2 - c.age_days / 7.0))::numeric, 2),
         array_remove(array[
           case when c.matches_request then 'Matches one of your requests' end,
           case when c.within_budget then 'Within your budget' end,
           case when c.moment_label is not null then 'Timed for ' || c.moment_label end,
           case when c.arrival_fit then 'Available when you arrive' end,
           case when c.age_days < 2 then 'Just listed' end
         ], null)
  from c
  join public.tenants t on t.id = c.tenant_id
  join public.profiles p on p.id = c.seller_id
  order by 16 desc, c.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.matches_for_request(p_request_id uuid, p_limit integer default 10)
returns table (listing_id uuid, title text, price_cents integer, tenant_short_name text, score real)
language sql stable security invoker set search_path = '' as $$
  with r as (
    select r.*, to_tsquery('english', coalesce(nullif(array_to_string(
             tsvector_to_array(to_tsvector('english', r.title)), ' | '), ''), 'zzzznomatch')) as q
    from public.requests r where r.id = p_request_id
  )
  select l.id, l.title, l.price_cents, t.short_name,
         (ts_rank(l.search, r.q) * 4
          + case when r.budget_cents is null or coalesce(l.price_cents, 0) <= r.budget_cents then 1 else 0 end)::real
  from r
  join public.listings l on l.category = r.category and l.status = 'active' and l.seller_id <> r.requester_id
  join public.tenants t on t.id = l.tenant_id
  where public.tenants_can_trade(l.tenant_id, r.tenant_id)
  order by 5 desc, l.created_at desc
  limit least(greatest(p_limit, 1), 25);
$$;

create or replace function public.requests_for_my_listings(p_limit integer default 20)
returns table (request_id uuid, request_title text, budget_cents integer, tenant_short_name text,
               my_listing_id uuid, my_listing_title text)
language sql stable security invoker set search_path = '' as $$
  select distinct on (r.id) r.id, r.title, r.budget_cents, t.short_name, l.id, l.title
  from public.listings l
  join public.requests r on r.category = l.category and r.status = 'open' and r.requester_id <> l.seller_id
       and (r.budget_cents is null or coalesce(l.price_cents, 0) <= r.budget_cents)
  join public.tenants t on t.id = r.tenant_id
  where l.seller_id = (select auth.uid()) and l.status = 'active'
    and public.tenants_can_trade(l.tenant_id, r.tenant_id)
  order by r.id, r.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;
