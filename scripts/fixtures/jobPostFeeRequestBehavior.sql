\set ON_ERROR_STOP on
-- Synthetic disposable database only. Everything below is rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at)
select ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'job-fee-fixture-' || n || '@example.invalid',now(),false,now(),now() from generate_series(1,4) n;
update private.account_activation_state set activation_state='active' where user_id::text like 'f1000000-%';
insert into public.profiles(id,username,display_name,is_admin,commons_onboarding_completed_at)
select ('f1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'job-fee-fixture-' || n, 'Synthetic Job Fee ' || n,n=3,now() from generate_series(1,4) n;
insert into private.economic_operator_assignments(user_id,capability,reason)
select 'f1000000-0000-4000-8000-000000000004',cap,'Synthetic local economic assignment'
from unnest(array['economic_assistance_manage','job_fee_assess']) cap;
insert into public.commune_posts(id,user_id,post_type,title,body,status,visibility,moderation_status,visibility_state)
select ('f2000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'f1000000-0000-4000-8000-000000000001','job_post','Synthetic opportunity ' || n,
 'Public opportunity with no private assistance explanation.','pending_review','public','pending_review','draft'
from generate_series(1,23) n;
insert into public.commune_job_posts(id,post_id,author_user_id,role_title,organization_project,role_type,paid_volunteer_status,location_mode,role_summary)
select ('f3000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 ('f2000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'f1000000-0000-4000-8000-000000000001','Synthetic role','Synthetic organization','other','must_clarify','unspecified','Local test only'
from generate_series(1,23) n;
create temporary table job_fee_preserved as select
 (select jsonb_agg(to_jsonb(f) order by feature_key) from private.economic_feature_flags f) flags,
 (select jsonb_agg(to_jsonb(p) order by id) from public.commune_posts p where id::text like 'f2000000-%') posts,
 (select count(*) from private.economic_orders) orders,
 (select count(*) from private.economic_assistance_grants) grants,
 (select count(*) from private.job_post_economic_conditions) conditions;

do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if has_table_privilege(role_name,'private.job_post_economic_requests','select,insert,update,delete') then raise exception 'direct private request table access'; end if;
 end loop;
 if has_function_privilege('anon','public.current_user_job_post_fee_workspace(boolean,uuid,uuid)','execute')
 or has_function_privilege('service_role','public.submit_job_post_fee_request_command(jsonb)','execute')
 or not has_function_privilege('authenticated','public.submit_job_post_fee_request_command(jsonb)','execute') then raise exception 'incorrect RPC privileges'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.current_user_job_post_fee_workspace(); raise exception 'anonymous workspace accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $workflow$
declare
 j uuid := 'f3000000-0000-4000-8000-000000000001'; cmd jsonb; answer jsonb; view_result jsonb; cursor_id uuid; n integer;
begin
 view_result := public.current_user_job_post_fee_workspace(false,j);
 if view_result->'items'->0->>'classification' <> 'not_assessed' or view_result->'items'->0->>'conditionStatus' <> 'not_assessed'
 or view_result->>'paymentsCollected'<>'false' then raise exception 'unassessed truth changed'; end if;
 view_result := public.current_user_job_post_fee_workspace(); cursor_id := (view_result->>'cursor')::uuid;
 if jsonb_array_length(view_result->'items')<>20 or view_result->>'hasMore'<>'true'
 or jsonb_array_length(public.current_user_job_post_fee_workspace(false,null,cursor_id)->'items')<>3 then raise exception 'pagination lost records'; end if;
 cmd := jsonb_build_object('action','submit','jobPostId',j,'commandId',gen_random_uuid(),'expectedRevision',0,'category','community_benefit','explanation','PRIVATE synthetic hardship explanation');
 answer := public.submit_job_post_fee_request_command(cmd);
 if answer->>'revision'<>'1' or public.submit_job_post_fee_request_command(cmd)<>answer then raise exception 'retry is not idempotent'; end if;
 begin perform public.submit_job_post_fee_request_command(cmd||'{"explanation":"different retry"}'::jsonb); raise exception 'changed retry accepted'; exception when serialization_failure then null; end;
 begin perform public.submit_job_post_fee_request_command(cmd||jsonb_build_object('commandId',gen_random_uuid())); raise exception 'stale revision accepted'; exception when serialization_failure then null; end;
 begin perform public.submit_job_post_fee_request_command(cmd||'{"actorUserId":"f1000000-0000-4000-8000-000000000004"}'::jsonb); raise exception 'actor injection accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_job_post_fee_request_command(cmd||'{"waived":true}'::jsonb); raise exception 'fee decision injection accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_job_post_fee_request_command(cmd||jsonb_build_object('explanation',repeat('x',501),'expectedRevision',1,'commandId',gen_random_uuid())); raise exception 'oversized private input accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.current_user_job_post_fee_workspace(true); raise exception 'poster entered operator queue'; exception when insufficient_privilege then null; end;
 begin perform public.submit_job_post_fee_request_command(jsonb_build_object('action','review','jobPostId',j,'commandId',gen_random_uuid(),'expectedRevision',1,'status','answered','response','Self approval')); raise exception 'poster triage accepted'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000002',true);
 if jsonb_array_length(public.current_user_job_post_fee_workspace()->'items')<>0 then raise exception 'other owner list leak'; end if;
 begin perform public.current_user_job_post_fee_workspace(false,j); raise exception 'other owner direct read'; exception when insufficient_privilege then null; end;
 begin perform public.submit_job_post_fee_request_command(cmd); raise exception 'other owner idempotent replay'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
 begin perform public.current_user_job_post_fee_workspace(true); raise exception 'community admin gained economic privacy'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000004',true);
 view_result := public.current_user_job_post_fee_workspace(true);
 if view_result->>'canReview'<>'true' or view_result->'items'->0->'request'->>'explanation'<>'PRIVATE synthetic hardship explanation' then raise exception 'authorized intake missing'; end if;
 begin perform public.submit_job_post_fee_request_command(jsonb_build_object('action','review','jobPostId',j,'commandId',gen_random_uuid(),'expectedRevision',1,'status','waived','response','Pretend fee waiver')); raise exception 'triage became fee decision'; exception when invalid_parameter_value then null; end;
 perform public.submit_job_post_fee_request_command(jsonb_build_object('action','review','jobPostId',j,'commandId',gen_random_uuid(),'expectedRevision',1,'status','needs_information','response','Please clarify the public benefit without sensitive records.'));
 perform set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
 view_result := public.current_user_job_post_fee_workspace(false,j);
 if view_result->'items'->0->'request'->>'status'<>'needs_information' or view_result->'items'->0->>'conditionStatus'<>'not_assessed' then raise exception 'request reply altered fee state'; end if;
 perform public.submit_job_post_fee_request_command(cmd||jsonb_build_object('commandId',gen_random_uuid(),'expectedRevision',2,'explanation','Updated private explanation'));
 perform public.submit_job_post_fee_request_command(jsonb_build_object('action','withdraw','jobPostId',j,'commandId',gen_random_uuid(),'expectedRevision',3));
 if public.current_user_job_post_fee_workspace(false,j)->'items'->0->'request'->>'status'<>'withdrawn' then raise exception 'withdrawal missing'; end if;
 perform public.submit_job_post_fee_request_command(cmd||jsonb_build_object('commandId',gen_random_uuid(),'expectedRevision',4));
 -- Three successful submissions above; allow seven more, then reject the next.
 for n in 2..8 loop
  perform public.submit_job_post_fee_request_command(cmd||jsonb_build_object('commandId',gen_random_uuid(),'jobPostId',('f3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid));
 end loop;
 begin perform public.submit_job_post_fee_request_command(cmd||jsonb_build_object('commandId',gen_random_uuid(),'jobPostId','f3000000-0000-4000-8000-000000000009')); raise exception 'intake rate bound ignored'; exception when program_limit_exceeded then null; end;
end;
$workflow$;
reset role;
do $$ begin
 if (select flags from job_fee_preserved)<>(select jsonb_agg(to_jsonb(f) order by feature_key) from private.economic_feature_flags f)
 or (select posts from job_fee_preserved)<>(select jsonb_agg(to_jsonb(p) order by id) from public.commune_posts p where id::text like 'f2000000-%')
 or (select orders from job_fee_preserved)<>(select count(*) from private.economic_orders)
 or (select grants from job_fee_preserved)<>(select count(*) from private.economic_assistance_grants)
 or (select conditions from job_fee_preserved)<>(select count(*) from private.job_post_economic_conditions) then raise exception 'request handling mutated economics or publication'; end if;
 if exists(select 1 from private.economic_audit_events where target_id::text like 'f3000000-%' and (metadata::text like '%PRIVATE synthetic%' or reason like '%PRIVATE synthetic%')) then raise exception 'private body duplicated into generic audit'; end if;
 if (select count(*) from private.economic_audit_events where action='job_post_fee_request_review' and target_id='f3000000-0000-4000-8000-000000000001')<>1 then raise exception 'missing or duplicate audited reply'; end if;
end $$;

-- Reuse the governed assessment; authenticated intake does not bypass its
-- existing service-role/capability/grant/feature-gate checks.
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 begin perform public.operator_assess_job_post_fee('f1000000-0000-4000-8000-000000000004','f3000000-0000-4000-8000-000000000001','community_free',null,null,null,gen_random_uuid(),'Synthetic direct attempt'); raise exception 'intake opened economic mutation'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
select public.operator_assess_job_post_fee('f1000000-0000-4000-8000-000000000004','f3000000-0000-4000-8000-000000000001','community_free',null,null,null,gen_random_uuid(),'Synthetic governed free classification');
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare v jsonb; begin
 v:= public.current_user_job_post_fee_workspace(false,'f3000000-0000-4000-8000-000000000001');
 if v->'items'->0->>'classification'<>'community_free' or v->'items'->0->>'conditionStatus'<>'not_required'
 or v->'items'->0->>'contentStatus'<>'pending_review' then raise exception 'existing assessment projection or content separation failed'; end if;
end $$;
reset role;
savepoint synthetic_assistance;
-- This local-only savepoint tests the existing governed grant attachment.
-- It never changes production flags or creates a provider object.
update private.economic_feature_flags set enabled=true where feature_key='economic_assistance_workflow';
insert into private.economic_assistance_programs(id,client_request_id,program_code,assistance_kind,scope,status,public_label,terms_version,starts_at,configured_by,private_reason)
values ('f5000000-0000-4000-8000-000000000001',gen_random_uuid(),'synthetic_job_request_waiver','waiver','job_post_fee','active','Synthetic local waiver','synthetic',now()-interval '1 day','f1000000-0000-4000-8000-000000000004','Synthetic local waiver test');
insert into private.economic_assistance_grants(id,client_request_id,program_id,beneficiary_user_id,scope,resource_id,granted_by,private_reason)
values ('f6000000-0000-4000-8000-000000000001',gen_random_uuid(),'f5000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','job_post_fee','f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000004','Synthetic beneficiary-scoped grant');
select set_config('request.jwt.claim.role','service_role',true);
select public.operator_assess_job_post_fee('f1000000-0000-4000-8000-000000000004','f3000000-0000-4000-8000-000000000001','waived',null,'f6000000-0000-4000-8000-000000000001',null,gen_random_uuid(),'Synthetic existing grant assessment');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare v jsonb; begin
 v:=public.current_user_job_post_fee_workspace(false,'f3000000-0000-4000-8000-000000000001');
 if v->'items'->0->>'classification'<>'waived' or v->'items'->0->>'conditionStatus'<>'waived'
 or v->'items'->0->>'contentStatus'<>'pending_review' then raise exception 'governed waiver did not reach participant independently'; end if;
end $$;
reset role;
-- Inconsistent/revoked assistance must never retain the reassuring free label.
update private.economic_assistance_grants set status='revoked',revoked_at=now(),revoked_by='f1000000-0000-4000-8000-000000000004' where id='f6000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 if public.current_user_job_post_fee_workspace(false,'f3000000-0000-4000-8000-000000000001')->'items'->0->>'conditionStatus'<>'reconciliation_required' then raise exception 'invalid grant still appeared waived'; end if;
end $$;
reset role;
rollback to savepoint synthetic_assistance;
update private.economic_operator_assignments set revoked_at=now(),revoked_by='f1000000-0000-4000-8000-000000000004',revocation_reason='Synthetic revoked authority' where user_id='f1000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 begin perform public.current_user_job_post_fee_workspace(true); raise exception 'revoked operator retained queue'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update auth.users set banned_until=now()+interval '1 hour' where id='f1000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 begin perform public.current_user_job_post_fee_workspace(); raise exception 'banned account retained requests'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
