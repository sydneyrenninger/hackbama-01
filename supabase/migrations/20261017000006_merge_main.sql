-- Merge of main into quad-backend's schema.
-- 1) Profile fields from main's onboarding flow.
-- 2) Any .edu school works immediately (main's behavior): auto-created tenants are
--    'active' instead of 'pending', so they're browsable and can post/trade cross-campus.

alter table public.profiles
  add column major     text check (char_length(major) <= 80),
  add column grad_year integer check (grad_year between 1950 and 2100),
  add column onboarded boolean not null default false;  -- false until user finishes /onboarding

grant update (major, grad_year, onboarded) on public.profiles to authenticated;

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
    values (v_slug, v_reg, left(upper(split_part(v_reg, '.', 1)), 24), 'active')
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

revoke execute on function public.provision_account(uuid, text) from public, anon, authenticated;
grant execute on function public.provision_account(uuid, text) to service_role;
