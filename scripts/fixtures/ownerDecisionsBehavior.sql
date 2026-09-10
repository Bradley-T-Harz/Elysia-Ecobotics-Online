\set ON_ERROR_STOP on
-- Synthetic accounts only; every behavioral mutation rolls back.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at)
select ('f5100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'owner-decisions-'||n||'@example.invalid',now(),false,now(),now() from generate_series(1,7)n;
update private.account_activation_state set activation_state='active' where user_id::text like 'f5100000-%';
insert into public.profiles(id,username,display_name,is_admin,headline,bio,featured_public_links,commons_onboarding_completed_at)
select ('f5100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'owner-decisions-'||n,'Synthetic Person '||n,n=3,'Commons headline','Commons biography','[{"label":"Commons link","url":"https://example.invalid"}]',now() from generate_series(1,7)n;
insert into public.user_roles(user_id,role) values
 ('f5100000-0000-4000-8000-000000000002','work_with_reviewer'),
 ('f5100000-0000-4000-8000-000000000003','administrator'),
 ('f5100000-0000-4000-8000-000000000004','marketplace_reviewer'),
 ('f5100000-0000-4000-8000-000000000005','stewardship_reviewer');
insert into private.economic_operator_assignments(user_id,capability,reason) values('f5100000-0000-4000-8000-000000000006','economic_audit_view','Synthetic scope test');
create temporary table owner_decision_baseline as select
 (select jsonb_agg(to_jsonb(f) order by feature_key) from private.economic_feature_flags f) flags,
 (select count(*) from private.economic_orders) orders,
 (select count(*) from private.economic_seller_accounts) sellers;
create function pg_temp.owner_expect_denied(command text) returns void language plpgsql as $$ declare affected integer;begin
 begin execute command;get diagnostics affected=row_count;if command ~* '^(update|delete)' and affected=0 then return;end if;
 exception when insufficient_privilege then return;end;
 raise exception 'Unexpected authority: %',command;
end;$$;
set local role anon;
do $$begin
 perform pg_temp.owner_expect_denied($q$select public.submit_own_work_with_request(gen_random_uuid(),'{"message":"forged"}',false)$q$);
 perform pg_temp.owner_expect_denied('select * from public.marketplace_account_profiles');
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','f5100000-0000-4000-8000-000000000001',true);
do $$begin
 perform pg_temp.owner_expect_denied($q$insert into public.work_with_requests(user_id,status) values(auth.uid(),'approved')$q$);
 perform pg_temp.owner_expect_denied($q$insert into public.work_with_requests(user_id,status) values(auth.uid(),'pending_review')$q$);
 begin perform public.submit_own_work_with_request(gen_random_uuid(),'{"message":"test","status":"approved"}',false);raise exception 'forged approval accepted';exception when invalid_parameter_value then null;end;
end;$$;
select public.submit_own_work_with_request('f5200000-0000-4000-8000-000000000001','{"name":"Synthetic applicant","request_type":"Volunteer","message":"Full private application","skills_experience":"Private skills","areas_of_interest":["Testing"]}',true);
-- Retry returns the same source without changing its original contents.
select public.submit_own_work_with_request('f5200000-0000-4000-8000-000000000001','{"message":"Retry must not replace this"}',true);
do $$declare r public.work_with_requests%rowtype;begin
 select * into r from public.work_with_requests where id='f5200000-0000-4000-8000-000000000001';
 if r.status<>'pending_review' or r.message<>'Full private application' or r.attachment_state<>'pending' then raise exception 'Initial state/intent mismatch';end if;
 if (select count(*) from public.review_items where source_id=r.id)<>1 then raise exception 'atomic routing/idempotency failed';end if;
 perform pg_temp.owner_expect_denied(format('select public.work_with_request_command(%L,1,%L,%L)',r.id,'approve','forged'));
 perform pg_temp.owner_expect_denied(format('update public.work_with_requests set status=%L where id=%L','approved',r.id));
 perform pg_temp.owner_expect_denied(format('update public.review_items set status=%L where source_id=%L','approved',r.id));
 perform pg_temp.owner_expect_denied(format('insert into public.review_items(domain,source_table,source_id,submitted_by,status) values(%L,%L,%L,auth.uid(),%L)','work_with','other',gen_random_uuid(),'approved'));
end;$$;
-- The actual Marketplace upsert shape never writes Commons data.
insert into public.marketplace_account_profiles(user_id,username,display_name,bio,interests,website_url,github_url,organization,is_developer,updated_at)
values(auth.uid(),'market-person','Market Name','Marketplace biography','Creator interests','https://example.invalid/market','https://github.com/example','Synthetic',true,now())
on conflict(user_id) do update set username=excluded.username,bio=excluded.bio;
do $$begin
 if (select headline<>'Commons headline' or bio<>'Commons biography' or featured_public_links='[]'::jsonb from public.profiles where id=auth.uid()) then raise exception 'Marketplace erased Commons';end if;
end;$$;
update public.profiles set bio='Updated Commons biography',headline='Updated Commons headline' where id=auth.uid();
do $$begin
 if (select bio<>'Marketplace biography' or interests<>'Creator interests' from public.marketplace_account_profiles where user_id=auth.uid()) then raise exception 'Commons erased Marketplace';end if;
 perform pg_temp.owner_expect_denied($q$update public.marketplace_account_profiles set initialized_from_legacy_at=now() where user_id=auth.uid()$q$);
end;$$;
-- Admin, other reviewer domains, economic authority and membership convey no CV access.
do $$declare n integer;begin
 for n in 3..7 loop
  perform set_config('request.jwt.claim.sub','f5100000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
  if public.current_user_can_review_domain('work_with') or exists(select 1 from public.work_with_requests where id='f5200000-0000-4000-8000-000000000001') then raise exception 'unscoped application read';end if;
  perform pg_temp.owner_expect_denied($q$select public.work_with_request_command('f5200000-0000-4000-8000-000000000001',1,'approve','not authorized')$q$);
  if exists(select 1 from public.marketplace_account_profiles where user_id='f5100000-0000-4000-8000-000000000001') then raise exception 'other private profile read';end if;
 end loop;
end;$$;
select set_config('request.jwt.claim.sub','f5100000-0000-4000-8000-000000000002',true);
do $$begin
 if not public.current_user_can_review_domain('work_with') or public.current_user_can_review_domain('marketplace') or public.current_user_can_review_domain('stewardship') then raise exception 'review domain confusion';end if;
 begin perform public.work_with_request_command('f5200000-0000-4000-8000-000000000001',1,'approve','');raise exception 'pending attachment approved';exception when invalid_parameter_value then null;end;
end;$$;
select public.work_with_request_command('f5200000-0000-4000-8000-000000000001',1,'request_information','Please clarify availability.');
select set_config('request.jwt.claim.sub','f5100000-0000-4000-8000-000000000001',true);
select public.work_with_request_command('f5200000-0000-4000-8000-000000000001',2,'respond','Available next week.');
select public.work_with_request_command('f5200000-0000-4000-8000-000000000001',3,'continue_without_attachment','');
select set_config('request.jwt.claim.sub','f5100000-0000-4000-8000-000000000002',true);
select public.work_with_request_command('f5200000-0000-4000-8000-000000000001',4,'approve','Application accepted for follow-up, no account authority granted.');
select set_config('request.jwt.claim.sub','f5100000-0000-4000-8000-000000000001',true);
do $$begin
 if (select status from public.work_with_requests where id='f5200000-0000-4000-8000-000000000001')<>'approved' then raise exception 'owner outcome missing';end if;
 if not exists(select 1 from public.review_events e join public.review_items i on i.id=e.review_item_id where i.source_id='f5200000-0000-4000-8000-000000000001' and e.note='Available next week.') then raise exception 'follow-up history missing';end if;
 perform pg_temp.owner_expect_denied($q$select public.work_with_request_command('f5200000-0000-4000-8000-000000000001',5,'withdraw','')$q$);
end;$$;
select public.submit_own_work_with_request('f5200000-0000-4000-8000-000000000002','{"message":"Second synthetic application"}',false);
select public.work_with_request_command('f5200000-0000-4000-8000-000000000002',1,'withdraw','Availability changed.');
-- An uploaded CV is linked once and visible only within the scoped application.
select public.submit_own_work_with_request('f5200000-0000-4000-8000-000000000003','{"message":"Synthetic attachment recovery"}',true);
reset role;
insert into storage.objects(id,bucket_id,name,owner_id,metadata) values('f5500000-0000-4000-8000-000000000001','work-with-attachments','f5100000-0000-4000-8000-000000000001/f5200000-0000-4000-8000-000000000003/synthetic.pdf','f5100000-0000-4000-8000-000000000001','{"size":512,"mimetype":"application/pdf"}');
set local role authenticated;
select public.attach_own_work_with_file('f5200000-0000-4000-8000-000000000003','f5100000-0000-4000-8000-000000000001/f5200000-0000-4000-8000-000000000003/synthetic.pdf','Synthetic private CV.pdf');
select public.attach_own_work_with_file('f5200000-0000-4000-8000-000000000003','f5100000-0000-4000-8000-000000000001/f5200000-0000-4000-8000-000000000003/synthetic.pdf','Synthetic private CV.pdf');
do $$declare n integer;begin
 if (select count(*) from public.work_with_request_files where request_id='f5200000-0000-4000-8000-000000000003')<>1 then raise exception 'attachment retry duplicated metadata';end if;
 for n in 1..7 loop
  perform set_config('request.jwt.claim.sub','f5100000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
  if exists(select 1 from storage.objects where id='f5500000-0000-4000-8000-000000000001') is distinct from (n in (1,2)) then raise exception 'CV storage scope leak or missing reviewer access: %',n;end if;
  if exists(select 1 from public.work_with_request_files where request_id='f5200000-0000-4000-8000-000000000003') is distinct from (n in (1,2)) then raise exception 'CV metadata scope mismatch: %',n;end if;
 end loop;
end;$$;
reset role;
do $$begin
 if (select flags from owner_decision_baseline) is distinct from (select jsonb_agg(to_jsonb(f) order by feature_key) from private.economic_feature_flags f) then raise exception 'financial flags changed';end if;
 if (select orders from owner_decision_baseline)<>(select count(*) from private.economic_orders) or (select sellers from owner_decision_baseline)<>(select count(*) from private.economic_seller_accounts) then raise exception 'financial records created';end if;
end;$$;
rollback;
select 'owner_decisions_behavior_ok';
