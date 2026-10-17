-- pgTAP tests. Run against a LOCAL Supabase stack: `supabase test db`
-- Everything runs inside a transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Fixtures -----------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-4111-8111-111111111111', 'ana@crimson.ua.edu',          now()),
  ('22222222-2222-4222-8222-222222222222', 'ben@ua.edu',                  now()),
  ('33333333-3333-4333-8333-333333333333', 'cy@demo-riverbend.edu',       now()),
  ('44444444-4444-4444-8444-444444444444', 'dee@newschool.edu',           now());

select is(public.provision_account('11111111-1111-4111-8111-111111111111', 'Ana'),
          'a1000000-0000-4000-8000-000000000001'::uuid, 'subdomain crimson.ua.edu resolves to UA');
select public.provision_account('22222222-2222-4222-8222-222222222222', 'Ben');
select is(public.provision_account('33333333-3333-4333-8333-333333333333', 'Cy'),
          'a1000000-0000-4000-8000-000000000002'::uuid, 'Riverbend user resolves to Riverbend');
select isnt(public.provision_account('44444444-4444-4444-8444-444444444444', 'Dee'), null, 'unknown domain provisions a tenant');
select is((select status::text from public.tenants where slug = 'newschool-edu'), 'pending', 'unknown domain tenant is pending');
select is((select verified from public.tenant_domains where domain = 'newschool.edu'), false, 'unknown domain is not marked verified');

-- Clients cannot call service-only functions ---------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ select public.provision_account('11111111-1111-4111-8111-111111111111', 'x') $$, '42501', null, 'authenticated cannot provision accounts');
select throws_ok($$ select * from private.verification_challenges $$, '42501', null, 'private schema is not reachable');

-- Tenant isolation on writes -------------------------------------------
select throws_ok($$ insert into public.listings (tenant_id, seller_id, title, category, kind, price_cents)
                    values ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Fake post', 'dorm', 'sale', 500) $$,
                 '42501', null, 'UA member cannot post into Riverbend');
select throws_ok($$ insert into public.listings (tenant_id, seller_id, title, category, kind, price_cents)
                    values ('a1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Impersonation', 'dorm', 'sale', 500) $$,
                 '42501', null, 'cannot post as another user');
select lives_ok($$ insert into public.listings (id, tenant_id, seller_id, title, category, kind, trade_wants_categories)
                   values ('aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
                           'Chem 101 textbook', 'textbooks', 'trade', '{lab}') $$, 'member can post at home');
select throws_ok($$ update public.profiles set home_tenant_id = 'a1000000-0000-4000-8000-000000000002' where id = '11111111-1111-4111-8111-111111111111' $$,
                 '42501', null, 'cannot change own home tenant');

-- Pending-tenant member is browse-only -----------------------------------
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select throws_ok($$ insert into public.listings (tenant_id, seller_id, title, category, kind, price_cents)
                    values ((select home_tenant_id from public.profiles where id = '44444444-4444-4444-8444-444444444444'),
                            '44444444-4444-4444-8444-444444444444', 'Mini fridge', 'dorm', 'sale', 4000) $$,
                 '42501', null, 'pending campus member cannot post yet');

-- Cross-campus read + 3-way exchange -------------------------------------
reset role;
insert into public.listings (id, tenant_id, seller_id, title, category, kind, trade_wants_categories) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Lab goggles + coat', 'lab', 'trade', '{electronics}'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'TI-84 calculator', 'electronics', 'trade', '{textbooks}');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select ok(exists (select 1 from public.listings where id = 'aaaaaaaa-0000-4000-8000-000000000003'), 'UA user can browse Riverbend listing');
select ok(exists (select 1 from public.find_trade_matches() where match_kind = 'three_way'), 'three-way trade is detected');
select throws_ok($$ select public.propose_exchange(array['aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002']::uuid[]) $$,
                 'P0001', 'exchange_chain_invalid', 'wrong-order chain is rejected');

-- Messaging: non-participants see nothing --------------------------------
reset role;
select public._create_conversation('offer', null, null, null, null,
  array['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333']::uuid[]);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.conversations), 0, 'non-participant cannot see conversations');

select * from finish();
rollback;
