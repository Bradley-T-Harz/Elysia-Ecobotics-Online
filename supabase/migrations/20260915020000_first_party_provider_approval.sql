-- Account review evidence is independent of runtime and lane activation.
begin;
create table private.economic_provider_readiness (
 provider text primary key check (provider='stripe'),
 scope text not null check (scope='first_party_account'),
 review_status text not null check (review_status in ('pending','passed','restricted','failed')),
 reviewed_at date,
 evidence_ref text not null,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 runtime_mode text not null default 'test' check(runtime_mode in ('test','live')),
 account_reference text check(account_reference ~ '^acct_[A-Za-z0-9]+$'),
 webhook_verified_at timestamptz,
 event_coverage_verified_at timestamptz,
 last_preflight_at timestamptz,
 receipt_configuration_verified_at timestamptz,
 portal_configuration_verified_at timestamptz,
 third_party_status text not null default 'hard_off' check(third_party_status='hard_off'),
 updated_at timestamptz not null default now()
);
alter table private.economic_provider_readiness owner to postgres;
alter table private.economic_provider_readiness enable row level security;
revoke all on private.economic_provider_readiness from public,anon,authenticated,service_role;
insert into private.economic_provider_readiness(provider,scope,review_status,reviewed_at,evidence_ref,evidence_sha256)
values('stripe','first_party_account','passed','2026-09-15',
 'Stripe_Provider_Approval_2026-09-15/STRIPE_APPROVAL_RECORD.md','745bed83d14a6824244ff5dce9fd9545e0a4daea02eafe0b473c6b2ea5f1399e');
insert into private.economic_audit_events(actor_kind,action,target_type,reason,metadata)
values('system','provider_review_completed','economic_provider',
 'Owner-confirmed September 15 Stripe first-party account approval; original email and screenshots not independently retrieved.',
 jsonb_build_object('provider','stripe','scope','first_party_account','result','passed','occurred_at','2026-09-15',
 'evidence_ref','Stripe_Provider_Approval_2026-09-15/STRIPE_APPROVAL_RECORD.md','source_sha256','67a7f6e2e8d3fbbb5945787122cdfc9cf6f1a4131fec59e2b01b01297ef79481',
 'activation_performed',false,'third_party_status','hard_off'));

alter table private.economic_feature_flags
 add column sandbox_qualified_at timestamptz,
 add column sandbox_evidence_ref text,
 add column tax_decision_ref text,
 add column tax_behavior text not null default 'disabled' check(tax_behavior in ('disabled','stripe_tax','externally_determined')),
 add column legal_qualified_at timestamptz,
 add column rollout_authorized_at timestamptz;

create function public.current_first_party_provider_readiness()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('provider',provider,'scope',scope,'reviewStatus',review_status,
 'reviewedAt',reviewed_at,'mode',runtime_mode,'webhookVerified',webhook_verified_at is not null,
 'eventCoverageVerified',event_coverage_verified_at is not null,'lastPreflightAt',last_preflight_at,
 'thirdPartyStatus',third_party_status,
 'lanes',(select jsonb_agg(jsonb_build_object('key',feature_key,'enabled',enabled,
 'sandboxQualified',sandbox_qualified_at is not null,'taxDecisionRecorded',tax_decision_ref is not null,
 'taxBehavior',tax_behavior,'legalQualified',legal_qualified_at is not null,'rolloutAuthorized',rollout_authorized_at is not null)
 order by feature_key) from private.economic_feature_flags where feature_key in
 ('support_checkout','recurring_support','job_post_fee_enforcement','organization_billing','sponsorship_checkout')))
 from private.economic_provider_readiness where provider='stripe';
$$;
alter function public.current_first_party_provider_readiness() owner to postgres;
revoke all on function public.current_first_party_provider_readiness() from public;
grant execute on function public.current_first_party_provider_readiness() to anon,authenticated,service_role;
commit;
