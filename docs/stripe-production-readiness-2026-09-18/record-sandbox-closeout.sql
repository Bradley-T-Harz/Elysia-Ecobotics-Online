begin;
do $$begin if (select runtime_mode='test' and account_reference='acct_1UGdHORrIWWoUVPh' from private.economic_provider_readiness where provider='stripe') is distinct from true then raise exception 'sandbox_scope_required';end if;end$$;
update private.economic_provider_readiness set webhook_verified_at=coalesce(webhook_verified_at,now()),event_coverage_verified_at=coalesce(event_coverage_verified_at,now()),last_preflight_at=now(),updated_at=now() where provider='stripe';
update private.economic_feature_flags set sandbox_qualified_at=coalesce(sandbox_qualified_at,now()),sandbox_evidence_ref='docs/stripe-sandbox-acceptance-2026-09-17/README.md',updated_at=now() where feature_key in ('support_checkout','recurring_support','job_post_fee_enforcement');
insert into private.economic_audit_events(actor_kind,action,target_type,reason,metadata)
select 'system','sandbox_acceptance_closed','economic_provider','20260918_owner_preflight_passed',jsonb_build_object('configurationChecksPassed',true,'events',20,'activationPerformed',false,'liveActivationAuthorized',false)
where not exists(select 1 from private.economic_audit_events where action='sandbox_acceptance_closed' and reason='20260918_owner_preflight_passed');
commit;
select public.current_first_party_provider_readiness() as sandbox_readiness;
