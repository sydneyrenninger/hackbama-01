-- Account/profile fields beyond the basics in 0001.

alter table profiles
  add column bio text,
  add column grad_year int,
  add column onboarded boolean not null default false;  -- false until user finishes /onboarding

-- Convenience view: a user's own account with their campus attached.
create or replace view my_account with (security_invoker = true) as
  select p.*, c.slug as campus_slug, c.name as campus_name
  from profiles p
  join campuses c on c.id = p.campus_id
  where p.id = auth.uid();
