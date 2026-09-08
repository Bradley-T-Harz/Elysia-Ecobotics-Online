\set ON_ERROR_STOP on
-- Runs only in the harness's disposable, networkless synthetic database.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,created_at,updated_at) values
 ('e9000000-0000-4000-8000-000000000001','preparation-creator@example.invalid',now(),false,now(),now()),
 ('e9000000-0000-4000-8000-000000000002','preparation-operator@example.invalid',now(),false,now(),now()),
 ('e9000000-0000-4000-8000-000000000003','preparation-outsider@example.invalid',now(),false,now(),now());
insert into public.profiles(id,username,display_name,commons_onboarding_completed_at) values
 ('e9000000-0000-4000-8000-000000000001','preparation-creator','Synthetic creator',now()),
 ('e9000000-0000-4000-8000-000000000002','preparation-operator','Synthetic operator',now()),
 ('e9000000-0000-4000-8000-000000000003','preparation-outsider','Synthetic outsider',now());
insert into public.developer_profiles(user_id,display_name,status) values
 ('e9000000-0000-4000-8000-000000000001','Synthetic preparation creator','active'),
 ('e9000000-0000-4000-8000-000000000003','Synthetic other creator','active');
insert into public.publishers(id,owner_id,name,slug,verified) values
 ('e9100000-0000-4000-8000-000000000001','e9000000-0000-4000-8000-000000000001','Synthetic prepared publisher','synthetic-prepared-publisher',true),
 ('e9100000-0000-4000-8000-000000000003','e9000000-0000-4000-8000-000000000003','Synthetic other publisher','synthetic-other-prepared-publisher',true);
insert into private.economic_operator_assignments(user_id,capability,reason)
 select 'e9000000-0000-4000-8000-000000000002',cap,'Synthetic narrow operator assignment' from unnest(array['marketplace_payout_manage','economic_assistance_manage','economic_refunds_manage','economic_audit_view','economic_feature_flags_manage','economic_payments_view']) cap;
insert into public.marketplace_listings(id,addon_id,developer_profile_id,name,slug,current_version,listing_status,published_at)
 select 'e9200000-0000-4000-8000-000000000001','synthetic-preparation-addon',id,'Synthetic preparation add-on','synthetic-preparation-addon','1.0.0','published',now() from public.developer_profiles where user_id='e9000000-0000-4000-8000-000000000001';
insert into public.marketplace_addon_versions(id,listing_id,version,review_status,published_at) values
 ('e9300000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','1.0.0','approved',now()),
 ('e9300000-0000-4000-8000-000000000002','e9200000-0000-4000-8000-000000000001','1.1.0','approved',now());
create temporary table preparation_preserved as select
 (select jsonb_agg(to_jsonb(f) order by feature_key) from private.economic_feature_flags f) flags,
 (select count(*) from private.economic_seller_onboarding_requests) onboardings,
 (select count(*) from private.marketplace_payout_result_events) provider_results,
 (select count(*) from public.user_badges) badges,
 (select count(*) from private.sandbox_credit_lots) credits;

do $$ begin
 if exists(select 1 from private.economic_preparation_settings where enabled or sellers_enabled or settlements_enabled or waivers_enabled or support_enabled or provider_execution_enabled) then raise exception 'preparation shipped enabled'; end if;
 if has_function_privilege('anon','public.command_economic_preparation(uuid,jsonb)','execute') or has_function_privilege('authenticated','public.command_economic_preparation(uuid,jsonb)','execute') or has_function_privilege('authenticated','public.get_economic_preparation(uuid,text)','execute') then raise exception 'preparation RPC exposed directly'; end if;
 if has_table_privilege('service_role','private.economic_owned_fee_waivers','insert') then raise exception 'direct table mutation grant'; end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 begin perform public.get_economic_preparation('e9000000-0000-4000-8000-000000000001','seller'); raise exception 'disabled read accepted'; exception when object_not_in_prerequisite_state then null; end;
end $$;
update private.economic_preparation_settings set enabled=true,sellers_enabled=true,settlements_enabled=true,waivers_enabled=true,support_enabled=true;

do $workflow$
declare
 creator uuid:='e9000000-0000-4000-8000-000000000001'; operator_id uuid:='e9000000-0000-4000-8000-000000000002'; outsider uuid:='e9000000-0000-4000-8000-000000000003';
 command jsonb; result jsonb; view_result jsonb; seller_id uuid; waiver_id uuid; case_id uuid; before_count integer;
begin
 perform set_config('request.jwt.claim.role','service_role',true);
 command:=jsonb_build_object('action','seller_save','requestId',gen_random_uuid(),'expectedRevision',0,'displayName','Prepared creator','supportUrl','https://example.invalid/support','intent','both');
 result:=public.command_economic_preparation(creator,command);seller_id:=(result->>'targetId')::uuid;
 if result->>'revision'<>'1' or result->>'providerActionsAvailable'<>'false' then raise exception 'seller preparation result invalid'; end if;
 if public.command_economic_preparation(creator,command)->>'idempotentReplay'<>'true' then raise exception 'retry duplicated seller command'; end if;
 begin perform public.command_economic_preparation(outsider,command);raise exception 'cross-owner idempotency accepted';exception when unique_violation then null;end;
 begin perform public.command_economic_preparation(creator,command||'{"displayName":"Different command"}'::jsonb);raise exception 'conflicting retry accepted';exception when unique_violation then null;end;
 begin perform public.command_economic_preparation(creator,command||jsonb_build_object('requestId',gen_random_uuid()));raise exception 'stale revision accepted';exception when serialization_failure then null;end;
 begin perform public.command_economic_preparation(creator,command||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',1,'bankAccount','forbidden'));raise exception 'extra payment field accepted';exception when invalid_parameter_value then null;end;
 perform public.command_economic_preparation(creator,jsonb_build_object('action','seller_terms','requestId',gen_random_uuid(),'expectedRevision',1,'documentVersion','2026-09-08-readiness','accept',true));
 begin perform public.command_economic_preparation(creator,jsonb_build_object('action','seller_link','requestId',gen_random_uuid(),'expectedRevision',2,'publisherId','e9100000-0000-4000-8000-000000000003','reason','Synthetic owner boundary check'));raise exception 'foreign publisher linked';exception when insufficient_privilege then null;end;
 perform public.command_economic_preparation(creator,jsonb_build_object('action','seller_link','requestId',gen_random_uuid(),'expectedRevision',2,'publisherId','e9100000-0000-4000-8000-000000000001','reason','Synthetic verified publisher linkage'));
 perform public.command_economic_preparation(creator,jsonb_build_object('action','seller_submit','requestId',gen_random_uuid(),'expectedRevision',3));
 begin perform public.command_economic_preparation(outsider,jsonb_build_object('action','seller_review','requestId',gen_random_uuid(),'expectedRevision',4,'sellerId',seller_id,'decision','approved','reason','Synthetic unauthorized review'));raise exception 'unauthorized review accepted';exception when insufficient_privilege then null;end;
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','seller_review','requestId',gen_random_uuid(),'expectedRevision',4,'sellerId',seller_id,'decision','approved','reason','Synthetic internal requirements checked'));
 perform public.command_economic_preparation(creator,jsonb_build_object('action','offer_save','requestId',gen_random_uuid(),'expectedRevision',0,'offerId','e9400000-0000-4000-8000-000000000001','addonVersionId','e9300000-0000-4000-8000-000000000001','kind','free','amountMinor',0,'currency','usd','licenseKey','MIT','licenseVersion','1','feeProposalId',null));
 perform public.command_economic_preparation(creator,jsonb_build_object('action','offer_save','requestId',gen_random_uuid(),'expectedRevision',0,'offerId','e9400000-0000-4000-8000-000000000002','addonVersionId','e9300000-0000-4000-8000-000000000002','kind','commercial','amountMinor',1000,'currency','usd','licenseKey','creator-license','licenseVersion','1','feeProposalId','e9090800-0000-4000-8000-000000000005'));
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','offer_review','requestId',gen_random_uuid(),'expectedRevision',1,'offerId','e9400000-0000-4000-8000-000000000002','decision','prepared','reason','Synthetic offering preparation reviewed'));
 view_result:=public.get_economic_preparation(creator,'seller');
 if jsonb_array_length(view_result->'sellers')<>1 or jsonb_array_length(view_result->'offers')<>2 or view_result->'sellers'->0->>'status'<>'approved' or not(view_result->'sellers'->0->'blockers' ? 'provider_onboarding_disabled') then raise exception 'seller readiness incomplete'; end if;
 if jsonb_array_length(public.get_economic_preparation(outsider,'seller')->'sellers')<>0 or jsonb_array_length(public.get_economic_preparation(outsider,'seller')->'offers')<>0 then raise exception 'cross-owner preparation exposed'; end if;
 begin perform public.get_economic_preparation(outsider,'operator');raise exception 'operator view allowed ordinary user';exception when insufficient_privilege then null;end;

 -- A later loss of identity/version eligibility invalidates read-side readiness
 -- and is checked again when an operator attempts to prepare an offer.
 update public.marketplace_addon_versions set revoked_at=now() where id='e9300000-0000-4000-8000-000000000002';
 if not exists(select 1 from jsonb_array_elements(public.get_economic_preparation(creator,'seller')->'offers') item where item->'blockers' ? 'reviewed_version_no_longer_eligible') then raise exception 'revoked version appeared ready'; end if;
 begin perform public.command_economic_preparation(operator_id,jsonb_build_object('action','offer_review','requestId',gen_random_uuid(),'expectedRevision',2,'offerId','e9400000-0000-4000-8000-000000000002','decision','prepared','reason','Synthetic revoked version denied'));raise exception 'revoked version approved';exception when object_not_in_prerequisite_state then null;end;
 update public.marketplace_addon_versions set revoked_at=null where id='e9300000-0000-4000-8000-000000000002';
 update public.publishers set verified=false where id='e9100000-0000-4000-8000-000000000001';
 begin perform public.command_economic_preparation(operator_id,jsonb_build_object('action','offer_review','requestId',gen_random_uuid(),'expectedRevision',2,'offerId','e9400000-0000-4000-8000-000000000002','decision','prepared','reason','Synthetic revoked publisher denied'));raise exception 'revoked publisher approved';exception when object_not_in_prerequisite_state then null;end;
 update public.publishers set verified=true where id='e9100000-0000-4000-8000-000000000001';
 insert into private.economic_operator_assignments(user_id,capability,reason) values(creator,'marketplace_payout_manage','Synthetic self-review denial test');
 begin perform public.command_economic_preparation(creator,jsonb_build_object('action','offer_review','requestId',gen_random_uuid(),'expectedRevision',2,'offerId','e9400000-0000-4000-8000-000000000002','decision','prepared','reason','Synthetic creator self-review denied'));raise exception 'creator self-review accepted';exception when insufficient_privilege then null;end;
 update private.economic_operator_assignments set revoked_at=now() where user_id=creator and capability='marketplace_payout_manage';
 update private.economic_preparation_settings set sellers_enabled=false;
 begin perform public.command_economic_preparation(creator,jsonb_build_object('action','seller_withdraw','requestId',gen_random_uuid(),'expectedRevision',5,'reason','Synthetic disabled-lane denial'));raise exception 'disabled seller mutation accepted';exception when object_not_in_prerequisite_state then null;end;
 update private.economic_preparation_settings set sellers_enabled=true;

 insert into private.economic_orders(id,client_request_id,user_id,flow,currency,subtotal_minor,total_minor,source_route,consent_version) values
 ('e9500000-0000-4000-8000-000000000001',gen_random_uuid(),creator,'job_post_fee','usd',1000,1000,'/commune/rooms/job-post','2026-07-16'),
 ('e9500000-0000-4000-8000-000000000002',gen_random_uuid(),creator,'organization_service','usd',2000,2000,'/support','2026-07-16'),
 ('e9500000-0000-4000-8000-000000000003',gen_random_uuid(),creator,'support_one_time','usd',1000,1000,'/support','2026-07-16');
 command:=jsonb_build_object('action','waiver_approve','requestId',gen_random_uuid(),'orderId','e9500000-0000-4000-8000-000000000001','component','ecosyneva_job_fee','amountMinor',400,'reason','Synthetic access exception for owned fee','confirmation','WAIVE ECOSYNEVA OWNED AMOUNT ONLY');
 result:=public.command_economic_preparation(operator_id,command);waiver_id:=(result->>'targetId')::uuid;
 if public.command_economic_preparation(operator_id,command)->>'idempotentReplay'<>'true' then raise exception 'waiver retry duplicated'; end if;
 begin perform public.command_economic_preparation(operator_id,command||jsonb_build_object('requestId',gen_random_uuid(),'amountMinor',700));raise exception 'over-waiver accepted';exception when invalid_parameter_value then null;end;
 begin perform public.command_economic_preparation(operator_id,command||jsonb_build_object('requestId',gen_random_uuid(),'component','creator_share'));raise exception 'creator waiver accepted';exception when insufficient_privilege then null;end;
 begin perform public.command_economic_preparation(operator_id,command||jsonb_build_object('requestId',gen_random_uuid(),'orderId','e9500000-0000-4000-8000-000000000003'));raise exception 'support treated as fee';exception when insufficient_privilege then null;end;
 begin update private.economic_orders set provider_session_reference='cs_test_syntheticblocked' where id='e9500000-0000-4000-8000-000000000001';raise exception 'old checkout ignored waiver';exception when object_not_in_prerequisite_state then null;end;
 if (select total_minor from private.economic_orders where id='e9500000-0000-4000-8000-000000000001')<>1000 then raise exception 'waiver silently edited original price'; end if;
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','waiver_revoke','requestId',gen_random_uuid(),'expectedRevision',1,'waiverId',waiver_id,'reason','Synthetic preparation waiver revoked'));

 insert into private.economic_payment_transactions(id,order_id,provider,provider_transaction_reference,transaction_type,status,gross_amount_minor,currency,occurred_at)
 values('e9600000-0000-4000-8000-000000000003','e9500000-0000-4000-8000-000000000003','stripe','pi_preprovidersynthetic','payment','succeeded',1000,'usd',now());
 update private.economic_orders set status='paid' where id='e9500000-0000-4000-8000-000000000003';
 command:=jsonb_build_object('action','support_request','requestId',gen_random_uuid(),'kind','support_refund','targetId','e9500000-0000-4000-8000-000000000003','amountMinor',100,'reason','Synthetic support refund request');
 begin perform public.command_economic_preparation(outsider,command);raise exception 'cross-user refund requested';exception when insufficient_privilege then null;end;
 result:=public.command_economic_preparation(creator,command);case_id:=(result->>'targetId')::uuid;
 begin perform public.command_economic_preparation(operator_id,jsonb_build_object('action','support_review','requestId',gen_random_uuid(),'expectedRevision',1,'caseId',case_id,'decision','completed','reason','Synthetic forbidden provider completion'));raise exception 'provider completion simulated';exception when object_not_in_prerequisite_state then null;end;
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','support_review','requestId',gen_random_uuid(),'expectedRevision',1,'caseId',case_id,'decision','reviewing','reason','Synthetic support request under review'));
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','support_review','requestId',gen_random_uuid(),'expectedRevision',2,'caseId',case_id,'decision','awaiting_provider','reason','Synthetic review complete provider remains off'));
 if exists(select 1 from private.economic_refunds where order_id='e9500000-0000-4000-8000-000000000003') then raise exception 'request fabricated provider refund'; end if;
 if public.get_economic_preparation(creator,'account')->'records'->0->>'deliveryStatus'<>'not_established' then raise exception 'provider receipt delivery inferred'; end if;
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','policy_propose','requestId',gen_random_uuid(),'kind','marketplace_fee_bps','value',500,'reason','Synthetic fee proposal remains owner pending'));
 if exists(select 1 from private.economic_preparation_proposals where adopted) then raise exception 'proposal adopted implicitly'; end if;
 begin update private.economic_preparation_events set reason='tampered';raise exception 'audit edited';exception when object_not_in_prerequisite_state then null;end;
 if not exists(select 1 from private.economic_preparation_events where action='waiver_approve' and actor_user_id=operator_id and reason is not null) then raise exception 'waiver audit missing'; end if;
end;
$workflow$;
do $settlement$
<<settlement>>
declare
 creator uuid:='e9000000-0000-4000-8000-000000000001'; operator_id uuid:='e9000000-0000-4000-8000-000000000002'; buyer uuid:='e9000000-0000-4000-8000-000000000003';
 seller_id uuid; offer_id uuid:=gen_random_uuid(); price_id uuid:=gen_random_uuid(); terms_id uuid:=gen_random_uuid(); order_id uuid:='e9700000-0000-4000-8000-000000000001';
 payment_id uuid:=gen_random_uuid(); webhook_id uuid:=gen_random_uuid(); license_id uuid:=gen_random_uuid(); refund_id uuid:=gen_random_uuid(); dispute_id uuid:=gen_random_uuid(); waiver_id uuid;
 command jsonb; result jsonb; snapshot jsonb; old_hash text;
begin
 perform set_config('request.jwt.claim.role','service_role',true);
 select id into seller_id from private.economic_seller_accounts where user_id=creator;
 insert into private.economic_prices(id,price_code,product_key,currency,unit_amount_minor) values(price_id,'marketplace_test_preprovider_fixture_usd','marketplace_purchase','usd',1000);
 insert into private.marketplace_commercial_term_versions(id,client_request_id,terms_code,commission_bps,seller_agreement_version,buyer_terms_version,configured_by,private_reason)
 values(terms_id,gen_random_uuid(),'marketplace_test_preprovider_fixture',500,'2026-07-16','2026-07-16',operator_id,'Synthetic test contract fee snapshot only');
 insert into private.marketplace_commercial_offers(id,client_request_id,seller_account_id,publisher_id,listing_id,addon_version_id,offer_kind,price_id,commercial_terms_version_id,license_key,license_version,buyer_terms_version,seller_agreement_version,commission_bps)
 values(offer_id,gen_random_uuid(),seller_id,'e9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000002','paid',price_id,terms_id,'synthetic-license','1','2026-07-16','2026-07-16',500);
 insert into private.economic_orders(id,client_request_id,user_id,flow,currency,subtotal_minor,total_minor,source_route,consent_version) values(order_id,gen_random_uuid(),buyer,'marketplace_purchase','usd',1000,1000,'/marketplace','2026-07-16');
 insert into private.marketplace_purchase_contracts(order_id,offer_id,buyer_user_id,seller_account_id,listing_id,addon_version_id,license_key_snapshot,license_version_snapshot,commission_bps_snapshot,gross_amount_minor,currency)
 values(order_id,offer_id,buyer,seller_id,'e9200000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000002','synthetic-license','1',500,1000,'usd');
 command:=jsonb_build_object('action','waiver_approve','requestId',gen_random_uuid(),'orderId',order_id,'component','ecosyneva_platform_fee','amountMinor',50,'reason','Synthetic waiver of platform portion only','confirmation','WAIVE ECOSYNEVA OWNED AMOUNT ONLY');
 result:=public.command_economic_preparation(operator_id,command);waiver_id:=(result->>'targetId')::uuid;
 if (select original_owned_minor from private.economic_owned_fee_waivers where id=waiver_id)<>50 or (select gross_amount_minor from private.marketplace_purchase_contracts c where c.order_id=settlement.order_id)<>1000 then raise exception 'platform waiver reduced creator price'; end if;
 begin perform public.command_economic_preparation(operator_id,command||jsonb_build_object('requestId',gen_random_uuid(),'amountMinor',1));raise exception 'cumulative platform waiver exceeded ownership';exception when invalid_parameter_value then null;end;
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','waiver_revoke','requestId',gen_random_uuid(),'expectedRevision',1,'waiverId',waiver_id,'reason','Synthetic reset before reconciliation fixture'));
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','settlement_refresh','requestId',gen_random_uuid(),'expectedRevision',0,'orderId',order_id,'reason','Synthetic initial unpaid reconciliation'));
 snapshot:=private.preparation_settlement_snapshot(order_id);
 if snapshot->>'status'<>'awaiting_payment' then raise exception 'unpaid order treated as paid'; end if;
 -- Synthetic internal payment/ledger evidence; no provider call or payout fact.
 insert into private.economic_webhook_events(id,provider,provider_event_id,event_type,event_created_at,payload_sha256,normalized_event)
 values(webhook_id,'stripe','evt_preprovidersynthetic','payment_intent.succeeded',now(),repeat('e',64),'{}');
 insert into private.economic_payment_transactions(id,order_id,webhook_event_id,provider,provider_transaction_reference,transaction_type,status,gross_amount_minor,processor_fee_minor,net_amount_minor,currency,occurred_at)
 values(payment_id,order_id,webhook_id,'stripe','pi_preprovidersettlementfixture','payment','succeeded',1000,59,941,'usd',now());
 insert into private.marketplace_licenses(id,buyer_user_id,offer_id,order_id,listing_id,addon_version_id,license_key,license_version,acquisition_kind)
 values(license_id,buyer,offer_id,order_id,'e9200000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000002','synthetic-license','1','paid_order');
 insert into private.marketplace_order_financial_state(order_id,license_id,sale_recorded) values(order_id,license_id,true);
 insert into private.marketplace_commission_events(order_id,license_id,seller_account_id,event_type,gross_delta_minor,commission_delta_minor,payable_delta_minor,currency,idempotency_key)
 values(order_id,license_id,seller_id,'sale',1000,50,950,'usd','pre-provider-synthetic-sale');
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','settlement_refresh','requestId',gen_random_uuid(),'expectedRevision',1,'orderId',order_id,'reason','Synthetic payment and ledger matched'));
 snapshot:=private.preparation_settlement_snapshot(order_id);old_hash:=snapshot->>'evidenceSha256';
 if snapshot->>'status'<>'review_required' or snapshot->>'creatorPayableMinor'<>'950' or snapshot->>'platformFeeMinor'<>'50' or snapshot->>'processorFeeMinor'<>'59' then raise exception 'scoped settlement math mismatch'; end if;
 command:=jsonb_build_object('action','settlement_review','requestId',gen_random_uuid(),'expectedRevision',2,'orderId',order_id,'decision','prepare_handoff','evidenceSha256',old_hash,'reason','Synthetic blocked handoff prepared only');
 perform public.command_economic_preparation(operator_id,command);
 if public.command_economic_preparation(operator_id,command)->>'idempotentReplay'<>'true' then raise exception 'handoff retry duplicated'; end if;
 if (select provider_payout_status from private.economic_settlement_preparations p where p.order_id=settlement.order_id)<>'not_verified' then raise exception 'payout completion inferred'; end if;
 insert into private.economic_refunds(id,order_id,payment_transaction_id,provider,provider_refund_reference,amount_minor,currency,status) values(refund_id,order_id,payment_id,'stripe','re_preprovidersynthetic',100,'usd','pending');
 snapshot:=public.get_economic_preparation(operator_id,'operator')->'settlements'->0;
 if snapshot->>'status'<>'reconciliation_required' or not(snapshot->'blockers' ? 'snapshot_stale_refresh_required') then raise exception 'stale handoff still appeared current'; end if;
 begin perform public.command_economic_preparation(operator_id,command||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',3));raise exception 'stale evidence reviewed';exception when serialization_failure then null;end;
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','settlement_refresh','requestId',gen_random_uuid(),'expectedRevision',3,'orderId',order_id,'reason','Synthetic pending refund blocks handoff'));
 snapshot:=private.preparation_settlement_snapshot(order_id);
 if snapshot->>'status'<>'refund_hold' then raise exception 'pending refund not held'; end if;
 begin perform public.command_economic_preparation(operator_id,command||jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',4,'evidenceSha256',snapshot->>'evidenceSha256'));raise exception 'refund hold bypassed';exception when object_not_in_prerequisite_state then null;end;
 update private.economic_refunds set status='succeeded' where id=refund_id;
 snapshot:=private.preparation_settlement_snapshot(order_id);
 if snapshot->>'refundedMinor'<>'100' or snapshot->>'creatorPayableMinor'<>'855' then raise exception 'refund effect not reconciled'; end if;
 insert into private.economic_disputes(id,order_id,payment_transaction_id,provider,provider_dispute_reference,amount_minor,currency,status)
 values(dispute_id,order_id,payment_id,'stripe','dp_preprovidersynthetic',200,'usd','needs_response');
 if private.preparation_settlement_snapshot(order_id)->>'status'<>'dispute_hold' then raise exception 'open dispute not held'; end if;
 update private.economic_disputes set status='won' where id=dispute_id;
 if private.preparation_settlement_snapshot(order_id)->>'disputeExposureMinor'<>'0' then raise exception 'won dispute not released'; end if;
 begin update private.economic_settlement_preparations set provider_payout_status='paid';raise exception 'manual payout completion accepted';exception when check_violation then null;end;
end;
$settlement$;
do $support$
declare
 creator uuid:='e9000000-0000-4000-8000-000000000001'; outsider uuid:='e9000000-0000-4000-8000-000000000003'; operator_id uuid:='e9000000-0000-4000-8000-000000000002';
 order_id uuid:=gen_random_uuid(); customer_id uuid:=gen_random_uuid(); price_id uuid:=gen_random_uuid(); subscription_id uuid:=gen_random_uuid(); command jsonb; result jsonb; case_id uuid;
begin
 perform set_config('request.jwt.claim.role','service_role',true);
 insert into private.economic_orders(id,client_request_id,user_id,flow,currency,subtotal_minor,total_minor,source_route,consent_version) values(order_id,gen_random_uuid(),creator,'support_recurring','usd',500,500,'/support','2026-07-16');
 insert into private.billing_customers(id,user_id,provider,status,test_mode) values(customer_id,creator,'stripe','pending',true);
 insert into private.economic_prices(id,price_code,product_key,currency,unit_amount_minor) values(price_id,'support_test_preprovider_fixture_usd','support_recurring','usd',500);
 insert into private.economic_subscriptions(id,user_id,billing_customer_id,originating_order_id,price_id,provider,provider_subscription_reference,status,current_period_end)
 values(subscription_id,creator,customer_id,order_id,price_id,'stripe','sub_preprovidersynthetic','active',now()+interval '1 month');
 command:=jsonb_build_object('action','support_request','requestId',gen_random_uuid(),'kind','support_cancellation','targetId',subscription_id,'amountMinor',null,'reason','Synthetic recurring support cancellation request');
 begin perform public.command_economic_preparation(outsider,command);raise exception 'foreign subscription cancellation accepted';exception when insufficient_privilege then null;end;
 result:=public.command_economic_preparation(creator,command);case_id:=(result->>'targetId')::uuid;
 if public.command_economic_preparation(creator,command)->>'idempotentReplay'<>'true' then raise exception 'cancellation retry duplicated'; end if;
 begin perform public.command_economic_preparation(creator,command||jsonb_build_object('requestId',gen_random_uuid()));raise exception 'duplicate open cancellation case accepted';exception when unique_violation then null;end;
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','support_review','requestId',gen_random_uuid(),'expectedRevision',1,'caseId',case_id,'decision','reviewing','reason','Synthetic cancellation reviewed internally'));
 perform public.command_economic_preparation(operator_id,jsonb_build_object('action','support_review','requestId',gen_random_uuid(),'expectedRevision',2,'caseId',case_id,'decision','awaiting_provider','reason','Synthetic cancellation awaiting approved adapter'));
 if not exists(select 1 from private.economic_subscriptions s where s.id=subscription_id and status='active' and not cancel_at_period_end and canceled_at is null) then raise exception 'request changed verified subscription truth'; end if;
 update private.economic_subscriptions set cancel_at_period_end=true,status='canceling' where id=subscription_id;
 if public.get_economic_preparation(creator,'account')->'subscriptions'->0->>'cancelAtPeriodEnd'<>'true' then raise exception 'verified cancellation state hidden'; end if;
 update private.economic_subscriptions set status='canceled',canceled_at=now() where id=subscription_id;
 begin perform public.command_economic_preparation(creator,command||jsonb_build_object('requestId',gen_random_uuid()));raise exception 'ended subscription cancellation accepted';exception when insufficient_privilege then null;end;
 command:=jsonb_build_object('action','support_request','requestId',gen_random_uuid(),'kind','acknowledgment_delivery','targetId','e9500000-0000-4000-8000-000000000003','amountMinor',null,'reason','Synthetic support acknowledgment delivery inquiry');
 perform public.command_economic_preparation(creator,command);
 if exists(select 1 from jsonb_array_elements(public.get_economic_preparation(creator,'account')->'records') item where item->>'deliveryStatus'<>'not_established') then raise exception 'delivery inquiry fabricated delivery'; end if;
end;
$support$;
do $$ begin
 if (select flags from preparation_preserved) is distinct from (select jsonb_agg(to_jsonb(f) order by feature_key) from private.economic_feature_flags f)
 or (select onboardings from preparation_preserved)<>(select count(*) from private.economic_seller_onboarding_requests)
 or (select provider_results from preparation_preserved)<>(select count(*) from private.marketplace_payout_result_events)
 or (select badges from preparation_preserved)<>(select count(*) from public.user_badges)
 or (select credits from preparation_preserved)<>(select count(*) from private.sandbox_credit_lots) then raise exception 'preparation changed provider, community or compute state'; end if;
end $$;
rollback;
\echo Pre-provider seller, offer, waiver, support, ownership, revision, privacy and immutable-audit checks passed.
