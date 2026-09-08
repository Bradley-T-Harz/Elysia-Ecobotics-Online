\set ON_ERROR_STOP on
-- Synthetic, disposable-only fixture; the harness starts a fresh isolated DB.
begin;
insert into auth.users(id, email, email_confirmed_at, created_at, updated_at) values
 ('e8000000-0000-4000-8000-000000000001','readiness-a@example.invalid',now(),now(),now()),
 ('e8000000-0000-4000-8000-000000000002','readiness-b@example.invalid',now(),now(),now());
insert into public.profiles(id,username,display_name,commons_onboarding_completed_at) values
 ('e8000000-0000-4000-8000-000000000001','readiness-a','Synthetic Member A',now()),
 ('e8000000-0000-4000-8000-000000000002','readiness-b','Synthetic Member B',now());
insert into public.stewardship_recognition_requests(id,user_id,organization_name,redaction_confirmed) values
 ('e8100000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000001','Synthetic independent organization',true);

set local role authenticated;
select set_config('request.jwt.claim.sub','e8000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"e8000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into storage.objects(bucket_id,name,owner_id) values
 ('stewardship-receipts','e8000000-0000-4000-8000-000000000001/e8100000-0000-4000-8000-000000000001/e8200000-0000-4000-8000-000000000001-redacted-proof.txt','e8000000-0000-4000-8000-000000000001');
insert into public.stewardship_receipt_files(id,request_id,user_id,storage_path,original_filename,mime_type,size_bytes,sha256_hash) values
 ('e8200000-0000-4000-8000-000000000001','e8100000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000001/e8100000-0000-4000-8000-000000000001/e8200000-0000-4000-8000-000000000001-redacted-proof.txt','redacted-proof.txt','text/plain',64,repeat('a',64));
do $$ begin
 if not public.attach_own_stewardship_receipt('e8100000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000001')
 or not public.attach_own_stewardship_receipt('e8100000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000001') then raise exception 'attachment retry failed'; end if;
 if not exists (select 1 from public.stewardship_recognition_requests where id='e8100000-0000-4000-8000-000000000001' and receipt_file_id='e8200000-0000-4000-8000-000000000001' and status='pending_review') then raise exception 'proof was not linked without a review decision'; end if;
 begin
  insert into public.stewardship_receipt_files(request_id,user_id,storage_path,original_filename,mime_type,size_bytes,sha256_hash) values
  ('e8100000-0000-4000-8000-000000000001',auth.uid(),'another-owner/another-request/secret.html','private-address.html','text/html',0,repeat('b',64));
  raise exception 'unsafe evidence metadata accepted';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','e8000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"e8000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.stewardship_receipt_files where id='e8200000-0000-4000-8000-000000000001') then raise exception 'other member read proof metadata'; end if;
 if exists(select 1 from storage.objects where bucket_id='stewardship-receipts' and name like 'e8000000-0000-4000-8000-000000000001/%') then raise exception 'other member read proof object'; end if;
 begin
  perform public.attach_own_stewardship_receipt('e8100000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000001');
  raise exception 'cross-owner attachment accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin
 if exists(select 1 from private.economic_orders where user_id in ('e8000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000002')) then raise exception 'proof created a payment'; end if;
 if exists(select 1 from private.economic_active_legal_documents where document_version='2026-09-08-readiness')
 or exists(select 1 from private.economic_active_legal_consent_bundles where bundle_version='2026-09-08-readiness') then raise exception 'staged legal text activated consent'; end if;
 if (select count(*) from private.economic_legal_consent_bundle_versions where bundle_version='2026-09-08-readiness' and effective_at='infinity')<>8 then raise exception 'staged bundles missing'; end if;
 if not exists(select 1 from pg_catalog.pg_trigger where tgname='economic_payments_grant_recurring_sandbox_program' and tgenabled='D') then raise exception 'support credit trigger not quarantined'; end if;
 if not exists(select 1 from private.sandbox_credit_program_versions where program_code='hosted_execution_starter_v1' and granted_units=1000 and one_time_per_user and expires_after_days is null and not test_mode and active) then raise exception 'live starter policy changed'; end if;
end $$;
create temporary table readiness_preserved_counts as select
 (select count(*) from private.sandbox_credit_lots) as lots,
 (select count(*) from private.sandbox_credit_recurring_payment_fulfillments) as recurring_grants,
 (select count(*) from public.user_badges) as badges;
insert into private.economic_orders(id,client_request_id,user_id,flow,status,currency,subtotal_minor,total_minor,source_route,consent_version,provider) values
 ('e8300000-0000-4000-8000-000000000001','e8310000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000001','support_recurring','paid','usd',500,500,'/support','2026-07-16','stripe');
insert into private.economic_payment_transactions(id,order_id,provider,provider_transaction_reference,transaction_type,status,gross_amount_minor,currency,occurred_at) values
 ('e8400000-0000-4000-8000-000000000001','e8300000-0000-4000-8000-000000000001','stripe','pi_readinesssynthetic','payment','succeeded',500,'usd',now());
insert into private.economic_refunds(order_id,payment_transaction_id,provider,provider_refund_reference,amount_minor,currency,status) values
 ('e8300000-0000-4000-8000-000000000001','e8400000-0000-4000-8000-000000000001','stripe','re_readinesssynthetic',100,'usd','succeeded');
update private.economic_orders set status='partially_refunded' where id='e8300000-0000-4000-8000-000000000001';
do $$ begin
 if (select lots from readiness_preserved_counts)<>(select count(*) from private.sandbox_credit_lots)
 or (select recurring_grants from readiness_preserved_counts)<>(select count(*) from private.sandbox_credit_recurring_payment_fulfillments)
 or (select badges from readiness_preserved_counts)<>(select count(*) from public.user_badges) then raise exception 'support minted units or recognition'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','e8000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"e8000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ declare v jsonb; begin
 v:=public.current_user_economic_account_summary()->'receipts';
 if jsonb_array_length(v)<>1 or v->0->>'recordVersion'<>'payment-record-v1' or v->0->>'payee'<>'EcoSyneva Commons LLC'
 or v->0->>'orderStatus'<>'partially_refunded' or (v->0->>'refundedAmountMinor')::integer<>100 or (v->0->>'amountMinor')::integer<>500
 or v::text like '%pi_readiness%' or v::text like '%re_readiness%' then raise exception 'receipt state or privacy incorrect'; end if;
end $$;
select set_config('request.jwt.claim.sub','e8000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"e8000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if jsonb_array_length(public.current_user_economic_account_summary()->'receipts')<>0 then raise exception 'cross-owner receipt exposed'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.attach_own_stewardship_receipt(uuid,uuid)','execute')
 or has_function_privilege('service_role','public.attach_own_stewardship_receipt(uuid,uuid)','execute') then raise exception 'unscoped attachment privilege'; end if;
end $$;
rollback;
