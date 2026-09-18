-- Production only: run from the verified qwmcstyfegvpzjmjrylc CLI project.
-- Records readiness/owner disposition; NEVER enables acquisition or rollout.
begin;
set local request.jwt.claim.role='service_role';
select set_config('request.headers','{"x-elysia-billing-mode":"live","x-elysia-stripe-account":"acct_1TtlldRvM2Bq0oxr"}',true);
do $$begin
 if exists(select 1 from private.economic_provider_readiness where provider='stripe' and account_reference is not null and account_reference<>'acct_1TtlldRvM2Bq0oxr') then raise exception 'production_account_scope_mismatch';end if;
 if exists(select 1 from private.economic_feature_flags where enabled and feature_key not in ('sandbox_credit_display','sandbox_credit_enforcement')) then raise exception 'acquisition_must_remain_off';end if;
end$$;
update private.economic_provider_readiness set runtime_mode='live',account_reference='acct_1TtlldRvM2Bq0oxr',
 webhook_verified_at=coalesce(webhook_verified_at,now()),event_coverage_verified_at=coalesce(event_coverage_verified_at,now()),
 receipt_configuration_verified_at=coalesce(receipt_configuration_verified_at,now()),portal_configuration_verified_at=coalesce(portal_configuration_verified_at,now()),last_preflight_at=now(),updated_at=now() where provider='stripe';
select public.record_economic_test_catalog_reference('support_one_time',null,'stripe','prod_elysialivesupportonetime20260915',null);
select public.record_economic_test_catalog_reference('support_recurring','support_monthly_seed_usd','stripe','prod_elysialivesupportrecurring20260915','price_1UGvJyRvM2Bq0oxrLKVXOTYI');
select public.record_economic_test_catalog_reference('support_recurring','support_monthly_commons_usd','stripe','prod_elysialivesupportrecurring20260915','price_1UGvJzRvM2Bq0oxrpvAFzD1a');
select public.record_economic_test_catalog_reference('support_recurring','support_monthly_infrastructure_usd','stripe','prod_elysialivesupportrecurring20260915','price_1UGvJzRvM2Bq0oxr0KzzABXI');
select public.record_economic_test_catalog_reference('support_recurring','support_monthly_sandbox_usd','stripe','prod_elysialivesupportrecurring20260915','price_1UGvK0RvM2Bq0oxrwEoDiySe');
select public.record_economic_test_catalog_reference('support_recurring','support_monthly_50_usd','stripe','prod_elysialivesupportrecurring20260915','price_1UGvK0RvM2Bq0oxryyZBQHsc');
select public.record_economic_test_catalog_reference('job_post_fee',null,'stripe','prod_elysialivejobpostfee20260915',null);
update private.economic_feature_flags set sandbox_qualified_at=coalesce(sandbox_qualified_at,now()),sandbox_evidence_ref='docs/stripe-sandbox-acceptance-2026-09-17/README.md',tax_decision_ref='docs/stripe-production-readiness-2026-09-18/OWNER_DISPOSITION.md',tax_behavior='disabled',legal_qualified_at=coalesce(legal_qualified_at,now()),updated_at=now()
where feature_key in ('support_checkout','recurring_support','job_post_fee_enforcement');
insert into private.economic_audit_events(actor_kind,action,target_type,reason,metadata)
select 'system','first_party_production_readiness_recorded','economic_provider','20260918_owner_adopted_disposition',
 jsonb_build_object('evidenceRef','docs/stripe-production-readiness-2026-09-18/owner-preflight.json','dispositionRef','docs/stripe-production-readiness-2026-09-18/OWNER_DISPOSITION.md','dispositionSha256','42b9c2340949d45dc90eb26e4d2273ce46d83222fff99c43d32b283168b3f1fd','sandboxEvidenceRef','docs/stripe-sandbox-acceptance-2026-09-17/README.md','configurationPreflightSource','owner_attestation','webhookQualification','sandbox_verified_handler_and_owner_verified_live_endpoint','firstLiveDeliveryVerified',false,'activationPerformed',false,'rolloutAuthorized',false,'thirdPartyStatus','hard_off','fortCollinsLicense','PENDING_HUMAN_FOLLOW_UP','homeOccupationLicense','PENDING_HUMAN_FOLLOW_UP')
where not exists(select 1 from private.economic_audit_events where action='first_party_production_readiness_recorded' and reason='20260918_owner_adopted_disposition');
do $$begin
 if exists(select 1 from private.economic_provider_catalog where test_mode or provider_product_reference not like 'prod_elysialive%') then raise exception 'live_catalog_isolation_failed';end if;
 if exists(select 1 from private.economic_feature_flags where enabled and feature_key not in ('sandbox_credit_display','sandbox_credit_enforcement')) then raise exception 'acquisition_changed';end if;
end$$;
commit;
select jsonb_build_object('readiness',public.current_first_party_provider_readiness(),'liveCatalogRows',(select count(*) from private.economic_provider_catalog where not test_mode),'enabledFlags',(select jsonb_agg(feature_key) from private.economic_feature_flags where enabled)) as production_readiness;
