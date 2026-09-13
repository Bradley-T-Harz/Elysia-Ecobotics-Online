\set ON_ERROR_STOP on
-- Disposable synthetic identities only; no source files or real login sessions.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at)
select ('c6100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'codev-fixture-'||n||'@example.invalid',now(),false,now(),now() from generate_series(1,2)n;
insert into auth.sessions(id,user_id,not_after)
select ('c6200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('c6100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,2)n;
create temporary table codev_fixture(k text primary key,v jsonb);
grant all on codev_fixture to authenticated,anon;
insert into codev_fixture values ('key',jsonb_build_object('kty','EC','crv','P-256','x',repeat('A',43),'y',repeat('B',43)));
create temporary table codev_preserved as select
 (select count(*) from public.publishers) publishers,(select count(*) from public.user_roles) roles,
 (select count(*) from public.addon_drafts) drafts,(select count(*) from public.addon_submissions) submissions,
 (select count(*) from private.economic_orders) orders;
create function pg_temp.codev_assert(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',msg;end if;end$$;
create function pg_temp.codev_denied(command text) returns void language plpgsql as $$begin
 begin execute command; exception when insufficient_privilege or invalid_parameter_value then return;end;
 raise exception 'Unexpected authorization: %',command;
end$$;
select pg_temp.codev_assert(private.codev_public_key_valid(null)=false,'NULL key accepted');
select pg_temp.codev_assert(private.codev_public_key_valid(jsonb_build_object('kty',null,'crv','P-256','x',repeat('A',43),'y',repeat('B',43)))=false,'NULL key field accepted');
select pg_temp.codev_assert(private.codev_public_key_valid((select v from codev_fixture where k='key')||'{"d":"private"}')=false,'private key field accepted');
set local role authenticated;
select set_config('request.jwt.claim.sub','c6100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"c6100000-0000-4000-8000-000000000001","session_id":"c6200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.codev_denied('select * from private.codev_pairings');
select pg_temp.codev_denied('select * from private.codev_pairing_events');
insert into codev_fixture values('intent',public.codev_create_pairing_intent('https://elysiaecobotics.com','forge',repeat('b',32),(select v from codev_fixture where k='key'),repeat('a',64)));
select pg_temp.codev_assert((select v->'workspace_grants'='[]'::jsonb and not(v ? 'code_hash') and not(v ? 'native_secret_hash') from codev_fixture where k='intent'),'pairing leaked authority or secret');
select pg_temp.codev_assert(public.codev_browser_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),'https://elysiaecobotics.com','forge',repeat('b',32),'finish') is null,'browser finished before native approval');
select pg_temp.codev_denied($q$select public.codev_claim_pairing_intent(repeat('a',64),(select v from codev_fixture where k='key'),repeat('c',64))$q$);
-- Changing the browser, surface, origin, online identity or login cannot inherit intent.
select pg_temp.codev_assert(public.codev_browser_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),'https://elysiaecobotics.com','marketplace',repeat('b',32),'status') is null,'cross surface');
select pg_temp.codev_assert(public.codev_browser_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),'https://www.elysiaecobotics.com','forge',repeat('b',32),'status') is null,'cross origin');
select pg_temp.codev_assert(public.codev_browser_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),'https://elysiaecobotics.com','forge',repeat('z',32),'status') is null,'cross browser');
select set_config('request.jwt.claim.sub','c6100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"c6100000-0000-4000-8000-000000000002","session_id":"c6200000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.codev_assert(public.codev_browser_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),'https://elysiaecobotics.com','forge',repeat('b',32),'status') is null,'cross account');
set local role anon;
select pg_temp.codev_denied('select * from private.codev_pairings');
select pg_temp.codev_denied($q$select public.codev_browser_pairing(gen_random_uuid(),'https://elysiaecobotics.com','forge',repeat('b',32),'status')$q$);
select pg_temp.codev_assert(public.codev_claim_pairing_intent(repeat('z',64),(select v from codev_fixture where k='key'),repeat('c',64)) is null,'guessed code');
insert into codev_fixture values('claim',public.codev_claim_pairing_intent(repeat('a',64),(select v from codev_fixture where k='key'),repeat('c',64)));
select pg_temp.codev_assert((select v->'intent'->>'status'='pending' from codev_fixture where k='claim'),'claim implicitly approved');
select pg_temp.codev_assert(public.codev_claim_pairing_intent(repeat('a',64),(select v from codev_fixture where k='key'),repeat('c',64)) is null,'replayed claim');
select pg_temp.codev_assert(public.codev_native_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),repeat('d',64),'confirm') is null,'wrong native secret');
select pg_temp.codev_assert(public.codev_native_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),repeat('c',64),'confirm')->'intent'->>'status'='native_approved','explicit native confirmation');
select pg_temp.codev_assert(public.codev_native_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),repeat('c',64),'confirm') is null,'replayed confirmation');
set local role authenticated;
select set_config('request.jwt.claim.sub','c6100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"c6100000-0000-4000-8000-000000000001","session_id":"c6200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.codev_assert(public.codev_browser_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),'https://elysiaecobotics.com','forge',repeat('b',32),'finish')->'intent'->>'status'='paired','browser finish');
reset role;
update auth.users set banned_until=now()+interval '1 hour' where id='c6100000-0000-4000-8000-000000000001';
set local role anon;
select pg_temp.codev_assert(public.codev_native_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),repeat('c',64),'lease') is null,'banned account retained lease');
reset role;
update auth.users set banned_until=null where id='c6100000-0000-4000-8000-000000000001';
update private.codev_pairings set pairing_expires_at=now()-interval '1 second';
set local role anon;
select pg_temp.codev_assert(public.codev_native_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),repeat('c',64),'lease') is null,'expired pairing retained lease');
reset role;
update private.codev_pairings set pairing_expires_at=now()+interval '1 minute';
update private.account_activation_state set activation_state='temporarily_deactivated',temporarily_deactivated_at=now() where user_id='c6100000-0000-4000-8000-000000000001';
set local role anon;
select pg_temp.codev_assert(public.codev_native_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),repeat('c',64),'lease') is null,'deactivated account retained lease');
reset role;
update private.account_activation_state set activation_state='active',temporarily_deactivated_at=null where user_id='c6100000-0000-4000-8000-000000000001';
delete from auth.sessions where id='c6200000-0000-4000-8000-000000000001';
set local role anon;
select pg_temp.codev_assert(public.codev_native_pairing((select (v->>'pairing_id')::uuid from codev_fixture where k='intent'),repeat('c',64),'lease') is null,'logout retained lease');
set local role authenticated;
select pg_temp.codev_denied($q$select public.codev_create_pairing_intent('https://elysiaecobotics.com','forge',repeat('b',32),(select v from codev_fixture where k='key'),repeat('a',64))$q$);
reset role;
select pg_temp.codev_assert(not exists(select 1 from private.codev_pairings),'logout did not cascade');
select pg_temp.codev_assert((select publishers=(select count(*) from public.publishers) and roles=(select count(*) from public.user_roles) and drafts=(select count(*) from public.addon_drafts) and submissions=(select count(*) from public.addon_submissions) and orders=(select count(*) from private.economic_orders) from codev_preserved),'pairing changed external authority');
select 'codev_pairing_identity_replay_expiry_logout_role_isolation_ok';
rollback;
