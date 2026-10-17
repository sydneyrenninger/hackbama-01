-- pgTAP tests for 0007 (tags, reels/video, request channels, relevance search)
-- plus the request -> accepted offer -> private chat flow.
-- Everything runs inside a transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures -----------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-0000000000a1', 'ft-ana@crimson.ua.edu', now()),
  ('a0000000-0000-4000-8000-0000000000b2', 'ft-ben@ua.edu',         now()),
  ('a0000000-0000-4000-8000-0000000000c3', 'ft-cy@demo-riverbend.edu', now());
select public.provision_account('a0000000-0000-4000-8000-0000000000a1', 'Ana');
select public.provision_account('a0000000-0000-4000-8000-0000000000b2', 'Ben');
select public.provision_account('a0000000-0000-4000-8000-0000000000c3', 'Cy');

-- Ana posts ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

insert into public.listings (id, tenant_id, seller_id, title, description, category, kind, price_cents, tags) values
  ('f0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1',
   'Blue dress', 'Blue dress, worn once', 'clothing', 'sale', 2500, array['#Dress ', 'formal', 'dress']),
  ('f0000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1',
   'Desk lamp', 'Goes with any dorm, even a dress-up party', 'dorm', 'sale', 900, array['lamp']),
  ('f0000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1',
   'ECE 380 textbook', 'Signals and systems', 'textbooks', 'sale', 4000, array['ECE', 'textbook']);

select is((select tags from public.listings where id = 'f0000000-0000-4000-8000-000000000001'),
          array['dress', 'formal'], 'tags are normalized: lowercase, no #, deduped, sorted');

select throws_ok($$ insert into public.listings (tenant_id, seller_id, title, category, kind, price_cents)
  values ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', 'No tags here', 'dorm', 'sale', 100) $$,
  '23514', null, 'listings require at least one tag');
select throws_ok($$ insert into public.listings (tenant_id, seller_id, title, category, kind, price_cents, tags)
  values ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', 'Bad tag', 'dorm', 'sale', 100, array['has space']) $$,
  '23514', null, 'tags with spaces are rejected');

-- Reels / video media
insert into public.listings (id, tenant_id, seller_id, title, category, kind, price_cents, tags, is_reel) values
  ('f0000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1',
   'Gameday tickets reel', 'tickets', 'sale', 3000, array['gameday'], true);
select lives_ok($$ insert into public.listing_images (listing_id, storage_path, position, media_type)
  values ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-000000000001.mp4', 0, 'video') $$,
  'seller attaches a video from their own folder');
select throws_ok($$ insert into public.listing_images (listing_id, storage_path, position, media_type)
  values ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-0000000000b2/00000000-0000-4000-8000-000000000002.mp4', 1, 'video') $$,
  '42501', null, 'cannot attach a file from someone else''s folder');
select throws_ok($$ insert into public.listing_images (listing_id, storage_path, position, media_type)
  values ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-000000000003.gif', 1, 'gif') $$,
  '23514', null, 'media_type must be image or video');

-- Channels
-- Names are prefixed "ZZ pgTAP" so they never collide with channels real users create.
select is((select slug from public.create_channel('ZZ pgTAP One', 'Buy and sell game tickets')), 'zz-pgtap-one',
          'create_channel slugifies the name');
select throws_ok($$ select public.create_channel('zz pgtap one') $$, 'P0001', 'channel_exists', 'channel names are unique (case-insensitive)');
select throws_ok($$ select public.create_channel('!!') $$, 'P0001', 'channel_name_invalid', 'channel name needs letters or numbers');
select public.create_channel('ZZ pgTAP ' || n) from generate_series(2, 5) n;
select throws_ok($$ select public.create_channel('ZZ pgTAP too many') $$, 'P0001', 'channel_rate_limited', 'max 5 new channels per user per day');
select throws_ok($$ insert into public.request_channels (slug, name) values ('sneaky', 'Sneaky') $$,
  '42501', null, 'channels can only be created through create_channel()');

-- Ben browses, requests, saves --------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-0000000000b2","role":"authenticated"}';

select is((select count(*)::int from public.list_channels(p_limit => 100)
           where slug in ('tutoring', 'rides', 'tickets', 'textbooks', 'housing') or slug like 'zz-pgtap-%'), 10,
          'list_channels shows the 5 starter channels + the 5 created here');
insert into public.requests (id, tenant_id, requester_id, title, category, budget_cents, channel_id, tags) values
  ('e0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2',
   'Need an ECE tutor', 'tutoring', 3000, (select id from public.request_channels where slug = 'zz-pgtap-one'), array['#ECE']);
select is((select open_requests::int from public.list_channels('pgtap one') where slug = 'zz-pgtap-one'), 1,
          'channel shows its open request count; search by name works');

-- Searches are scoped to this test's own listings (ids start f0000000-) so real listings can't affect them.
select is((select (array_agg(id order by rank desc, id))[1] from public.search_listing_ids(array['a1000000-0000-4000-8000-000000000001']::uuid[], 'dress', p_limit => 100)
           where id::text like 'f0000000-%'),
          'f0000000-0000-4000-8000-000000000001'::uuid, 'relevance: title match ranks above description match');
select is((select count(*)::int from public.search_listing_ids(array['a1000000-0000-4000-8000-000000000001']::uuid[], 'dress', p_limit => 100)
           where id::text like 'f0000000-%'), 2,
          'text search matches title and description');
select is((select array_agg(id) from public.search_listing_ids(array['a1000000-0000-4000-8000-000000000001']::uuid[], null, array['#ECE'], p_limit => 100)
           where id::text like 'f0000000-%'),
          array['f0000000-0000-4000-8000-000000000003'::uuid], 'tag filter (normalized) finds the ECE textbook');
select is((select array_agg(id) from public.search_listing_ids(array['a1000000-0000-4000-8000-000000000001']::uuid[], p_reels_only => true, p_limit => 100)
           where id::text like 'f0000000-%'),
          array['f0000000-0000-4000-8000-000000000004'::uuid], 'reels_only returns only reels');
select is((select (array_agg(id))[1] from public.search_listing_ids(array['a1000000-0000-4000-8000-000000000001']::uuid[], p_sort => 'price_asc', p_limit => 100)
           where id::text like 'f0000000-%'),
          'f0000000-0000-4000-8000-000000000002'::uuid, 'price low to high');

select public.swipe('f0000000-0000-4000-8000-000000000001', 'save');
select is((select count(*)::int from public.listing_interactions where action = 'save'), 1, 'Ben sees his saved listing');

-- Cross-campus: Cy (Riverbend) browses UA ------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-0000000000c3","role":"authenticated"}';
select is((select count(*)::int from public.search_listing_ids(array['a1000000-0000-4000-8000-000000000001']::uuid[], p_limit => 100)
           where id::text like 'f0000000-%'), 4,
          'a Riverbend student can search UA listings');
select is((select count(*)::int from public.listing_interactions), 0, 'saves are private to their owner');

-- Request -> offer -> accept -> private chat ------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
create temp table t_offer as
  select public.respond_to_request('e0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 3000, 'I tutor ECE and have the book') as id;

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from public.conversations), 0, 'no chat exists before the requester accepts');
create temp table t_conv as
  select (public.respond_to_offer((select id from t_offer), true)->>'conversation_id')::uuid as id;
select is((select array_agg(user_id order by user_id) from public.conversation_participants where conversation_id = (select id from t_conv)),
          array['a0000000-0000-4000-8000-0000000000a1'::uuid, 'a0000000-0000-4000-8000-0000000000b2'::uuid],
          'accepting opens a private chat between exactly the two of them');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-0000000000c3","role":"authenticated"}';
select is((select count(*)::int from public.conversations where id = (select id from t_conv)), 0, 'outsiders cannot see the chat');

select * from finish();
rollback;
