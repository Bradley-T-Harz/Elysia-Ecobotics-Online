\set ON_ERROR_STOP on
begin;
create function pg_temp.expect(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'first-party assertion: %',label;end if;end;$$;
select pg_temp.expect((select review_status='passed' and third_party_status='hard_off' from private.economic_provider_readiness),'approval independent of activation');
update private.economic_feature_flags set enabled=true where feature_key in ('marketplace_paid_offers','marketplace_seller_onboarding','marketplace_payout_preparation','marketplace_payouts','sandbox_credit_purchase');
select pg_temp.expect(not private.economic_feature_enabled(feature_key),'immutable third-party boundary '||feature_key) from private.economic_feature_flags where feature_key in ('marketplace_paid_offers','marketplace_seller_onboarding','marketplace_payout_preparation','marketplace_payouts','sandbox_credit_purchase');
do $$begin
 begin
  perform public.configure_sandbox_test_credit_program('sandbox_test_forbidden','recurring_support','support_monthly_commons_usd',10,null,false,false,'CONFIGURE UNAPPROVED SANDBOX TEST PROGRAM','Synthetic boundary test');
  raise exception 'unexpected support to compute configuration';
 exception when insufficient_privilege then
  if sqlerrm<>'support_to_compute_hard_off' then raise;end if;
 end;
end;$$;
-- This is a fresh disposable database, with synthetic identifiers only.
update private.economic_provider_readiness set runtime_mode='live',account_reference='acct_synthetic';
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.expect(not private.economic_caller_is_service_role(),'live worker mode/account binding required');
select set_config('request.headers','{"x-elysia-billing-mode":"live","x-elysia-stripe-account":"acct_synthetic"}',true);
select pg_temp.expect(private.economic_caller_is_service_role(),'correct runtime binding');
update private.economic_feature_flags set enabled=true where feature_key in ('support_checkout','recurring_support','customer_portal','economic_webhooks','live_stripe');
select pg_temp.expect(not private.economic_feature_enabled('support_checkout'),'missing qualification refuses live acquisition');
update private.economic_provider_readiness set webhook_verified_at=now(),event_coverage_verified_at=now(),last_preflight_at=now(),receipt_configuration_verified_at=now(),portal_configuration_verified_at=now();
update private.economic_feature_flags set sandbox_qualified_at=now(),sandbox_evidence_ref='synthetic://disposable-only',tax_decision_ref='synthetic://not-a-tax-conclusion',legal_qualified_at=now(),rollout_authorized_at=now() where feature_key in ('support_checkout','recurring_support');
select pg_temp.expect(private.economic_feature_enabled('support_checkout'),'qualified gate opens');
update private.economic_feature_flags set enabled=false where feature_key='support_checkout';
select pg_temp.expect(private.economic_feature_enabled('recurring_support') and private.economic_feature_enabled('customer_portal') and private.economic_feature_enabled('economic_webhooks'),'independent lane and management switches');
update private.economic_feature_flags set enabled=true where feature_key='support_checkout';
do $$declare prepared jsonb; replay jsonb; event jsonb; result jsonb; oid uuid; code text; txid uuid; before_rows bigint;
begin
 select price_code into code from private.economic_prices where product_key='support_one_time' and active limit 1;
 prepared:=private.begin_economic_checkout_core(null,'f6100000-0000-4000-8000-000000000001','support_one_time',199,'usd',code,'/support','2026-09-15-first-party');
 oid:=(prepared->>'orderId')::uuid;
 replay:=private.begin_economic_checkout_core(null,'f6100000-0000-4000-8000-000000000001','support_one_time',199,'usd',code,'/support','2026-09-15-first-party');
 perform pg_temp.expect(prepared->>'orderId'=replay->>'orderId' and prepared->>'checkoutExpiresAt'=replay->>'checkoutExpiresAt','stable checkout request and expiry');
 begin
  update private.economic_provider_readiness set runtime_mode='test';
  raise exception 'environment changed with financial records';
 exception when object_not_in_prerequisite_state then null;end;
 event:=jsonb_build_object('providerEventId','evt_firstparty_pending','orderId',oid,'providerObjectReference','cs_live_synthetic','providerPaymentId','pi_synthetic','amountMinor',199,'currency','usd','paymentStatus','unpaid','livemode',true);
 result:=public.process_economic_provider_event('stripe','evt_firstparty_pending','checkout.session.completed',now(),repeat('a',64),event);
 perform pg_temp.expect(result->>'status'='processed','delayed method completion retained');
 perform pg_temp.expect(not exists(select 1 from private.economic_payment_transactions where order_id=oid),'unpaid checkout is not payment');
 begin
  perform public.process_economic_provider_event('stripe','evt_crossmode','payment_intent.succeeded',now(),repeat('b',64),event||'{"livemode":false}');
  raise exception 'cross-mode event accepted';
 exception when insufficient_privilege then null;end;
 event:=event||'{"providerEventId":"evt_firstparty_paid","paymentStatus":"paid"}';
 result:=public.process_economic_provider_event('stripe','evt_firstparty_paid','payment_intent.succeeded',now(),repeat('c',64),event);
 perform pg_temp.expect(result->>'status'='processed','provider payment confirmed');
 select id into txid from private.economic_payment_transactions where order_id=oid and transaction_type='payment';
 perform pg_temp.expect(txid is not null,'one payment recorded');
 update private.economic_webhook_events set received_at=now()-interval '2 minutes' where provider_event_id='evt_firstparty_paid';
 perform pg_temp.expect(jsonb_array_length(public.claim_economic_settlement_reconciliation(5))>=1,'late settlement reconciliation is claimed');
 event:=event||'{"providerReceiptUrl":"https://pay.stripe.com/receipts/synthetic","providerBalanceTransactionId":"txn_synthetic","processorFeeMinor":36,"netAmountMinor":163}';
 result:=public.process_economic_provider_event('stripe','evt_firstparty_paid','payment_intent.succeeded',now(),repeat('c',64),event);
 result:=public.process_economic_provider_event('stripe','evt_firstparty_paid','payment_intent.succeeded',now(),repeat('c',64),event);
 perform pg_temp.expect((select count(*)=1 from private.economic_payment_transactions where order_id=oid and transaction_type='payment'),'durable payment deduplication');
 perform pg_temp.expect((select count(*)=1 from private.economic_provider_settlements where payment_transaction_id=txid),'receipt enrichment and deduplication');
 perform pg_temp.expect((select processor_fee_minor=36 and net_amount_minor=163 from private.economic_payment_settlement(txid)),'provider-confirmed fee/net');
 perform pg_temp.expect((select processor_fee_minor is null from private.economic_payment_transactions where id=txid),'original ledger remains unchanged');
 begin update private.economic_payment_transactions set gross_amount_minor=200 where id=txid;raise exception 'ledger mutation allowed';exception when object_not_in_prerequisite_state then null;end;
 begin update private.economic_provider_settlements set processor_fee_minor=37 where payment_transaction_id=txid;raise exception 'evidence mutation allowed';exception when object_not_in_prerequisite_state then null;end;
 event:=event||'{"processorFeeMinor":37,"netAmountMinor":162}';
 begin
 perform public.process_economic_provider_event('stripe','evt_firstparty_paid','payment_intent.succeeded',now(),repeat('c',64),event);
 raise exception 'conflicting settlement accepted';
 exception when invalid_parameter_value then null;end;
end;$$;
select pg_temp.expect(not exists(select 1 from private.economic_support_recognition_preferences),'Support does not create recognition');

insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at) values
 ('f6200000-0000-4000-8000-000000000001','poster@synthetic.invalid',now(),false,now(),now()),
 ('f6200000-0000-4000-8000-000000000002','operator@synthetic.invalid',now(),false,now(),now());
update private.account_activation_state set activation_state='active' where user_id::text like 'f6200000-%';
-- Free compute grants require service authority, never Stripe mode/account headers.
select set_config('request.headers','{}',true);
select public.grant_sandbox_credit_units('f6200000-0000-4000-8000-000000000001',1,'starter','synthetic-free-allowance',null,'synthetic-free-allowance-20260915','Synthetic free allowance check');
select pg_temp.expect((select sum(granted_units)=1 from private.sandbox_credit_lots where user_id='f6200000-0000-4000-8000-000000000001'),'free allowance remains independent of Stripe');
do $$declare source text;begin
 foreach source in array array['purchased','recurring_support'] loop
  begin
   perform public.grant_sandbox_credit_units('f6200000-0000-4000-8000-000000000001',1,source,'synthetic-forbidden',null,'synthetic-forbidden-'||source,'Synthetic hard boundary');
   raise exception 'monetary compute grant unexpectedly allowed';
  exception when insufficient_privilege then
   if sqlerrm<>'paid_compute_and_support_to_compute_hard_off' then raise;end if;
  end;
  begin
   insert into private.sandbox_credit_lots(user_id,source_category,granted_units,idempotency_key,private_reason)
   values('f6200000-0000-4000-8000-000000000001',source,1,'direct-forbidden-'||source,'Synthetic table boundary');
   raise exception 'direct monetary credit insert unexpectedly allowed';
  exception when insufficient_privilege then
   if sqlerrm<>'paid_compute_and_support_to_compute_hard_off' then raise;end if;
  end;
 end loop;
end;$$;
select set_config('request.headers','{"x-elysia-billing-mode":"live","x-elysia-stripe-account":"acct_synthetic"}',true);
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
rollback;
select 'first_party_activation_behavior_ok';
