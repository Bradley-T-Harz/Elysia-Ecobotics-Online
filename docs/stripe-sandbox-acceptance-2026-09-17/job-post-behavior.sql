-- Synthetic rollback-only governed Job Post reduction. No publication or provider calls.
begin;
set local request.jwt.claim.role='service_role';
create function pg_temp.expect(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'sandbox job assertion: %',label;end if;end;$$;
select pg_temp.expect(private.economic_runtime_mode()='test','sandbox only');
insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at) values
 ('f6200000-0000-4000-8000-000000000001','poster@synthetic.invalid',now(),false,now(),now()),
 ('f6200000-0000-4000-8000-000000000002','operator@synthetic.invalid',now(),false,now(),now());
update private.account_activation_state set activation_state='active' where user_id::text like 'f6200000-%';
insert into private.economic_operator_assignments(user_id,capability,reason) values
 ('f6200000-0000-4000-8000-000000000002','job_fee_assess','Synthetic fixture'),
 ('f6200000-0000-4000-8000-000000000002','economic_assistance_manage','Synthetic fixture');
insert into public.commune_posts(id,user_id,post_type,title,body,visibility,status,moderation_status) values
 ('f6300000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','job_post','Synthetic opportunity','Synthetic only','private_draft','draft','not_submitted');
insert into public.commune_job_posts(id,post_id,author_user_id) values
 ('f6300000-0000-4000-8000-000000000002','f6300000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001');
select private.ensure_job_post_economic_condition('f6300000-0000-4000-8000-000000000002');
update private.job_post_economic_conditions set classification='commercial',condition_status='payment_required',price_id=(select id from private.economic_prices where product_key='job_post_fee' and unit_amount_minor=1000 and active limit 1),terms_version='2026-09-15-first-party' where job_post_id='f6300000-0000-4000-8000-000000000002';
select pg_temp.expect((public.operator_reduce_job_post_fee('f6200000-0000-4000-8000-000000000002','f6300000-0000-4000-8000-000000000002','f6400000-0000-4000-8000-000000000001',500,'Synthetic governed fee reduction')->>'idempotentReplay')::boolean=false,'first reduction');
select pg_temp.expect((public.operator_reduce_job_post_fee('f6200000-0000-4000-8000-000000000002','f6300000-0000-4000-8000-000000000002','f6400000-0000-4000-8000-000000000001',500,'Synthetic governed fee reduction')->>'idempotentReplay')::boolean,'reduction retry');
select pg_temp.expect((select p.unit_amount_minor=500 and c.condition_status='payment_required' and c.order_id is null from private.job_post_economic_conditions c join private.economic_prices p on p.id=c.price_id where job_post_id='f6300000-0000-4000-8000-000000000002'),'only owned fee changed');
select pg_temp.expect((select status='draft' from public.commune_posts where id='f6300000-0000-4000-8000-000000000001'),'reduction cannot publish');
update private.economic_feature_flags set enabled=true where feature_key='economic_assistance_workflow';
insert into private.economic_assistance_programs(id,client_request_id,program_code,assistance_kind,scope,status,public_label,terms_version,starts_at,configured_by,private_reason)
values ('f6500000-0000-4000-8000-000000000001',gen_random_uuid(),'synthetic_sandbox_waiver','waiver','job_post_fee','active','Synthetic rollback waiver','synthetic',now()-interval '1 day','f6200000-0000-4000-8000-000000000002','Synthetic rollback waiver test');
insert into private.economic_assistance_grants(id,client_request_id,program_id,beneficiary_user_id,scope,resource_id,granted_by,private_reason)
values ('f6600000-0000-4000-8000-000000000001',gen_random_uuid(),'f6500000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','job_post_fee','f6300000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000002','Synthetic beneficiary-scoped grant');
select public.operator_assess_job_post_fee('f6200000-0000-4000-8000-000000000002','f6300000-0000-4000-8000-000000000002','waived',null,'f6600000-0000-4000-8000-000000000001',null,gen_random_uuid(),'Synthetic governed waiver');
select pg_temp.expect((select classification='waived' and condition_status='waived' and order_id is null from private.job_post_economic_conditions where job_post_id='f6300000-0000-4000-8000-000000000002'),'governed waiver needs no payment');
select pg_temp.expect((select status='draft' from public.commune_posts where id='f6300000-0000-4000-8000-000000000001'),'waiver cannot publish');
rollback;
select 'PASSED: governed $10 Job Post reduction, waiver, idempotency, and no publication' as result;
