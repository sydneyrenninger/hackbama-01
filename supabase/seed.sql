-- Demo tenants. Branding is configurable and UNOFFICIAL: no university
-- logos are included and no affiliation is claimed.
insert into public.tenants (id, slug, name, short_name, status, primary_color, secondary_color, welcome_text, is_demo)
values
  ('a1000000-0000-4000-8000-000000000001', 'ua', 'The University of Alabama', 'UA', 'active',
   '#9E1B32', '#828A8F', 'Student-run exchange for the Capstone. Unofficial demo, not affiliated with UA.', true),
  ('a1000000-0000-4000-8000-000000000002', 'riverbend', 'Riverbend State University (demo)', 'Riverbend', 'active',
   '#1F6F5C', '#C9A227', 'Fictional demo campus used to show multi-campus browsing.', true)
on conflict (id) do nothing;

insert into public.tenant_domains (domain, tenant_id, include_subdomains, is_primary, verified) values
  ('ua.edu',              'a1000000-0000-4000-8000-000000000001', true, true, true),
  ('demo-riverbend.edu',  'a1000000-0000-4000-8000-000000000002', true, true, true)
on conflict (domain) do nothing;

-- Approximate academic calendar for demo ranking. Replace with official dates.
insert into public.tenant_calendar_events (tenant_id, kind, label, starts_on, ends_on) values
  ('a1000000-0000-4000-8000-000000000001', 'midterms', 'fall midterms', '2026-10-05', '2026-10-30'),
  ('a1000000-0000-4000-8000-000000000001', 'finals',   'fall finals',   '2026-12-07', '2026-12-11'),
  ('a1000000-0000-4000-8000-000000000001', 'move_out', 'fall move-out', '2026-12-11', '2026-12-14'),
  ('a1000000-0000-4000-8000-000000000001', 'move_in',  'spring move-in','2027-01-09', '2027-01-12'),
  ('a1000000-0000-4000-8000-000000000002', 'midterms', 'fall midterms', '2026-10-12', '2026-10-23'),
  ('a1000000-0000-4000-8000-000000000002', 'finals',   'fall finals',   '2026-12-14', '2026-12-18'),
  ('a1000000-0000-4000-8000-000000000002', 'move_in',  'spring move-in','2027-01-15', '2027-01-18')
on conflict (tenant_id, kind, starts_on) do nothing;
