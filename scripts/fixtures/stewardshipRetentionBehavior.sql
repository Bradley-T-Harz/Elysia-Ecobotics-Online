\set ON_ERROR_STOP on
-- Synthetic storage catalog objects only; never run against a real project.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at)
select ('f6100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'proof-policy-'||n||'@example.invalid',now(),false,now(),now() from generate_series(1,3)n;
update private.account_activation_state set activation_state='active' where user_id::text like 'f6100000-%';
insert into public.profiles(id,username,display_name,is_admin,commons_onboarding_completed_at)
select ('f6100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'proof-policy-'||n,'Synthetic proof person '||n,n=3,now() from generate_series(1,3)n;
insert into public.user_roles(user_id,role) values('f6100000-0000-4000-8000-000000000002','stewardship_reviewer'),('f6100000-0000-4000-8000-000000000003','administrator');
insert into public.stewardship_recognition_requests(id,user_id,organization_name,redaction_confirmed,status)
select ('f6200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6100000-0000-4000-8000-000000000001','Synthetic independent organization',true,'pending_review' from generate_series(1,4)n;
insert into public.review_items(domain,source_table,source_id,submitted_by,status,title)
select 'stewardship','stewardship_recognition_requests',id,user_id,'pending_review','Synthetic stewardship review' from public.stewardship_recognition_requests where id::text like 'f6200000-%';
insert into public.stewardship_receipt_files(id,request_id,user_id,storage_path,original_filename,mime_type,size_bytes,sha256_hash)
select ('f6300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f6200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6100000-0000-4000-8000-000000000001',
 'f6100000-0000-4000-8000-000000000001/f6200000-0000-4000-8000-'||lpad(n::text,12,'0')||'/f6300000-0000-4000-8000-'||lpad(n::text,12,'0')||'-redacted-proof.pdf','redacted-proof.pdf','application/pdf',512,repeat('a',64) from generate_series(1,4)n;
insert into storage.objects(id,bucket_id,name,owner_id,metadata)
select id,'stewardship-receipts',storage_path,user_id,'{"size":512,"mimetype":"application/pdf"}' from public.stewardship_receipt_files where id::text like 'f6300000-%';
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000003',true);
do $$begin
 if public.current_user_can_review_domain('stewardship') then raise exception 'admin inherited stewardship review';end if;
 if exists(select 1 from storage.objects where bucket_id='stewardship-receipts' and name like 'f6100000-%') then raise exception 'admin read private proof';end if;
 begin perform public.review_stewardship_request('f6200000-0000-4000-8000-000000000001','approved','Not authorized','pending_review');raise exception 'admin reviewed proof';exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000002',true);
do $$declare r record;begin
 if (select count(*) from storage.objects where bucket_id='stewardship-receipts' and name like 'f6100000-%')<>4 then raise exception 'Scoped reviewer cannot access linked proof';end if;
 begin update public.review_items set status='approved' where domain='stewardship' and source_id='f6200000-0000-4000-8000-000000000001';raise exception 'generic stewardship approval bypass';exception when insufficient_privilege then null;end;
 for r in select id from public.stewardship_recognition_requests where id::text like 'f6200000-%' loop
  perform public.review_stewardship_request(r.id,'approved','Synthetic final review.','pending_review');
 end loop;
end;$$;
reset role;
-- Move only synthetic lifecycle clocks to test boundary behavior.
update private.stewardship_proof_lifecycle set final_review_at=now()-interval '31 days' where request_id::text like 'f6200000-%';
update private.stewardship_proof_lifecycle set final_review_at=now()-interval '29 days' where request_id='f6200000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000001',true);
select public.stewardship_retention_command('f6200000-0000-4000-8000-000000000003',2,'appeal','Please reconsider this synthetic outcome.',null);
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000002',true);
select public.stewardship_retention_command('f6200000-0000-4000-8000-000000000004',2,'hold_legal','Synthetic necessary hold.',now()+interval '3 days');
reset role;
create temporary table proof_jobs(data jsonb);
grant select,insert on proof_jobs to service_role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
insert into proof_jobs values(public.claim_stewardship_proof_deletions(10));
do $$declare jobs jsonb:=(select data from proof_jobs);begin
 if jsonb_array_length(jobs)<>1 or jobs->0->>'requestId'<>'f6200000-0000-4000-8000-000000000001' then raise exception 'Retention selected pending-window, appeal or hold evidence';end if;
 if public.claim_stewardship_proof_deletions(10)<>'[]'::jsonb then raise exception 'Retention lease duplicated';end if;
 begin perform public.complete_stewardship_proof_deletion((jobs->0->>'requestId')::uuid,(jobs->0->>'leaseToken')::uuid);raise exception 'Marked proof deleted while object exists';exception when object_not_in_prerequisite_state then null;end;
end;$$;
reset role;
-- This disposable object catalog models a successful Storage API removal.
delete from storage.objects where id='f6300000-0000-4000-8000-000000000001';
set local role service_role;
select public.complete_stewardship_proof_deletion((data->0->>'requestId')::uuid,(data->0->>'leaseToken')::uuid) from proof_jobs;
reset role;
do $$begin
 if exists(select 1 from public.stewardship_receipt_files where id='f6300000-0000-4000-8000-000000000001' and (deleted_at is null or sha256_hash is not null or mime_type is not null or size_bytes is not null)) then raise exception 'raw proof metadata not minimized';end if;
end;$$;
-- A restored copy is recognized without retaining the filename in public metadata.
do $$begin
 if exists(select 1 from public.stewardship_receipt_files where id='f6300000-0000-4000-8000-000000000001' and storage_path like '%redacted-proof.pdf%') then raise exception 'Retained filename in deletion tombstone';end if;
end;$$;
insert into storage.objects(id,bucket_id,name,owner_id,metadata) values('f6400000-0000-4000-8000-000000000001','stewardship-receipts','f6100000-0000-4000-8000-000000000001/f6200000-0000-4000-8000-000000000001/f6300000-0000-4000-8000-000000000001-redacted-proof.pdf','f6100000-0000-4000-8000-000000000001','{"size":512}');
set local role service_role;
insert into proof_jobs values(public.claim_stewardship_proof_deletions(10));
reset role;
do $$begin if not exists(select 1 from proof_jobs where data->0->'objects'->0->>'objectId'='f6400000-0000-4000-8000-000000000001') then raise exception 'Restored proof escaped hashed tombstone';end if;end;$$;
delete from storage.objects where id='f6400000-0000-4000-8000-000000000001';
set local role service_role;
select public.complete_stewardship_proof_deletion((data->0->>'requestId')::uuid,(data->0->>'leaseToken')::uuid) from proof_jobs where data->0->'objects'->0->>'objectId'='f6400000-0000-4000-8000-000000000001';
reset role;
-- Closing an appeal restarts the 30-day period, never uses the original date.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000002',true);
select public.stewardship_retention_command('f6200000-0000-4000-8000-000000000003',3,'close_appeal','Existing decision retained after synthetic appeal review.',null);
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$begin if public.claim_stewardship_proof_deletions(10)<>'[]'::jsonb then raise exception 'Closed appeal proof deleted too early';end if;end;$$;
reset role;
rollback;
select 'stewardship_retention_behavior_ok';
