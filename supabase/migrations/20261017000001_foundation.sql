-- =====================================================================
-- 0001 Foundation: tenants, domains, profiles, memberships, settings,
-- verification challenges, rate limits, and authorization helpers.
-- Non-destructive: creates objects only. Safe on a project with no
-- conflicting objects. Inspect existing schema before applying.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema private from anon, authenticated';
  end if;
end $$;

create type public.tenant_status      as enum ('active', 'pending', 'suspended');
create type public.membership_role    as enum ('member', 'moderator', 'admin');
create type public.membership_status  as enum ('active', 'pending', 'revoked');
create type public.browse_scope       as enum ('home', 'memberships', 'network', 'custom');
create type public.calendar_event_kind as enum ('move_in', 'semester_start', 'midterms', 'finals', 'move_out', 'break');

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- Tenants (universities)
-- ---------------------------------------------------------------------
create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name            text not null check (char_length(name) between 2 and 120),
  short_name      text not null check (char_length(short_name) between 1 and 24),
  status          public.tenant_status not null default 'pending',
  primary_color   text not null default '#2F5D8A' check (primary_color   ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#5B6B7A' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path       text check (char_length(logo_path) <= 300),
  banner_path     text check (char_length(banner_path) <= 300),
  welcome_text    text check (char_length(welcome_text) <= 280),
  settings        jsonb not null default jsonb_build_object(
                    'network_visible', true,
                    'allow_cross_campus_offers', true,
                    'pending_members_can_post', false,
                    'categories', jsonb_build_array('textbooks','dorm','lab','tickets','tutoring','rides','electronics','furniture','clothing','other')
                  ),
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

create table public.tenant_domains (
  domain             text primary key
                     check (domain = lower(domain)
                            and char_length(domain) <= 253
                            and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+edu$'),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  include_subdomains boolean not null default true,
  is_primary         boolean not null default false,
  verified           boolean not null default false,
  created_at         timestamptz not null default now()
);
create index tenant_domains_tenant_idx on public.tenant_domains (tenant_id);
create unique index tenant_domains_one_primary on public.tenant_domains (tenant_id) where is_primary;

create table public.tenant_calendar_events (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  kind       public.calendar_event_kind not null,
  label      text not null check (char_length(label) between 2 and 80),
  starts_on  date not null,
  ends_on    date not null,
  check (ends_on >= starts_on),
  unique (tenant_id, kind, starts_on)
);
create index tenant_calendar_events_idx on public.tenant_calendar_events (tenant_id, ends_on);

-- ---------------------------------------------------------------------
-- Profiles: public-safe fields only. Email lives in auth.users.
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text not null check (char_length(btrim(display_name)) between 2 and 40),
  avatar_path      text check (char_length(avatar_path) <= 300),
  bio              text check (char_length(bio) <= 280),
  home_tenant_id   uuid not null references public.tenants(id) on delete restrict,
  completed_trades integer not null default 0 check (completed_trades >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index profiles_home_tenant_idx on public.profiles (home_tenant_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.tenant_memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  role            public.membership_role not null default 'member',
  status          public.membership_status not null default 'active',
  verified_domain text not null,
  verified_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (user_id, tenant_id)
);
create index tenant_memberships_tenant_idx on public.tenant_memberships (tenant_id, status);

create table public.user_settings (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  browse_scope      public.browse_scope not null default 'home',
  browse_tenant_ids uuid[] not null default '{}' check (cardinality(browse_tenant_ids) <= 25),
  active_tenant_id  uuid references public.tenants(id) on delete set null,
  arrival_date      date,
  updated_at        timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Private security tables (not exposed through the Data API)
-- ---------------------------------------------------------------------
create table private.verification_challenges (
  id                      uuid primary key,
  email                   text not null check (email = lower(email) and char_length(email) <= 254),
  email_canonical         text not null,
  email_domain            text not null,
  code_hash               text not null,
  attempts                smallint not null default 0,
  max_attempts            smallint not null default 5,
  delivery_status         text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  ip_hash                 text,
  created_at              timestamptz not null default now(),
  expires_at              timestamptz not null,
  verified_at             timestamptz,
  superseded_at           timestamptz,
  signup_token_hash       text,
  signup_token_expires_at timestamptz,
  consumed_at             timestamptz
);
create index verification_challenges_email_idx
  on private.verification_challenges (email_canonical, created_at desc);

create table private.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------
-- Authorization helpers (security definer, fixed search_path)
-- ---------------------------------------------------------------------
create or replace function public.is_member(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_memberships m
    where m.user_id = (select auth.uid()) and m.tenant_id = p_tenant and m.status = 'active');
$$;

create or replace function public.can_post_in(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = (select auth.uid()) and m.tenant_id = p_tenant and m.status = 'active'
      and (t.status = 'active'
           or (t.status = 'pending' and coalesce((t.settings->>'pending_members_can_post')::boolean, false))));
$$;

create or replace function public.tenant_is_browsable(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.tenants t
           where t.id = p_tenant and t.status = 'active'
             and coalesce((t.settings->>'network_visible')::boolean, true))
         or public.is_member(p_tenant);
$$;

create or replace function public.tenants_can_trade(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_a = p_b or (
    select count(*) = 2 from public.tenants t
    where t.id in (p_a, p_b) and t.status = 'active'
      and coalesce((t.settings->>'allow_cross_campus_offers')::boolean, false));
$$;

-- Current user may make offers / send trade proposals involving p_tenant.
create or replace function public.can_transact_in(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_post_in(p_tenant) or exists (
    select 1 from public.tenant_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
      and public.can_post_in(m.tenant_id)
      and public.tenants_can_trade(m.tenant_id, p_tenant));
$$;

create or replace function public.my_browse_tenant_ids() returns uuid[]
language plpgsql stable security definer set search_path = '' as $$
declare s public.user_settings; v uuid[];
begin
  select * into s from public.user_settings where user_id = (select auth.uid());
  if not found then return '{}'; end if;
  case s.browse_scope
    when 'home' then
      select array[p.home_tenant_id] into v from public.profiles p where p.id = s.user_id;
    when 'memberships' then
      select coalesce(array_agg(m.tenant_id), '{}') into v from public.tenant_memberships m
      where m.user_id = s.user_id and m.status = 'active';
    when 'network' then
      select coalesce(array_agg(t.id), '{}') into v from public.tenants t
      where public.tenant_is_browsable(t.id);
    when 'custom' then
      select coalesce(array_agg(x), '{}') into v from unnest(s.browse_tenant_ids) x
      where public.tenant_is_browsable(x);
  end case;
  return coalesce(v, '{}');
end $$;

create or replace function public.validate_user_settings() returns trigger
language plpgsql set search_path = '' as $$
declare bad uuid;
begin
  select x into bad from unnest(new.browse_tenant_ids) x where not public.tenant_is_browsable(x) limit 1;
  if bad is not null then raise exception 'tenant_not_browsable' using errcode = 'P0001'; end if;
  if new.active_tenant_id is not null and not public.tenant_is_browsable(new.active_tenant_id) then
    raise exception 'tenant_not_browsable' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger user_settings_validate before insert or update on public.user_settings
  for each row execute function public.validate_user_settings();

-- ---------------------------------------------------------------------
-- Tenant resolution (longest-suffix match, honoring include_subdomains)
-- ---------------------------------------------------------------------
create or replace function public.resolve_tenant_for_domain(p_domain text)
returns table (tenant_id uuid, slug text, name text, status public.tenant_status, matched_domain text)
language plpgsql stable security definer set search_path = '' as $$
declare v_d text := lower(btrim(p_domain)); v_first boolean := true;
begin
  while v_d is not null and position('.' in v_d) > 0 loop
    return query
      select t.id, t.slug, t.name, t.status, d.domain
      from public.tenant_domains d join public.tenants t on t.id = d.tenant_id
      where d.domain = v_d and (v_first or d.include_subdomains)
      limit 1;
    if found then return; end if;
    v_first := false;
    v_d := substring(v_d from position('.' in v_d) + 1);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Verification challenge lifecycle (service role only)
-- ---------------------------------------------------------------------
create or replace function public.create_verification_challenge(
  p_id uuid, p_email text, p_email_canonical text, p_domain text, p_code_hash text,
  p_ip_hash text, p_ttl_seconds integer default 600, p_cooldown_seconds integer default 60,
  p_max_per_hour integer default 5)
returns table (status text, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz; v_count integer;
begin
  -- Serialize issuance per canonical email to prevent concurrent double sends.
  perform pg_advisory_xact_lock(hashtextextended('vc:' || p_email_canonical, 0));

  select max(c.created_at), count(*) into v_last, v_count
  from private.verification_challenges c
  where c.email_canonical = p_email_canonical and c.created_at > now() - interval '1 hour';

  if v_last is not null and v_last > now() - make_interval(secs => p_cooldown_seconds) then
    return query select 'cooldown'::text,
      greatest(1, ceil(extract(epoch from (v_last + make_interval(secs => p_cooldown_seconds) - now())))::integer);
    return;
  end if;
  if v_count >= p_max_per_hour then
    return query select 'limited'::text, 3600; return;
  end if;

  update private.verification_challenges c set superseded_at = now()
  where c.email_canonical = p_email_canonical and c.superseded_at is null and c.consumed_at is null;

  insert into private.verification_challenges
    (id, email, email_canonical, email_domain, code_hash, ip_hash, expires_at)
  values
    (p_id, p_email, p_email_canonical, p_domain, p_code_hash, p_ip_hash,
     now() + make_interval(secs => p_ttl_seconds));

  return query select 'created'::text, 0;
end $$;

create or replace function public.mark_challenge_delivery(p_id uuid, p_status text) returns void
language sql security definer set search_path = '' as $$
  update private.verification_challenges set delivery_status = p_status
  where id = p_id and p_status in ('sent', 'failed');
$$;

create or replace function public.verify_challenge(
  p_id uuid, p_code_hash text, p_token_hash text, p_token_ttl_seconds integer default 900)
returns table (status text, attempts_remaining integer)
language plpgsql security definer set search_path = '' as $$
declare c private.verification_challenges;
begin
  select * into c from private.verification_challenges where id = p_id for update;
  if not found then return query select 'invalid'::text, 0; return; end if;
  if c.superseded_at is not null or c.consumed_at is not null or c.verified_at is not null then
    return query select 'expired'::text, 0; return;
  end if;
  if c.delivery_status <> 'sent' then return query select 'invalid'::text, 0; return; end if;
  if c.expires_at <= now() then return query select 'expired'::text, 0; return; end if;
  if c.attempts >= c.max_attempts then return query select 'locked'::text, 0; return; end if;

  update private.verification_challenges set attempts = attempts + 1 where id = p_id;

  if c.code_hash = p_code_hash then
    update private.verification_challenges
      set verified_at = now(), signup_token_hash = p_token_hash,
          signup_token_expires_at = now() + make_interval(secs => p_token_ttl_seconds)
      where id = p_id;
    return query select 'ok'::text, 0;
  elsif c.attempts + 1 >= c.max_attempts then
    return query select 'locked'::text, 0;
  else
    return query select 'invalid'::text, (c.max_attempts - c.attempts - 1)::integer;
  end if;
end $$;

-- Single atomic UPDATE: only one concurrent request can consume a token.
create or replace function public.consume_signup_token(p_id uuid, p_token_hash text)
returns table (email text, email_domain text)
language sql security definer set search_path = '' as $$
  update private.verification_challenges c set consumed_at = now()
  where c.id = p_id and c.signup_token_hash = p_token_hash
    and c.verified_at is not null and c.consumed_at is null and c.superseded_at is null
    and c.signup_token_expires_at > now()
  returning c.email, c.email_domain;
$$;

-- Compensation when account creation fails for a retryable reason.
create or replace function public.release_signup_token(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update private.verification_challenges set consumed_at = null
  where id = p_id and signup_token_expires_at > now() and superseded_at is null;
$$;

create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_max;
end $$;

-- ---------------------------------------------------------------------
-- Account provisioning (service role only, one transaction)
-- Unknown .edu domains get a PENDING tenant with an UNVERIFIED domain.
-- ---------------------------------------------------------------------
create or replace function public.provision_account(p_user_id uuid, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text; v_confirmed timestamptz; v_domain text; v_reg text; v_slug text; v_tenant uuid;
  v_status public.tenant_status;
begin
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = p_user_id;
  if v_email is null then raise exception 'user_not_found' using errcode = 'P0001'; end if;
  if v_confirmed is null then raise exception 'email_not_confirmed' using errcode = 'P0001'; end if;

  v_domain := split_part(v_email, '@', 2);
  select r.tenant_id, r.status into v_tenant, v_status from public.resolve_tenant_for_domain(v_domain) r;

  if v_tenant is null then
    v_reg  := array_to_string((string_to_array(v_domain, '.'))[array_length(string_to_array(v_domain, '.'), 1) - 1 :], '.');
    v_slug := left(replace(v_reg, '.', '-'), 63);
    insert into public.tenants (slug, name, short_name, status)
    values (v_slug, v_reg, left(upper(split_part(v_reg, '.', 1)), 24), 'pending')
    on conflict (slug) do nothing
    returning id into v_tenant;
    if v_tenant is null then select id into v_tenant from public.tenants where slug = v_slug; end if;
    insert into public.tenant_domains (domain, tenant_id, include_subdomains, is_primary, verified)
    values (v_reg, v_tenant, true, true, false)
    on conflict (domain) do nothing;
    select r.tenant_id, r.status into v_tenant, v_status from public.resolve_tenant_for_domain(v_domain) r;
  end if;

  if v_status = 'suspended' then raise exception 'tenant_suspended' using errcode = 'P0001'; end if;

  insert into public.profiles (id, display_name, home_tenant_id)
  values (p_user_id, btrim(p_display_name), v_tenant)
  on conflict (id) do nothing;

  insert into public.tenant_memberships (user_id, tenant_id, role, status, verified_domain)
  values (p_user_id, v_tenant, 'member', 'active', v_domain)
  on conflict (user_id, tenant_id) do nothing;

  insert into public.user_settings (user_id, browse_scope, active_tenant_id)
  values (p_user_id, 'home', v_tenant)
  on conflict (user_id) do nothing;

  return v_tenant;
end $$;

-- ---------------------------------------------------------------------
-- Function privileges: service-only functions are not callable by clients.
-- ---------------------------------------------------------------------
revoke execute on function public.create_verification_challenge(uuid, text, text, text, text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.mark_challenge_delivery(uuid, text) from public, anon, authenticated;
revoke execute on function public.verify_challenge(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.consume_signup_token(uuid, text) from public, anon, authenticated;
revoke execute on function public.release_signup_token(uuid) from public, anon, authenticated;
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.provision_account(uuid, text) from public, anon, authenticated;
revoke execute on function public.resolve_tenant_for_domain(text) from public, anon, authenticated;

grant execute on function public.create_verification_challenge(uuid, text, text, text, text, text, integer, integer, integer) to service_role;
grant execute on function public.mark_challenge_delivery(uuid, text) to service_role;
grant execute on function public.verify_challenge(uuid, text, text, integer) to service_role;
grant execute on function public.consume_signup_token(uuid, text) to service_role;
grant execute on function public.release_signup_token(uuid) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.provision_account(uuid, text) to service_role;
grant execute on function public.resolve_tenant_for_domain(text) to service_role;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.tenants                enable row level security;
alter table public.tenant_domains         enable row level security;
alter table public.tenant_calendar_events enable row level security;
alter table public.profiles               enable row level security;
alter table public.tenant_memberships     enable row level security;
alter table public.user_settings          enable row level security;
alter table private.verification_challenges enable row level security;
alter table private.rate_limits             enable row level security;

create policy "tenants: active are public, members see own"
  on public.tenants for select to anon, authenticated
  using (status = 'active' or ((select auth.uid()) is not null and public.is_member(id)));

create policy "tenant_domains: verified domains of active tenants"
  on public.tenant_domains for select to authenticated
  using (verified and exists (select 1 from public.tenants t where t.id = tenant_id and t.status = 'active'));

create policy "calendar: visible for browsable tenants"
  on public.tenant_calendar_events for select to authenticated
  using (public.tenant_is_browsable(tenant_id));

create policy "profiles: authenticated can read public profile fields"
  on public.profiles for select to authenticated using (true);
create policy "profiles: owner updates own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "memberships: active memberships are visible badges"
  on public.tenant_memberships for select to authenticated
  using (user_id = (select auth.uid()) or status = 'active');

create policy "settings: owner reads"
  on public.user_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "settings: owner updates"
  on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Column-level privileges: users can never change their home tenant or reputation.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_path, bio) on public.profiles to authenticated;
revoke insert, update, delete on public.user_settings from anon, authenticated;
grant update (browse_scope, browse_tenant_ids, active_tenant_id, arrival_date) on public.user_settings to authenticated;
revoke insert, update, delete on public.tenants, public.tenant_domains, public.tenant_memberships, public.tenant_calendar_events from anon, authenticated;
