\set ON_ERROR_STOP on
-- Synthetic identities and release metadata, disposable database only.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at)
select ('f4100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'publisher-fixture-'||n||'@example.invalid',now(),false,now(),now() from generate_series(1,7)n;
update private.account_activation_state set activation_state='active' where user_id::text like 'f4100000-%';
insert into public.profiles(id,username,display_name,is_admin,commons_onboarding_completed_at)
select ('f4100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'publisher-fixture-'||n,'Synthetic Publisher Person '||n,n=4,now() from generate_series(1,7)n;
insert into public.user_roles(user_id,role) values('f4100000-0000-4000-8000-000000000003','marketplace_reviewer'),('f4100000-0000-4000-8000-000000000004','administrator');
insert into private.economic_operator_assignments(user_id,capability,reason) values('f4100000-0000-4000-8000-000000000005','marketplace_payout_manage','Synthetic ownership separation test');
create temporary table publisher_preserved as select
 (select jsonb_agg(to_jsonb(f) order by feature_key) from private.economic_feature_flags f) flags,
 (select count(*) from private.economic_seller_accounts) sellers,
 (select count(*) from private.economic_orders) orders,
 (select count(*) from private.economic_seller_publisher_links) financial_links;
create temporary table publisher_test_ids(key text primary key,id uuid);
grant select,insert,update on publisher_test_ids to authenticated;
insert into publisher_test_ids values('publisher',private.establish_marketplace_publisher('synthetic-official','Synthetic Official Publisher','Synthetic Organization','f4100000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','Synthetic explicit owner authorization; not administrator inheritance.',gen_random_uuid()));
insert into publisher_test_ids select 'reference',private.register_external_publisher_release(id,'synthetic.official-addon','1.0.0','Synthetic Organization','https://example.invalid/release/addon.vsix',repeat('a',64),'https://example.invalid/release/v1.0.0',true,'f4100000-0000-4000-8000-000000000001','Synthetic external release evidence, not remote review.',gen_random_uuid()) from publisher_test_ids where key='publisher';
create function pg_temp.publisher_expect_denial(command text) returns void language plpgsql as $$ declare affected integer; begin
 begin execute command; get diagnostics affected=row_count; if command ~* '^(update|delete)' and affected=0 then return; end if; exception when insufficient_privilege or unique_violation then return; when raise_exception then if sqlerrm like 'Submitted Developer Forge draft%' then return; end if; raise; end;
 raise exception 'Unexpected authorization: %',command;
end $$;

set local role anon;
do $$begin
 perform pg_temp.publisher_expect_denial('select public.current_user_publisher_workspace()');
 if public.get_addon_publisher_provenance('synthetic.official-addon','1.0.0',repeat('a',64))->>'publisherDisplayName'<>'Synthetic Official Publisher' then raise exception 'public reference missing';end if;
 if public.get_addon_publisher_provenance('synthetic.official-addon','1.0.0',repeat('b',64)) is not null then raise exception 'wrong artifact acquired provenance';end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000001',true);
do $$declare w jsonb;p uuid:=(select id from publisher_test_ids where key='publisher');begin
 w:=public.current_user_publisher_workspace();
 if jsonb_array_length(w->'publishers')<>1 or jsonb_array_length(w->'releaseReferences')<>1 or jsonb_array_length(w->'listings')<>0 then raise exception 'manager release/listing truth';end if;
 if w->>'commonsDisplayName'<>'Synthetic Publisher Person 1' then raise exception 'own Commons name mismatch';end if;
 perform pg_temp.publisher_expect_denial('select * from private.marketplace_publisher_managers');
 perform pg_temp.publisher_expect_denial(format('update public.publishers set verified=true where id=%L',p));
 perform pg_temp.publisher_expect_denial(format('select private.authorize_marketplace_publisher_manager(%L,%L,true,%L,%L,gen_random_uuid())',p,'f4100000-0000-4000-8000-000000000002','f4100000-0000-4000-8000-000000000001','not permitted from API'));
end $$;
insert into public.developer_profiles(id,user_id,developer_slug,display_name,status) values('f4200000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','synthetic-owner-dev','Synthetic developer','requested');
insert into public.addon_drafts(id,owner_user_id,developer_profile_id,publisher_id,creator_attribution,addon_slug,addon_name,version,license,short_summary,manifest_json)
select 'f4300000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','f4200000-0000-4000-8000-000000000001',id,'Synthetic Organization','synthetic-official-addon','Synthetic Official Addon','1.0.0','Apache-2.0','Synthetic review example','{"addon_id":"synthetic.official-addon","version":"1.0.0","name":"Synthetic Official Addon"}' from publisher_test_ids where key='publisher';
insert into public.addon_submissions(id,addon_draft_id,submitted_by,status) values('f4400000-0000-4000-8000-000000000001','f4300000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','pending');
insert into public.addon_submission_snapshots(id,submission_id,draft_id,developer_user_id,manifest_snapshot,publisher_display_name)
select 'f4500000-0000-4000-8000-000000000001','f4400000-0000-4000-8000-000000000001',id,owner_user_id,manifest_json,'FORGED DISPLAY' from public.addon_drafts where id='f4300000-0000-4000-8000-000000000001';
do $$begin
 if (select publisher_display_name from public.addon_submission_snapshots where id='f4500000-0000-4000-8000-000000000001')<>'Synthetic Official Publisher' then raise exception 'client forged snapshot name';end if;
 perform pg_temp.publisher_expect_denial($q$update public.addon_drafts set creator_attribution='rewritten' where id='f4300000-0000-4000-8000-000000000001'$q$);
 perform pg_temp.publisher_expect_denial($q$update public.addon_submissions set status='approved' where id='f4400000-0000-4000-8000-000000000001'$q$);
 perform pg_temp.publisher_expect_denial($q$update public.addon_submission_snapshots set publisher_display_name='rewritten' where id='f4500000-0000-4000-8000-000000000001'$q$);
end $$;
insert into public.review_items(id,domain,source_table,source_id,submitted_by,title,status) values('f4600000-0000-4000-8000-000000000001','marketplace','addon_submissions','f4400000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','Synthetic review','pending_review');
select public.link_own_addon_submission_review_item('f4400000-0000-4000-8000-000000000001','f4600000-0000-4000-8000-000000000001');
select public.save_own_marketplace_publisher('Synthetic renamed publisher',(select id from publisher_test_ids where key='publisher'));
reset role;
-- Email and role changes cannot transfer publisher ownership or rewrite snapshots.
update auth.users set email='renamed-fixture@example.invalid' where id='f4100000-0000-4000-8000-000000000001';
insert into public.user_roles(user_id,role) values('f4100000-0000-4000-8000-000000000001','administrator');
set local role authenticated;
do $$begin
 if (public.current_user_publisher_workspace()->'publishers'->0->>'displayName')<>'Synthetic renamed publisher' then raise exception 'publisher lost on email rename';end if;
 perform pg_temp.publisher_expect_denial($q$update public.addon_submissions set status='approved' where id='f4400000-0000-4000-8000-000000000001'$q$);
 perform pg_temp.publisher_expect_denial($q$update public.review_items set status='approved' where id='f4600000-0000-4000-8000-000000000001'$q$);
 perform pg_temp.publisher_expect_denial($q$update public.addon_drafts set manifest_json='{}' where id='f4300000-0000-4000-8000-000000000001'$q$);
 if public.get_addon_publisher_provenance('synthetic.official-addon','1.0.0',repeat('a',64))->>'publisherDisplayName'<>'Synthetic Official Publisher' then raise exception 'release reference renamed retroactively';end if;
end $$;
-- Unrelated creator can own their own publisher; attribution text cannot claim another.
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000002',true);
insert into publisher_test_ids values('unrelated',public.save_own_marketplace_publisher('Synthetic unrelated publisher'));
do $$declare p uuid:=(select id from publisher_test_ids where key='publisher');begin
 if public.current_user_can_manage_publisher(p) or jsonb_array_length(public.current_user_publisher_workspace()->'releaseReferences')<>0 then raise exception 'unrelated publisher access';end if;
 perform pg_temp.publisher_expect_denial(format('select public.save_own_marketplace_publisher(%L,%L)','Claimed organization',p));
 perform pg_temp.publisher_expect_denial(format($q$insert into public.addon_drafts(owner_user_id,publisher_id,creator_attribution,addon_slug,addon_name,version,manifest_json) values(%L,%L,'Synthetic Organization','claimed','Claimed','1.0.0','{"addon_id":"synthetic.official-addon"}')$q$,'f4100000-0000-4000-8000-000000000002',(select id from publisher_test_ids where key='unrelated')));
 perform pg_temp.publisher_expect_denial(format($q$insert into public.addon_drafts(owner_user_id,publisher_id,creator_attribution,manifest_json) values(%L,%L,'Synthetic Organization','{"addon_id":"synthetic.unrelated"}')$q$,'f4100000-0000-4000-8000-000000000002',p));
end $$;
insert into public.addon_drafts(id,owner_user_id,publisher_id,creator_attribution,manifest_json) select 'f4300000-0000-4000-8000-000000000002','f4100000-0000-4000-8000-000000000002',id,'Synthetic Organization','{"addon_id":"synthetic.unrelated"}' from publisher_test_ids where key='unrelated';
do $$declare n integer;begin
 for n in 3..6 loop
  perform set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
  if jsonb_array_length(public.current_user_publisher_workspace()->'publishers')<>0 then raise exception 'role conferred publisher management';end if;
  if public.current_user_can_manage_publisher((select id from publisher_test_ids where key='publisher')) then raise exception 'role shortcut';end if;
 end loop;
end $$;
-- Independent reviewer can perform review and publication through existing tables.
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000003',true);
update public.addon_submissions set status='approved' where id='f4400000-0000-4000-8000-000000000001';
insert into public.marketplace_listings(id,addon_id,developer_profile_id,source_submission_id,name,slug,current_version,listing_status,publisher_display_name)
values('f4700000-0000-4000-8000-000000000001','synthetic.official-addon','f4200000-0000-4000-8000-000000000001','f4400000-0000-4000-8000-000000000001','Synthetic Official Addon','synthetic-official-addon','1.0.0','published','FORGED');
insert into public.marketplace_addon_versions(id,listing_id,version,manifest_json,published_at)
select 'f4800000-0000-4000-8000-000000000001','f4700000-0000-4000-8000-000000000001','1.0.0',manifest_snapshot,now() from public.addon_submission_snapshots where id='f4500000-0000-4000-8000-000000000001';
do $$begin
 if (select publisher_display_name from public.marketplace_addon_versions where id='f4800000-0000-4000-8000-000000000001')<>'Synthetic Official Publisher' then raise exception 'publication lost historical snapshot';end if;
 perform pg_temp.publisher_expect_denial($q$update public.marketplace_addon_versions set manifest_json='{}' where id='f4800000-0000-4000-8000-000000000001'$q$);
end $$;
reset role;
-- A later release gets a fresh snapshot; the first release remains revocable
-- using its own original submission even when the listing advances.
set local role authenticated;
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000001',true);
insert into public.addon_drafts(id,owner_user_id,developer_profile_id,publisher_id,creator_attribution,addon_slug,addon_name,version,revision_of_draft_id,manifest_json)
select 'f4300000-0000-4000-8000-000000000003',owner_user_id,developer_profile_id,publisher_id,'Later attribution',addon_slug,addon_name,'1.0.1',id,jsonb_set(manifest_json,'{version}','"1.0.1"') from public.addon_drafts where id='f4300000-0000-4000-8000-000000000001';
insert into public.addon_submissions(id,addon_draft_id,submitted_by,status) values('f4400000-0000-4000-8000-000000000003','f4300000-0000-4000-8000-000000000003','f4100000-0000-4000-8000-000000000001','pending');
insert into public.addon_submission_snapshots(submission_id,draft_id,developer_user_id,manifest_snapshot) select 'f4400000-0000-4000-8000-000000000003',id,owner_user_id,manifest_json from public.addon_drafts where id='f4300000-0000-4000-8000-000000000003';
do $$begin
 if public.current_user_can_independently_review_addon('f4400000-0000-4000-8000-000000000003') then raise exception 'manager admin gained reviewer preflight'; end if;
 perform pg_temp.publisher_expect_denial($q$delete from public.addon_drafts where id='f4300000-0000-4000-8000-000000000003'$q$);
 perform pg_temp.publisher_expect_denial($q$insert into public.marketplace_publication_events(listing_id,actor_user_id,action) values('f4700000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','published')$q$);
end $$;
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000003',true);
do $$begin if not public.current_user_can_independently_review_addon('f4400000-0000-4000-8000-000000000003') then raise exception 'independent marketplace reviewer excluded';end if;end $$;
update public.addon_submissions set status='approved' where id='f4400000-0000-4000-8000-000000000003';
update public.marketplace_listings set source_submission_id='f4400000-0000-4000-8000-000000000003',current_version='1.0.1' where id='f4700000-0000-4000-8000-000000000001';
insert into public.marketplace_addon_versions(listing_id,version,manifest_json,published_at) select 'f4700000-0000-4000-8000-000000000001','1.0.1',manifest_snapshot,now() from public.addon_submission_snapshots where submission_id='f4400000-0000-4000-8000-000000000003';
update public.marketplace_addon_versions set revoked_at=now(),revocation_reason='Synthetic independent revocation' where id='f4800000-0000-4000-8000-000000000001';
insert into public.marketplace_publication_events(listing_id,actor_user_id,action) values('f4700000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000003','published');
do $$begin
 if (select publisher_display_name from public.marketplace_addon_versions where id='f4800000-0000-4000-8000-000000000001')<>'Synthetic Official Publisher' then raise exception 'old release changed on new publication';end if;
 if public.get_addon_publisher_provenance('synthetic.official-addon','1.0.1',null)->>'publisherDisplayName'<>'Synthetic renamed publisher' then raise exception 'later release snapshot missing';end if;
 perform pg_temp.publisher_expect_denial($q$insert into public.marketplace_publication_events(listing_id,actor_user_id,action) values('f4700000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','published')$q$);
end $$;
reset role;
-- Explicit delegation uses the normal publisher identity, no listing transfer.
select private.authorize_marketplace_publisher_manager((select id from publisher_test_ids where key='publisher'),'f4100000-0000-4000-8000-000000000007',true,'f4100000-0000-4000-8000-000000000001','Synthetic owner-approved delegation.',gen_random_uuid());
set local role authenticated;
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000007',true);
do $$begin
 if jsonb_array_length(public.current_user_publisher_workspace()->'listings')<>1 then raise exception 'delegate missing owned listing';end if;
end $$;
reset role;
select private.authorize_marketplace_publisher_manager((select id from publisher_test_ids where key='publisher'),'f4100000-0000-4000-8000-000000000007',false,'f4100000-0000-4000-8000-000000000001','Synthetic delegation revocation.',gen_random_uuid());
set local role authenticated;
do $$begin if jsonb_array_length(public.current_user_publisher_workspace()->'publishers')<>0 then raise exception 'revoked delegate retained authority';end if;end $$;
reset role;
-- Keep the existing account cleanup operational without transferring or
-- revoking the organization's released work when one managing account leaves.
select private.authorize_marketplace_publisher_manager((select id from publisher_test_ids where key='publisher'),'f4100000-0000-4000-8000-000000000007',true,'f4100000-0000-4000-8000-000000000001','Synthetic ongoing organization maintainer.',gen_random_uuid());
delete from public.user_roles where user_id='f4100000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000001',true);
do $$begin if not public.current_user_can_manage_publisher((select id from publisher_test_ids where key='publisher')) then raise exception 'losing admin role lost publisher management';end if;end $$;
reset role;
insert into private.account_lifecycle_requests(id,client_request_id,user_id,action,status,notice_version,cooling_period_ends_at)
values('f4900000-0000-4000-8000-000000000001',gen_random_uuid(),'f4100000-0000-4000-8000-000000000001','account_deletion','storage_cleanup','synthetic-v1',now()-interval '1 minute');
insert into private.account_deletion_handoffs(lifecycle_request_id,storage_inventory_completed_at,storage_inventory_evidence_sha256,owned_storage_object_count,storage_cleanup_completed_at,storage_cleanup_evidence_sha256)
values('f4900000-0000-4000-8000-000000000001',now(),repeat('a',64),0,now(),repeat('b',64));
update private.account_deletion_finalizer_jobs set phase='artisan_cleanup',status='processing',available_at=now(),claimed_by='synthetic-publisher-finalizer',lease_token=gen_random_uuid(),claimed_at=now(),lease_expires_at=now()+interval '5 minutes' where lifecycle_request_id='f4900000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 perform pg_temp.publisher_expect_denial($q$update public.addon_drafts set submission_status='archived',review_status='withdrawn' where id='f4300000-0000-4000-8000-000000000003'$q$);
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
select private.apply_automatic_community_deletion_anonymization('f4900000-0000-4000-8000-000000000001');
update auth.users set deleted_at=now() where id='f4100000-0000-4000-8000-000000000001';
do $$begin
 if (select submission_status from public.addon_drafts where id='f4300000-0000-4000-8000-000000000003')<>'archived' then raise exception 'account cleanup draft archive failed';end if;
 if (select listing_status from public.marketplace_listings where id='f4700000-0000-4000-8000-000000000001')<>'published' then raise exception 'one departing manager revoked organization listing';end if;
 if (select publisher_display_name from public.marketplace_addon_versions where id='f4800000-0000-4000-8000-000000000001')<>'Synthetic Official Publisher' then raise exception 'account cleanup rewrote release provenance';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000007',true);
do $$begin if jsonb_array_length(public.current_user_publisher_workspace()->'listings')<>1 then raise exception 'other maintainer lost organization listing';end if;end $$;
reset role;
do $$declare b publisher_preserved%rowtype;begin
 select * into b from publisher_preserved;
 if b.flags is distinct from (select jsonb_agg(to_jsonb(f) order by feature_key) from private.economic_feature_flags f)
 or b.sellers<>(select count(*) from private.economic_seller_accounts) or b.orders<>(select count(*) from private.economic_orders) or b.financial_links<>(select count(*) from private.economic_seller_publisher_links) then raise exception 'ownership changed financial state';end if;
 if exists(select 1 from public.publishers where id=(select id from publisher_test_ids where key='publisher') and (owner_id is not null or verified)) then raise exception 'organization is personal owner or gained verification';end if;
end $$;
select jsonb_build_object('synthetic_only',true,'roles_tested',7,'publishers',(select count(*) from publisher_test_ids where key in ('publisher','unrelated')),'immutable_versions',2,'financial_state_unchanged',true,'manager_self_review_denied',true,'independent_marketplace_reviewer_accepted',true,'result','publisher_ownership_behavior_ok') as publisher_evidence;
rollback;
