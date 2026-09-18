-- Owner-authorized activation; production qwmcstyfegvpzjmjrylc only. No migrations or provider provisioning.
begin;
do $$begin
 if not exists(select 1 from private.economic_provider_readiness where provider='stripe' and runtime_mode='live' and account_reference='acct_1TtlldRvM2Bq0oxr' and review_status='passed') then raise exception 'production_provider_scope_mismatch';end if;
 if exists(select 1 from private.economic_feature_flags where enabled and feature_key not in ('sandbox_credit_display','sandbox_credit_enforcement','live_stripe','support_checkout','economic_webhooks','test_refund_execution')) then raise exception 'unauthorized_enabled_lane';end if;
end$$;
update private.economic_feature_flags set enabled=true,updated_at=now(),rollout_authorized_at=case when feature_key='support_checkout' then coalesce(rollout_authorized_at,now()) else rollout_authorized_at end
 where feature_key in ('live_stripe','support_checkout','economic_webhooks','test_refund_execution');
do $$begin
 if not private.economic_feature_enabled('support_checkout') then raise exception 'support_readiness_failed';end if;
 if exists(select 1 from private.economic_feature_flags where enabled and feature_key not in ('sandbox_credit_display','sandbox_credit_enforcement','live_stripe','support_checkout','economic_webhooks','test_refund_execution')) then raise exception 'unauthorized_enabled_lane';end if;
end$$;
insert into private.economic_audit_events(actor_kind,action,target_type,reason,metadata)
 select 'system','owner_authorized_one_time_support_activation','economic_feature_flag','20260918_bradley_harz_explicit_owner_authorization',
 jsonb_build_object('owner','Bradley Harz','organization','EcoSyneva Commons LLC','lane','support_checkout','environment','live','source','explicit_owner_instruction','evidenceRef','docs/stripe-one-time-support-activation-2026-09-18/authorization.md','otherAcquisitionAuthorized',false,'thirdPartyStatus','hard_off','paymentSubmissionAuthorized',false)
 where not exists(select 1 from private.economic_audit_events where action='owner_authorized_one_time_support_activation' and reason='20260918_bradley_harz_explicit_owner_authorization');
commit;
select jsonb_build_object('readiness',public.current_first_party_provider_readiness(),'enabledFlags',(select jsonb_agg(feature_key order by feature_key) from private.economic_feature_flags where enabled)) as activation;
