-- Apply only using the isolated kdtqyxlrkpmlpupzgmwv CLI workdir.
-- Preserve synthetic financial/audit history; disable acceptance acquisition.
begin;
do $$ begin
 if (select runtime_mode='test' and account_reference='acct_1UGdHORrIWWoUVPh' from private.economic_provider_readiness where provider='stripe') is distinct from true then raise exception 'sandbox_scope_required';end if;
end $$;
update private.economic_feature_flags set enabled=false,updated_at=now()
where feature_key in ('support_checkout','economic_webhooks','recurring_support','customer_portal','test_refund_execution','job_post_fee_enforcement');
update private.economic_operator_assignments set revoked_at=coalesce(revoked_at,now()),revocation_reason='Synthetic sandbox acceptance finished'
where user_id in ('f6170000-0000-4000-8000-000000000010','f6170000-0000-4000-8000-000000000020') and revoked_at is null;
update public.commune_posts set status='draft',visibility='private_draft'
where id='f6170000-0000-4000-8000-000000000030' and user_id='f6170000-0000-4000-8000-000000000010';
update private.economic_provider_readiness set webhook_verified_at=coalesce(webhook_verified_at,now()),updated_at=now()
where provider='stripe' and runtime_mode='test' and exists(select 1 from private.economic_webhook_events where event_type='payment_intent.succeeded' and processing_status='processed');
insert into private.economic_audit_events(actor_kind,action,target_type,reason,metadata)
values('system','sandbox_acceptance_safe_state_restored','economic_feature','20260917_authorized_synthetic_acceptance',jsonb_build_object('environment','test','acquisitionEnabled',false,'live',false,'evidence','docs/stripe-sandbox-acceptance-2026-09-17/README.md'));
commit;
select 'Sandbox acceptance gates OFF; synthetic operators revoked and Job Post hidden; signed webhook delivery recorded' as result;
