-- Pre-branded tenants. Any other .edu school gets a default campus row on its first signup;
-- the "new campus deploy" demo = sign up with a new school's email, then update its theme/logo.
insert into campuses (slug, name, email_domain, theme, pickup_spots) values
  ('ua', 'University of Alabama', 'ua.edu',
   '{"primary":"#9E1B32","secondary":"#FFFFFF"}', array['Ferguson Center','Gorgas Library','Bryant-Denny']),
  ('auburn', 'Auburn University', 'auburn.edu',
   '{"primary":"#0C2340","secondary":"#E87722"}', array['Student Center','Haley Center']);

-- Cross-campus interest communities
insert into communities (slug, name, campus_id) values
  ('gameday', 'Gameday', null),
  ('pre-med', 'Pre-Med', null),
  ('greek-life', 'Greek Life', null);
