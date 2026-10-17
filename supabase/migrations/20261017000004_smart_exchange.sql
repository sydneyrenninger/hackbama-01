-- =====================================================================
-- 0004 Smart Campus Exchange: rules-based direct and 3-way trade
-- matching, with explicit consent from every participant.
--
-- Chain semantics for listings [L0, L1, ... Ln-1]:
--   owner(Li) RECEIVES L(i+1 mod n) and GIVES Li to owner(L(i-1 mod n)).
--   Valid when category(L(i+1)) is in Li.trade_wants_categories for all i.
-- =====================================================================

create type public.exchange_status as enum ('proposed','accepted','completed','declined','expired');
create type public.leg_response    as enum ('pending','accepted','declined');

create table public.exchange_proposals (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid references public.profiles(id) on delete set null,
  status          public.exchange_status not null default 'proposed',
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '3 days',
  accepted_at     timestamptz,
  completed_at    timestamptz
);
create index exchange_proposals_status_idx on public.exchange_proposals (status, expires_at);

create table public.exchange_legs (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.exchange_proposals(id) on delete cascade,
  position     smallint not null check (position between 0 and 2),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  giver_id     uuid not null references public.profiles(id) on delete cascade,
  receiver_id  uuid not null references public.profiles(id) on delete cascade,
  response     public.leg_response not null default 'pending',
  responded_at timestamptz,
  completed_at timestamptz,
  unique (proposal_id, position),
  unique (proposal_id, listing_id),
  check (giver_id <> receiver_id)
);
create index exchange_legs_giver_idx    on public.exchange_legs (giver_id);
create index exchange_legs_receiver_idx on public.exchange_legs (receiver_id);
create index exchange_legs_listing_idx  on public.exchange_legs (listing_id);

alter table public.conversations add constraint conversations_exchange_fk
  foreign key (exchange_id) references public.exchange_proposals(id) on delete set null;

create or replace function public.is_exchange_participant(p_proposal uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.exchange_legs el where el.proposal_id = p_proposal
                 and (el.giver_id = (select auth.uid()) or el.receiver_id = (select auth.uid())));
$$;

create or replace function public.listing_in_active_exchange(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.exchange_legs el join public.exchange_proposals ep on ep.id = el.proposal_id
                 where el.listing_id = p_listing and ep.status in ('proposed','accepted') and ep.expires_at > now());
$$;

alter table public.exchange_proposals enable row level security;
alter table public.exchange_legs      enable row level security;
create policy "exchange: participants read proposals"
  on public.exchange_proposals for select to authenticated using (public.is_exchange_participant(id));
create policy "exchange: participants read legs"
  on public.exchange_legs for select to authenticated using (public.is_exchange_participant(proposal_id));
revoke insert, update, delete on public.exchange_proposals, public.exchange_legs from anon, authenticated;

-- ---------------------------------------------------------------------
-- Matching (security invoker: only listings the caller can see)
-- ---------------------------------------------------------------------
create or replace function public.find_trade_matches(p_limit integer default 10)
returns table (match_kind text, listing_ids uuid[], score integer, summary text)
language sql stable security invoker set search_path = '' as $$
  with pool as (
    select l.id, l.seller_id, l.tenant_id, l.title, l.category, l.trade_wants_categories, l.trade_wants_text, l.search,
           p.display_name, t.short_name
    from public.listings l
    join public.profiles p on p.id = l.seller_id
    join public.tenants t on t.id = l.tenant_id
    where l.status = 'active' and l.kind = 'trade' and not public.listing_in_active_exchange(l.id)
  ),
  mine   as (select * from pool where seller_id =  (select auth.uid())),
  others as (select * from pool where seller_id <> (select auth.uid())),
  direct as (
    select 'direct'::text as match_kind, array[m.id, o.id] as listing_ids,
           10 + (case when m.trade_wants_text is not null and o.search @@ plainto_tsquery('english', m.trade_wants_text) then 5 else 0 end)
              + (case when m.tenant_id = o.tenant_id then 2 else 0 end) as score,
           format('Swap your "%s" for %s''s "%s" (%s)', m.title, o.display_name, o.title, o.short_name) as summary
    from mine m join others o
      on o.category = any (m.trade_wants_categories) and m.category = any (o.trade_wants_categories)
     and public.tenants_can_trade(m.tenant_id, o.tenant_id)
  ),
  cycle as (
    select 'three_way'::text, array[m.id, b.id, c.id],
           6 + (case when m.trade_wants_text is not null and b.search @@ plainto_tsquery('english', m.trade_wants_text) then 4 else 0 end),
           format('You get "%s" from %s, %s gets "%s" from %s, and %s gets your "%s"',
                  b.title, b.display_name, b.display_name, c.title, c.display_name, c.display_name, m.title)
    from mine m
    join others b on b.category = any (m.trade_wants_categories) and public.tenants_can_trade(m.tenant_id, b.tenant_id)
    join others c on c.seller_id <> b.seller_id
                 and c.category = any (b.trade_wants_categories)
                 and m.category = any (c.trade_wants_categories)
                 and public.tenants_can_trade(b.tenant_id, c.tenant_id)
                 and public.tenants_can_trade(c.tenant_id, m.tenant_id)
  )
  select * from (select * from direct union all select * from cycle) x
  order by score desc
  limit least(greatest(p_limit, 1), 25);
$$;

-- ---------------------------------------------------------------------
-- Propose: validates the whole chain server-side, proposer auto-accepts.
-- ---------------------------------------------------------------------
create or replace function public.propose_exchange(p_listing_ids uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  n integer := coalesce(cardinality(p_listing_ids), 0);
  ls public.listings[]; cur public.listings; nxt public.listings; prv public.listings;
  v_id uuid; i integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if n not between 2 and 3 then raise exception 'exchange_size_invalid' using errcode = 'P0001'; end if;
  if (select count(distinct x) from unnest(p_listing_ids) x) <> n then
    raise exception 'exchange_duplicate_listing' using errcode = 'P0001';
  end if;
  if (select count(*) from public.exchange_proposals where created_by = v_uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'exchange_rate_limited' using errcode = 'P0001';
  end if;

  perform 1 from public.listings where id = any (p_listing_ids) order by id for update;
  for i in 1..n loop
    select * into cur from public.listings where id = p_listing_ids[i];
    if not found or cur.status <> 'active' or cur.kind <> 'trade'
       or public.listing_in_active_exchange(cur.id) or not public.tenant_is_browsable(cur.tenant_id) then
      raise exception 'listing_unavailable' using errcode = 'P0001';
    end if;
    ls := ls || cur;
  end loop;

  if ls[1].seller_id <> v_uid then raise exception 'exchange_must_start_with_own_listing' using errcode = 'P0001'; end if;
  if not public.can_post_in(ls[1].tenant_id) then raise exception 'not_allowed_to_trade' using errcode = 'P0001'; end if;
  if (select count(distinct (x).seller_id) from unnest(ls) x) <> n then
    raise exception 'exchange_needs_distinct_people' using errcode = 'P0001';
  end if;

  for i in 1..n loop
    cur := ls[i]; nxt := ls[(i % n) + 1];
    if not (nxt.category = any (cur.trade_wants_categories)) then
      raise exception 'exchange_chain_invalid' using errcode = 'P0001';
    end if;
    if not public.tenants_can_trade(cur.tenant_id, nxt.tenant_id) then
      raise exception 'cross_campus_not_allowed' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.exchange_proposals (created_by) values (v_uid) returning id into v_id;
  for i in 1..n loop
    cur := ls[i]; prv := ls[((i - 2 + n) % n) + 1];
    insert into public.exchange_legs (proposal_id, position, listing_id, giver_id, receiver_id, response, responded_at)
    values (v_id, i - 1, cur.id, cur.seller_id, prv.seller_id,
            case when cur.seller_id = v_uid then 'accepted'::public.leg_response else 'pending' end,
            case when cur.seller_id = v_uid then now() end);
  end loop;
  return v_id;
end $$;

create or replace function public.respond_exchange(p_proposal_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); p public.exchange_proposals; v_conv uuid;
begin
  select * into p from public.exchange_proposals where id = p_proposal_id for update;
  if not found or not exists (select 1 from public.exchange_legs where proposal_id = p.id and giver_id = v_uid) then
    raise exception 'exchange_not_found' using errcode = 'P0001';
  end if;
  if p.status <> 'proposed' then raise exception 'exchange_not_open' using errcode = 'P0001'; end if;
  if p.expires_at <= now() then
    update public.exchange_proposals set status = 'expired' where id = p.id;
    return jsonb_build_object('status', 'expired');
  end if;

  if not p_accept then
    update public.exchange_legs set response = 'declined', responded_at = now() where proposal_id = p.id and giver_id = v_uid;
    update public.exchange_proposals set status = 'declined' where id = p.id;
    return jsonb_build_object('status', 'declined');
  end if;

  update public.exchange_legs set response = 'accepted', responded_at = now()
  where proposal_id = p.id and giver_id = v_uid and response = 'pending';

  if exists (select 1 from public.exchange_legs where proposal_id = p.id and response <> 'accepted') then
    return jsonb_build_object('status', 'proposed');
  end if;

  perform 1 from public.listings l where l.id in (select listing_id from public.exchange_legs where proposal_id = p.id)
    order by l.id for update;
  if exists (select 1 from public.exchange_legs el join public.listings l on l.id = el.listing_id
             where el.proposal_id = p.id and l.status <> 'active') then
    update public.exchange_proposals set status = 'expired' where id = p.id;
    raise exception 'listing_unavailable' using errcode = 'P0001';
  end if;

  update public.listings set status = 'reserved'
  where id in (select listing_id from public.exchange_legs where proposal_id = p.id);
  v_conv := public._create_conversation('exchange', null, p.id, null, null,
              array(select distinct giver_id from public.exchange_legs where proposal_id = p.id));
  update public.exchange_proposals set status = 'accepted', accepted_at = now(), conversation_id = v_conv where id = p.id;
  return jsonb_build_object('status', 'accepted', 'conversation_id', v_conv);
end $$;

-- Each participant confirms the handoff; when all confirm, listings are sold
-- and everyone's completed_trades reputation increases by one.
create or replace function public.confirm_exchange_handoff(p_proposal_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); p public.exchange_proposals;
begin
  select * into p from public.exchange_proposals where id = p_proposal_id for update;
  if not found or not exists (select 1 from public.exchange_legs where proposal_id = p.id and giver_id = v_uid) then
    raise exception 'exchange_not_found' using errcode = 'P0001';
  end if;
  if p.status <> 'accepted' then raise exception 'exchange_not_accepted' using errcode = 'P0001'; end if;

  update public.exchange_legs set completed_at = coalesce(completed_at, now()) where proposal_id = p.id and giver_id = v_uid;
  if exists (select 1 from public.exchange_legs where proposal_id = p.id and completed_at is null) then
    return jsonb_build_object('status', 'accepted');
  end if;

  update public.listings set status = 'sold' where id in (select listing_id from public.exchange_legs where proposal_id = p.id);
  update public.profiles set completed_trades = completed_trades + 1
    where id in (select distinct giver_id from public.exchange_legs where proposal_id = p.id);
  update public.exchange_proposals set status = 'completed', completed_at = now() where id = p.id;
  return jsonb_build_object('status', 'completed');
end $$;

create or replace function public.my_exchanges()
returns table (proposal_id uuid, status public.exchange_status, created_at timestamptz, expires_at timestamptz,
               conversation_id uuid, legs jsonb)
language sql stable security invoker set search_path = '' as $$
  select ep.id, ep.status, ep.created_at, ep.expires_at, ep.conversation_id,
         (select jsonb_agg(jsonb_build_object(
                   'position', el.position, 'listing_id', el.listing_id, 'listing_title', l.title,
                   'category', l.category, 'giver_id', el.giver_id, 'giver_name', g.display_name,
                   'receiver_id', el.receiver_id, 'receiver_name', r.display_name,
                   'response', el.response, 'completed', el.completed_at is not null) order by el.position)
            from public.exchange_legs el
            join public.listings l on l.id = el.listing_id
            join public.profiles g on g.id = el.giver_id
            join public.profiles r on r.id = el.receiver_id
           where el.proposal_id = ep.id)
  from public.exchange_proposals ep
  where public.is_exchange_participant(ep.id)
  order by ep.created_at desc;
$$;
