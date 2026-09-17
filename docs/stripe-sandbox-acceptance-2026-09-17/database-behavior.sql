-- Synthetic rollback-only database assertions, NOT Stripe provider acceptance.
begin;
set local request.jwt.claim.role='service_role';
select set_config('request.headers','{"x-elysia-billing-mode":"test","x-elysia-stripe-account":"acct_1UGdHORrIWWoUVPh"}',true);
create function pg_temp.expect(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'sandbox assertion: %',label;end if;end;$$;
select pg_temp.expect(private.economic_runtime_mode()='test','sandbox mode');
select pg_temp.expect((select account_reference='acct_1UGdHORrIWWoUVPh' from private.economic_provider_readiness),'sandbox account');
select pg_temp.expect(not private.economic_feature_enabled(feature_key),'third-party hard off') from private.economic_feature_flags where feature_key in ('marketplace_paid_offers','marketplace_seller_onboarding','marketplace_payout_preparation','marketplace_payouts','sandbox_credit_purchase');
create temporary table initial_nonfinancial_counts as select (select count(*) from private.sandbox_credit_lots) as compute,(select count(*) from public.user_badges) as badges;
do $$declare prepared jsonb; replay jsonb; event jsonb; result jsonb; oid uuid; code text; txid uuid;
begin
 select price_code into code from private.economic_prices where product_key='support_one_time' and active limit 1;
 prepared:=private.begin_economic_checkout_core(null,'f6170000-0000-4000-8000-000000000001','support_one_time',199,'usd',code,'/support','2026-09-15-first-party');
 oid:=(prepared->>'orderId')::uuid;
 replay:=private.begin_economic_checkout_core(null,'f6170000-0000-4000-8000-000000000001','support_one_time',199,'usd',code,'/support','2026-09-15-first-party');
 perform pg_temp.expect(prepared->>'orderId'=replay->>'orderId' and prepared->>'checkoutExpiresAt'=replay->>'checkoutExpiresAt','stable outbound identity and expiry');
 begin
  update private.economic_provider_readiness set runtime_mode='live';
  raise exception 'environment changed';
 exception when object_not_in_prerequisite_state then null;end;
 event:=jsonb_build_object('providerEventId','evt_synthetic_sandbox_pending','orderId',oid,'providerObjectReference','cs_test_synthetic_sandbox','providerPaymentId','pi_synthetic_sandbox','amountMinor',199,'currency','usd','paymentStatus','unpaid','livemode',false);
 result:=public.process_economic_provider_event('stripe','evt_synthetic_sandbox_pending','checkout.session.completed',now(),repeat('a',64),event);
 perform pg_temp.expect(result->>'status'='processed','unpaid completion retained');
 perform pg_temp.expect(not exists(select 1 from private.economic_payment_transactions where order_id=oid),'unpaid completion never creates payment');
 begin
  perform public.process_economic_provider_event('stripe','evt_synthetic_crossmode','payment_intent.succeeded',now(),repeat('b',64),event||'{"livemode":true}');
  raise exception 'cross-mode accepted';
 exception when insufficient_privilege then null;end;
 event:=event||'{"providerEventId":"evt_synthetic_sandbox_paid","paymentStatus":"paid"}';
 result:=public.process_economic_provider_event('stripe','evt_synthetic_sandbox_paid','payment_intent.succeeded',now(),repeat('c',64),event);
 perform pg_temp.expect(result->>'status'='processed','synthetic payment confirmed');
 select id into txid from private.economic_payment_transactions where order_id=oid and transaction_type='payment';
 perform pg_temp.expect(txid is not null,'payment recorded');
 event:=event||'{"providerReceiptUrl":"https://pay.stripe.com/receipts/synthetic","providerBalanceTransactionId":"txn_synthetic_sandbox","processorFeeMinor":36,"netAmountMinor":163}';
 result:=public.process_economic_provider_event('stripe','evt_synthetic_sandbox_paid','payment_intent.succeeded',now(),repeat('c',64),event);
 result:=public.process_economic_provider_event('stripe','evt_synthetic_sandbox_paid','payment_intent.succeeded',now(),repeat('c',64),event);
 perform pg_temp.expect((select count(*)=1 from private.economic_payment_transactions where order_id=oid and transaction_type='payment'),'durable deduplication');
 perform pg_temp.expect((select count(*)=1 from private.economic_provider_settlements where payment_transaction_id=txid),'append-only receipt enrichment');
 perform pg_temp.expect((select processor_fee_minor=36 and net_amount_minor=163 from private.economic_payment_settlement(txid)),'integer fee/net');
 begin update private.economic_payment_transactions set gross_amount_minor=200 where id=txid;raise exception 'ledger mutable';exception when object_not_in_prerequisite_state then null;end;
 result:=public.process_economic_provider_event('stripe','evt_synthetic_sandbox_old','checkout.session.expired',now()-interval '5 minutes',repeat('d',64),event||'{"providerEventId":"evt_synthetic_sandbox_old","paymentStatus":"unpaid"}');
 perform pg_temp.expect((select status='paid' from private.economic_orders where id=oid),'late expiration cannot erase payment');
 update private.economic_feature_flags set enabled=false where feature_key='support_checkout';
 begin
  perform private.begin_economic_checkout_core(null,'f6170000-0000-4000-8000-000000000002','support_one_time',199,'usd',code,'/support','2026-09-15-first-party');
  raise exception 'kill switch ignored';
 exception when object_not_in_prerequisite_state then null;end;
 perform pg_temp.expect(private.economic_feature_enabled('economic_webhooks'),'acquisition kill preserves reconciliation');
end;$$;
select pg_temp.expect((select compute=(select count(*) from private.sandbox_credit_lots) and badges=(select count(*) from public.user_badges) from initial_nonfinancial_counts),'Support grants no compute or status');
rollback;
select 'PASSED: rollback-only sandbox idempotency, delayed truth, deduplication, out-of-order, integer settlement, isolation, kill switch, no entitlements' as result;
