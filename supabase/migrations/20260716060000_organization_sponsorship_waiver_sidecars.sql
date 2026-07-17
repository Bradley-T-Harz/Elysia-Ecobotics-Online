-- Private organization, professional-service, sponsorship, waiver, and subsidy
-- sidecars. None of these records alter Commons identity, roles, review power,
-- badges, moderation, publication approval, or public profile affiliation.

begin;

insert into private.economic_feature_flags(feature_key, enabled, test_mode_only, reason)
values
  ('organization_contract_workflow', false, true, 'Requires operator-reviewed contracts, disclosures, and test catalog configuration.'),
  ('sponsorship_checkout', false, true, 'Ethically reviewed sponsorship checkout has a separate fail-closed acquisition switch.'),
  ('sponsorship_review_workflow', false, true, 'Requires ethical review and a countersigned no-control agreement.'),
  ('economic_assistance_workflow', false, true, 'Requires an approved waiver or subsidy program and audited grant issuance.')
on conflict (feature_key) do nothing;

create table private.economic_organizations (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  account_name text not null,
  country_code text,
  initial_contact_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint economic_organizations_name_check
    check (pg_catalog.char_length(pg_catalog.btrim(account_name)) between 2 and 200),
  constraint economic_organizations_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint economic_organizations_status_check
    check (status in ('pending', 'active', 'restricted', 'closed')),
  constraint economic_organizations_close_check check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  )
);

create table private.economic_price_disclosures (
  price_id uuid primary key references private.economic_prices(id) on delete restrict,
  disclosure_version text not null,
  configured_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint economic_price_disclosure_version_check
    check (pg_catalog.char_length(disclosure_version) between 1 and 120)
);

create table private.economic_organization_memberships (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique default gen_random_uuid(),
  organization_id uuid not null references private.economic_organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  relationship text not null,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  reason text not null,
  constraint economic_organization_membership_relationship_check check (
    relationship in (
      'owner', 'billing_admin', 'technical_contact', 'procurement_contact',
      'billing_contact', 'authorized_signer', 'service_participant'
    )
  ),
  constraint economic_organization_membership_reason_check
    check (pg_catalog.char_length(reason) between 8 and 1000),
  constraint economic_organization_membership_revocation_check check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null)
  )
);

create unique index economic_organization_membership_active_idx
  on private.economic_organization_memberships(organization_id, user_id, relationship)
  where revoked_at is null;

create table private.organization_service_engagements (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  organization_id uuid not null references private.economic_organizations(id) on delete restrict,
  service_code text not null,
  status text not null default 'contract_pending',
  authorized_signer_user_id uuid not null references auth.users(id) on delete restrict,
  statement_of_work_version text not null,
  service_terms_version text not null,
  data_handling_disclosure_version text not null,
  confidentiality_class text not null default 'confidential',
  proposal_reference text,
  contract_reference text,
  invoice_reference text,
  entitlement_state text not null default 'pending',
  support_agreement_state text not null default 'pending',
  price_id uuid references private.economic_prices(id) on delete restrict,
  order_id uuid unique references private.economic_orders(id) on delete restrict,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  private_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_service_code_check
    check (service_code ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint organization_service_status_check check (
    status in ('contract_pending', 'active', 'completed', 'canceled', 'reconciliation_required')
  ),
  constraint organization_service_versions_check check (
    pg_catalog.char_length(statement_of_work_version) between 1 and 120
    and pg_catalog.char_length(service_terms_version) between 1 and 120
    and pg_catalog.char_length(data_handling_disclosure_version) between 1 and 120
  ),
  constraint organization_service_confidentiality_check check (
    confidentiality_class in ('internal', 'confidential', 'restricted')
  ),
  constraint organization_service_reference_check check (
    (proposal_reference is null or pg_catalog.char_length(proposal_reference) between 1 and 120)
    and (contract_reference is null or pg_catalog.char_length(contract_reference) between 1 and 120)
    and (invoice_reference is null or pg_catalog.char_length(invoice_reference) between 1 and 120)
  ),
  constraint organization_service_entitlement_state_check check (
    entitlement_state in ('pending', 'active', 'fulfilled', 'suspended', 'ended')
  ),
  constraint organization_service_support_state_check check (
    support_agreement_state in ('pending', 'active', 'suspended', 'expired', 'terminated', 'not_applicable')
  ),
  constraint organization_service_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint organization_service_time_check
    check (ends_at is null or (starts_at is not null and ends_at > starts_at)),
  constraint organization_service_active_state_check check (
    (status in ('active', 'completed') and price_id is not null and starts_at is not null
      and reviewed_by is not null and reviewed_at is not null)
    or status not in ('active', 'completed')
  )
);

create table private.sponsorship_agreements (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  organization_id uuid not null references private.economic_organizations(id) on delete restrict,
  authorized_signer_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'ethical_review',
  agreement_version text not null,
  disclosure_version text not null,
  purpose_code text not null,
  public_label text,
  public_summary text,
  public_recognition_opt_in boolean not null default false,
  public_recognition_approved boolean not null default false,
  public_recognition_reviewed_by uuid references auth.users(id) on delete restrict,
  public_recognition_reviewed_at timestamptz,
  no_governance_control boolean not null default true,
  no_moderation_control boolean not null default true,
  no_editorial_control boolean not null default true,
  no_user_tracking boolean not null default true,
  no_search_prominence boolean not null default true,
  no_endorsement_claim boolean not null default true,
  price_id uuid references private.economic_prices(id) on delete restrict,
  order_id uuid unique references private.economic_orders(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  private_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsorship_status_check check (
    status in ('ethical_review', 'contract_pending', 'active', 'completed', 'rejected', 'canceled', 'reconciliation_required')
  ),
  constraint sponsorship_review_state_check check (
    (status in ('active', 'completed', 'rejected')
      and reviewed_by is not null and reviewed_at is not null)
    or status not in ('active', 'completed', 'rejected')
  ),
  constraint sponsorship_versions_check check (
    pg_catalog.char_length(agreement_version) between 1 and 120
    and pg_catalog.char_length(disclosure_version) between 1 and 120
  ),
  constraint sponsorship_purpose_check
    check (purpose_code ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint sponsorship_boundaries_check check (
    no_governance_control and no_moderation_control and no_editorial_control
    and no_user_tracking and no_search_prominence and no_endorsement_claim
  ),
  constraint sponsorship_public_copy_check check (
    (public_label is null or pg_catalog.char_length(pg_catalog.btrim(public_label)) between 2 and 120)
    and (public_summary is null or pg_catalog.char_length(public_summary) <= 500)
  ),
  constraint sponsorship_public_review_check check (
    (not public_recognition_approved
      and public_recognition_reviewed_by is null
      and public_recognition_reviewed_at is null)
    or (public_recognition_approved
      and public_recognition_opt_in
      and public_label is not null
      and public_recognition_reviewed_by is not null
      and public_recognition_reviewed_at is not null)
  ),
  constraint sponsorship_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.economic_assistance_programs (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  program_code text not null unique,
  assistance_kind text not null,
  scope text not null,
  status text not null default 'draft',
  public_label text not null,
  terms_version text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  max_grants integer,
  configured_by uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint economic_assistance_program_code_check
    check (program_code ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint economic_assistance_program_kind_check
    check (assistance_kind in ('waiver', 'subsidy', 'sponsored_access')),
  constraint economic_assistance_program_scope_check
    check (scope in ('job_post_fee', 'sandbox_credits')),
  constraint economic_assistance_program_status_check
    check (status in ('draft', 'active', 'paused', 'retired')),
  constraint economic_assistance_program_dates_check
    check (ends_at is null or ends_at > starts_at),
  constraint economic_assistance_program_max_check
    check (max_grants is null or max_grants > 0),
  constraint economic_assistance_program_copy_check check (
    pg_catalog.char_length(pg_catalog.btrim(public_label)) between 2 and 120
    and pg_catalog.char_length(terms_version) between 1 and 120
    and pg_catalog.char_length(private_reason) between 8 and 1000
  )
);

create table private.economic_assistance_grants (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  program_id uuid not null references private.economic_assistance_programs(id) on delete restrict,
  beneficiary_user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null,
  resource_id uuid,
  status text not null default 'granted',
  units bigint,
  granted_by uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  consumed_at timestamptz,
  consumed_resource_id uuid,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  constraint economic_assistance_grant_scope_check
    check (scope in ('job_post_fee', 'sandbox_credits')),
  constraint economic_assistance_grant_status_check
    check (status in ('granted', 'consumed', 'revoked', 'expired')),
  constraint economic_assistance_grant_units_check check (
    (scope = 'sandbox_credits' and units is not null and units > 0)
    or (scope <> 'sandbox_credits' and units is null)
  ),
  constraint economic_assistance_grant_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint economic_assistance_grant_expiry_check
    check (expires_at is null or expires_at > granted_at),
  constraint economic_assistance_grant_consumption_check check (
    (status = 'consumed' and consumed_at is not null and consumed_resource_id is not null)
    or (status in ('revoked', 'expired')
      and ((consumed_at is null and consumed_resource_id is null)
        or (consumed_at is not null and consumed_resource_id is not null)))
    or (status = 'granted' and consumed_at is null and consumed_resource_id is null)
  ),
  constraint economic_assistance_grant_revocation_check check (
    (status = 'revoked' and revoked_at is not null and revoked_by is not null)
    or (status <> 'revoked' and revoked_at is null and revoked_by is null)
  )
);

create table private.economic_assistance_program_actions (
  client_request_id uuid primary key,
  program_id uuid not null references private.economic_assistance_programs(id) on delete restrict,
  target_status text not null,
  confirmation text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint economic_assistance_program_action_status_check
    check (target_status in ('active', 'paused', 'retired')),
  constraint economic_assistance_program_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.sponsorship_assistance_allocations (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  sponsorship_agreement_id uuid not null
    references private.sponsorship_agreements(id) on delete restrict,
  assistance_program_id uuid not null
    references private.economic_assistance_programs(id) on delete restrict,
  scope text not null,
  allocation_kind text not null,
  allocation_cap bigint not null,
  currency text,
  status text not null default 'active',
  sponsor_selects_recipients boolean not null default false,
  sponsor_receives_recipient_data boolean not null default false,
  configured_by uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint sponsorship_assistance_allocation_scope_check
    check (scope in ('job_post_fee', 'sandbox_credits')),
  constraint sponsorship_assistance_allocation_kind_check
    check (allocation_kind in ('funding_minor', 'sandbox_credit_units', 'grant_count')),
  constraint sponsorship_assistance_allocation_cap_check
    check (allocation_cap > 0),
  constraint sponsorship_assistance_allocation_currency_check check (
    (allocation_kind = 'funding_minor' and currency ~ '^[a-z]{3}$')
    or (allocation_kind <> 'funding_minor' and currency is null)
  ),
  constraint sponsorship_assistance_allocation_status_check
    check (status in ('active', 'exhausted', 'canceled')),
  constraint sponsorship_assistance_allocation_no_control_check
    check (sponsor_selects_recipients = false and sponsor_receives_recipient_data = false),
  constraint sponsorship_assistance_allocation_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint sponsorship_assistance_allocation_close_check check (
    (status = 'active' and closed_at is null)
    or (status <> 'active' and closed_at is not null)
  )
);

alter table private.economic_assistance_grants
  add column sponsorship_allocation_id uuid
    references private.sponsorship_assistance_allocations(id) on delete restrict,
  add column allocation_consumption bigint,
  add constraint economic_assistance_grant_allocation_pair_check check (
    (sponsorship_allocation_id is null and allocation_consumption is null)
    or (sponsorship_allocation_id is not null and allocation_consumption > 0)
  );

create index economic_assistance_grants_allocation_idx
  on private.economic_assistance_grants(sponsorship_allocation_id)
  where sponsorship_allocation_id is not null;

create table private.sponsorship_assistance_allocation_actions (
  client_request_id uuid primary key,
  allocation_id uuid not null
    references private.sponsorship_assistance_allocations(id) on delete restrict,
  action text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint sponsorship_assistance_allocation_action_check
    check (action = 'cancel'),
  constraint sponsorship_assistance_allocation_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.economic_assistance_grant_actions (
  client_request_id uuid primary key,
  grant_id uuid not null references private.economic_assistance_grants(id) on delete restrict,
  action text not null,
  confirmation text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reversed_units bigint not null default 0,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint economic_assistance_grant_action_check check (action in ('revoke', 'expire')),
  constraint economic_assistance_grant_action_units_check check (reversed_units >= 0),
  constraint economic_assistance_grant_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.economic_organization_membership_actions (
  client_request_id uuid primary key,
  membership_id uuid references private.economic_organization_memberships(id) on delete restrict,
  organization_id uuid not null references private.economic_organizations(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  relationship text not null,
  enabled boolean not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint economic_organization_membership_action_relationship_check
    check (relationship in (
      'owner', 'billing_admin', 'technical_contact', 'procurement_contact',
      'billing_contact', 'authorized_signer', 'service_participant'
    )),
  constraint economic_organization_membership_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.organization_service_engagement_actions (
  client_request_id uuid primary key,
  engagement_id uuid not null references private.organization_service_engagements(id) on delete restrict,
  action text not null,
  confirmation text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint organization_service_engagement_action_check
    check (action in (
      'activate', 'complete', 'cancel', 'reconciliation_required',
      'resolve_resume', 'resolve_complete', 'resolve_cancel'
    )),
  constraint organization_service_engagement_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.sponsorship_agreement_actions (
  client_request_id uuid primary key,
  sponsorship_agreement_id uuid not null references private.sponsorship_agreements(id) on delete restrict,
  action text not null,
  confirmation text,
  public_recognition_approved boolean,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint sponsorship_agreement_action_check
    check (action in (
      'approve', 'activate', 'reject', 'complete', 'cancel',
      'resolve_resume', 'resolve_complete', 'resolve_cancel',
      'approve_public_recognition', 'revoke_public_recognition'
    )),
  constraint sponsorship_agreement_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.organization_sponsorship_settlement_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references private.economic_orders(id) on delete restrict,
  organization_service_engagement_id uuid
    references private.organization_service_engagements(id) on delete restrict,
  sponsorship_agreement_id uuid
    references private.sponsorship_agreements(id) on delete restrict,
  reason_code text not null,
  target_status_at_hold text not null,
  resolution_target_status text not null,
  status text not null default 'open',
  order_total_minor bigint not null,
  verified_paid_minor bigint not null default 0,
  verified_refunded_minor bigint not null default 0,
  last_order_status text not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint organization_sponsorship_hold_target_check check (
    (organization_service_engagement_id is not null and sponsorship_agreement_id is null
      and resolution_target_status = 'canceled')
    or (organization_service_engagement_id is null and sponsorship_agreement_id is not null
      and resolution_target_status in ('rejected', 'canceled'))
  ),
  constraint organization_sponsorship_hold_reason_check check (
    reason_code in (
      'late_settlement_after_terminal_state',
      'late_settlement_after_checkout_ineligibility',
      'terminal_state_after_settlement'
    )
  ),
  constraint organization_sponsorship_hold_status_check check (
    status in ('open', 'resolved_full_refund')
  ),
  constraint organization_sponsorship_hold_amount_check check (
    order_total_minor > 0 and verified_paid_minor >= 0
      and verified_refunded_minor >= 0
  ),
  constraint organization_sponsorship_hold_resolution_check check (
    (status = 'open' and resolved_at is null)
    or (status = 'resolved_full_refund' and resolved_at is not null
      and verified_paid_minor > 0
      and verified_refunded_minor >= verified_paid_minor)
  )
);

create unique index organization_sponsorship_hold_engagement_idx
  on private.organization_sponsorship_settlement_holds(organization_service_engagement_id)
  where organization_service_engagement_id is not null;
create unique index organization_sponsorship_hold_agreement_idx
  on private.organization_sponsorship_settlement_holds(sponsorship_agreement_id)
  where sponsorship_agreement_id is not null;
create index organization_sponsorship_hold_opened_idx
  on private.organization_sponsorship_settlement_holds(status, opened_at)
  where status = 'open';

create table private.organization_sponsorship_settlement_hold_events (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null
    references private.organization_sponsorship_settlement_holds(id) on delete restrict,
  event_type text not null,
  order_status text not null,
  verified_paid_minor bigint not null,
  verified_refunded_minor bigint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint organization_sponsorship_hold_event_type_check check (
    event_type in ('opened', 'reopened', 'full_refund_verified')
  ),
  constraint organization_sponsorship_hold_event_amount_check check (
    verified_paid_minor >= 0 and verified_refunded_minor >= 0
  ),
  constraint organization_sponsorship_hold_event_metadata_check check (
    pg_catalog.jsonb_typeof(metadata) = 'object'
  )
);

create index organization_sponsorship_hold_events_hold_idx
  on private.organization_sponsorship_settlement_hold_events(hold_id, created_at);

create index economic_assistance_grants_beneficiary_idx
  on private.economic_assistance_grants(beneficiary_user_id, scope, status, expires_at);

create table private.sponsorship_recognition_preference_actions (
  client_request_id uuid primary key,
  sponsorship_agreement_id uuid not null
    references private.sponsorship_agreements(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  opted_in boolean not null,
  agreement_version text not null,
  disclosure_version text not null,
  source_route text not null,
  created_at timestamptz not null default now(),
  constraint sponsorship_recognition_preference_versions_check check (
    pg_catalog.char_length(agreement_version) between 1 and 120
    and pg_catalog.char_length(disclosure_version) between 1 and 120
  ),
  constraint sponsorship_recognition_preference_route_check check (
    source_route ~ '^/[A-Za-z0-9/_?&=.%:-]*$'
    and pg_catalog.char_length(source_route) <= 300
  )
);

alter table private.job_post_economic_conditions
  add constraint job_post_economic_conditions_waiver_fkey
  foreign key (waiver_id) references private.economic_assistance_grants(id) on delete restrict;
alter table private.job_post_economic_conditions
  add constraint job_post_economic_conditions_subsidy_fkey
  foreign key (subsidy_id) references private.economic_assistance_grants(id) on delete restrict;

alter table private.economic_entitlements
  add constraint economic_entitlements_organization_fkey
  foreign key (organization_id) references private.economic_organizations(id) on delete restrict;

do $economic_sidecar_hardening$
declare v_table text;
begin
  foreach v_table in array array[
    'economic_price_disclosures', 'economic_organizations', 'economic_organization_memberships',
    'organization_service_engagements', 'sponsorship_agreements',
    'economic_assistance_programs', 'economic_assistance_program_actions',
    'economic_assistance_grants',
    'sponsorship_assistance_allocations',
    'sponsorship_assistance_allocation_actions',
    'economic_assistance_grant_actions',
    'economic_organization_membership_actions',
    'organization_service_engagement_actions',
    'sponsorship_agreement_actions',
    'organization_sponsorship_settlement_holds',
    'organization_sponsorship_settlement_hold_events',
    'sponsorship_recognition_preference_actions'
  ] loop
    execute pg_catalog.format('alter table private.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table private.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table private.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$economic_sidecar_hardening$;

create trigger economic_organization_membership_actions_are_append_only
before update or delete on private.economic_organization_membership_actions
for each row execute function private.prevent_economic_history_mutation();
create trigger organization_service_engagement_actions_are_append_only
before update or delete on private.organization_service_engagement_actions
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_assistance_program_actions_are_append_only
before update or delete on private.economic_assistance_program_actions
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_assistance_grant_actions_are_append_only
before update or delete on private.economic_assistance_grant_actions
for each row execute function private.prevent_economic_history_mutation();
create trigger sponsorship_agreement_actions_are_append_only
before update or delete on private.sponsorship_agreement_actions
for each row execute function private.prevent_economic_history_mutation();
create trigger sponsorship_recognition_preference_actions_are_append_only
before update or delete on private.sponsorship_recognition_preference_actions
for each row execute function private.prevent_economic_history_mutation();
create trigger sponsorship_assistance_allocation_actions_are_append_only
before update or delete on private.sponsorship_assistance_allocation_actions
for each row execute function private.prevent_economic_history_mutation();
create trigger org_sponsor_hold_events_are_append_only
before update or delete on private.organization_sponsorship_settlement_hold_events
for each row execute function private.prevent_economic_history_mutation();

create or replace function private.organization_service_checkout_is_eligible(
  p_engagement_id uuid,
  p_actor_user_id uuid,
  p_order_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.organization_service_engagements as engagement
    join private.economic_organizations as organization
      on organization.id = engagement.organization_id
    join private.economic_organization_memberships as membership
      on membership.organization_id = organization.id
     and membership.user_id = engagement.authorized_signer_user_id
     and membership.relationship = 'authorized_signer'
     and membership.revoked_at is null
    join auth.users as account on account.id = membership.user_id
    join private.economic_prices as price on price.id = engagement.price_id
    join private.economic_products as product on product.product_key = price.product_key
    where engagement.id = p_engagement_id
      and engagement.status = 'contract_pending'
      and engagement.authorized_signer_user_id = p_actor_user_id
      and organization.status = 'active'
      and account.deleted_at is null
      and account.is_anonymous is false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
      and price.active = true and price.test_mode_only = true
      and price.retired_at is null
      and product.active = true and product.test_mode_only = true
      and product.product_kind = 'organization_service'
      and not exists (
        select 1
        from private.organization_sponsorship_settlement_holds as settlement_hold
        where settlement_hold.organization_service_engagement_id = engagement.id
          and settlement_hold.status = 'open'
      )
      and (
        p_order_id is null
        or (
          engagement.order_id = p_order_id
          and exists (
            select 1
            from private.economic_orders as economic_order
            where economic_order.id = p_order_id
              and economic_order.user_id = p_actor_user_id
              and economic_order.flow = 'organization_service'
              and economic_order.status in ('paid', 'partially_refunded')
          )
          and exists (
            select 1
            from private.economic_consents as sow
            join private.economic_consents as terms
              on terms.client_request_id = sow.client_request_id
             and terms.user_id = sow.user_id
            join private.economic_consents as disclosure
              on disclosure.client_request_id = sow.client_request_id
             and disclosure.user_id = sow.user_id
            where sow.order_id = p_order_id
              and sow.user_id = p_actor_user_id
              and sow.document_key = 'organization_statement_of_work'
              and sow.document_version = engagement.statement_of_work_version
              and terms.order_id = p_order_id
              and terms.document_key = 'organization_service_terms'
              and terms.document_version = engagement.service_terms_version
              and disclosure.order_id = p_order_id
              and disclosure.document_key = 'organization_data_handling_disclosure'
              and disclosure.document_version = engagement.data_handling_disclosure_version
          )
        )
      )
  );
$$;

alter function private.organization_service_checkout_is_eligible(uuid, uuid, uuid)
  owner to postgres;
revoke all privileges on function private.organization_service_checkout_is_eligible(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.sponsorship_checkout_is_eligible(
  p_sponsorship_agreement_id uuid,
  p_actor_user_id uuid,
  p_order_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.sponsorship_agreements as agreement
    join private.economic_organizations as organization
      on organization.id = agreement.organization_id
    join private.economic_organization_memberships as membership
      on membership.organization_id = organization.id
     and membership.user_id = agreement.authorized_signer_user_id
     and membership.relationship = 'authorized_signer'
     and membership.revoked_at is null
    join auth.users as account on account.id = membership.user_id
    join private.economic_prices as price on price.id = agreement.price_id
    join private.economic_products as product on product.product_key = price.product_key
    where agreement.id = p_sponsorship_agreement_id
      and agreement.status = 'contract_pending'
      and agreement.authorized_signer_user_id = p_actor_user_id
      and agreement.reviewed_by is not null and agreement.reviewed_at is not null
      and agreement.no_governance_control and agreement.no_moderation_control
      and agreement.no_editorial_control and agreement.no_user_tracking
      and agreement.no_search_prominence and agreement.no_endorsement_claim
      and organization.status = 'active'
      and account.deleted_at is null
      and account.is_anonymous is false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
      and price.active = true and price.test_mode_only = true
      and price.retired_at is null
      and product.active = true and product.test_mode_only = true
      and product.product_kind = 'sponsorship'
      and not exists (
        select 1
        from private.organization_sponsorship_settlement_holds as settlement_hold
        where settlement_hold.sponsorship_agreement_id = agreement.id
          and settlement_hold.status = 'open'
      )
      and (
        p_order_id is null
        or (
          agreement.order_id = p_order_id
          and exists (
            select 1
            from private.economic_orders as economic_order
            where economic_order.id = p_order_id
              and economic_order.user_id = p_actor_user_id
              and economic_order.flow = 'sponsorship'
              and economic_order.status in ('paid', 'partially_refunded')
          )
          and exists (
            select 1
            from private.economic_consents as agreement_consent
            join private.economic_consents as disclosure_consent
              on disclosure_consent.client_request_id = agreement_consent.client_request_id
             and disclosure_consent.user_id = agreement_consent.user_id
            where agreement_consent.order_id = p_order_id
              and agreement_consent.user_id = p_actor_user_id
              and agreement_consent.document_key = 'sponsorship_no_control_agreement'
              and agreement_consent.document_version = agreement.agreement_version
              and disclosure_consent.order_id = p_order_id
              and disclosure_consent.document_key = 'sponsorship_data_disclosure'
              and disclosure_consent.document_version = agreement.disclosure_version
          )
        )
      )
  );
$$;

alter function private.sponsorship_checkout_is_eligible(uuid, uuid, uuid)
  owner to postgres;
revoke all privileges on function private.sponsorship_checkout_is_eligible(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.configure_economic_test_price(
  p_actor_user_id uuid,
  p_price_code text,
  p_product_key text,
  p_amount_minor bigint,
  p_currency text,
  p_disclosure_version text,
  p_client_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product private.economic_products%rowtype;
  v_price private.economic_prices%rowtype;
  v_capability text;
  v_audit private.economic_audit_events%rowtype;
begin
  select * into v_product
  from private.economic_products as product
  where product.product_key = p_product_key
    and product.product_kind in ('job_post_fee', 'organization_service', 'sponsorship')
    and product.active = true
    and product.test_mode_only = true;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_configurable_product_not_found';
  end if;
  v_capability := case v_product.product_kind
    when 'job_post_fee' then 'job_fee_assess'
    when 'organization_service' then 'organization_billing_manage'
    else 'sponsorship_manage'
  end;
  perform private.require_economic_operator_capability(p_actor_user_id, v_capability);
  if p_client_request_id is null
     or coalesce(p_price_code, '') !~ '^[a-z][a-z0-9_]{2,120}$'
     or p_amount_minor is null or p_amount_minor <= 0
     or lower(coalesce(p_currency, '')) !~ '^[a-z]{3}$'
     or pg_catalog.char_length(coalesce(p_disclosure_version, '')) not between 1 and 120
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_test_price_configuration_invalid';
  end if;
  select * into v_audit
  from private.economic_audit_events as audit
    where audit.action = 'economic_test_price_configured'
      and audit.metadata ->> 'client_request_id' = p_client_request_id::text;
  if found then
    if v_audit.actor_user_id is distinct from p_actor_user_id
       or v_audit.reason <> pg_catalog.btrim(p_reason)
       or v_audit.metadata ->> 'price_code' <> p_price_code
       or v_audit.metadata ->> 'product_key' <> p_product_key
       or v_audit.metadata ->> 'amount_minor' <> p_amount_minor::text
       or v_audit.metadata ->> 'currency' <> lower(p_currency)
       or v_audit.metadata ->> 'disclosure_version' <> p_disclosure_version then
      raise exception using errcode = '23505', message = 'economic_test_price_idempotency_conflict';
    end if;
    select * into v_price from private.economic_prices where id = v_audit.target_id;
    if not found then
      raise exception using errcode = '55000', message = 'economic_test_price_audit_target_missing';
    end if;
    return pg_catalog.jsonb_build_object(
      'priceCode', v_price.price_code, 'productKey', v_price.product_key,
      'amountMinor', v_price.unit_amount_minor, 'currency', v_price.currency,
      'disclosureVersion', p_disclosure_version,
      'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_price from private.economic_prices where price_code = p_price_code for update;
  if found and (
    v_price.product_key <> p_product_key
    or v_price.currency <> lower(p_currency)
    or v_price.unit_amount_minor <> p_amount_minor
  ) then
    raise exception using errcode = '23505', message = 'economic_test_price_code_conflict';
  elsif not found then
    insert into private.economic_prices(
      price_code, product_key, currency, unit_amount_minor,
      active, test_mode_only
    ) values (
      p_price_code, p_product_key, lower(p_currency), p_amount_minor,
      true, true
    ) returning * into v_price;
  end if;
  if exists (
    select 1 from private.economic_price_disclosures as disclosure
    where disclosure.price_id = v_price.id
      and disclosure.disclosure_version <> p_disclosure_version
  ) then
    raise exception using errcode = '23505', message = 'economic_test_price_disclosure_conflict';
  end if;
  insert into private.economic_price_disclosures(
    price_id, disclosure_version, configured_by
  ) values (
    v_price.id, p_disclosure_version, p_actor_user_id
  ) on conflict (price_id) do nothing;
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'economic_test_price_configured',
    'economic_price', v_price.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'client_request_id', p_client_request_id,
      'price_code', v_price.price_code,
      'product_key', v_price.product_key,
      'amount_minor', v_price.unit_amount_minor,
      'currency', v_price.currency,
      'disclosure_version', p_disclosure_version,
      'test_mode', true
    )
  );
  return pg_catalog.jsonb_build_object(
    'priceCode', v_price.price_code, 'productKey', v_price.product_key,
    'amountMinor', v_price.unit_amount_minor, 'currency', v_price.currency,
    'disclosureVersion', p_disclosure_version,
    'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.configure_economic_test_price(uuid, text, text, bigint, text, text, uuid, text)
  owner to postgres;

create or replace function public.operator_create_economic_organization(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_account_name text,
  p_country_code text,
  p_initial_contact_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org private.economic_organizations%rowtype;
  v_replay boolean := false;
  v_create_audit private.economic_audit_events%rowtype;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'organization_billing_manage');
  if p_client_request_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_account_name, ''))) not between 2 and 200
     or (p_country_code is not null and upper(p_country_code) !~ '^[A-Z]{2}$')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000
     or not exists (
       select 1 from auth.users as account
       where account.id = p_initial_contact_user_id
         and account.deleted_at is null and account.is_anonymous is false
         and (account.banned_until is null or account.banned_until <= pg_catalog.now())
     ) then
    raise exception using errcode = '22023', message = 'economic_organization_input_invalid';
  end if;
  select * into v_org
  from private.economic_organizations as organization
  where organization.client_request_id = p_client_request_id;
  if found then
    v_replay := true;
    select * into v_create_audit
    from private.economic_audit_events as audit
    where audit.action = 'economic_organization_created'
      and audit.target_id = v_org.id
    order by audit.created_at
    limit 1;
    if v_org.account_name <> pg_catalog.btrim(p_account_name)
       or v_org.country_code is distinct from upper(p_country_code)
       or v_org.initial_contact_user_id <> p_initial_contact_user_id
       or v_org.created_by <> p_actor_user_id
       or v_create_audit.reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_organization_idempotency_conflict';
    end if;
  else
    insert into private.economic_organizations(
      client_request_id, account_name, country_code, initial_contact_user_id,
      status, created_by
    ) values (
      p_client_request_id, pg_catalog.btrim(p_account_name), upper(p_country_code),
      p_initial_contact_user_id, 'active', p_actor_user_id
    ) returning * into v_org;
    insert into private.economic_organization_memberships(
      organization_id, user_id, relationship, granted_by, reason
    ) values
      (v_org.id, p_initial_contact_user_id, 'owner', p_actor_user_id, pg_catalog.btrim(p_reason)),
      (v_org.id, p_initial_contact_user_id, 'billing_admin', p_actor_user_id, pg_catalog.btrim(p_reason)),
      (v_org.id, p_initial_contact_user_id, 'billing_contact', p_actor_user_id, pg_catalog.btrim(p_reason)),
      (v_org.id, p_initial_contact_user_id, 'authorized_signer', p_actor_user_id, pg_catalog.btrim(p_reason));
    insert into private.economic_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
    ) values (
      p_actor_user_id, 'economic_operator', 'economic_organization_created',
      'economic_organization', v_org.id, pg_catalog.btrim(p_reason),
      pg_catalog.jsonb_build_object('initial_contact_user_id', p_initial_contact_user_id)
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'organizationId', v_org.id, 'accountName', v_org.account_name,
    'status', v_org.status, 'testMode', true,
    'idempotentReplay', v_replay
  );
end;
$$;

alter function public.operator_create_economic_organization(uuid, uuid, text, text, uuid, text)
  owner to postgres;

create or replace function public.operator_set_economic_organization_membership(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_organization_id uuid,
  p_target_user_id uuid,
  p_relationship text,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org private.economic_organizations%rowtype;
  v_membership private.economic_organization_memberships%rowtype;
  v_action private.economic_organization_membership_actions%rowtype;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'organization_billing_manage');
  if p_client_request_id is null
     or p_relationship not in (
       'owner', 'billing_admin', 'technical_contact', 'procurement_contact',
       'billing_contact', 'authorized_signer', 'service_participant'
     )
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_organization_membership_input_invalid';
  end if;
  select * into v_action from private.economic_organization_membership_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.organization_id <> p_organization_id
       or v_action.target_user_id <> p_target_user_id
       or v_action.relationship <> p_relationship
       or v_action.enabled <> coalesce(p_enabled, false)
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_organization_membership_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'membershipId', v_action.membership_id,
      'organizationId', v_action.organization_id,
      'userId', v_action.target_user_id,
      'relationship', v_action.relationship,
      'active', v_action.enabled,
      'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_org from private.economic_organizations
  where id = p_organization_id and status = 'active' for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_organization_not_active';
  end if;
  if coalesce(p_enabled, false) and not exists (
    select 1 from auth.users as account
    where account.id = p_target_user_id
      and account.deleted_at is null and account.is_anonymous is false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
  ) then
    raise exception using errcode = '42501', message = 'economic_organization_member_account_ineligible';
  end if;
  select * into v_membership
  from private.economic_organization_memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_target_user_id
    and membership.relationship = p_relationship
    and membership.revoked_at is null
  for update;
  if coalesce(p_enabled, false) then
    if not found then
      insert into private.economic_organization_memberships(
        client_request_id, organization_id, user_id, relationship,
        granted_by, reason
      ) values (
        p_client_request_id, p_organization_id, p_target_user_id,
        p_relationship, p_actor_user_id, pg_catalog.btrim(p_reason)
      ) returning * into v_membership;
    end if;
  elsif found then
    if p_relationship in ('owner', 'billing_admin', 'billing_contact', 'authorized_signer')
       and not exists (
         select 1 from private.economic_organization_memberships as other
         where other.organization_id = p_organization_id
           and other.relationship = p_relationship
           and other.revoked_at is null
           and other.id <> v_membership.id
       ) then
      raise exception using errcode = '55000', message = 'economic_organization_last_required_contact_cannot_be_revoked';
    end if;
    update private.economic_organization_memberships
    set revoked_at = pg_catalog.now(), revoked_by = p_actor_user_id
    where id = v_membership.id returning * into v_membership;
  end if;
  insert into private.economic_organization_membership_actions(
    client_request_id, membership_id, organization_id, target_user_id,
    relationship, enabled, actor_user_id, private_reason
  ) values (
    p_client_request_id, v_membership.id, p_organization_id, p_target_user_id,
    p_relationship, coalesce(p_enabled, false), p_actor_user_id,
    pg_catalog.btrim(p_reason)
  ) returning * into v_action;
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator',
    case when coalesce(p_enabled, false) then 'economic_organization_membership_granted'
      else 'economic_organization_membership_revoked' end,
    'economic_organization_membership', v_membership.id,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'organization_id', p_organization_id,
      'target_user_id', p_target_user_id,
      'relationship', p_relationship
    )
  );
  return pg_catalog.jsonb_build_object(
    'membershipId', v_membership.id, 'organizationId', p_organization_id,
    'userId', p_target_user_id, 'relationship', p_relationship,
    'active', coalesce(p_enabled, false),
    'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.operator_set_economic_organization_membership(
  uuid, uuid, uuid, uuid, text, boolean, text
) owner to postgres;

create or replace function public.operator_create_organization_service_engagement(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_organization_id uuid,
  p_authorized_signer_user_id uuid,
  p_service_code text,
  p_price_code text,
  p_statement_of_work_version text,
  p_service_terms_version text,
  p_data_handling_disclosure_version text,
  p_confidentiality_class text,
  p_proposal_reference text,
  p_contract_reference text,
  p_invoice_reference text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org private.economic_organizations%rowtype;
  v_price private.economic_prices%rowtype;
  v_engagement private.organization_service_engagements%rowtype;
  v_replay boolean := false;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'organization_billing_manage');
  if not private.economic_feature_enabled('organization_contract_workflow') then
    raise exception using errcode = '55000', message = 'organization_contract_workflow_disabled';
  end if;
  if p_client_request_id is null or coalesce(p_service_code, '') !~ '^[a-z][a-z0-9_]{2,100}$'
     or pg_catalog.char_length(coalesce(p_statement_of_work_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_service_terms_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_data_handling_disclosure_version, '')) not between 1 and 120
     or p_confidentiality_class not in ('internal', 'confidential', 'restricted')
     or pg_catalog.char_length(coalesce(p_proposal_reference, '')) > 120
     or pg_catalog.char_length(coalesce(p_contract_reference, '')) > 120
     or pg_catalog.char_length(coalesce(p_invoice_reference, '')) > 120
     or p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'organization_service_engagement_input_invalid';
  end if;
  select * into v_engagement from private.organization_service_engagements
  where client_request_id = p_client_request_id;
  if found then
    v_replay := true;
    if v_engagement.organization_id <> p_organization_id
       or v_engagement.authorized_signer_user_id <> p_authorized_signer_user_id
       or v_engagement.service_code <> p_service_code
       or v_engagement.statement_of_work_version <> p_statement_of_work_version
       or v_engagement.service_terms_version <> p_service_terms_version
       or v_engagement.data_handling_disclosure_version <> p_data_handling_disclosure_version
       or v_engagement.confidentiality_class <> p_confidentiality_class
       or v_engagement.proposal_reference is distinct from nullif(pg_catalog.btrim(coalesce(p_proposal_reference, '')), '')
       or v_engagement.contract_reference is distinct from nullif(pg_catalog.btrim(coalesce(p_contract_reference, '')), '')
       or v_engagement.invoice_reference is distinct from nullif(pg_catalog.btrim(coalesce(p_invoice_reference, '')), '')
       or v_engagement.starts_at <> p_starts_at
       or v_engagement.ends_at is distinct from p_ends_at
       or v_engagement.created_by <> p_actor_user_id
       or v_engagement.private_reason <> pg_catalog.btrim(p_reason)
       or v_engagement.price_id is distinct from (
         select price.id from private.economic_prices as price
         where price.price_code = p_price_code
       ) then
      raise exception using errcode = '23505', message = 'organization_service_engagement_idempotency_conflict';
    end if;
  else
    select * into v_org from private.economic_organizations
    where id = p_organization_id and status = 'active';
    if not found or not exists (
      select 1 from private.economic_organization_memberships as membership
      join auth.users as account on account.id = membership.user_id
      where membership.organization_id = p_organization_id
        and membership.user_id = p_authorized_signer_user_id
        and membership.relationship = 'authorized_signer'
        and membership.revoked_at is null
        and account.deleted_at is null and account.is_anonymous is false
        and (account.banned_until is null or account.banned_until <= pg_catalog.now())
    ) then
      raise exception using errcode = '42501', message = 'organization_active_authorized_signer_required';
    end if;
    select * into v_price from private.economic_prices as price
    where price.price_code = p_price_code and price.product_key = 'organization_service'
      and price.active = true and price.test_mode_only = true and price.retired_at is null;
    if not found then
      raise exception using errcode = 'P0002', message = 'organization_service_test_price_not_configured';
    end if;
    insert into private.organization_service_engagements(
      client_request_id, organization_id, service_code, authorized_signer_user_id,
      statement_of_work_version, service_terms_version,
      data_handling_disclosure_version, confidentiality_class,
      proposal_reference, contract_reference, invoice_reference,
      price_id, starts_at, ends_at,
      created_by, private_reason
    ) values (
      p_client_request_id, p_organization_id, p_service_code,
      p_authorized_signer_user_id, p_statement_of_work_version,
      p_service_terms_version, p_data_handling_disclosure_version,
      p_confidentiality_class,
      nullif(pg_catalog.btrim(coalesce(p_proposal_reference, '')), ''),
      nullif(pg_catalog.btrim(coalesce(p_contract_reference, '')), ''),
      nullif(pg_catalog.btrim(coalesce(p_invoice_reference, '')), ''),
      v_price.id, p_starts_at, p_ends_at, p_actor_user_id,
      pg_catalog.btrim(p_reason)
    ) returning * into v_engagement;
    insert into private.economic_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
    ) values (
      p_actor_user_id, 'economic_operator', 'organization_service_engagement_created',
      'organization_service_engagement', v_engagement.id, pg_catalog.btrim(p_reason),
      pg_catalog.jsonb_build_object('organization_id', p_organization_id, 'test_mode', true)
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'engagementId', v_engagement.id, 'organizationId', v_engagement.organization_id,
    'serviceCode', v_engagement.service_code, 'status', v_engagement.status,
    'serviceTermsVersion', v_engagement.service_terms_version,
    'testMode', true, 'idempotentReplay', v_replay
  );
end;
$$;

alter function public.operator_create_organization_service_engagement(
  uuid, uuid, uuid, uuid, text, text, text, text, text,
  text, text, text, text, timestamptz, timestamptz, text
) owner to postgres;

create or replace function public.operator_review_organization_service_engagement(
  p_actor_user_id uuid,
  p_engagement_id uuid,
  p_client_request_id uuid,
  p_action text,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement private.organization_service_engagements%rowtype;
  v_action private.organization_service_engagement_actions%rowtype;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'organization_billing_manage');
  if p_client_request_id is null
     or p_action not in (
       'activate', 'complete', 'cancel', 'reconciliation_required',
       'resolve_resume', 'resolve_complete', 'resolve_cancel'
     )
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'organization_service_review_input_invalid';
  end if;
  select * into v_action from private.organization_service_engagement_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.engagement_id <> p_engagement_id or v_action.action <> p_action
       or v_action.confirmation is distinct from p_confirmation
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'organization_service_review_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'engagementId', v_action.engagement_id, 'action', v_action.action,
      'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_engagement from private.organization_service_engagements
  where id = p_engagement_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'organization_service_engagement_not_found';
  end if;
  if p_action in ('resolve_resume', 'resolve_complete', 'resolve_cancel') then
    if v_engagement.status <> 'reconciliation_required'
       or exists (
         select 1
         from private.organization_sponsorship_settlement_holds as settlement_hold
         where settlement_hold.organization_service_engagement_id = v_engagement.id
           and settlement_hold.status = 'open'
       )
       or p_confirmation is distinct from (case p_action
         when 'resolve_resume' then 'RESOLVE TEST ORGANIZATION RECONCILIATION AS ACTIVE'
         when 'resolve_complete' then 'RESOLVE TEST ORGANIZATION RECONCILIATION AS COMPLETED'
         else 'RESOLVE TEST ORGANIZATION RECONCILIATION AS CANCELED'
       end)
       or (p_action <> 'resolve_cancel' and not exists (
         select 1 from private.economic_orders as settled_order
         where settled_order.id = v_engagement.order_id
           and settled_order.status in ('paid', 'partially_refunded')
       )) then
      raise exception using errcode = '55000', message = 'organization_service_reconciliation_resolution_prerequisites_required';
    end if;
    update private.organization_service_engagements
    set status = case p_action
          when 'resolve_resume' then 'active'
          when 'resolve_complete' then 'completed'
          else 'canceled' end,
        entitlement_state = case p_action
          when 'resolve_resume' then 'active'
          when 'resolve_complete' then 'fulfilled'
          else 'ended' end,
        support_agreement_state = case p_action
          when 'resolve_resume' then 'active'
          when 'resolve_complete' then 'expired'
          else 'terminated' end,
        reviewed_by = p_actor_user_id, reviewed_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where id = v_engagement.id returning * into v_engagement;
  elsif p_action = 'activate' then
    if p_confirmation is distinct from 'ACTIVATE TEST ORGANIZATION SERVICE'
       or not private.economic_feature_enabled('organization_contract_workflow')
       or v_engagement.status <> 'contract_pending'
       or v_engagement.order_id is null
       or not private.organization_service_checkout_is_eligible(
         v_engagement.id, v_engagement.authorized_signer_user_id, v_engagement.order_id
       )
       or not exists (
         select 1 from private.economic_orders as paid_order
         where paid_order.id = v_engagement.order_id
           and paid_order.status in ('paid', 'partially_refunded')
       )
       or not exists (select 1 from private.economic_organizations where id = v_engagement.organization_id and status = 'active')
       or not exists (
         select 1 from private.economic_organization_memberships
         where organization_id = v_engagement.organization_id
           and user_id = v_engagement.authorized_signer_user_id
           and relationship = 'authorized_signer' and revoked_at is null
       )
       or not exists (
         select 1
         from private.economic_consents as sow
         join private.economic_consents as terms
           on terms.client_request_id = sow.client_request_id
          and terms.user_id = sow.user_id
         join private.economic_consents as disclosure
           on disclosure.client_request_id = sow.client_request_id
          and disclosure.user_id = sow.user_id
         where sow.order_id = v_engagement.order_id
           and sow.user_id = v_engagement.authorized_signer_user_id
           and sow.document_key = 'organization_statement_of_work'
           and sow.document_version = v_engagement.statement_of_work_version
           and terms.order_id = v_engagement.order_id
           and terms.document_key = 'organization_service_terms'
           and terms.document_version = v_engagement.service_terms_version
           and disclosure.order_id = v_engagement.order_id
           and disclosure.document_key = 'organization_data_handling_disclosure'
           and disclosure.document_version = v_engagement.data_handling_disclosure_version
       ) then
      raise exception using errcode = '55000', message = 'organization_service_activation_prerequisites_required';
    end if;
    update private.organization_service_engagements
    set status = 'active', reviewed_by = p_actor_user_id,
        reviewed_at = pg_catalog.now(), entitlement_state = 'active',
        support_agreement_state = 'active', updated_at = pg_catalog.now()
    where id = v_engagement.id returning * into v_engagement;
  elsif p_action = 'complete' then
    if v_engagement.status <> 'active' then
      raise exception using errcode = '55000', message = 'organization_service_not_active';
    end if;
    update private.organization_service_engagements
    set status = 'completed', entitlement_state = 'fulfilled',
        support_agreement_state = 'expired', updated_at = pg_catalog.now()
    where id = v_engagement.id returning * into v_engagement;
  elsif p_action = 'cancel' then
    if v_engagement.status not in ('contract_pending', 'active') then
      raise exception using errcode = '55000', message = 'organization_service_not_cancelable';
    end if;
    update private.organization_service_engagements
    set status = 'canceled', entitlement_state = 'ended',
        support_agreement_state = 'terminated', updated_at = pg_catalog.now()
    where id = v_engagement.id returning * into v_engagement;
  else
    update private.organization_service_engagements
    set status = 'reconciliation_required', updated_at = pg_catalog.now()
    where id = v_engagement.id returning * into v_engagement;
  end if;
  insert into private.organization_service_engagement_actions(
    client_request_id, engagement_id, action, confirmation,
    actor_user_id, private_reason
  ) values (
    p_client_request_id, p_engagement_id, p_action, p_confirmation,
    p_actor_user_id, pg_catalog.btrim(p_reason)
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'organization_service_' || p_action,
    'organization_service_engagement', p_engagement_id,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object('status', v_engagement.status, 'test_mode', true)
  );
  return pg_catalog.jsonb_build_object(
    'engagementId', v_engagement.id, 'action', p_action,
    'status', v_engagement.status, 'testMode', true,
    'idempotentReplay', false
  );
end;
$$;

alter function public.operator_review_organization_service_engagement(
  uuid, uuid, uuid, text, text, text
) owner to postgres;

create or replace function public.prepare_organization_service_checkout(
  p_actor_user_id uuid,
  p_engagement_id uuid,
  p_client_request_id uuid,
  p_source_route text,
  p_legal_bundle_version text,
  p_statement_of_work_version text,
  p_service_terms_version text,
  p_data_handling_disclosure_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement private.organization_service_engagements%rowtype;
  v_price private.economic_prices%rowtype;
  v_result jsonb;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if not private.economic_feature_enabled('organization_contract_workflow')
     or not private.economic_feature_enabled('organization_billing')
     or not private.economic_feature_enabled('economic_webhooks') then
    raise exception using errcode = '55000', message = 'organization_service_checkout_disabled';
  end if;
  select * into v_engagement from private.organization_service_engagements
  where id = p_engagement_id and status = 'contract_pending' for update;
  if not found
     or p_actor_user_id <> v_engagement.authorized_signer_user_id
     or p_statement_of_work_version <> v_engagement.statement_of_work_version
     or p_service_terms_version <> v_engagement.service_terms_version
     or p_data_handling_disclosure_version <> v_engagement.data_handling_disclosure_version then
    raise exception using errcode = '42501', message = 'organization_service_checkout_not_available';
  end if;
  select price.* into v_price
  from private.economic_organizations as organization
  join private.economic_organization_memberships as membership
    on membership.organization_id = organization.id
   and membership.user_id = p_actor_user_id
   and membership.relationship = 'authorized_signer'
   and membership.revoked_at is null
  join auth.users as account on account.id = membership.user_id
  join private.economic_prices as price on price.id = v_engagement.price_id
  join private.economic_products as product on product.product_key = price.product_key
  where organization.id = v_engagement.organization_id
    and organization.status = 'active'
    and account.deleted_at is null and account.is_anonymous is false
    and (account.banned_until is null or account.banned_until <= pg_catalog.now())
    and price.active = true and price.test_mode_only = true
    and price.retired_at is null
    and product.active = true and product.test_mode_only = true
    and product.product_kind = 'organization_service'
    and private.organization_service_checkout_is_eligible(
      v_engagement.id, p_actor_user_id, null
    )
  for share of organization, membership, account, price, product;
  if not found then
    raise exception using errcode = '42501', message = 'organization_service_checkout_not_available';
  end if;
  v_result := public.begin_economic_checkout(
    p_actor_user_id, p_client_request_id, 'organization_service',
    v_price.unit_amount_minor, v_price.currency, v_price.price_code,
    p_source_route, p_legal_bundle_version
  );
  update private.organization_service_engagements
  set order_id = (v_result ->> 'orderId')::uuid, updated_at = pg_catalog.now()
  where id = v_engagement.id
    and (order_id is null or order_id = (v_result ->> 'orderId')::uuid);
  if not found then
    raise exception using errcode = '23505', message = 'organization_service_checkout_order_conflict';
  end if;
  insert into private.economic_consents(
    user_id, order_id, document_key, document_version, source_route,
    client_request_id, metadata
  ) values
    (p_actor_user_id, (v_result ->> 'orderId')::uuid,
      'organization_statement_of_work', p_statement_of_work_version,
      p_source_route, p_client_request_id,
      pg_catalog.jsonb_build_object('engagement_id', v_engagement.id)),
    (p_actor_user_id, (v_result ->> 'orderId')::uuid,
      'organization_service_terms', p_service_terms_version,
      p_source_route, p_client_request_id,
      pg_catalog.jsonb_build_object('engagement_id', v_engagement.id)),
    (p_actor_user_id, (v_result ->> 'orderId')::uuid,
      'organization_data_handling_disclosure', p_data_handling_disclosure_version,
      p_source_route, p_client_request_id,
      pg_catalog.jsonb_build_object('engagement_id', v_engagement.id))
  on conflict (client_request_id, document_key) do nothing;
  if (select pg_catalog.count(*) from private.economic_consents as consent
      where consent.client_request_id = p_client_request_id
        and consent.user_id = p_actor_user_id
        and consent.order_id = (v_result ->> 'orderId')::uuid
        and consent.source_route = p_source_route
        and (
          (consent.document_key = 'organization_statement_of_work'
            and consent.document_version = p_statement_of_work_version)
          or (consent.document_key = 'organization_service_terms'
            and consent.document_version = p_service_terms_version)
          or (consent.document_key = 'organization_data_handling_disclosure'
            and consent.document_version = p_data_handling_disclosure_version)
        )) <> 3 then
    raise exception using errcode = '23505', message = 'organization_service_consent_idempotency_conflict';
  end if;
  return v_result || pg_catalog.jsonb_build_object(
    'engagementId', v_engagement.id, 'organizationId', v_engagement.organization_id
  );
end;
$$;

alter function public.prepare_organization_service_checkout(uuid, uuid, uuid, text, text, text, text, text)
  owner to postgres;

create or replace function public.operator_create_sponsorship_agreement(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_organization_id uuid,
  p_authorized_signer_user_id uuid,
  p_purpose_code text,
  p_price_code text,
  p_agreement_version text,
  p_disclosure_version text,
  p_public_label text,
  p_public_summary text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement private.sponsorship_agreements%rowtype;
  v_price private.economic_prices%rowtype;
  v_replay boolean := false;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'sponsorship_manage');
  if not private.economic_feature_enabled('sponsorship_review_workflow') then
    raise exception using errcode = '55000', message = 'sponsorship_review_workflow_disabled';
  end if;
  if p_client_request_id is null or coalesce(p_purpose_code, '') !~ '^[a-z][a-z0-9_]{2,100}$'
     or pg_catalog.char_length(coalesce(p_agreement_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_disclosure_version, '')) not between 1 and 120
     or (nullif(pg_catalog.btrim(coalesce(p_public_label, '')), '') is not null
       and pg_catalog.char_length(pg_catalog.btrim(p_public_label)) not between 2 and 120)
     or pg_catalog.char_length(coalesce(p_public_summary, '')) > 500
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sponsorship_agreement_input_invalid';
  end if;
  select * into v_agreement from private.sponsorship_agreements
  where client_request_id = p_client_request_id;
  if found then
    v_replay := true;
    if v_agreement.organization_id <> p_organization_id
       or v_agreement.authorized_signer_user_id <> p_authorized_signer_user_id
       or v_agreement.purpose_code <> p_purpose_code
       or v_agreement.agreement_version <> p_agreement_version
       or v_agreement.disclosure_version <> p_disclosure_version
       or v_agreement.public_label is distinct from nullif(pg_catalog.btrim(coalesce(p_public_label, '')), '')
       or v_agreement.public_summary is distinct from nullif(pg_catalog.btrim(coalesce(p_public_summary, '')), '')
       or v_agreement.public_recognition_opt_in <> false
       or v_agreement.created_by <> p_actor_user_id
       or v_agreement.private_reason <> pg_catalog.btrim(p_reason)
       or v_agreement.price_id is distinct from (
         select price.id from private.economic_prices as price where price.price_code = p_price_code
       ) then
      raise exception using errcode = '23505', message = 'sponsorship_agreement_idempotency_conflict';
    end if;
  else
    if not exists (select 1 from private.economic_organizations where id = p_organization_id and status = 'active')
       or not exists (
         select 1
         from private.economic_organization_memberships as membership
         join auth.users as account on account.id = membership.user_id
         where membership.organization_id = p_organization_id
           and membership.user_id = p_authorized_signer_user_id
           and membership.relationship = 'authorized_signer'
           and membership.revoked_at is null
           and account.deleted_at is null and account.is_anonymous is false
           and (account.banned_until is null or account.banned_until <= pg_catalog.now())
       ) then
      raise exception using errcode = '42501', message = 'sponsorship_active_authorized_signer_required';
    end if;
    select * into v_price from private.economic_prices as price
    where price.price_code = p_price_code and price.product_key = 'sponsorship'
      and price.active = true and price.test_mode_only = true and price.retired_at is null;
    if not found then
      raise exception using errcode = 'P0002', message = 'sponsorship_test_price_not_configured';
    end if;
    insert into private.sponsorship_agreements(
      client_request_id, organization_id, authorized_signer_user_id,
      agreement_version, disclosure_version, purpose_code,
      public_label, public_summary, public_recognition_opt_in,
      price_id, created_by, private_reason
    ) values (
      p_client_request_id, p_organization_id, p_authorized_signer_user_id,
      p_agreement_version, p_disclosure_version, p_purpose_code,
      nullif(pg_catalog.btrim(coalesce(p_public_label, '')), ''),
      nullif(pg_catalog.btrim(coalesce(p_public_summary, '')), ''),
      false, v_price.id, p_actor_user_id,
      pg_catalog.btrim(p_reason)
    ) returning * into v_agreement;
    insert into private.economic_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
    ) values (
      p_actor_user_id, 'economic_operator', 'sponsorship_agreement_created',
      'sponsorship_agreement', v_agreement.id, pg_catalog.btrim(p_reason),
      pg_catalog.jsonb_build_object(
        'purpose_code', p_purpose_code,
        'no_governance_control', true,
        'no_moderation_control', true,
        'no_editorial_control', true,
        'no_user_tracking', true,
        'test_mode', true
      )
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'sponsorshipAgreementId', v_agreement.id,
    'organizationId', v_agreement.organization_id,
    'status', v_agreement.status,
    'publicRecognitionOptIn', v_agreement.public_recognition_opt_in,
    'publicRecognitionApproved', v_agreement.public_recognition_approved,
    'grantsAuthority', false, 'testMode', true,
    'idempotentReplay', v_replay
  );
end;
$$;

alter function public.operator_create_sponsorship_agreement(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, text
) owner to postgres;

create or replace function public.operator_review_sponsorship_agreement(
  p_actor_user_id uuid,
  p_sponsorship_agreement_id uuid,
  p_client_request_id uuid,
  p_action text,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement private.sponsorship_agreements%rowtype;
  v_action private.sponsorship_agreement_actions%rowtype;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'sponsorship_manage');
  if p_client_request_id is null or p_action not in (
       'approve', 'activate', 'reject', 'complete', 'cancel',
       'resolve_resume', 'resolve_complete', 'resolve_cancel'
     )
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sponsorship_review_input_invalid';
  end if;
  select * into v_action from private.sponsorship_agreement_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.sponsorship_agreement_id <> p_sponsorship_agreement_id
       or v_action.action <> p_action
       or v_action.confirmation is distinct from p_confirmation
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'sponsorship_review_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'sponsorshipAgreementId', v_action.sponsorship_agreement_id,
      'action', v_action.action, 'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_agreement from private.sponsorship_agreements
  where id = p_sponsorship_agreement_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'sponsorship_agreement_not_found';
  end if;
  if p_action in ('resolve_resume', 'resolve_complete', 'resolve_cancel') then
    if v_agreement.status <> 'reconciliation_required'
       or exists (
         select 1
         from private.organization_sponsorship_settlement_holds as settlement_hold
         where settlement_hold.sponsorship_agreement_id = v_agreement.id
           and settlement_hold.status = 'open'
       )
       or p_confirmation is distinct from (case p_action
         when 'resolve_resume' then 'RESOLVE TEST SPONSORSHIP RECONCILIATION AS ACTIVE'
         when 'resolve_complete' then 'RESOLVE TEST SPONSORSHIP RECONCILIATION AS COMPLETED'
         else 'RESOLVE TEST SPONSORSHIP RECONCILIATION AS CANCELED'
       end)
       or (p_action <> 'resolve_cancel' and (
         not exists (
           select 1 from private.economic_orders as settled_order
           where settled_order.id = v_agreement.order_id
             and settled_order.status in ('paid', 'partially_refunded')
         )
         or private.sponsorship_committed_funding_minor(v_agreement.id)
           > coalesce(private.sponsorship_net_settled_minor(v_agreement.id), 0)
       )) then
      raise exception using errcode = '55000', message = 'sponsorship_reconciliation_resolution_prerequisites_required';
    end if;
    update private.sponsorship_agreements
    set status = case p_action
          when 'resolve_resume' then 'active'
          when 'resolve_complete' then 'completed'
          else 'canceled' end,
        reviewed_by = p_actor_user_id, reviewed_at = pg_catalog.now(),
        public_recognition_approved = false,
        public_recognition_reviewed_by = null,
        public_recognition_reviewed_at = null,
        updated_at = pg_catalog.now()
    where id = v_agreement.id returning * into v_agreement;
  elsif p_action = 'approve' then
    if p_confirmation is distinct from 'APPROVE TEST SPONSORSHIP WITHOUT CONTROL'
       or not private.economic_feature_enabled('sponsorship_review_workflow')
       or v_agreement.status <> 'ethical_review'
       or not (v_agreement.no_governance_control and v_agreement.no_moderation_control
         and v_agreement.no_editorial_control and v_agreement.no_user_tracking
         and v_agreement.no_search_prominence and v_agreement.no_endorsement_claim) then
      raise exception using errcode = '55000', message = 'sponsorship_ethical_review_prerequisites_required';
    end if;
    update private.sponsorship_agreements
    set status = 'contract_pending', reviewed_by = p_actor_user_id,
        reviewed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where id = v_agreement.id returning * into v_agreement;
  elsif p_action = 'activate' then
    if p_confirmation is distinct from 'ACTIVATE PAID TEST SPONSORSHIP WITHOUT CONTROL'
       or v_agreement.status <> 'contract_pending'
       or v_agreement.order_id is null
       or not private.sponsorship_checkout_is_eligible(
         v_agreement.id, v_agreement.authorized_signer_user_id, v_agreement.order_id
       )
       or not exists (
         select 1 from private.economic_orders as paid_order
         where paid_order.id = v_agreement.order_id
           and paid_order.status in ('paid', 'partially_refunded')
       )
       or not exists (
         select 1
         from private.economic_consents as agreement_consent
         join private.economic_consents as disclosure_consent
           on disclosure_consent.client_request_id = agreement_consent.client_request_id
          and disclosure_consent.user_id = agreement_consent.user_id
         where agreement_consent.order_id = v_agreement.order_id
           and agreement_consent.user_id = v_agreement.authorized_signer_user_id
           and agreement_consent.document_key = 'sponsorship_no_control_agreement'
           and agreement_consent.document_version = v_agreement.agreement_version
           and disclosure_consent.order_id = v_agreement.order_id
           and disclosure_consent.document_key = 'sponsorship_data_disclosure'
           and disclosure_consent.document_version = v_agreement.disclosure_version
       ) then
      raise exception using errcode = '55000', message = 'sponsorship_activation_prerequisites_required';
    end if;
    update private.sponsorship_agreements
    set status = 'active', updated_at = pg_catalog.now()
    where id = v_agreement.id returning * into v_agreement;
  elsif p_action = 'reject' then
    if v_agreement.status not in ('ethical_review', 'contract_pending') then
      raise exception using errcode = '55000', message = 'sponsorship_not_reviewable';
    end if;
    update private.sponsorship_agreements
    set status = 'rejected', reviewed_by = p_actor_user_id,
        reviewed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where id = v_agreement.id returning * into v_agreement;
  elsif p_action = 'complete' then
    if v_agreement.status <> 'active' then
      raise exception using errcode = '55000', message = 'sponsorship_not_active';
    end if;
    update private.sponsorship_agreements set status = 'completed', updated_at = pg_catalog.now()
    where id = v_agreement.id returning * into v_agreement;
  else
    if v_agreement.status not in ('ethical_review', 'contract_pending', 'active') then
      raise exception using errcode = '55000', message = 'sponsorship_not_cancelable';
    end if;
    update private.sponsorship_agreements
    set status = 'canceled', public_recognition_approved = false,
        public_recognition_reviewed_by = null,
        public_recognition_reviewed_at = null,
        updated_at = pg_catalog.now()
    where id = v_agreement.id returning * into v_agreement;
  end if;
  insert into private.sponsorship_agreement_actions(
    client_request_id, sponsorship_agreement_id, action, confirmation,
    actor_user_id, private_reason
  ) values (
    p_client_request_id, v_agreement.id, p_action, p_confirmation,
    p_actor_user_id, pg_catalog.btrim(p_reason)
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'sponsorship_' || p_action,
    'sponsorship_agreement', v_agreement.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'status', v_agreement.status,
      'no_control_boundaries_verified', p_action = 'approve',
      'test_mode', true
    )
  );
  return pg_catalog.jsonb_build_object(
    'sponsorshipAgreementId', v_agreement.id, 'action', p_action,
    'status', v_agreement.status, 'grantsAuthority', false,
    'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.operator_review_sponsorship_agreement(
  uuid, uuid, uuid, text, text, text
) owner to postgres;

create or replace function public.operator_set_sponsorship_public_recognition(
  p_actor_user_id uuid,
  p_sponsorship_agreement_id uuid,
  p_client_request_id uuid,
  p_approved boolean,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement private.sponsorship_agreements%rowtype;
  v_action private.sponsorship_agreement_actions%rowtype;
  v_action_name text := case when coalesce(p_approved, false)
    then 'approve_public_recognition' else 'revoke_public_recognition' end;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'sponsorship_manage');
  if p_client_request_id is null
     or (coalesce(p_approved, false)
       and p_confirmation is distinct from 'APPROVE NEUTRAL SPONSORSHIP RECOGNITION')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sponsorship_public_recognition_input_invalid';
  end if;
  select * into v_action from private.sponsorship_agreement_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.sponsorship_agreement_id <> p_sponsorship_agreement_id
       or v_action.action <> v_action_name
       or v_action.confirmation is distinct from p_confirmation
       or v_action.public_recognition_approved is distinct from coalesce(p_approved, false)
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'sponsorship_public_recognition_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'sponsorshipAgreementId', v_action.sponsorship_agreement_id,
      'publicRecognitionApproved', v_action.public_recognition_approved,
      'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_agreement from private.sponsorship_agreements
  where id = p_sponsorship_agreement_id for update;
  if not found or v_agreement.status not in ('active', 'completed') then
    raise exception using errcode = '55000', message = 'sponsorship_not_eligible_for_public_recognition';
  end if;
  if coalesce(p_approved, false) and (
    not v_agreement.public_recognition_opt_in or v_agreement.public_label is null
    or v_agreement.order_id is null
    or not exists (
      select 1 from private.economic_orders
      where id = v_agreement.order_id and status in ('paid', 'partially_refunded')
    )
  ) then
    raise exception using errcode = '55000', message = 'sponsorship_public_recognition_prerequisites_required';
  end if;
  update private.sponsorship_agreements
  set public_recognition_approved = coalesce(p_approved, false),
      public_recognition_reviewed_by = case when coalesce(p_approved, false) then p_actor_user_id else null end,
      public_recognition_reviewed_at = case when coalesce(p_approved, false) then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where id = v_agreement.id returning * into v_agreement;
  insert into private.sponsorship_agreement_actions(
    client_request_id, sponsorship_agreement_id, action, confirmation,
    public_recognition_approved, actor_user_id, private_reason
  ) values (
    p_client_request_id, v_agreement.id, v_action_name, p_confirmation,
    coalesce(p_approved, false), p_actor_user_id, pg_catalog.btrim(p_reason)
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'sponsorship_public_recognition_changed',
    'sponsorship_agreement', v_agreement.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'approved', coalesce(p_approved, false),
      'amounts_public', false, 'is_endorsement', false,
      'grants_authority', false
    )
  );
  return pg_catalog.jsonb_build_object(
    'sponsorshipAgreementId', v_agreement.id,
    'publicRecognitionApproved', v_agreement.public_recognition_approved,
    'publicDisplayEnabled', private.economic_feature_enabled('sponsorship_display'),
    'amountsPublic', false, 'grantsAuthority', false,
    'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.operator_set_sponsorship_public_recognition(
  uuid, uuid, uuid, boolean, text, text
) owner to postgres;

create or replace function public.prepare_sponsorship_checkout(
  p_actor_user_id uuid,
  p_sponsorship_agreement_id uuid,
  p_client_request_id uuid,
  p_source_route text,
  p_legal_bundle_version text,
  p_agreement_version text,
  p_disclosure_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement private.sponsorship_agreements%rowtype;
  v_price private.economic_prices%rowtype;
  v_result jsonb;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if not private.economic_feature_enabled('sponsorship_checkout')
     or not private.economic_feature_enabled('sponsorship_review_workflow')
     or not private.economic_feature_enabled('economic_webhooks') then
    raise exception using errcode = '55000', message = 'sponsorship_checkout_disabled';
  end if;
  select * into v_agreement from private.sponsorship_agreements
  where id = p_sponsorship_agreement_id and status = 'contract_pending' for update;
  if not found
     or p_actor_user_id <> v_agreement.authorized_signer_user_id
     or p_agreement_version <> v_agreement.agreement_version
     or p_disclosure_version <> v_agreement.disclosure_version then
    raise exception using errcode = '42501', message = 'sponsorship_checkout_not_available';
  end if;
  select price.* into v_price
  from private.economic_organizations as organization
  join private.economic_organization_memberships as membership
    on membership.organization_id = organization.id
   and membership.user_id = p_actor_user_id
   and membership.relationship = 'authorized_signer'
   and membership.revoked_at is null
  join auth.users as account on account.id = membership.user_id
  join private.economic_prices as price on price.id = v_agreement.price_id
  join private.economic_products as product on product.product_key = price.product_key
  where organization.id = v_agreement.organization_id
    and organization.status = 'active'
    and account.deleted_at is null and account.is_anonymous is false
    and (account.banned_until is null or account.banned_until <= pg_catalog.now())
    and price.active = true and price.test_mode_only = true
    and price.retired_at is null
    and product.active = true and product.test_mode_only = true
    and product.product_kind = 'sponsorship'
    and private.sponsorship_checkout_is_eligible(
      v_agreement.id, p_actor_user_id, null
    )
  for share of organization, membership, account, price, product;
  if not found then
    raise exception using errcode = '42501', message = 'sponsorship_checkout_not_available';
  end if;
  v_result := public.begin_economic_checkout(
    p_actor_user_id, p_client_request_id, 'sponsorship',
    v_price.unit_amount_minor, v_price.currency, v_price.price_code,
    p_source_route, p_legal_bundle_version
  );
  update private.sponsorship_agreements
  set order_id = (v_result ->> 'orderId')::uuid, updated_at = pg_catalog.now()
  where id = v_agreement.id
    and (order_id is null or order_id = (v_result ->> 'orderId')::uuid);
  if not found then
    raise exception using errcode = '23505', message = 'sponsorship_checkout_order_conflict';
  end if;
  insert into private.economic_consents(
    user_id, order_id, document_key, document_version, source_route,
    client_request_id, metadata
  ) values
    (p_actor_user_id, (v_result ->> 'orderId')::uuid,
      'sponsorship_no_control_agreement', p_agreement_version,
      p_source_route, p_client_request_id,
      pg_catalog.jsonb_build_object('sponsorship_agreement_id', v_agreement.id)),
    (p_actor_user_id, (v_result ->> 'orderId')::uuid,
      'sponsorship_data_disclosure', p_disclosure_version,
      p_source_route, p_client_request_id,
      pg_catalog.jsonb_build_object('sponsorship_agreement_id', v_agreement.id))
  on conflict (client_request_id, document_key) do nothing;
  if (select pg_catalog.count(*) from private.economic_consents as consent
      where consent.client_request_id = p_client_request_id
        and consent.user_id = p_actor_user_id
        and consent.order_id = (v_result ->> 'orderId')::uuid
        and consent.source_route = p_source_route
        and (
          (consent.document_key = 'sponsorship_no_control_agreement'
            and consent.document_version = p_agreement_version)
          or (consent.document_key = 'sponsorship_data_disclosure'
            and consent.document_version = p_disclosure_version)
        )) <> 2 then
    raise exception using errcode = '23505', message = 'sponsorship_consent_idempotency_conflict';
  end if;
  return v_result || pg_catalog.jsonb_build_object(
    'sponsorshipAgreementId', v_agreement.id,
    'organizationId', v_agreement.organization_id,
    'grantsAuthority', false
  );
end;
$$;

alter function public.prepare_sponsorship_checkout(uuid, uuid, uuid, text, text, text, text)
  owner to postgres;

create or replace function public.set_current_user_sponsorship_recognition_preference(
  p_actor_user_id uuid,
  p_sponsorship_agreement_id uuid,
  p_client_request_id uuid,
  p_opted_in boolean,
  p_source_route text,
  p_agreement_version text,
  p_disclosure_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement private.sponsorship_agreements%rowtype;
  v_action private.sponsorship_recognition_preference_actions%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_client_request_id is null
     or coalesce(p_source_route, '') !~ '^/[A-Za-z0-9/_?&=.%:-]*$'
     or pg_catalog.char_length(p_source_route) > 300 then
    raise exception using errcode = '22023', message = 'sponsorship_recognition_preference_input_invalid';
  end if;
  select * into v_action
  from private.sponsorship_recognition_preference_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.sponsorship_agreement_id <> p_sponsorship_agreement_id
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.opted_in <> coalesce(p_opted_in, false)
       or v_action.source_route <> p_source_route
       or v_action.agreement_version <> p_agreement_version
       or v_action.disclosure_version <> p_disclosure_version then
      raise exception using errcode = '23505', message = 'sponsorship_recognition_preference_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'sponsorshipAgreementId', v_action.sponsorship_agreement_id,
      'publicRecognitionOptIn', v_action.opted_in,
      'amountsPublic', false, 'grantsAuthority', false,
      'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_agreement
  from private.sponsorship_agreements
  where id = p_sponsorship_agreement_id
  for update;
  if not found
     or p_actor_user_id <> v_agreement.authorized_signer_user_id
     or v_agreement.agreement_version <> p_agreement_version
     or v_agreement.disclosure_version <> p_disclosure_version
     or not exists (
       select 1
       from private.economic_organization_memberships as membership
       join auth.users as account on account.id = membership.user_id
       where membership.organization_id = v_agreement.organization_id
         and membership.user_id = p_actor_user_id
         and membership.relationship = 'authorized_signer'
         and membership.revoked_at is null
         and account.deleted_at is null and account.is_anonymous is false
         and (account.banned_until is null or account.banned_until <= pg_catalog.now())
     )
     or (
       v_agreement.status not in ('contract_pending', 'active', 'completed')
       and (coalesce(p_opted_in, false) or not v_agreement.public_recognition_opt_in)
     ) then
    raise exception using errcode = '42501', message = 'sponsorship_recognition_preference_not_available';
  end if;
  if coalesce(p_opted_in, false) and (
    not exists (
      select 1 from private.economic_orders as paid_order
      where paid_order.id = v_agreement.order_id
        and paid_order.status in ('paid', 'partially_refunded')
    )
    or not exists (
      select 1
      from private.economic_consents as agreement_consent
      join private.economic_consents as disclosure_consent
        on disclosure_consent.client_request_id = agreement_consent.client_request_id
       and disclosure_consent.user_id = agreement_consent.user_id
      where agreement_consent.user_id = p_actor_user_id
        and agreement_consent.order_id = v_agreement.order_id
        and agreement_consent.document_key = 'sponsorship_no_control_agreement'
        and agreement_consent.document_version = v_agreement.agreement_version
        and disclosure_consent.order_id = v_agreement.order_id
        and disclosure_consent.document_key = 'sponsorship_data_disclosure'
        and disclosure_consent.document_version = v_agreement.disclosure_version
    )
  ) then
    raise exception using errcode = '55000', message = 'sponsorship_consent_required_before_recognition_opt_in';
  end if;
  insert into private.sponsorship_recognition_preference_actions(
    client_request_id, sponsorship_agreement_id, actor_user_id, opted_in,
    agreement_version, disclosure_version, source_route
  ) values (
    p_client_request_id, v_agreement.id, p_actor_user_id,
    coalesce(p_opted_in, false), p_agreement_version,
    p_disclosure_version, p_source_route
  );
  update private.sponsorship_agreements
  set public_recognition_opt_in = coalesce(p_opted_in, false),
      public_recognition_approved = case when coalesce(p_opted_in, false)
        then public_recognition_approved else false end,
      public_recognition_reviewed_by = case when coalesce(p_opted_in, false)
        then public_recognition_reviewed_by else null end,
      public_recognition_reviewed_at = case when coalesce(p_opted_in, false)
        then public_recognition_reviewed_at else null end,
      updated_at = pg_catalog.now()
  where id = v_agreement.id returning * into v_agreement;
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, metadata
  ) values (
    p_actor_user_id, 'user', 'sponsorship_public_recognition_preference_changed',
    'sponsorship_agreement', v_agreement.id,
    pg_catalog.jsonb_build_object(
      'opted_in', coalesce(p_opted_in, false),
      'amounts_public', false, 'grants_authority', false,
      'client_request_id', p_client_request_id
    )
  );
  return pg_catalog.jsonb_build_object(
    'sponsorshipAgreementId', v_agreement.id,
    'publicRecognitionOptIn', v_agreement.public_recognition_opt_in,
    'publicRecognitionApproved', v_agreement.public_recognition_approved,
    'amountsPublic', false, 'grantsAuthority', false,
    'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.set_current_user_sponsorship_recognition_preference(
  uuid, uuid, uuid, boolean, text, text, text
) owner to postgres;

create or replace function public.operator_configure_assistance_program(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_program_code text,
  p_assistance_kind text,
  p_scope text,
  p_public_label text,
  p_terms_version text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_grants integer,
  p_activate boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program private.economic_assistance_programs%rowtype;
  v_replay boolean := false;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_assistance_manage');
  if not private.economic_feature_enabled('economic_assistance_workflow') then
    raise exception using errcode = '55000', message = 'economic_assistance_workflow_disabled';
  end if;
  if p_client_request_id is null or coalesce(p_program_code, '') !~ '^[a-z][a-z0-9_]{2,100}$'
     or p_assistance_kind not in ('waiver', 'subsidy', 'sponsored_access')
     or p_scope not in ('job_post_fee', 'sandbox_credits')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_public_label, ''))) not between 2 and 120
     or pg_catalog.char_length(coalesce(p_terms_version, '')) not between 1 and 120
     or p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at)
     or (p_max_grants is not null and p_max_grants <= 0)
     or coalesce(p_activate, false)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_assistance_program_invalid';
  end if;
  select * into v_program from private.economic_assistance_programs where client_request_id = p_client_request_id;
  if found then
    v_replay := true;
    if v_program.program_code <> p_program_code or v_program.assistance_kind <> p_assistance_kind
       or v_program.scope <> p_scope
       or v_program.public_label <> pg_catalog.btrim(p_public_label)
       or v_program.terms_version <> p_terms_version
       or v_program.starts_at <> p_starts_at
       or v_program.ends_at is distinct from p_ends_at
       or v_program.max_grants is distinct from p_max_grants
       or v_program.status <> 'draft'
       or v_program.configured_by <> p_actor_user_id
       or v_program.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_assistance_program_idempotency_conflict';
    end if;
  else
    insert into private.economic_assistance_programs(
      client_request_id, program_code, assistance_kind, scope, status,
      public_label, terms_version, starts_at, ends_at, max_grants,
      configured_by, private_reason
    ) values (
      p_client_request_id, p_program_code, p_assistance_kind, p_scope,
      'draft',
      pg_catalog.btrim(p_public_label), p_terms_version, p_starts_at, p_ends_at,
      p_max_grants, p_actor_user_id, pg_catalog.btrim(p_reason)
    ) returning * into v_program;
    insert into private.economic_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
    ) values (
      p_actor_user_id, 'economic_operator', 'economic_assistance_program_configured',
      'economic_assistance_program', v_program.id, pg_catalog.btrim(p_reason),
      pg_catalog.jsonb_build_object('scope', v_program.scope, 'kind', v_program.assistance_kind)
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'programId', v_program.id, 'programCode', v_program.program_code,
    'kind', v_program.assistance_kind, 'scope', v_program.scope,
    'status', v_program.status, 'publicLabel', v_program.public_label,
    'testMode', true, 'idempotentReplay', v_replay
  );
end;
$$;

alter function public.operator_configure_assistance_program(
  uuid, uuid, text, text, text, text, text, timestamptz, timestamptz, integer, boolean, text
) owner to postgres;

create or replace function public.operator_set_economic_assistance_program_status(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_program_id uuid,
  p_target_status text,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program private.economic_assistance_programs%rowtype;
  v_action private.economic_assistance_program_actions%rowtype;
  v_expected_confirmation text;
begin
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'economic_assistance_manage'
  );
  v_expected_confirmation := case p_target_status
    when 'active' then 'ACTIVATE TEST ECONOMIC ASSISTANCE PROGRAM'
    when 'paused' then 'PAUSE TEST ECONOMIC ASSISTANCE PROGRAM'
    when 'retired' then 'RETIRE TEST ECONOMIC ASSISTANCE PROGRAM'
    else null
  end;
  if p_client_request_id is null or v_expected_confirmation is null
     or p_confirmation is distinct from v_expected_confirmation
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_assistance_program_status_input_invalid';
  end if;
  select * into v_action from private.economic_assistance_program_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.program_id <> p_program_id
       or v_action.target_status <> p_target_status
       or v_action.confirmation <> p_confirmation
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_assistance_program_status_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'programId', v_action.program_id, 'status', v_action.target_status,
      'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_program from private.economic_assistance_programs
  where id = p_program_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_assistance_program_not_found';
  end if;
  if v_program.status = p_target_status then
    raise exception using errcode = '55000', message = 'economic_assistance_program_already_in_status';
  end if;
  if p_target_status = 'active' then
    if v_program.status not in ('draft', 'paused')
       or not private.economic_feature_enabled('economic_assistance_workflow')
       or v_program.starts_at > pg_catalog.now()
       or (v_program.ends_at is not null and v_program.ends_at <= pg_catalog.now()) then
      raise exception using errcode = '55000', message = 'economic_assistance_program_activation_prerequisites_required';
    end if;
  elsif p_target_status = 'paused' and v_program.status <> 'active' then
    raise exception using errcode = '55000', message = 'economic_assistance_program_not_active';
  elsif p_target_status = 'retired' and v_program.status not in ('draft', 'active', 'paused') then
    raise exception using errcode = '55000', message = 'economic_assistance_program_not_retirable';
  end if;
  update private.economic_assistance_programs
  set status = p_target_status, updated_at = pg_catalog.now()
  where id = v_program.id returning * into v_program;
  insert into private.economic_assistance_program_actions(
    client_request_id, program_id, target_status, confirmation,
    actor_user_id, private_reason
  ) values (
    p_client_request_id, v_program.id, p_target_status, p_confirmation,
    p_actor_user_id, pg_catalog.btrim(p_reason)
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator',
    'economic_assistance_program_' || p_target_status,
    'economic_assistance_program', v_program.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'program_code', v_program.program_code, 'scope', v_program.scope,
      'status', v_program.status, 'test_mode', true
    )
  );
  return pg_catalog.jsonb_build_object(
    'programId', v_program.id, 'programCode', v_program.program_code,
    'status', v_program.status, 'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.operator_set_economic_assistance_program_status(
  uuid, uuid, uuid, text, text, text
) owner to postgres;

create or replace function private.sponsorship_net_settled_minor(p_agreement_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    economic_order.total_minor
      - coalesce((select pg_catalog.sum(refund.amount_minor)
          from private.economic_refunds as refund
          where refund.order_id = economic_order.id and refund.status = 'succeeded'), 0)
      - coalesce((select pg_catalog.sum(dispute.amount_minor)
          from private.economic_disputes as dispute
          where dispute.order_id = economic_order.id and dispute.status = 'lost'), 0),
    0::numeric
  )::bigint
  from private.sponsorship_agreements as agreement
  join private.economic_orders as economic_order on economic_order.id = agreement.order_id
  where agreement.id = p_agreement_id
    and economic_order.status in ('paid', 'partially_refunded')
$$;

alter function private.sponsorship_net_settled_minor(uuid) owner to postgres;
revoke all privileges on function private.sponsorship_net_settled_minor(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.sponsorship_committed_funding_minor(p_agreement_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.sum(case
    when allocation.status in ('active', 'exhausted') then allocation.allocation_cap
    else coalesce((select pg_catalog.sum(grant_record.allocation_consumption)
      from private.economic_assistance_grants as grant_record
      where grant_record.sponsorship_allocation_id = allocation.id), 0)
  end), 0)
  from private.sponsorship_assistance_allocations as allocation
  where allocation.sponsorship_agreement_id = p_agreement_id
    and allocation.allocation_kind = 'funding_minor'
$$;

alter function private.sponsorship_committed_funding_minor(uuid) owner to postgres;
revoke all privileges on function private.sponsorship_committed_funding_minor(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.operator_issue_economic_assistance_grant(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_program_code text,
  p_beneficiary_user_id uuid,
  p_resource_id uuid,
  p_units bigint,
  p_expires_at timestamptz,
  p_sponsorship_allocation_id uuid,
  p_allocation_consumption bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program private.economic_assistance_programs%rowtype;
  v_grant private.economic_assistance_grants%rowtype;
  v_count bigint;
  v_credit jsonb;
  v_replay boolean := false;
  v_effective_expiry timestamptz;
  v_allocation private.sponsorship_assistance_allocations%rowtype;
  v_consumed bigint;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_assistance_manage');
  if not private.economic_feature_enabled('economic_assistance_workflow') then
    raise exception using errcode = '55000', message = 'economic_assistance_workflow_disabled';
  end if;
  select * into v_program
  from private.economic_assistance_programs as program
  where program.program_code = p_program_code
    and program.status = 'active'
    and program.starts_at <= pg_catalog.now()
    and (program.ends_at is null or program.ends_at > pg_catalog.now())
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_assistance_program_not_active';
  end if;
  if not exists (
    select 1 from auth.users as account
    where account.id = p_beneficiary_user_id
      and account.deleted_at is null and account.is_anonymous is false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
  ) or p_client_request_id is null
     or (v_program.scope = 'sandbox_credits' and (p_units is null or p_units <= 0))
     or (v_program.scope <> 'sandbox_credits' and p_units is not null)
     or (p_expires_at is not null and p_expires_at <= pg_catalog.now())
     or (v_program.ends_at is not null and p_expires_at is not null and p_expires_at > v_program.ends_at)
     or ((p_sponsorship_allocation_id is null) <> (p_allocation_consumption is null))
     or (p_allocation_consumption is not null and p_allocation_consumption <= 0)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_assistance_grant_invalid';
  end if;
  select * into v_grant from private.economic_assistance_grants where client_request_id = p_client_request_id;
  v_effective_expiry := coalesce(p_expires_at, v_program.ends_at);
  if found then
    v_replay := true;
    if v_grant.program_id <> v_program.id or v_grant.beneficiary_user_id <> p_beneficiary_user_id
       or v_grant.resource_id is distinct from p_resource_id or v_grant.units is distinct from p_units
       or v_grant.expires_at is distinct from v_effective_expiry
       or v_grant.sponsorship_allocation_id is distinct from p_sponsorship_allocation_id
       or v_grant.allocation_consumption is distinct from p_allocation_consumption
       or v_grant.granted_by <> p_actor_user_id
       or v_grant.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_assistance_grant_idempotency_conflict';
    end if;
  else
    if p_sponsorship_allocation_id is not null then
      select * into v_allocation
      from private.sponsorship_assistance_allocations
      where id = p_sponsorship_allocation_id and status = 'active'
      for update;
      if not found or v_allocation.assistance_program_id <> v_program.id
         or v_allocation.scope <> v_program.scope
         or (v_allocation.allocation_kind = 'grant_count' and p_allocation_consumption <> 1)
         or (v_allocation.allocation_kind = 'sandbox_credit_units'
           and (v_program.scope <> 'sandbox_credits' or p_allocation_consumption <> p_units)) then
        raise exception using errcode = '42501', message = 'economic_assistance_sponsorship_allocation_invalid';
      end if;
      if not exists (
        select 1 from private.sponsorship_agreements as agreement
        join private.economic_orders as economic_order on economic_order.id = agreement.order_id
        where agreement.id = v_allocation.sponsorship_agreement_id
          and agreement.status = 'active'
          and economic_order.status in ('paid', 'partially_refunded')
      ) or (
        v_allocation.allocation_kind = 'funding_minor'
        and private.sponsorship_committed_funding_minor(v_allocation.sponsorship_agreement_id)
          > coalesce(private.sponsorship_net_settled_minor(v_allocation.sponsorship_agreement_id), 0)
      ) then
        raise exception using errcode = '55000', message = 'economic_assistance_sponsorship_requires_reconciliation';
      end if;
      select coalesce(pg_catalog.sum(existing.allocation_consumption), 0)
      into v_consumed
      from private.economic_assistance_grants as existing
      where existing.sponsorship_allocation_id = v_allocation.id
        and existing.status <> 'revoked';
      if v_consumed + p_allocation_consumption > v_allocation.allocation_cap then
        raise exception using errcode = '55000', message = 'economic_assistance_sponsorship_allocation_exhausted';
      end if;
    end if;
    if v_program.max_grants is not null then
      select pg_catalog.count(*) into v_count
      from private.economic_assistance_grants where program_id = v_program.id;
      if v_count >= v_program.max_grants then
        raise exception using errcode = '55000', message = 'economic_assistance_program_limit_reached';
      end if;
    end if;
    insert into private.economic_assistance_grants(
      client_request_id, program_id, beneficiary_user_id, scope, resource_id,
      units, granted_by, private_reason, expires_at,
      sponsorship_allocation_id, allocation_consumption
    ) values (
      p_client_request_id, v_program.id, p_beneficiary_user_id, v_program.scope,
      p_resource_id, p_units, p_actor_user_id, pg_catalog.btrim(p_reason),
      v_effective_expiry, p_sponsorship_allocation_id, p_allocation_consumption
    ) returning * into v_grant;
    if v_program.scope = 'sandbox_credits' then
      perform private.require_economic_operator_capability(p_actor_user_id, 'sandbox_credits_adjust');
      v_credit := public.operator_grant_sandbox_credit_units(
        p_actor_user_id, p_beneficiary_user_id, p_units,
        case when v_program.assistance_kind = 'sponsored_access' then 'sponsored' else 'waiver' end,
        'assistance-grant:' || v_grant.id::text, v_grant.expires_at,
        'assistance-grant:' || v_grant.id::text, pg_catalog.btrim(p_reason)
      );
      update private.economic_assistance_grants
      set status = 'consumed', consumed_at = pg_catalog.now(), consumed_resource_id = v_grant.id
      where id = v_grant.id
      returning * into v_grant;
    end if;
    if v_allocation.id is not null
       and v_consumed + p_allocation_consumption = v_allocation.allocation_cap then
      update private.sponsorship_assistance_allocations
      set status = 'exhausted', closed_at = pg_catalog.now()
      where id = v_allocation.id;
    end if;
    insert into private.economic_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
    ) values (
      p_actor_user_id, 'economic_operator', 'economic_assistance_grant_issued',
      'economic_assistance_grant', v_grant.id, pg_catalog.btrim(p_reason),
      pg_catalog.jsonb_build_object(
        'beneficiary_user_id', p_beneficiary_user_id,
        'scope', v_grant.scope,
        'kind', v_program.assistance_kind,
        'sponsorship_allocation_id', p_sponsorship_allocation_id,
        'public_recognition', false
      )
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'grantId', v_grant.id, 'scope', v_grant.scope, 'status', v_grant.status,
    'expiresAt', v_grant.expires_at, 'publiclyVisible', false,
    'sandboxCreditResult', v_credit, 'testMode', true,
    'idempotentReplay', v_replay
  );
end;
$$;

alter function public.operator_issue_economic_assistance_grant(
  uuid, uuid, text, uuid, uuid, bigint, timestamptz, uuid, bigint, text
) owner to postgres;

create or replace function public.operator_end_economic_assistance_grant(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_grant_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant private.economic_assistance_grants%rowtype;
  v_action private.economic_assistance_grant_actions%rowtype;
  v_lot private.sandbox_credit_lots%rowtype;
  v_remaining bigint := 0;
  v_target_status text;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_assistance_manage');
  if p_client_request_id is null or p_action not in ('revoke', 'expire')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_assistance_end_input_invalid';
  end if;
  select * into v_action from private.economic_assistance_grant_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.grant_id <> p_grant_id or v_action.action <> p_action
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_assistance_end_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'grantId', v_action.grant_id, 'status', case v_action.action when 'revoke' then 'revoked' else 'expired' end,
      'reversedUnits', v_action.reversed_units, 'publiclyVisible', false,
      'idempotentReplay', true
    );
  end if;
  select * into v_grant from private.economic_assistance_grants
  where id = p_grant_id for update;
  if not found or v_grant.status in ('revoked', 'expired') then
    raise exception using errcode = '55000', message = 'economic_assistance_grant_not_actionable';
  end if;
  if p_action = 'expire' and (v_grant.expires_at is null or v_grant.expires_at > pg_catalog.now()) then
    raise exception using errcode = '55000', message = 'economic_assistance_grant_not_expired';
  end if;
  if v_grant.scope = 'job_post_fee' and v_grant.consumed_at is not null then
    raise exception using errcode = '55000', message = 'economic_assistance_consumed_job_grant_requires_reconciliation';
  end if;
  if v_grant.scope = 'sandbox_credits' then
    perform private.require_economic_operator_capability(p_actor_user_id, 'sandbox_credits_adjust');
    select * into v_lot from private.sandbox_credit_lots as lot
    where lot.user_id = v_grant.beneficiary_user_id
      and lot.source_reference = 'assistance-grant:' || v_grant.id::text
    for update;
    if not found then
      raise exception using errcode = '55000', message = 'economic_assistance_sandbox_lot_missing';
    end if;
    if v_lot.reserved_units > 0 then
      raise exception using errcode = '55000', message = 'economic_assistance_sandbox_reservations_require_reconciliation';
    end if;
    v_remaining := v_lot.granted_units - v_lot.consumed_units
      - v_lot.reserved_units - v_lot.expired_units - v_lot.adjusted_units;
    if v_remaining > 0 then
      update private.sandbox_credit_lots
      set adjusted_units = adjusted_units + v_remaining
      where id = v_lot.id;
      insert into private.sandbox_credit_ledger_entries(
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category, idempotency_key
      ) values (
        v_grant.beneficiary_user_id, v_lot.id, 'compensating_debit',
        -v_remaining, -v_remaining, 0, v_lot.source_category,
        'assistance-end:' || p_client_request_id::text
      );
    end if;
  end if;
  v_target_status := case when p_action = 'revoke' then 'revoked' else 'expired' end;
  update private.economic_assistance_grants
  set status = v_target_status,
      revoked_at = case when p_action = 'revoke' then pg_catalog.now() else null end,
      revoked_by = case when p_action = 'revoke' then p_actor_user_id else null end
  where id = v_grant.id returning * into v_grant;
  insert into private.economic_assistance_grant_actions(
    client_request_id, grant_id, action, actor_user_id, reversed_units, private_reason
  ) values (
    p_client_request_id, v_grant.id, p_action, p_actor_user_id,
    v_remaining, pg_catalog.btrim(p_reason)
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'economic_assistance_grant_' || v_target_status,
    'economic_assistance_grant', v_grant.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'scope', v_grant.scope, 'reversed_units', v_remaining,
      'consumed_units_preserved', true, 'public_recognition', false
    )
  );
  return pg_catalog.jsonb_build_object(
    'grantId', v_grant.id, 'status', v_grant.status,
    'reversedUnits', v_remaining, 'publiclyVisible', false,
    'idempotentReplay', false
  );
end;
$$;

alter function public.operator_end_economic_assistance_grant(uuid, uuid, uuid, text, text)
  owner to postgres;

create or replace function public.operator_reconcile_job_post_assistance_grant(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_job_post_id uuid,
  p_grant_id uuid,
  p_end_action text,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant private.economic_assistance_grants%rowtype;
  v_action private.economic_assistance_grant_actions%rowtype;
  v_condition private.job_post_economic_conditions%rowtype;
  v_publication jsonb;
  v_target_status text;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'job_fee_assess');
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_assistance_manage');
  if p_client_request_id is null or p_end_action not in ('revoke', 'expire')
     or p_confirmation is distinct from 'RECONCILE AND END TEST JOB POST ASSISTANCE'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'job_post_assistance_reconciliation_input_invalid';
  end if;
  select * into v_action from private.economic_assistance_grant_actions
  where client_request_id = p_client_request_id;
  if found then
    select * into v_grant from private.economic_assistance_grants where id = v_action.grant_id;
    select * into v_condition from private.job_post_economic_conditions where job_post_id = p_job_post_id;
    if v_action.grant_id <> p_grant_id or v_action.action <> p_end_action
       or v_action.confirmation is distinct from p_confirmation
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason)
       or v_grant.consumed_resource_id is distinct from p_job_post_id then
      raise exception using errcode = '23505', message = 'job_post_assistance_reconciliation_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'jobPostId', p_job_post_id, 'grantId', p_grant_id,
      'grantStatus', v_grant.status,
      'economicStatus', coalesce(v_condition.condition_status, 'not_assessed'),
      'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_grant from private.economic_assistance_grants
  where id = p_grant_id for update;
  select * into v_condition from private.job_post_economic_conditions
  where job_post_id = p_job_post_id for update;
  if v_grant.id is null or v_condition.id is null
     or v_grant.scope <> 'job_post_fee' or v_grant.status <> 'consumed'
     or v_grant.consumed_resource_id <> p_job_post_id
     or not (
       (v_condition.classification = 'waived' and v_condition.waiver_id = v_grant.id)
       or (v_condition.classification = 'subsidized' and v_condition.subsidy_id = v_grant.id)
     ) then
    raise exception using errcode = '55000', message = 'job_post_assistance_reconciliation_not_actionable';
  end if;
  if p_end_action = 'expire'
     and (v_grant.expires_at is null or v_grant.expires_at > pg_catalog.now()) then
    raise exception using errcode = '55000', message = 'economic_assistance_grant_not_expired';
  end if;
  update private.job_post_economic_conditions
  set classification = 'not_assessed', condition_status = 'not_assessed',
      price_id = null, terms_version = null, order_id = null,
      waiver_id = null, subsidy_id = null, assessment_request_id = null,
      assessed_by = null, private_assessment_reason = null,
      assessed_at = null, satisfied_at = null, updated_at = pg_catalog.now()
  where id = v_condition.id returning * into v_condition;
  v_target_status := case when p_end_action = 'revoke' then 'revoked' else 'expired' end;
  update private.economic_assistance_grants
  set status = v_target_status,
      revoked_at = case when p_end_action = 'revoke' then pg_catalog.now() else null end,
      revoked_by = case when p_end_action = 'revoke' then p_actor_user_id else null end
  where id = v_grant.id returning * into v_grant;
  insert into private.economic_assistance_grant_actions(
    client_request_id, grant_id, action, confirmation,
    actor_user_id, reversed_units, private_reason
  ) values (
    p_client_request_id, v_grant.id, p_end_action, p_confirmation,
    p_actor_user_id, 0, pg_catalog.btrim(p_reason)
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'job_post_assistance_reconciled',
    'job_post_economic_condition', v_condition.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'job_post_id', p_job_post_id, 'grant_id', v_grant.id,
      'grant_status', v_grant.status,
      'replacement_economic_status', 'not_assessed',
      'content_approval_changed', false
    )
  );
  v_publication := private.publish_job_post_if_eligible(p_job_post_id);
  return pg_catalog.jsonb_build_object(
    'jobPostId', p_job_post_id, 'grantId', v_grant.id,
    'grantStatus', v_grant.status, 'economicStatus', v_condition.condition_status,
    'publicationStatus', v_publication ->> 'postStatus',
    'published', coalesce((v_publication ->> 'published')::boolean, false),
    'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.operator_reconcile_job_post_assistance_grant(
  uuid, uuid, uuid, uuid, text, text, text
) owner to postgres;

create or replace function public.operator_create_sponsorship_assistance_allocation(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_sponsorship_agreement_id uuid,
  p_assistance_program_id uuid,
  p_allocation_kind text,
  p_allocation_cap bigint,
  p_currency text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement private.sponsorship_agreements%rowtype;
  v_program private.economic_assistance_programs%rowtype;
  v_allocation private.sponsorship_assistance_allocations%rowtype;
  v_order private.economic_orders%rowtype;
  v_replay boolean := false;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'sponsorship_manage');
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_assistance_manage');
  if not private.economic_feature_enabled('sponsorship_review_workflow')
     or not private.economic_feature_enabled('economic_assistance_workflow') then
    raise exception using errcode = '55000', message = 'sponsorship_assistance_workflow_disabled';
  end if;
  if p_client_request_id is null
     or p_allocation_kind not in ('funding_minor', 'sandbox_credit_units', 'grant_count')
     or p_allocation_cap is null or p_allocation_cap <= 0
     or (p_allocation_kind = 'funding_minor' and lower(coalesce(p_currency, '')) !~ '^[a-z]{3}$')
     or (p_allocation_kind <> 'funding_minor' and p_currency is not null)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sponsorship_assistance_allocation_input_invalid';
  end if;
  select * into v_allocation
  from private.sponsorship_assistance_allocations
  where client_request_id = p_client_request_id;
  if found then
    v_replay := true;
    if v_allocation.sponsorship_agreement_id <> p_sponsorship_agreement_id
       or v_allocation.assistance_program_id <> p_assistance_program_id
       or v_allocation.allocation_kind <> p_allocation_kind
       or v_allocation.allocation_cap <> p_allocation_cap
       or v_allocation.currency is distinct from (case when p_currency is null then null else lower(p_currency) end)
       or v_allocation.configured_by <> p_actor_user_id
       or v_allocation.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'sponsorship_assistance_allocation_idempotency_conflict';
    end if;
  else
    select * into v_agreement
    from private.sponsorship_agreements
    where id = p_sponsorship_agreement_id and status in ('active', 'completed')
    for update;
    if not found or v_agreement.order_id is null
       or not (v_agreement.no_governance_control and v_agreement.no_moderation_control
         and v_agreement.no_editorial_control and v_agreement.no_user_tracking
         and v_agreement.no_search_prominence and v_agreement.no_endorsement_claim) then
      raise exception using errcode = '55000', message = 'sponsorship_assistance_agreement_not_eligible';
    end if;
    select * into v_order from private.economic_orders
    where id = v_agreement.order_id and status in ('paid', 'partially_refunded')
    for update;
    if not found then
      raise exception using errcode = '55000', message = 'sponsorship_assistance_payment_required';
    end if;
    select * into v_program
    from private.economic_assistance_programs
    where id = p_assistance_program_id and status = 'active'
      and assistance_kind = 'sponsored_access'
      and starts_at <= pg_catalog.now()
      and (ends_at is null or ends_at > pg_catalog.now())
    for update;
    if not found
       or (p_allocation_kind = 'sandbox_credit_units' and v_program.scope <> 'sandbox_credits')
       or (p_allocation_kind = 'funding_minor' and lower(p_currency) <> v_order.currency)
       or (p_allocation_kind = 'funding_minor'
         and private.sponsorship_committed_funding_minor(v_agreement.id) + p_allocation_cap
           > coalesce(private.sponsorship_net_settled_minor(v_agreement.id), 0)) then
      raise exception using errcode = '55000', message = 'sponsorship_assistance_allocation_not_eligible';
    end if;
    insert into private.sponsorship_assistance_allocations(
      client_request_id, sponsorship_agreement_id, assistance_program_id,
      scope, allocation_kind, allocation_cap, currency,
      configured_by, private_reason
    ) values (
      p_client_request_id, v_agreement.id, v_program.id, v_program.scope,
      p_allocation_kind, p_allocation_cap,
      case when p_currency is null then null else lower(p_currency) end,
      p_actor_user_id, pg_catalog.btrim(p_reason)
    ) returning * into v_allocation;
    insert into private.economic_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
    ) values (
      p_actor_user_id, 'economic_operator', 'sponsorship_assistance_allocation_created',
      'sponsorship_assistance_allocation', v_allocation.id,
      pg_catalog.btrim(p_reason),
      pg_catalog.jsonb_build_object(
        'sponsorship_agreement_id', v_agreement.id,
        'assistance_program_id', v_program.id,
        'scope', v_program.scope,
        'allocation_kind', p_allocation_kind,
        'sponsor_selects_recipients', false,
        'sponsor_receives_recipient_data', false
      )
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'allocationId', v_allocation.id,
    'sponsorshipAgreementId', v_allocation.sponsorship_agreement_id,
    'assistanceProgramId', v_allocation.assistance_program_id,
    'scope', v_allocation.scope, 'allocationKind', v_allocation.allocation_kind,
    'allocationCap', v_allocation.allocation_cap, 'currency', v_allocation.currency,
    'sponsorSelectsRecipients', false,
    'sponsorReceivesRecipientData', false,
    'grantsAuthority', false, 'testMode', true,
    'idempotentReplay', v_replay
  );
end;
$$;

alter function public.operator_create_sponsorship_assistance_allocation(
  uuid, uuid, uuid, uuid, text, bigint, text, text
) owner to postgres;

create or replace function public.operator_close_sponsorship_assistance_allocation(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_allocation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allocation private.sponsorship_assistance_allocations%rowtype;
  v_action private.sponsorship_assistance_allocation_actions%rowtype;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'sponsorship_manage');
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_assistance_manage');
  if p_client_request_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sponsorship_assistance_allocation_close_input_invalid';
  end if;
  select * into v_action
  from private.sponsorship_assistance_allocation_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.allocation_id <> p_allocation_id
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'sponsorship_assistance_allocation_close_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'allocationId', v_action.allocation_id, 'status', 'canceled',
      'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_allocation
  from private.sponsorship_assistance_allocations
  where id = p_allocation_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'sponsorship_assistance_allocation_not_found';
  end if;
  if v_allocation.status <> 'active' then
    raise exception using errcode = '55000', message = 'sponsorship_assistance_allocation_not_active';
  end if;
  update private.sponsorship_assistance_allocations
  set status = 'canceled', closed_at = pg_catalog.now()
  where id = v_allocation.id returning * into v_allocation;
  insert into private.sponsorship_assistance_allocation_actions(
    client_request_id, allocation_id, action, actor_user_id, private_reason
  ) values (
    p_client_request_id, v_allocation.id, 'cancel',
    p_actor_user_id, pg_catalog.btrim(p_reason)
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'sponsorship_assistance_allocation_canceled',
    'sponsorship_assistance_allocation', v_allocation.id,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'sponsor_selects_recipients', false,
      'sponsor_receives_recipient_data', false
    )
  );
  return pg_catalog.jsonb_build_object(
    'allocationId', v_allocation.id, 'status', v_allocation.status,
    'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.operator_close_sponsorship_assistance_allocation(
  uuid, uuid, uuid, text
) owner to postgres;

-- Replace the assessment RPC so Job Post waiver/subsidy references must be an
-- active, matching, single-use assistance grant for the post's actual author.
create or replace function public.operator_assess_job_post_fee(
  p_actor_user_id uuid,
  p_job_post_id uuid,
  p_classification text,
  p_price_code text,
  p_waiver_id uuid,
  p_subsidy_id uuid,
  p_client_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_condition private.job_post_economic_conditions%rowtype;
  v_price private.economic_prices%rowtype;
  v_grant private.economic_assistance_grants%rowtype;
  v_program private.economic_assistance_programs%rowtype;
  v_assistance_id uuid;
  v_expected_kind text;
  v_publication jsonb;
  v_terms_version text;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'job_fee_assess');
  if p_client_request_id is null
     or p_classification not in ('community_free', 'commercial', 'waived', 'subsidized')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000
     or (p_classification = 'waived') <> (p_waiver_id is not null)
     or (p_classification = 'subsidized') <> (p_subsidy_id is not null)
     or (p_classification not in ('waived', 'subsidized') and (p_waiver_id is not null or p_subsidy_id is not null)) then
    raise exception using errcode = '22023', message = 'job_post_fee_assessment_invalid';
  end if;
  select * into v_condition
  from private.ensure_job_post_economic_condition(p_job_post_id);
  if v_condition.assessment_request_id = p_client_request_id then
    if v_condition.classification <> p_classification
       or v_condition.waiver_id is distinct from p_waiver_id
       or v_condition.subsidy_id is distinct from p_subsidy_id
       or v_condition.private_assessment_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'job_post_fee_assessment_idempotency_conflict';
    end if;
    if p_classification = 'commercial' then
      select * into v_price from private.economic_prices as price
      where price.price_code = p_price_code and price.product_key = 'job_post_fee'
        and price.active = true and price.test_mode_only = true and price.retired_at is null;
      if not found or v_condition.price_id is distinct from v_price.id then
        raise exception using errcode = '23505', message = 'job_post_fee_assessment_idempotency_conflict';
      end if;
      select disclosure.disclosure_version into v_terms_version
      from private.economic_price_disclosures as disclosure
      where disclosure.price_id = v_price.id;
      if not found or v_condition.terms_version is distinct from v_terms_version then
        raise exception using errcode = '23505', message = 'job_post_fee_assessment_idempotency_conflict';
      end if;
    elsif p_price_code is not null or v_condition.price_id is not null then
      raise exception using errcode = '23505', message = 'job_post_fee_assessment_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'jobPostId', v_condition.job_post_id, 'classification', v_condition.classification,
      'economicStatus', v_condition.condition_status,
      'termsVersion', v_condition.terms_version,
      'idempotentReplay', true
    );
  end if;
  if v_condition.waiver_id is not null or v_condition.subsidy_id is not null then
    raise exception using errcode = '55000', message = 'job_post_assistance_consumption_requires_reconciliation';
  end if;
  if p_classification = 'commercial' then
    select * into v_price from private.economic_prices as price
    where price.price_code = p_price_code and price.product_key = 'job_post_fee'
      and price.active = true and price.test_mode_only = true and price.retired_at is null;
    if not found then
      raise exception using errcode = 'P0002', message = 'job_post_test_price_not_configured';
    end if;
    select disclosure.disclosure_version into v_terms_version
    from private.economic_price_disclosures as disclosure
    where disclosure.price_id = v_price.id;
    if not found then
      raise exception using errcode = 'P0002', message = 'job_post_fee_terms_not_configured';
    end if;
  elsif p_price_code is not null then
    raise exception using errcode = '22023', message = 'job_post_fee_price_not_allowed';
  end if;
  if v_condition.order_id is not null and (
    p_classification <> 'commercial' or v_condition.price_id is distinct from v_price.id
  ) then
    raise exception using errcode = '55000', message = 'job_post_fee_attached_order_requires_reconciliation';
  end if;
  if p_classification in ('waived', 'subsidized') then
    perform private.require_economic_operator_capability(p_actor_user_id, 'economic_assistance_manage');
    if not private.economic_feature_enabled('economic_assistance_workflow') then
      raise exception using errcode = '55000', message = 'economic_assistance_workflow_disabled';
    end if;
    v_assistance_id := case when p_classification = 'waived' then p_waiver_id else p_subsidy_id end;
    v_expected_kind := case when p_classification = 'waived' then 'waiver' else 'subsidy' end;
    select * into v_grant
    from private.economic_assistance_grants as grant_record
    where grant_record.id = v_assistance_id
    for update of grant_record;
    if found then
      select * into v_program
      from private.economic_assistance_programs as program
      where program.id = v_grant.program_id;
    end if;
    if v_grant.id is null or v_program.id is null or v_grant.status <> 'granted'
       or v_grant.beneficiary_user_id <> v_condition.author_user_id
       or v_grant.scope <> 'job_post_fee' or v_program.scope <> 'job_post_fee'
       or v_program.assistance_kind <> v_expected_kind or v_program.status <> 'active'
       or v_program.starts_at > pg_catalog.now()
       or (v_program.ends_at is not null and v_program.ends_at <= pg_catalog.now())
       or (v_grant.expires_at is not null and v_grant.expires_at <= pg_catalog.now())
       or (v_grant.resource_id is not null and v_grant.resource_id <> p_job_post_id) then
      raise exception using errcode = '42501', message = 'job_post_assistance_grant_not_eligible';
    end if;
  end if;
  update private.job_post_economic_conditions
  set classification = p_classification,
      condition_status = case p_classification when 'community_free' then 'not_required'
        when 'commercial' then 'payment_required' when 'waived' then 'waived' else 'subsidized' end,
      price_id = case when p_classification = 'commercial' then v_price.id else null end,
      terms_version = case when p_classification = 'commercial' then v_terms_version else null end,
      order_id = case when p_classification = 'commercial' then order_id else null end,
      waiver_id = case when p_classification = 'waived' then p_waiver_id else null end,
      subsidy_id = case when p_classification = 'subsidized' then p_subsidy_id else null end,
      assessment_request_id = p_client_request_id, assessed_by = p_actor_user_id,
      private_assessment_reason = pg_catalog.btrim(p_reason), assessed_at = pg_catalog.now(),
      satisfied_at = case when p_classification in ('community_free', 'waived', 'subsidized') then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where id = v_condition.id returning * into v_condition;
  if v_assistance_id is not null then
    update private.economic_assistance_grants
    set status = 'consumed', consumed_at = pg_catalog.now(), consumed_resource_id = p_job_post_id
    where id = v_assistance_id and status = 'granted';
    if not found then
      raise exception using errcode = '55000', message = 'job_post_assistance_grant_already_consumed';
    end if;
  end if;
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'job_post_fee_assessed',
    'job_post_economic_condition', v_condition.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'job_post_id', p_job_post_id, 'classification', p_classification,
      'condition_status', v_condition.condition_status,
      'assistance_grant_id', v_assistance_id,
      'payment_does_not_approve_content', true
    )
  );
  v_publication := private.publish_job_post_if_eligible(p_job_post_id);
  return pg_catalog.jsonb_build_object(
    'jobPostId', p_job_post_id, 'classification', v_condition.classification,
    'economicStatus', v_condition.condition_status,
    'termsVersion', v_condition.terms_version,
    'publicationStatus', v_publication ->> 'postStatus',
    'published', coalesce((v_publication ->> 'published')::boolean, false),
    'idempotentReplay', false
  );
end;
$$;

alter function public.operator_assess_job_post_fee(uuid, uuid, text, text, uuid, uuid, uuid, text)
  owner to postgres;

create or replace function public.current_user_economic_organization_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;
  return pg_catalog.jsonb_build_object(
    'organizations', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'organizationId', organization.id,
        'accountName', organization.account_name,
        'status', organization.status,
        'relationships', coalesce((
          select pg_catalog.jsonb_agg(membership.relationship order by membership.relationship)
          from private.economic_organization_memberships as membership
          where membership.organization_id = organization.id
            and membership.user_id = v_actor and membership.revoked_at is null
        ), '[]'::jsonb),
        'engagements', coalesce((
          select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'engagementId', engagement.id,
            'status', engagement.status,
            'serviceCode', engagement.service_code,
            'statementOfWorkVersion', engagement.statement_of_work_version,
            'serviceTermsVersion', engagement.service_terms_version,
            'dataHandlingDisclosureVersion', engagement.data_handling_disclosure_version,
            'amountMinor', price.unit_amount_minor,
            'currency', price.currency,
            'checkoutAvailable', engagement.status = 'contract_pending'
              and engagement.order_id is null
              and organization.status = 'active'
              and price.product_key = 'organization_service'
              and price.active = true and price.test_mode_only = true
              and price.retired_at is null
              and private.economic_feature_enabled('organization_contract_workflow')
              and private.economic_feature_enabled('organization_billing')
              and private.economic_feature_enabled('economic_webhooks')
          ) order by engagement.created_at desc), '[]'::jsonb)
          from private.organization_service_engagements as engagement
          join private.economic_prices as price on price.id = engagement.price_id
          where engagement.organization_id = organization.id
            and engagement.authorized_signer_user_id = v_actor
            and price.unit_amount_minor is not null
            and exists (
              select 1
              from private.economic_organization_memberships as access_membership
              join auth.users as account on account.id = access_membership.user_id
              where access_membership.organization_id = organization.id
                and access_membership.user_id = v_actor
                and access_membership.relationship = 'authorized_signer'
                and access_membership.revoked_at is null
                and account.deleted_at is null and account.is_anonymous is false
                and (account.banned_until is null or account.banned_until <= pg_catalog.now())
            )
        ), '[]'::jsonb),
        'sponsorshipAgreements', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'agreementId', agreement.id,
            'status', agreement.status,
            'agreementVersion', agreement.agreement_version,
            'disclosureVersion', agreement.disclosure_version,
            'amountMinor', price.unit_amount_minor,
            'currency', price.currency,
            'publicRecognitionOptIn', agreement.public_recognition_opt_in,
            'publicRecognitionApproved', agreement.public_recognition_approved,
            'checkoutAvailable', agreement.status = 'contract_pending'
              and agreement.order_id is null
              and organization.status = 'active'
              and price.product_key = 'sponsorship'
              and price.active = true and price.test_mode_only = true
              and price.retired_at is null
              and private.economic_feature_enabled('sponsorship_checkout')
              and private.economic_feature_enabled('sponsorship_review_workflow')
              and private.economic_feature_enabled('economic_webhooks'),
            'recognitionPreferenceAvailable', agreement.public_recognition_opt_in
              or (
                agreement.status in ('contract_pending', 'active', 'completed')
                and exists (
                  select 1 from private.economic_orders as paid_order
                  where paid_order.id = agreement.order_id
                    and paid_order.status in ('paid', 'partially_refunded')
                )
                and exists (
                  select 1
                  from private.economic_consents as agreement_consent
                  join private.economic_consents as disclosure_consent
                    on disclosure_consent.client_request_id = agreement_consent.client_request_id
                   and disclosure_consent.user_id = agreement_consent.user_id
                  where agreement_consent.user_id = v_actor
                    and agreement_consent.order_id = agreement.order_id
                    and agreement_consent.document_key = 'sponsorship_no_control_agreement'
                    and agreement_consent.document_version = agreement.agreement_version
                    and disclosure_consent.order_id = agreement.order_id
                    and disclosure_consent.document_key = 'sponsorship_data_disclosure'
                    and disclosure_consent.document_version = agreement.disclosure_version
                )
              )
          ) order by agreement.created_at desc)
          from private.sponsorship_agreements as agreement
          join private.economic_prices as price on price.id = agreement.price_id
          where agreement.organization_id = organization.id
            and agreement.authorized_signer_user_id = v_actor
            and price.unit_amount_minor is not null
            and exists (
              select 1
              from private.economic_organization_memberships as access_membership
              join auth.users as account on account.id = access_membership.user_id
              where access_membership.organization_id = organization.id
                and access_membership.user_id = v_actor
                and access_membership.relationship = 'authorized_signer'
                and access_membership.revoked_at is null
                and account.deleted_at is null and account.is_anonymous is false
                and (account.banned_until is null or account.banned_until <= pg_catalog.now())
            )
        ), '[]'::jsonb)
      ) order by organization.account_name)
      from private.economic_organizations as organization
      where exists (
        select 1 from private.economic_organization_memberships as membership
        where membership.organization_id = organization.id
          and membership.user_id = v_actor and membership.revoked_at is null
      )
    ), '[]'::jsonb),
    'financialDetailsPrivate', true,
    'affectsCommonsIdentity', false,
    'testMode', true
  );
end;
$$;

alter function public.current_user_economic_organization_status() owner to postgres;

create or replace function private.open_organization_sponsorship_settlement_hold(
  p_order_id uuid,
  p_organization_service_engagement_id uuid,
  p_sponsorship_agreement_id uuid,
  p_reason_code text,
  p_target_status text,
  p_resolution_target_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_hold private.organization_sponsorship_settlement_holds%rowtype;
  v_verified_paid_minor bigint := 0;
  v_verified_refunded_minor bigint := 0;
  v_event_type text;
  v_target_kind text;
begin
  if (p_organization_service_engagement_id is not null)
       = (p_sponsorship_agreement_id is not null)
     or p_reason_code not in (
       'late_settlement_after_terminal_state',
       'late_settlement_after_checkout_ineligibility',
       'terminal_state_after_settlement'
     ) then
    raise exception using errcode = '22023', message = 'organization_sponsorship_settlement_hold_input_invalid';
  end if;

  select * into v_order
  from private.economic_orders as economic_order
  where economic_order.id = p_order_id;
  if not found
     or (p_organization_service_engagement_id is not null
       and (v_order.flow <> 'organization_service' or p_resolution_target_status <> 'canceled'))
     or (p_sponsorship_agreement_id is not null
       and (v_order.flow <> 'sponsorship' or p_resolution_target_status not in ('rejected', 'canceled'))) then
    raise exception using errcode = '22023', message = 'organization_sponsorship_settlement_hold_order_invalid';
  end if;

  select coalesce(pg_catalog.sum(payment.gross_amount_minor), 0)
  into v_verified_paid_minor
  from private.economic_payment_transactions as payment
  where payment.order_id = p_order_id
    and payment.transaction_type = 'payment'
    and payment.status in ('succeeded', 'refunded', 'disputed');
  select coalesce(pg_catalog.sum(refund.amount_minor), 0)
  into v_verified_refunded_minor
  from private.economic_refunds as refund
  where refund.order_id = p_order_id and refund.status = 'succeeded';

  if v_order.status = 'refunded'
     and v_verified_paid_minor > 0
     and v_verified_refunded_minor >= v_verified_paid_minor then
    return null;
  end if;

  select * into v_hold
  from private.organization_sponsorship_settlement_holds as settlement_hold
  where settlement_hold.order_id = p_order_id
  for update;
  if found then
    if v_hold.organization_service_engagement_id is distinct from p_organization_service_engagement_id
       or v_hold.sponsorship_agreement_id is distinct from p_sponsorship_agreement_id
       or v_hold.resolution_target_status <> p_resolution_target_status then
      raise exception using errcode = '23505', message = 'organization_sponsorship_settlement_hold_conflict';
    end if;
    if v_hold.status = 'resolved_full_refund' then
      v_event_type := 'reopened';
      update private.organization_sponsorship_settlement_holds
      set status = 'open', resolved_at = null,
          verified_paid_minor = v_verified_paid_minor,
          verified_refunded_minor = v_verified_refunded_minor,
          last_order_status = v_order.status,
          updated_at = pg_catalog.now()
      where id = v_hold.id returning * into v_hold;
    else
      update private.organization_sponsorship_settlement_holds
      set verified_paid_minor = v_verified_paid_minor,
          verified_refunded_minor = v_verified_refunded_minor,
          last_order_status = v_order.status,
          updated_at = pg_catalog.now()
      where id = v_hold.id returning * into v_hold;
    end if;
  else
    v_event_type := 'opened';
    insert into private.organization_sponsorship_settlement_holds(
      order_id, organization_service_engagement_id, sponsorship_agreement_id,
      reason_code, target_status_at_hold, resolution_target_status,
      order_total_minor, verified_paid_minor, verified_refunded_minor,
      last_order_status
    ) values (
      p_order_id, p_organization_service_engagement_id, p_sponsorship_agreement_id,
      p_reason_code, p_target_status, p_resolution_target_status,
      v_order.total_minor, v_verified_paid_minor, v_verified_refunded_minor,
      v_order.status
    ) returning * into v_hold;
  end if;

  if v_event_type is not null then
    v_target_kind := case when p_organization_service_engagement_id is not null
      then 'organization_service_engagement' else 'sponsorship_agreement' end;
    insert into private.organization_sponsorship_settlement_hold_events(
      hold_id, event_type, order_status, verified_paid_minor,
      verified_refunded_minor, metadata
    ) values (
      v_hold.id, v_event_type, v_order.status, v_verified_paid_minor,
      v_verified_refunded_minor,
      pg_catalog.jsonb_build_object(
        'reason_code', p_reason_code,
        'target_kind', v_target_kind,
        'target_id', coalesce(
          p_organization_service_engagement_id, p_sponsorship_agreement_id
        ),
        'target_status_at_hold', p_target_status,
        'resolution_target_status', p_resolution_target_status,
        'full_verified_refund_required', true,
        'community_identity_affected', false,
        'governance_affected', false
      )
    );
    insert into private.economic_audit_events(
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'system', 'organization_sponsorship_settlement_hold_' || v_event_type,
      'organization_sponsorship_settlement_hold', v_hold.id,
      pg_catalog.jsonb_build_object(
        'order_id', p_order_id, 'order_status', v_order.status,
        'target_kind', v_target_kind,
        'target_id', coalesce(
          p_organization_service_engagement_id, p_sponsorship_agreement_id
        ),
        'full_verified_refund_required', true,
        'community_identity_affected', false,
        'governance_affected', false
      )
    );
  end if;
  return v_hold.id;
end;
$$;

alter function private.open_organization_sponsorship_settlement_hold(
  uuid, uuid, uuid, text, text, text
) owner to postgres;
revoke all privileges on function private.open_organization_sponsorship_settlement_hold(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;

create or replace function private.resolve_organization_sponsorship_settlement_hold(
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_hold private.organization_sponsorship_settlement_holds%rowtype;
  v_verified_paid_minor bigint := 0;
  v_verified_refunded_minor bigint := 0;
begin
  select * into v_order
  from private.economic_orders as economic_order
  where economic_order.id = p_order_id
  for share;
  select * into v_hold
  from private.organization_sponsorship_settlement_holds as settlement_hold
  where settlement_hold.order_id = p_order_id and settlement_hold.status = 'open';
  if not found then
    return false;
  end if;

  -- Terminal-state quarantine already owns the target row before it opens the
  -- hold. Use that same order -> target -> hold sequence here so a simultaneous
  -- provider refund and operator terminal action cannot form a lock cycle.
  if v_hold.organization_service_engagement_id is not null then
    perform 1
    from private.organization_service_engagements as engagement
    where engagement.id = v_hold.organization_service_engagement_id
    for update;
  else
    perform 1
    from private.sponsorship_agreements as agreement
    where agreement.id = v_hold.sponsorship_agreement_id
    for update;
  end if;
  select * into v_hold
  from private.organization_sponsorship_settlement_holds as settlement_hold
  where settlement_hold.order_id = p_order_id and settlement_hold.status = 'open'
  for update;
  if not found then
    return false;
  end if;

  select coalesce(pg_catalog.sum(payment.gross_amount_minor), 0)
  into v_verified_paid_minor
  from private.economic_payment_transactions as payment
  where payment.order_id = p_order_id
    and payment.transaction_type = 'payment'
    and payment.status in ('succeeded', 'refunded', 'disputed');
  select coalesce(pg_catalog.sum(refund.amount_minor), 0)
  into v_verified_refunded_minor
  from private.economic_refunds as refund
  where refund.order_id = p_order_id and refund.status = 'succeeded';

  update private.organization_sponsorship_settlement_holds
  set verified_paid_minor = v_verified_paid_minor,
      verified_refunded_minor = v_verified_refunded_minor,
      last_order_status = v_order.status,
      updated_at = pg_catalog.now()
  where id = v_hold.id;
  if v_order.status <> 'refunded'
     or v_verified_paid_minor <= 0
     or v_verified_refunded_minor < v_verified_paid_minor then
    return false;
  end if;

  update private.organization_sponsorship_settlement_holds
  set status = 'resolved_full_refund', resolved_at = pg_catalog.now(),
      verified_paid_minor = v_verified_paid_minor,
      verified_refunded_minor = v_verified_refunded_minor,
      last_order_status = v_order.status,
      updated_at = pg_catalog.now()
  where id = v_hold.id returning * into v_hold;

  if v_hold.organization_service_engagement_id is not null then
    update private.organization_service_engagements
    set status = 'canceled', entitlement_state = 'ended',
        support_agreement_state = 'terminated', updated_at = pg_catalog.now()
    where id = v_hold.organization_service_engagement_id;
  else
    update private.sponsorship_agreements
    set status = v_hold.resolution_target_status,
        public_recognition_approved = false,
        public_recognition_reviewed_by = null,
        public_recognition_reviewed_at = null,
        updated_at = pg_catalog.now()
    where id = v_hold.sponsorship_agreement_id;
  end if;

  insert into private.organization_sponsorship_settlement_hold_events(
    hold_id, event_type, order_status, verified_paid_minor,
    verified_refunded_minor, metadata
  ) values (
    v_hold.id, 'full_refund_verified', v_order.status,
    v_verified_paid_minor, v_verified_refunded_minor,
    pg_catalog.jsonb_build_object(
      'resolution_target_status', v_hold.resolution_target_status,
      'verified_refund_complete', true,
      'community_identity_affected', false,
      'governance_affected', false
    )
  );
  insert into private.economic_audit_events(
    actor_kind, action, target_type, target_id, metadata
  ) values (
    'provider_webhook', 'organization_sponsorship_settlement_hold_full_refund_verified',
    'organization_sponsorship_settlement_hold', v_hold.id,
    pg_catalog.jsonb_build_object(
      'order_id', p_order_id,
      'verified_paid_minor', v_verified_paid_minor,
      'verified_refunded_minor', v_verified_refunded_minor,
      'resolution_target_status', v_hold.resolution_target_status,
      'community_identity_affected', false,
      'governance_affected', false
    )
  );
  return true;
end;
$$;

alter function private.resolve_organization_sponsorship_settlement_hold(uuid)
  owner to postgres;
revoke all privileges on function private.resolve_organization_sponsorship_settlement_hold(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.quarantine_terminal_organization_sponsorship_settlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_hold_id uuid;
begin
  if new.status is not distinct from old.status or new.order_id is null then
    return new;
  end if;
  if tg_table_name = 'organization_service_engagements' and new.status <> 'canceled' then
    return new;
  elsif tg_table_name = 'sponsorship_agreements'
        and new.status not in ('rejected', 'canceled') then
    return new;
  end if;

  select * into v_order
  from private.economic_orders as economic_order
  where economic_order.id = new.order_id;
  if not found or v_order.status not in ('paid', 'partially_refunded', 'disputed', 'refunded') then
    return new;
  end if;

  if tg_table_name = 'organization_service_engagements' then
    v_hold_id := private.open_organization_sponsorship_settlement_hold(
      new.order_id, new.id, null, 'terminal_state_after_settlement',
      new.status, 'canceled'
    );
    if v_hold_id is not null then
      new.status := 'reconciliation_required';
      new.entitlement_state := 'suspended';
      new.support_agreement_state := 'suspended';
    end if;
  else
    v_hold_id := private.open_organization_sponsorship_settlement_hold(
      new.order_id, null, new.id, 'terminal_state_after_settlement',
      new.status, new.status
    );
    if v_hold_id is not null then
      new.status := 'reconciliation_required';
      new.public_recognition_approved := false;
      new.public_recognition_reviewed_by := null;
      new.public_recognition_reviewed_at := null;
    end if;
  end if;
  return new;
end;
$$;

alter function private.quarantine_terminal_organization_sponsorship_settlement()
  owner to postgres;
revoke all privileges on function private.quarantine_terminal_organization_sponsorship_settlement()
  from public, anon, authenticated, service_role;

create trigger quarantine_terminal_organization_service_settlement
before update of status on private.organization_service_engagements
for each row execute function private.quarantine_terminal_organization_sponsorship_settlement();
create trigger quarantine_terminal_sponsorship_settlement
before update of status on private.sponsorship_agreements
for each row execute function private.quarantine_terminal_organization_sponsorship_settlement();

create or replace function private.reconcile_organization_sponsorship_hold_from_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Normal provider processing records the durable refund before it advances the
  -- order to refunded, and the order trigger resolves the hold. This second edge
  -- also covers safe replay/reconciliation when the order was already refunded:
  -- a row marked succeeded still cannot resolve anything unless the resolver can
  -- verify complete durable coverage across all payments for that order.
  if new.status = 'succeeded'
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    perform private.resolve_organization_sponsorship_settlement_hold(new.order_id);
  end if;
  return new;
end;
$$;

alter function private.reconcile_organization_sponsorship_hold_from_refund()
  owner to postgres;
revoke all privileges on function private.reconcile_organization_sponsorship_hold_from_refund()
  from public, anon, authenticated, service_role;
create trigger reconcile_organization_sponsorship_hold_from_refund
after insert or update of status on private.economic_refunds
for each row execute function private.reconcile_organization_sponsorship_hold_from_refund();

create or replace function private.reconcile_organization_and_sponsorship_order_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement_id uuid;
  v_sponsorship_id uuid;
  v_engagement private.organization_service_engagements%rowtype;
  v_agreement private.sponsorship_agreements%rowtype;
  v_hold_id uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'refunded' then
    perform private.resolve_organization_sponsorship_settlement_hold(new.id);
  end if;

  if old.status in (
       'pending', 'checkout_created', 'processing', 'failed', 'canceled', 'refunded'
     )
     and new.status in ('paid', 'partially_refunded', 'disputed', 'refunded') then
    select * into v_engagement
    from private.organization_service_engagements as engagement
    where engagement.order_id = new.id
    for update;
    if found and not private.organization_service_checkout_is_eligible(
      v_engagement.id, v_engagement.authorized_signer_user_id, new.id
    ) then
      v_hold_id := private.open_organization_sponsorship_settlement_hold(
        new.id, v_engagement.id, null,
        case when v_engagement.status = 'canceled'
          then 'late_settlement_after_terminal_state'
          else 'late_settlement_after_checkout_ineligibility' end,
        v_engagement.status, 'canceled'
      );
      if v_hold_id is not null then
        update private.organization_service_engagements
        set status = 'reconciliation_required',
            entitlement_state = 'suspended',
            support_agreement_state = 'suspended',
            updated_at = pg_catalog.now()
        where id = v_engagement.id;
      end if;
    end if;

    select * into v_agreement
    from private.sponsorship_agreements as agreement
    where agreement.order_id = new.id
    for update;
    if found and not private.sponsorship_checkout_is_eligible(
      v_agreement.id, v_agreement.authorized_signer_user_id, new.id
    ) then
      v_hold_id := private.open_organization_sponsorship_settlement_hold(
        new.id, null, v_agreement.id,
        case when v_agreement.status in ('rejected', 'canceled')
          then 'late_settlement_after_terminal_state'
          else 'late_settlement_after_checkout_ineligibility' end,
        v_agreement.status,
        case when v_agreement.status = 'rejected' then 'rejected' else 'canceled' end
      );
      if v_hold_id is not null then
        update private.sponsorship_agreements
        set status = 'reconciliation_required',
            public_recognition_approved = false,
            public_recognition_reviewed_by = null,
            public_recognition_reviewed_at = null,
            updated_at = pg_catalog.now()
        where id = v_agreement.id;
      end if;
    end if;
  end if;

  if new.status = 'paid' then
    return new;
  end if;
  update private.organization_service_engagements
  set status = 'reconciliation_required',
      entitlement_state = 'suspended',
      support_agreement_state = 'suspended',
      updated_at = pg_catalog.now()
  where order_id = new.id
    and status in ('active', 'completed')
  returning id into v_engagement_id;
  if v_engagement_id is not null then
    insert into private.economic_audit_events(
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'provider_webhook', 'organization_service_economic_hold_applied',
      'organization_service_engagement', v_engagement_id,
      pg_catalog.jsonb_build_object(
        'order_id', new.id, 'order_status', new.status,
        'community_identity_affected', false
      )
    );
  end if;
  update private.sponsorship_agreements
  set status = 'reconciliation_required',
      public_recognition_approved = false,
      public_recognition_reviewed_by = null,
      public_recognition_reviewed_at = null,
      updated_at = pg_catalog.now()
  where order_id = new.id
    and status in ('active', 'completed')
    and (
      new.status <> 'partially_refunded'
      or private.sponsorship_committed_funding_minor(id)
        > coalesce(private.sponsorship_net_settled_minor(id), 0)
    )
  returning id into v_sponsorship_id;
  if v_sponsorship_id is not null then
    insert into private.economic_audit_events(
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'provider_webhook', 'sponsorship_economic_hold_applied',
      'sponsorship_agreement', v_sponsorship_id,
      pg_catalog.jsonb_build_object(
        'order_id', new.id, 'order_status', new.status,
        'public_recognition_removed', true,
        'governance_affected', false
      )
    );
  end if;
  return new;
end;
$$;

alter function private.reconcile_organization_and_sponsorship_order_state() owner to postgres;
revoke all privileges on function private.reconcile_organization_and_sponsorship_order_state()
  from public, anon, authenticated, service_role;
create trigger reconcile_organization_and_sponsorship_order_state
after update of status on private.economic_orders
for each row execute function private.reconcile_organization_and_sponsorship_order_state();

create or replace function public.public_sponsorship_recognition()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'enabled', private.economic_feature_enabled('sponsorship_display'),
    'recognitions', case when private.economic_feature_enabled('sponsorship_display') then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'label', agreement.public_label,
        'summary', agreement.public_summary,
        'purposeCode', agreement.purpose_code,
        'grantsAuthority', false,
        'isEndorsement', false
      ) order by agreement.public_label)
      from private.sponsorship_agreements as agreement
      join private.economic_orders as economic_order on economic_order.id = agreement.order_id
      where agreement.status in ('active', 'completed')
        and economic_order.status in ('paid', 'partially_refunded')
        and agreement.public_recognition_opt_in = true
        and agreement.public_recognition_approved = true
    ), '[]'::jsonb) else '[]'::jsonb end,
    'paymentGrantsAuthority', false
  );
$$;

alter function public.public_sponsorship_recognition() owner to postgres;

do $economic_sidecar_function_acl$
begin
  revoke all privileges on function public.configure_economic_test_price(uuid, text, text, bigint, text, text, uuid, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_create_economic_organization(uuid, uuid, text, text, uuid, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_set_economic_organization_membership(uuid, uuid, uuid, uuid, text, boolean, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_create_organization_service_engagement(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_review_organization_service_engagement(uuid, uuid, uuid, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.prepare_organization_service_checkout(uuid, uuid, uuid, text, text, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_create_sponsorship_agreement(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_review_sponsorship_agreement(uuid, uuid, uuid, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_set_sponsorship_public_recognition(uuid, uuid, uuid, boolean, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.prepare_sponsorship_checkout(uuid, uuid, uuid, text, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.set_current_user_sponsorship_recognition_preference(uuid, uuid, uuid, boolean, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_configure_assistance_program(uuid, uuid, text, text, text, text, text, timestamptz, timestamptz, integer, boolean, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_set_economic_assistance_program_status(uuid, uuid, uuid, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_issue_economic_assistance_grant(uuid, uuid, text, uuid, uuid, bigint, timestamptz, uuid, bigint, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_end_economic_assistance_grant(uuid, uuid, uuid, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_reconcile_job_post_assistance_grant(uuid, uuid, uuid, uuid, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_create_sponsorship_assistance_allocation(uuid, uuid, uuid, uuid, text, bigint, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_close_sponsorship_assistance_allocation(uuid, uuid, uuid, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.current_user_economic_organization_status()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.public_sponsorship_recognition()
    from public, anon, authenticated, service_role;
end
$economic_sidecar_function_acl$;

grant execute on function public.configure_economic_test_price(uuid, text, text, bigint, text, text, uuid, text)
  to service_role;
grant execute on function public.operator_create_economic_organization(uuid, uuid, text, text, uuid, text)
  to service_role;
grant execute on function public.operator_set_economic_organization_membership(uuid, uuid, uuid, uuid, text, boolean, text)
  to service_role;
grant execute on function public.operator_create_organization_service_engagement(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text)
  to service_role;
grant execute on function public.operator_review_organization_service_engagement(uuid, uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.prepare_organization_service_checkout(uuid, uuid, uuid, text, text, text, text, text)
  to service_role;
grant execute on function public.operator_create_sponsorship_agreement(uuid, uuid, uuid, uuid, text, text, text, text, text, text, text)
  to service_role;
grant execute on function public.operator_review_sponsorship_agreement(uuid, uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.operator_set_sponsorship_public_recognition(uuid, uuid, uuid, boolean, text, text)
  to service_role;
grant execute on function public.prepare_sponsorship_checkout(uuid, uuid, uuid, text, text, text, text)
  to service_role;
grant execute on function public.set_current_user_sponsorship_recognition_preference(uuid, uuid, uuid, boolean, text, text, text)
  to service_role;
grant execute on function public.operator_configure_assistance_program(uuid, uuid, text, text, text, text, text, timestamptz, timestamptz, integer, boolean, text)
  to service_role;
grant execute on function public.operator_set_economic_assistance_program_status(uuid, uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.operator_issue_economic_assistance_grant(uuid, uuid, text, uuid, uuid, bigint, timestamptz, uuid, bigint, text)
  to service_role;
grant execute on function public.operator_end_economic_assistance_grant(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.operator_reconcile_job_post_assistance_grant(uuid, uuid, uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.operator_create_sponsorship_assistance_allocation(uuid, uuid, uuid, uuid, text, bigint, text, text)
  to service_role;
grant execute on function public.operator_close_sponsorship_assistance_allocation(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.current_user_economic_organization_status()
  to authenticated;
grant execute on function public.public_sponsorship_recognition()
  to anon, authenticated;

comment on table private.economic_assistance_grants is
  'Private, non-stigmatizing waivers, subsidies, and sponsored-access grants. They are never badges, recognition credits, governance roles, or public status.';
comment on table private.sponsorship_agreements is
  'Private sponsorship contracts with enforced no-control boundaries. Public recognition is a separate opt-in and reviewed projection.';
comment on function public.current_user_economic_organization_status is
  'Self-only organization relationship/status projection. It omits prices, orders, provider identifiers, private reasons, and signer disclosures.';

commit;
