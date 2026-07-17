-- Marketplace commerce is a private sidecar to the existing developer,
-- publisher, listing, review, version, revocation, and local-install systems.
-- Payment creates an immutable version-bound license and seller accounting; it
-- never approves, ranks, trusts, publishes, downloads, or installs an add-on.

begin;

create table private.economic_seller_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  developer_profile_id uuid not null unique references public.developer_profiles(id) on delete restrict,
  status text not null default 'pending',
  provider text,
  provider_account_reference text,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  provider_disabled_reason text,
  provider_status_response_sha256 text,
  provider_status_updated_at timestamptz,
  test_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint economic_seller_status_check check (
    status in ('pending', 'onboarding', 'ready', 'restricted', 'closed')
  ),
  constraint economic_seller_provider_pair_check check (
    (provider is null) = (provider_account_reference is null)
  ),
  constraint economic_seller_provider_check
    check (provider is null or provider ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint economic_seller_provider_status_hash_check
    check (provider_status_response_sha256 is null or provider_status_response_sha256 ~ '^[0-9a-f]{64}$'),
  constraint economic_seller_test_only_check check (test_mode = true),
  constraint economic_seller_closed_check check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  )
);

create unique index economic_seller_provider_account_idx
  on private.economic_seller_accounts(provider, provider_account_reference)
  where provider_account_reference is not null;

create table private.economic_seller_publisher_links (
  id uuid primary key default gen_random_uuid(),
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  publisher_id uuid not null references public.publishers(id) on delete restrict,
  linked_at timestamptz not null default now(),
  unlinked_at timestamptz,
  unique (seller_account_id, publisher_id),
  constraint economic_seller_publisher_link_state_check
    check (unlinked_at is null or unlinked_at >= linked_at)
);

create table private.economic_seller_publisher_link_requests (
  client_request_id uuid primary key,
  requested_by uuid not null references auth.users(id) on delete restrict,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  publisher_id uuid not null references public.publishers(id) on delete restrict,
  link_id uuid not null references private.economic_seller_publisher_links(id) on delete restrict,
  private_reason text not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint economic_seller_publisher_link_request_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint economic_seller_publisher_link_request_result_check
    check (pg_catalog.jsonb_typeof(result_payload) = 'object')
);

create table private.economic_seller_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  seller_agreement_version text not null,
  stripe_connect_disclosure_version text not null,
  consent_source_route text not null,
  status text not null default 'prepared',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  completed_at timestamptz,
  constraint economic_seller_onboarding_status_check
    check (status in ('prepared', 'provider_attached', 'completed', 'expired', 'canceled')),
  constraint economic_seller_onboarding_consent_check check (
    pg_catalog.char_length(seller_agreement_version) between 1 and 120
    and pg_catalog.char_length(stripe_connect_disclosure_version) between 1 and 120
    and consent_source_route ~ '^/[A-Za-z0-9/_?&=.%:-]*$'
    and pg_catalog.char_length(consent_source_route) <= 300
  )
);

create index economic_seller_onboarding_requests_seller_created_idx
  on private.economic_seller_onboarding_requests(seller_account_id, created_at desc);

create table private.economic_seller_provider_status_requests (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'prepared',
  attempt_count integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint economic_seller_provider_status_request_status_check
    check (status in ('prepared', 'completed')),
  constraint economic_seller_provider_status_request_attempt_check
    check (attempt_count between 1 and 10),
  constraint economic_seller_provider_status_request_completion_check
    check ((status = 'completed') = (completed_at is not null))
);

create index economic_seller_provider_status_requests_seller_created_idx
  on private.economic_seller_provider_status_requests(seller_account_id, created_at desc);

create index economic_seller_provider_status_requests_seller_attempt_idx
  on private.economic_seller_provider_status_requests(seller_account_id, last_attempt_at desc);

create table private.marketplace_free_seller_agreements (
  client_request_id uuid primary key,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  agreement_version text not null,
  consent_source_route text not null,
  accepted_at timestamptz not null default now(),
  constraint marketplace_free_seller_agreement_version_check
    check (pg_catalog.char_length(agreement_version) between 1 and 120),
  constraint marketplace_free_seller_agreement_route_check
    check (consent_source_route ~ '^/[A-Za-z0-9/_?&=.%:-]*$'
      and pg_catalog.char_length(consent_source_route) <= 300)
);

create table private.marketplace_commercial_term_versions (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  terms_code text not null unique,
  commission_bps integer not null,
  seller_agreement_version text not null,
  buyer_terms_version text not null,
  active boolean not null default false,
  test_mode boolean not null default true,
  approved_for_live_use boolean not null default false,
  configured_by uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint marketplace_commercial_terms_code_check
    check (terms_code ~ '^marketplace_test_[a-z0-9_]{3,100}$'),
  constraint marketplace_commercial_terms_commission_check
    check (commission_bps between 0 and 5000),
  constraint marketplace_commercial_terms_versions_check check (
    pg_catalog.char_length(seller_agreement_version) between 1 and 120
    and pg_catalog.char_length(buyer_terms_version) between 1 and 120
  ),
  constraint marketplace_commercial_terms_test_only_check
    check (test_mode = true and approved_for_live_use = false),
  constraint marketplace_commercial_terms_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint marketplace_commercial_terms_retirement_check check (
    (active and retired_at is null) or (not active)
  )
);

create table private.marketplace_commercial_offers (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  publisher_id uuid references public.publishers(id) on delete restrict,
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  addon_version_id uuid not null unique references public.marketplace_addon_versions(id) on delete restrict,
  offer_kind text not null,
  price_id uuid unique references private.economic_prices(id) on delete restrict,
  commercial_terms_version_id uuid references private.marketplace_commercial_term_versions(id) on delete restrict,
  license_key text not null,
  license_version text not null,
  buyer_terms_version text not null,
  seller_agreement_version text not null,
  commission_bps integer not null,
  status text not null default 'draft',
  test_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  constraint marketplace_offer_kind_check check (offer_kind in ('free', 'paid')),
  constraint marketplace_offer_price_check check (
    (offer_kind = 'free' and price_id is null and commercial_terms_version_id is null and commission_bps = 0)
    or (offer_kind = 'paid' and price_id is not null and commercial_terms_version_id is not null)
  ),
  constraint marketplace_offer_license_key_check
    check (license_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{1,100}$'),
  constraint marketplace_offer_license_version_check
    check (
      pg_catalog.char_length(license_version) between 1 and 120
      and pg_catalog.char_length(buyer_terms_version) between 1 and 120
      and pg_catalog.char_length(seller_agreement_version) between 1 and 120
    ),
  constraint marketplace_offer_commission_check check (commission_bps between 0 and 5000),
  constraint marketplace_offer_status_check
    check (status in ('draft', 'active', 'suspended', 'retired')),
  constraint marketplace_offer_activation_check check (
    (status = 'active' and activated_at is not null and retired_at is null)
    or (status = 'retired' and retired_at is not null)
    or (status in ('draft', 'suspended'))
  ),
  constraint marketplace_offer_test_only_check check (test_mode = true)
);

create index marketplace_commercial_offers_catalog_idx
  on private.marketplace_commercial_offers(listing_id, status);

create table private.marketplace_offer_configuration_requests (
  client_request_id uuid primary key,
  requested_by uuid not null references auth.users(id) on delete restrict,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  offer_id uuid not null references private.marketplace_commercial_offers(id) on delete restrict,
  request_payload jsonb not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint marketplace_offer_configuration_request_payload_check check (
    pg_catalog.jsonb_typeof(request_payload) = 'object'
    and pg_catalog.jsonb_typeof(result_payload) = 'object'
  )
);

create table private.marketplace_offer_status_requests (
  client_request_id uuid primary key,
  requested_by uuid not null references auth.users(id) on delete restrict,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  offer_id uuid not null references private.marketplace_commercial_offers(id) on delete restrict,
  previous_status text not null,
  target_status text not null,
  confirmation text not null,
  private_reason text not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint marketplace_offer_status_request_previous_check
    check (previous_status in ('draft', 'active', 'suspended')),
  constraint marketplace_offer_status_request_target_check
    check (target_status in ('active', 'suspended', 'retired')),
  constraint marketplace_offer_status_request_confirmation_check check (
    (target_status = 'active' and confirmation = 'ACTIVATE MARKETPLACE TEST OFFER')
    or (target_status = 'suspended' and confirmation = 'SUSPEND MARKETPLACE TEST OFFER')
    or (target_status = 'retired' and confirmation = 'RETIRE MARKETPLACE TEST OFFER')
  ),
  constraint marketplace_offer_status_request_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint marketplace_offer_status_request_result_check
    check (pg_catalog.jsonb_typeof(result_payload) = 'object')
);

create table private.marketplace_purchase_contracts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references private.economic_orders(id) on delete restrict,
  offer_id uuid not null references private.marketplace_commercial_offers(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  addon_version_id uuid not null references public.marketplace_addon_versions(id) on delete restrict,
  license_key_snapshot text not null,
  license_version_snapshot text not null,
  commission_bps_snapshot integer not null,
  gross_amount_minor bigint not null,
  currency text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_purchase_contract_amount_check check (gross_amount_minor > 0),
  constraint marketplace_purchase_contract_currency_check check (currency ~ '^[a-z]{3}$'),
  constraint marketplace_purchase_contract_status_check check (
    status in (
      'pending', 'active', 'partially_refunded', 'refunded', 'disputed',
      'canceled', 'reconciliation_required'
    )
  )
);

create unique index marketplace_purchase_contract_buyer_offer_idx
  on private.marketplace_purchase_contracts(buyer_user_id, offer_id);

create table private.marketplace_licenses (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid unique,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  offer_id uuid not null references private.marketplace_commercial_offers(id) on delete restrict,
  order_id uuid unique references private.economic_orders(id) on delete restrict,
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  addon_version_id uuid not null references public.marketplace_addon_versions(id) on delete restrict,
  license_key text not null,
  license_version text not null,
  acquisition_kind text not null,
  economic_status text not null default 'active',
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  unique (buyer_user_id, offer_id),
  constraint marketplace_license_acquisition_check
    check (acquisition_kind in ('free_acceptance', 'paid_order')),
  constraint marketplace_license_order_check check (
    (acquisition_kind = 'free_acceptance' and order_id is null and client_request_id is not null)
    or (acquisition_kind = 'paid_order' and order_id is not null)
  ),
  constraint marketplace_license_economic_status_check check (
    economic_status in ('active', 'partially_refunded', 'refunded', 'disputed', 'revoked')
  )
);

create table private.marketplace_order_financial_state (
  order_id uuid primary key references private.economic_orders(id) on delete restrict,
  license_id uuid not null unique references private.marketplace_licenses(id) on delete restrict,
  sale_recorded boolean not null default false,
  refunded_gross_minor bigint not null default 0,
  refunded_commission_minor bigint not null default 0,
  lost_dispute_gross_minor bigint not null default 0,
  lost_dispute_commission_minor bigint not null default 0,
  dispute_held_payable_minor bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint marketplace_financial_state_nonnegative_check check (
    refunded_gross_minor >= 0 and refunded_commission_minor >= 0
    and lost_dispute_gross_minor >= 0 and lost_dispute_commission_minor >= 0
    and dispute_held_payable_minor >= 0
  )
);

create table private.marketplace_license_conflicts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references private.economic_orders(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  offer_id uuid not null references private.marketplace_commercial_offers(id) on delete restrict,
  existing_license_id uuid not null references private.marketplace_licenses(id) on delete restrict,
  conflict_code text not null default 'license_already_owned_for_different_order',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint marketplace_license_conflict_status_check
    check (status in ('open', 'refund_required', 'resolved')),
  constraint marketplace_license_conflict_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create table private.marketplace_fulfillment_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references private.economic_orders(id) on delete restrict,
  purchase_contract_id uuid not null unique references private.marketplace_purchase_contracts(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  offer_id uuid not null references private.marketplace_commercial_offers(id) on delete restrict,
  reason_code text not null default 'offer_unavailable_at_payment',
  status text not null default 'refund_required',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint marketplace_fulfillment_hold_reason_check check (
    reason_code in ('offer_unavailable_at_payment')
  ),
  constraint marketplace_fulfillment_hold_status_check check (
    status in ('refund_required', 'resolved')
  ),
  constraint marketplace_fulfillment_hold_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create table private.marketplace_commission_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.economic_orders(id) on delete restrict,
  license_id uuid not null references private.marketplace_licenses(id) on delete restrict,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  event_type text not null,
  gross_delta_minor bigint not null,
  commission_delta_minor bigint not null,
  payable_delta_minor bigint not null,
  currency text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint marketplace_commission_event_type_check check (
    event_type in (
      'sale', 'refund', 'refund_reversal', 'dispute_hold',
      'dispute_release', 'chargeback', 'chargeback_reversal',
      'processor_fee', 'operator_adjustment'
    )
  ),
  constraint marketplace_commission_currency_check check (currency ~ '^[a-z]{3}$'),
  constraint marketplace_commission_balance_check check (
    gross_delta_minor - commission_delta_minor = payable_delta_minor
    or event_type in ('dispute_hold', 'dispute_release', 'processor_fee', 'operator_adjustment')
  )
);

create index marketplace_commission_seller_idx
  on private.marketplace_commission_events(seller_account_id, currency, created_at);

create table private.marketplace_payout_preparations (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  seller_account_id uuid not null references private.economic_seller_accounts(id) on delete restrict,
  amount_minor bigint not null,
  currency text not null,
  status text not null default 'prepared',
  prepared_by uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  provider text,
  provider_transfer_reference text,
  provider_response_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint marketplace_payout_amount_check check (amount_minor > 0),
  constraint marketplace_payout_currency_check check (currency ~ '^[a-z]{3}$'),
  constraint marketplace_payout_status_check check (
    status in ('prepared', 'transfer_pending', 'transferred', 'failed', 'canceled', 'reversed')
  ),
  constraint marketplace_payout_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint marketplace_payout_provider_pair_check check (
    (provider is null and provider_transfer_reference is null and provider_response_sha256 is null)
    or (
      provider is not null and provider_transfer_reference is not null
      and provider_response_sha256 ~ '^[0-9a-f]{64}$'
    )
  )
);

create table private.marketplace_payout_result_events (
  id uuid primary key default gen_random_uuid(),
  payout_preparation_id uuid not null
    references private.marketplace_payout_preparations(id) on delete restrict,
  provider_status text not null,
  provider_transfer_reference text not null,
  provider_response_sha256 text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  unique (payout_preparation_id, provider_status),
  constraint marketplace_payout_result_status_check
    check (provider_status in ('pending', 'transferred', 'failed', 'canceled', 'reversed')),
  constraint marketplace_payout_result_reference_check
    check (provider_transfer_reference ~ '^tr_[A-Za-z0-9]{3,250}$'),
  constraint marketplace_payout_result_hash_check
    check (provider_response_sha256 ~ '^[0-9a-f]{64}$'),
  constraint marketplace_payout_result_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

do $marketplace_economic_table_hardening$
declare
  v_table text;
begin
  foreach v_table in array array[
    'economic_seller_accounts', 'economic_seller_publisher_links',
    'economic_seller_publisher_link_requests',
    'economic_seller_onboarding_requests', 'economic_seller_provider_status_requests',
    'marketplace_free_seller_agreements',
    'marketplace_commercial_term_versions',
    'marketplace_commercial_offers', 'marketplace_offer_configuration_requests',
    'marketplace_offer_status_requests', 'marketplace_purchase_contracts',
    'marketplace_licenses', 'marketplace_order_financial_state',
    'marketplace_license_conflicts', 'marketplace_fulfillment_holds',
    'marketplace_commission_events', 'marketplace_payout_preparations',
    'marketplace_payout_result_events'
  ]
  loop
    execute pg_catalog.format('alter table private.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table private.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table private.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$marketplace_economic_table_hardening$;

create trigger marketplace_commission_events_are_append_only
before update or delete on private.marketplace_commission_events
for each row execute function private.prevent_economic_history_mutation();
create trigger marketplace_free_seller_agreements_are_append_only
before update or delete on private.marketplace_free_seller_agreements
for each row execute function private.prevent_economic_history_mutation();
create trigger marketplace_payout_result_events_are_append_only
before update or delete on private.marketplace_payout_result_events
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_seller_publisher_link_requests_are_append_only
before update or delete on private.economic_seller_publisher_link_requests
for each row execute function private.prevent_economic_history_mutation();
create trigger marketplace_offer_configuration_requests_are_append_only
before update or delete on private.marketplace_offer_configuration_requests
for each row execute function private.prevent_economic_history_mutation();
create trigger marketplace_offer_status_requests_are_append_only
before update or delete on private.marketplace_offer_status_requests
for each row execute function private.prevent_economic_history_mutation();

create or replace function private.marketplace_seller_is_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from auth.users as account
    join public.developer_profiles as developer on developer.user_id = account.id
    where account.id = p_user_id
      and account.deleted_at is null
      and account.is_anonymous is false
      and account.email_confirmed_at is not null
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
      and developer.status in ('active', 'trusted')
      and developer.suspended_at is null
  ), false);
$$;

alter function private.marketplace_seller_is_eligible(uuid) owner to postgres;
revoke all privileges on function private.marketplace_seller_is_eligible(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.accept_marketplace_free_seller_agreement(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_agreement_version text,
  p_consent_source_route text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_developer public.developer_profiles%rowtype;
  v_seller private.economic_seller_accounts%rowtype;
  v_agreement private.marketplace_free_seller_agreements%rowtype;
  v_idempotent_replay boolean;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if private.economic_service_is_restricted(p_actor_user_id, 'marketplace_selling') then
    raise exception using errcode = '42501', message = 'marketplace_selling_restricted';
  end if;
  if p_client_request_id is null
     or pg_catalog.char_length(coalesce(p_agreement_version, '')) not between 1 and 120
     or coalesce(p_consent_source_route, '') !~ '^/[A-Za-z0-9/_?&=.%:-]*$'
     or pg_catalog.char_length(p_consent_source_route) > 300
     or not private.marketplace_seller_is_eligible(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'marketplace_free_seller_agreement_invalid';
  end if;
  perform private.require_active_economic_legal_version(
    'marketplace_free_seller_agreement', p_agreement_version
  );
  select * into v_developer from public.developer_profiles
  where user_id = p_actor_user_id;
  insert into private.economic_seller_accounts(user_id, developer_profile_id)
  values (p_actor_user_id, v_developer.id)
  on conflict (user_id) do update
    set developer_profile_id = excluded.developer_profile_id,
        updated_at = pg_catalog.now()
  returning * into v_seller;
  if v_seller.status in ('restricted', 'closed') then
    raise exception using errcode = '42501', message = 'marketplace_seller_account_restricted';
  end if;
  select * into v_agreement
  from private.marketplace_free_seller_agreements
  where client_request_id = p_client_request_id;
  v_idempotent_replay := found;
  if v_idempotent_replay then
    if v_agreement.seller_account_id <> v_seller.id
       or v_agreement.user_id <> p_actor_user_id
       or v_agreement.agreement_version <> p_agreement_version
       or v_agreement.consent_source_route <> p_consent_source_route then
      raise exception using errcode = '23505', message = 'marketplace_free_seller_agreement_idempotency_conflict';
    end if;
  else
    insert into private.marketplace_free_seller_agreements(
      client_request_id, seller_account_id, user_id,
      agreement_version, consent_source_route
    ) values (
      p_client_request_id, v_seller.id, p_actor_user_id,
      p_agreement_version, p_consent_source_route
    ) returning * into v_agreement;
    insert into private.economic_consents(
      user_id, document_key, document_version, source_route,
      client_request_id, metadata
    ) values (
      p_actor_user_id, 'marketplace_free_seller_agreement',
      p_agreement_version, p_consent_source_route,
      p_client_request_id,
      pg_catalog.jsonb_build_object(
        'seller_account_id', v_seller.id,
        'connect_or_payout_consent', false,
        'does_not_grant_developer_or_publisher_status', true
      )
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'sellerAccountId', v_seller.id,
    'agreementVersion', v_agreement.agreement_version,
    'connectRequiredForFreeOffers', false,
    'testMode', true, 'idempotentReplay', v_idempotent_replay
  );
end;
$$;

alter function public.accept_marketplace_free_seller_agreement(uuid, uuid, text, text)
  owner to postgres;

create or replace function public.prepare_economic_seller_onboarding(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_seller_agreement_version text,
  p_stripe_connect_disclosure_version text,
  p_consent_source_route text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_developer public.developer_profiles%rowtype;
  v_seller private.economic_seller_accounts%rowtype;
  v_request private.economic_seller_onboarding_requests%rowtype;
  v_idempotent_replay boolean;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if private.economic_service_is_restricted(p_actor_user_id, 'marketplace_selling') then
    raise exception using errcode = '42501', message = 'marketplace_selling_restricted';
  end if;
  if not private.economic_feature_enabled('marketplace_seller_onboarding') then
    raise exception using errcode = '55000', message = 'marketplace_seller_onboarding_disabled';
  end if;
  if p_client_request_id is null
     or pg_catalog.char_length(coalesce(p_seller_agreement_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_stripe_connect_disclosure_version, '')) not between 1 and 120
     or coalesce(p_consent_source_route, '') !~ '^/[A-Za-z0-9/_?&=.%:-]*$'
     or pg_catalog.char_length(p_consent_source_route) > 300
     or not private.marketplace_seller_is_eligible(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'marketplace_verified_developer_required';
  end if;
  -- Stripe Connect onboarding is only for the commercial seller path. Free
  -- sellers accept the separate free-seller agreement through
  -- accept_marketplace_free_seller_agreement() and do not need Connect.
  perform private.require_active_economic_legal_version(
    'marketplace_seller_agreement', p_seller_agreement_version
  );
  perform private.require_active_economic_legal_version(
    'stripe_connect_seller_disclosure', p_stripe_connect_disclosure_version
  );
  select * into v_developer
  from public.developer_profiles as developer
  where developer.user_id = p_actor_user_id;

  insert into private.economic_seller_accounts (user_id, developer_profile_id)
  values (p_actor_user_id, v_developer.id)
  on conflict (user_id) do update
    set developer_profile_id = excluded.developer_profile_id,
        updated_at = pg_catalog.now()
  returning * into v_seller;
  if v_seller.status in ('restricted', 'closed') then
    raise exception using errcode = '42501', message = 'marketplace_seller_account_restricted';
  end if;

  select * into v_request
  from private.economic_seller_onboarding_requests as request
  where request.client_request_id = p_client_request_id;
  v_idempotent_replay := found;
  if v_idempotent_replay then
    if v_request.seller_account_id <> v_seller.id
       or v_request.requested_by <> p_actor_user_id
       or v_request.seller_agreement_version <> p_seller_agreement_version
       or v_request.stripe_connect_disclosure_version <> p_stripe_connect_disclosure_version
       or v_request.consent_source_route <> p_consent_source_route then
      raise exception using errcode = '23505', message = 'marketplace_seller_onboarding_idempotency_conflict';
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('marketplace_seller_onboarding:' || v_seller.id::text, 0)
    );
    if exists (
      select 1
      from private.economic_seller_onboarding_requests as recent_request
      where recent_request.seller_account_id = v_seller.id
        and recent_request.created_at > pg_catalog.now() - interval '60 seconds'
    ) or (
      select pg_catalog.count(*)
      from private.economic_seller_onboarding_requests as hourly_request
      where hourly_request.seller_account_id = v_seller.id
        and hourly_request.created_at > pg_catalog.now() - interval '1 hour'
    ) >= 5 then
      raise exception using errcode = '55000', message = 'marketplace_seller_onboarding_rate_limited';
    end if;
    insert into private.economic_seller_onboarding_requests (
      client_request_id, seller_account_id, requested_by,
      seller_agreement_version, stripe_connect_disclosure_version,
      consent_source_route
    ) values (
      p_client_request_id, v_seller.id, p_actor_user_id,
      p_seller_agreement_version, p_stripe_connect_disclosure_version,
      p_consent_source_route
    ) returning * into v_request;
    insert into private.economic_consents (
      user_id, document_key, document_version, source_route,
      client_request_id, metadata
    ) values (
      p_actor_user_id, 'marketplace_seller_agreement',
      p_seller_agreement_version, p_consent_source_route,
      p_client_request_id,
      pg_catalog.jsonb_build_object(
        'seller_account_id', v_seller.id,
        'does_not_grant_developer_or_publisher_status', true,
        'test_mode', true
      )
    );
    insert into private.economic_consents (
      user_id, document_key, document_version, source_route,
      client_request_id, metadata
    ) values (
      p_actor_user_id, 'stripe_connect_seller_disclosure',
      p_stripe_connect_disclosure_version, p_consent_source_route,
      p_client_request_id,
      pg_catalog.jsonb_build_object(
        'seller_account_id', v_seller.id,
        'stripe_receives_seller_identity_and_payout_information', true,
        'local_elysia_data_is_not_shared', true,
        'test_mode', true
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'sellerAccountId', v_seller.id,
    'developerProfileId', v_developer.id,
    'status', v_seller.status,
    'providerAccountAttached', v_seller.provider_account_reference is not null,
    'providerAccountReference', v_seller.provider_account_reference,
    'providerIdempotencyKey', 'seller-account:' || v_seller.id::text,
    'onboardingRequestId', v_request.id,
    'sellerAgreementVersion', v_request.seller_agreement_version,
    'stripeConnectDisclosureVersion', v_request.stripe_connect_disclosure_version,
    'testMode', true,
    'idempotentReplay', v_idempotent_replay
  );
end;
$$;

alter function public.prepare_economic_seller_onboarding(uuid, uuid, text, text, text) owner to postgres;

create or replace function public.attach_economic_seller_provider_account(
  p_seller_account_id uuid,
  p_provider text,
  p_provider_account_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller private.economic_seller_accounts%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if not private.economic_feature_enabled('marketplace_seller_onboarding')
     or p_provider <> 'stripe'
     or coalesce(p_provider_account_reference, '') !~ '^acct_[A-Za-z0-9]{3,250}$'
     or coalesce((select enabled from private.economic_feature_flags where feature_key = 'live_stripe'), false) then
    raise exception using errcode = '55000', message = 'marketplace_test_seller_provider_attachment_refused';
  end if;
  select * into v_seller
  from private.economic_seller_accounts as seller
  where seller.id = p_seller_account_id
  for update;
  if not found or v_seller.status in ('restricted', 'closed') then
    raise exception using errcode = 'P0002', message = 'marketplace_seller_account_not_found';
  end if;
  if v_seller.provider_account_reference is not null
     and (
       v_seller.provider <> p_provider
       or v_seller.provider_account_reference <> p_provider_account_reference
     ) then
    raise exception using errcode = '23505', message = 'marketplace_seller_provider_account_conflict';
  end if;
  update private.economic_seller_accounts
  set provider = p_provider,
      provider_account_reference = p_provider_account_reference,
      status = case when status = 'pending' then 'onboarding' else status end,
      updated_at = pg_catalog.now()
  where id = v_seller.id
  returning * into v_seller;
  update private.economic_seller_onboarding_requests
  set status = 'provider_attached'
  where seller_account_id = v_seller.id and status = 'prepared';
  return pg_catalog.jsonb_build_object(
    'sellerAccountId', v_seller.id,
    'provider', v_seller.provider,
    'providerAccountReference', v_seller.provider_account_reference,
    'status', v_seller.status,
    'testMode', true
  );
end;
$$;

alter function public.attach_economic_seller_provider_account(uuid, text, text)
  owner to postgres;

create or replace function public.record_economic_seller_provider_status(
  p_seller_account_id uuid,
  p_client_request_id uuid,
  p_provider_account_reference text,
  p_details_submitted boolean,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_disabled_reason text,
  p_provider_event_created_at timestamptz,
  p_provider_response_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller private.economic_seller_accounts%rowtype;
  v_request private.economic_seller_provider_status_requests%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_client_request_id is null
     or coalesce(p_provider_response_sha256, '') !~ '^[0-9a-f]{64}$'
     or p_provider_event_created_at is null
     or p_provider_event_created_at > pg_catalog.now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'marketplace_seller_provider_status_invalid';
  end if;
  select * into v_seller
  from private.economic_seller_accounts as seller
  where seller.id = p_seller_account_id
    and seller.provider = 'stripe'
    and seller.provider_account_reference = p_provider_account_reference
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'marketplace_seller_provider_account_not_found';
  end if;
  select * into v_request
  from private.economic_seller_provider_status_requests as request
  where request.client_request_id = p_client_request_id
    and request.seller_account_id = v_seller.id
    and request.requested_by = v_seller.user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'marketplace_seller_status_request_not_found';
  end if;
  if v_request.status = 'completed' then
    return pg_catalog.jsonb_build_object(
      'sellerAccountId', v_seller.id, 'status', v_seller.status,
      'idempotentReplay', true, 'testMode', true
    );
  end if;
  if v_seller.provider_status_updated_at is not null
     and p_provider_event_created_at < v_seller.provider_status_updated_at then
    update private.economic_seller_provider_status_requests
    set status = 'completed', completed_at = pg_catalog.now()
    where id = v_request.id;
    return pg_catalog.jsonb_build_object(
      'sellerAccountId', v_seller.id, 'status', v_seller.status,
      'ignoredOutOfOrder', true, 'idempotentReplay', false, 'testMode', true
    );
  end if;
  update private.economic_seller_accounts
  set details_submitted = coalesce(p_details_submitted, false),
      charges_enabled = coalesce(p_charges_enabled, false),
      payouts_enabled = coalesce(p_payouts_enabled, false),
      provider_disabled_reason = nullif(pg_catalog.left(coalesce(p_disabled_reason, ''), 300), ''),
      provider_status_response_sha256 = p_provider_response_sha256,
      provider_status_updated_at = p_provider_event_created_at,
      status = case
        when coalesce(p_details_submitted, false)
         and coalesce(p_charges_enabled, false)
         and coalesce(p_payouts_enabled, false) then 'ready'
        else 'onboarding'
      end,
      updated_at = pg_catalog.now()
  where id = v_seller.id
  returning * into v_seller;
  if v_seller.status = 'ready' then
    update private.economic_seller_onboarding_requests
    set status = 'completed', completed_at = coalesce(completed_at, pg_catalog.now())
    where seller_account_id = v_seller.id
      and status in ('prepared', 'provider_attached');
  end if;
  update private.economic_seller_provider_status_requests
  set status = 'completed', completed_at = pg_catalog.now()
  where id = v_request.id;
  return pg_catalog.jsonb_build_object(
    'sellerAccountId', v_seller.id,
    'status', v_seller.status,
    'detailsSubmitted', v_seller.details_submitted,
    'chargesEnabled', v_seller.charges_enabled,
    'payoutsEnabled', v_seller.payouts_enabled,
    'idempotentReplay', false,
    'testMode', true
  );
end;
$$;

alter function public.record_economic_seller_provider_status(
  uuid, uuid, text, boolean, boolean, boolean, text, timestamptz, text
) owner to postgres;

create or replace function public.get_economic_seller_provider_context(
  p_actor_user_id uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller private.economic_seller_accounts%rowtype;
  v_request private.economic_seller_provider_status_requests%rowtype;
  v_idempotent_replay boolean := false;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_actor_user_id is null or p_client_request_id is null then
    raise exception using errcode = '22023', message = 'marketplace_seller_status_request_required';
  end if;
  if not private.economic_feature_enabled('marketplace_seller_onboarding') then
    raise exception using errcode = '55000', message = 'marketplace_seller_onboarding_disabled';
  end if;
  select * into v_seller
  from private.economic_seller_accounts as seller
  where seller.user_id = p_actor_user_id;
  if not found or v_seller.status in ('restricted', 'closed') then
    raise exception using errcode = 'P0002', message = 'marketplace_seller_account_not_found';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marketplace_seller_status:' || v_seller.id::text, 0)
  );
  select * into v_request
  from private.economic_seller_provider_status_requests as request
  where request.client_request_id = p_client_request_id;
  if found then
    if v_request.seller_account_id <> v_seller.id
       or v_request.requested_by <> p_actor_user_id then
      raise exception using errcode = '23505', message = 'marketplace_seller_status_idempotency_conflict';
    end if;
    if v_request.status = 'completed' then
      v_idempotent_replay := true;
    else
      if v_request.last_attempt_at > pg_catalog.now() - interval '30 seconds'
         or v_request.attempt_count >= 10 then
        raise exception using errcode = '55000', message = 'marketplace_seller_status_rate_limited';
      end if;
      update private.economic_seller_provider_status_requests
      set attempt_count = attempt_count + 1,
          last_attempt_at = pg_catalog.now()
      where id = v_request.id
      returning * into v_request;
    end if;
  else
    if exists (
      select 1
      from private.economic_seller_provider_status_requests as recent_request
      where recent_request.seller_account_id = v_seller.id
        and recent_request.last_attempt_at > pg_catalog.now() - interval '30 seconds'
    ) or (
      select pg_catalog.count(*)
      from private.economic_seller_provider_status_requests as hourly_request
      where hourly_request.seller_account_id = v_seller.id
        and hourly_request.created_at > pg_catalog.now() - interval '1 hour'
    ) >= 10 then
      raise exception using errcode = '55000', message = 'marketplace_seller_status_rate_limited';
    end if;
    insert into private.economic_seller_provider_status_requests (
      client_request_id, seller_account_id, requested_by
    ) values (
      p_client_request_id, v_seller.id, p_actor_user_id
    ) returning * into v_request;
  end if;
  return pg_catalog.jsonb_build_object(
    'sellerAccountId', v_seller.id,
    'provider', v_seller.provider,
    'providerAccountReference', v_seller.provider_account_reference,
    'status', v_seller.status,
    'detailsSubmitted', v_seller.details_submitted,
    'chargesEnabled', v_seller.charges_enabled,
    'payoutsEnabled', v_seller.payouts_enabled,
    'idempotentReplay', v_idempotent_replay,
    'testMode', true
  );
end;
$$;

alter function public.get_economic_seller_provider_context(uuid, uuid) owner to postgres;

create or replace function public.link_economic_seller_publisher(
  p_actor_user_id uuid,
  p_publisher_id uuid,
  p_client_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller private.economic_seller_accounts%rowtype;
  v_link private.economic_seller_publisher_links%rowtype;
  v_request private.economic_seller_publisher_link_requests%rowtype;
  v_result jsonb;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if private.economic_service_is_restricted(p_actor_user_id, 'marketplace_selling') then
    raise exception using errcode = '42501', message = 'marketplace_selling_restricted';
  end if;
  if p_client_request_id is null
     or p_publisher_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'marketplace_publisher_link_invalid';
  end if;

  -- A request UUID is a durable command identity, not a best-effort browser hint.
  -- Serialize same-key retries before touching the link or its audit trail.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marketplace_publisher_link_request:' || p_client_request_id::text, 0)
  );
  select * into v_seller
  from private.economic_seller_accounts as seller
  where seller.user_id = p_actor_user_id and seller.status not in ('restricted', 'closed')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'marketplace_seller_account_not_found';
  end if;

  select * into v_request
  from private.economic_seller_publisher_link_requests as request
  where request.client_request_id = p_client_request_id;
  if found then
    if v_request.requested_by <> p_actor_user_id
       or v_request.seller_account_id <> v_seller.id
       or v_request.publisher_id <> p_publisher_id
       or v_request.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'marketplace_publisher_link_idempotency_conflict';
    end if;
    return v_request.result_payload || pg_catalog.jsonb_build_object('idempotentReplay', true);
  end if;

  if not private.marketplace_seller_is_eligible(p_actor_user_id)
     or not exists (
       select 1 from public.publishers as publisher
       where publisher.id = p_publisher_id and publisher.owner_id = p_actor_user_id
     ) then
    raise exception using errcode = '42501', message = 'marketplace_publisher_owner_required';
  end if;
  insert into private.economic_seller_publisher_links (
    seller_account_id, publisher_id
  ) values (
    v_seller.id, p_publisher_id
  ) on conflict (seller_account_id, publisher_id) do update
    set unlinked_at = null
  returning * into v_link;
  v_result := pg_catalog.jsonb_build_object(
    'sellerAccountId', v_seller.id,
    'publisherId', p_publisher_id,
    'linked', true,
    'publisherVerifiedChanged', false,
    'testMode', true,
    'idempotentReplay', false
  );
  insert into private.economic_seller_publisher_link_requests (
    client_request_id, requested_by, seller_account_id, publisher_id,
    link_id, private_reason, result_payload
  ) values (
    p_client_request_id, p_actor_user_id, v_seller.id, p_publisher_id,
    v_link.id, pg_catalog.btrim(p_reason), v_result
  );
  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'user', 'economic_seller_publisher_linked',
    'economic_seller_publisher_link', v_link.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'publisher_id', p_publisher_id,
      'publisher_verified_changed', false,
      'developer_status_changed', false
    )
  );
  return v_result;
end;
$$;

alter function public.link_economic_seller_publisher(uuid, uuid, uuid, text)
  owner to postgres;

create or replace function public.configure_marketplace_test_commercial_terms(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_terms_code text,
  p_commission_bps integer,
  p_seller_agreement_version text,
  p_buyer_terms_version text,
  p_active boolean,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_terms private.marketplace_commercial_term_versions%rowtype;
begin
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'marketplace_payout_manage'
  );
  if p_client_request_id is null
     or coalesce(p_terms_code, '') !~ '^marketplace_test_[a-z0-9_]{3,100}$'
     or p_commission_bps is null or p_commission_bps not between 0 and 5000
     or pg_catalog.char_length(coalesce(p_seller_agreement_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_buyer_terms_version, '')) not between 1 and 120
     or p_confirmation is distinct from 'CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'marketplace_test_commercial_terms_invalid';
  end if;
  perform private.require_active_economic_legal_version(
    'marketplace_seller_agreement', p_seller_agreement_version
  );
  perform private.require_active_economic_legal_version(
    'marketplace_buyer_terms', p_buyer_terms_version
  );
  select * into v_terms
  from private.marketplace_commercial_term_versions as terms
  where terms.client_request_id = p_client_request_id
     or terms.terms_code = p_terms_code
  for update;
  if found then
    if v_terms.terms_code <> p_terms_code
       or v_terms.commission_bps <> p_commission_bps
       or v_terms.seller_agreement_version <> p_seller_agreement_version
       or v_terms.buyer_terms_version <> p_buyer_terms_version then
      raise exception using errcode = '23505', message = 'marketplace_commercial_terms_version_conflict';
    end if;
    update private.marketplace_commercial_term_versions
    set active = coalesce(p_active, false),
        retired_at = case when coalesce(p_active, false) then null else coalesce(retired_at, pg_catalog.now()) end
    where id = v_terms.id returning * into v_terms;
  else
    insert into private.marketplace_commercial_term_versions (
      client_request_id, terms_code, commission_bps,
      seller_agreement_version, buyer_terms_version,
      active, configured_by, private_reason, retired_at
    ) values (
      p_client_request_id, p_terms_code, p_commission_bps,
      p_seller_agreement_version, p_buyer_terms_version,
      coalesce(p_active, false), p_actor_user_id, pg_catalog.btrim(p_reason),
      case when coalesce(p_active, false) then null else pg_catalog.now() end
    ) returning * into v_terms;
  end if;
  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'marketplace_test_commercial_terms_configured',
    'marketplace_commercial_term_version', v_terms.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'terms_code', v_terms.terms_code,
      'commission_bps', v_terms.commission_bps,
      'active', v_terms.active,
      'approved_for_live_use', false,
      'test_mode', true
    )
  );
  return pg_catalog.jsonb_build_object(
    'commercialTermsVersionId', v_terms.id,
    'termsCode', v_terms.terms_code,
    'commissionBps', v_terms.commission_bps,
    'sellerAgreementVersion', v_terms.seller_agreement_version,
    'buyerTermsVersion', v_terms.buyer_terms_version,
    'active', v_terms.active,
    'approvedForLiveUse', false,
    'testMode', true
  );
end;
$$;

alter function public.configure_marketplace_test_commercial_terms(
  uuid, uuid, text, integer, text, text, boolean, text, text
) owner to postgres;

create or replace function public.configure_marketplace_test_offer(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_addon_version_id uuid,
  p_publisher_id uuid,
  p_offer_kind text,
  p_price_code text,
  p_amount_minor bigint,
  p_currency text,
  p_license_key text,
  p_license_version text,
  p_buyer_terms_version text,
  p_commercial_terms_code text,
  p_seller_agreement_version text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.marketplace_addon_versions%rowtype;
  v_listing public.marketplace_listings%rowtype;
  v_developer public.developer_profiles%rowtype;
  v_seller private.economic_seller_accounts%rowtype;
  v_price private.economic_prices%rowtype;
  v_terms private.marketplace_commercial_term_versions%rowtype;
  v_offer private.marketplace_commercial_offers%rowtype;
  v_request private.marketplace_offer_configuration_requests%rowtype;
  v_request_payload jsonb;
  v_result jsonb;
  v_audit_action text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if private.economic_service_is_restricted(p_actor_user_id, 'marketplace_selling') then
    raise exception using errcode = '42501', message = 'marketplace_selling_restricted';
  end if;
  if p_client_request_id is null
     or p_addon_version_id is null
     or p_offer_kind is null
     or p_offer_kind not in ('free', 'paid')
     or coalesce(p_license_key, '') !~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{1,100}$'
     or pg_catalog.char_length(coalesce(p_license_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_buyer_terms_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_seller_agreement_version, '')) not between 1 and 120
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'marketplace_test_offer_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marketplace_offer_configuration_request:' || p_client_request_id::text, 0)
  );
  select * into v_seller
  from private.economic_seller_accounts as seller
  where seller.user_id = p_actor_user_id;
  if not found then
    raise exception using errcode = '55000', message = 'marketplace_seller_account_required';
  end if;
  v_request_payload := pg_catalog.jsonb_build_object(
    'addonVersionId', p_addon_version_id,
    'publisherId', p_publisher_id,
    'offerKind', p_offer_kind,
    'priceCode', p_price_code,
    'amountMinor', p_amount_minor,
    'currency', case when p_currency is null then null else pg_catalog.lower(p_currency) end,
    'licenseKey', p_license_key,
    'licenseVersion', p_license_version,
    'buyerTermsVersion', p_buyer_terms_version,
    'commercialTermsCode', p_commercial_terms_code,
    'sellerAgreementVersion', p_seller_agreement_version,
    'reason', pg_catalog.btrim(p_reason)
  );
  select * into v_request
  from private.marketplace_offer_configuration_requests as request
  where request.client_request_id = p_client_request_id;
  if found then
    if v_request.requested_by <> p_actor_user_id
       or v_request.seller_account_id <> v_seller.id
       or v_request.request_payload <> v_request_payload then
      raise exception using errcode = '23505', message = 'marketplace_offer_idempotency_conflict';
    end if;
    return v_request.result_payload || pg_catalog.jsonb_build_object('idempotentReplay', true);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marketplace_offer_addon_version:' || p_addon_version_id::text, 0)
  );
  if v_seller.status in ('restricted', 'closed')
     or not private.marketplace_seller_is_eligible(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'marketplace_selling_restricted';
  end if;
  perform private.require_active_economic_legal_version(
    'marketplace_seller_agreement', p_seller_agreement_version
  );
  perform private.require_active_economic_legal_version(
    'marketplace_buyer_terms', p_buyer_terms_version
  );
  if p_offer_kind = 'paid' and not private.economic_feature_enabled('marketplace_paid_offers') then
    raise exception using errcode = '55000', message = 'marketplace_paid_offers_disabled';
  end if;
  select * into v_version from public.marketplace_addon_versions where id = p_addon_version_id;
  select * into v_listing from public.marketplace_listings where id = v_version.listing_id;
  select * into v_developer from public.developer_profiles where id = v_listing.developer_profile_id;
  if v_version.id is null or v_listing.id is null
     or v_developer.user_id <> p_actor_user_id
     or v_listing.listing_status <> 'published'
     or v_listing.revoked_at is not null
     or v_version.review_status <> 'approved'
     or v_version.published_at is null
     or v_version.revoked_at is not null then
    raise exception using errcode = '42501', message = 'marketplace_offer_version_not_eligible';
  end if;
  if p_offer_kind = 'paid' and not exists (
      select 1
      from private.economic_seller_onboarding_requests as request
      where request.seller_account_id = v_seller.id
        and request.requested_by = p_actor_user_id
        and request.seller_agreement_version = p_seller_agreement_version
        and request.status in ('provider_attached', 'completed')
    ) then
    raise exception using errcode = '55000', message = 'marketplace_paid_seller_agreement_required';
  elsif p_offer_kind = 'free' and not exists (
      select 1
      from private.marketplace_free_seller_agreements as agreement
      where agreement.seller_account_id = v_seller.id
        and agreement.user_id = p_actor_user_id
        and agreement.agreement_version = p_seller_agreement_version
    ) and not exists (
      select 1
      from private.economic_seller_onboarding_requests as request
      where request.seller_account_id = v_seller.id
        and request.requested_by = p_actor_user_id
        and request.seller_agreement_version = p_seller_agreement_version
        and request.status in ('provider_attached', 'completed')
    ) then
    raise exception using errcode = '55000', message = 'marketplace_free_seller_agreement_required';
  end if;
  if p_publisher_id is not null and not exists (
    select 1
    from private.economic_seller_publisher_links as link
    join public.publishers as publisher on publisher.id = link.publisher_id
    where link.seller_account_id = v_seller.id
      and link.publisher_id = p_publisher_id
      and link.unlinked_at is null
      and publisher.owner_id = p_actor_user_id
  ) then
    raise exception using errcode = '42501', message = 'marketplace_seller_publisher_link_required';
  end if;

  if p_offer_kind = 'paid' then
    select * into v_terms
    from private.marketplace_commercial_term_versions as terms
    where terms.terms_code = p_commercial_terms_code
      and terms.active = true
      and terms.test_mode = true
      and terms.approved_for_live_use = false
      and terms.retired_at is null;
    if not found or v_terms.seller_agreement_version <> p_seller_agreement_version then
      raise exception using errcode = '55000', message = 'marketplace_commercial_terms_not_active';
    end if;
    if v_terms.buyer_terms_version <> p_buyer_terms_version then
      raise exception using errcode = '22023', message = 'marketplace_buyer_terms_version_mismatch';
    end if;
    if coalesce(p_price_code, '') !~ '^marketplace_test_[a-z0-9_]{3,100}_usd$'
       or lower(coalesce(p_currency, '')) <> 'usd'
       or p_amount_minor is null or p_amount_minor not between 50 and 10000000 then
      raise exception using errcode = '22023', message = 'marketplace_test_offer_price_invalid';
    end if;
    select * into v_price from private.economic_prices where price_code = p_price_code;
    if found then
      if v_price.product_key <> 'marketplace_purchase'
         or v_price.unit_amount_minor <> p_amount_minor
         or v_price.currency <> 'usd' then
        raise exception using errcode = '23505', message = 'marketplace_test_offer_price_conflict';
      end if;
    else
      insert into private.economic_prices (
        price_code, product_key, currency, unit_amount_minor, active, test_mode_only
      ) values (
        p_price_code, 'marketplace_purchase', 'usd', p_amount_minor, true, true
      ) returning * into v_price;
    end if;
  elsif p_price_code is not null or p_amount_minor is not null or p_currency is not null
     or p_commercial_terms_code is not null then
    raise exception using errcode = '22023', message = 'marketplace_free_offer_price_not_allowed';
  end if;

  select * into v_offer
  from private.marketplace_commercial_offers as offer
  where offer.addon_version_id = p_addon_version_id
  for update;
  if found then
    if v_offer.seller_account_id <> v_seller.id then
      raise exception using errcode = '42501', message = 'marketplace_offer_owner_required';
    end if;
    if v_offer.status <> 'draft'
       or exists (
         select 1 from private.marketplace_purchase_contracts as contract
         where contract.offer_id = v_offer.id
       )
       or exists (
         select 1 from private.marketplace_licenses as license
         where license.offer_id = v_offer.id
       ) then
      raise exception using errcode = '55000', message = 'marketplace_offer_configuration_immutable';
    end if;
    update private.marketplace_commercial_offers
    set publisher_id = p_publisher_id,
        offer_kind = p_offer_kind,
        price_id = v_price.id,
        commercial_terms_version_id = v_terms.id,
        license_key = p_license_key,
        license_version = p_license_version,
        buyer_terms_version = p_buyer_terms_version,
        seller_agreement_version = p_seller_agreement_version,
        commission_bps = coalesce(v_terms.commission_bps, 0),
        updated_at = pg_catalog.now()
    where id = v_offer.id
    returning * into v_offer;
    v_audit_action := 'marketplace_test_offer_revised';
  else
    insert into private.marketplace_commercial_offers (
      client_request_id, seller_account_id, publisher_id, listing_id, addon_version_id,
      offer_kind, price_id, commercial_terms_version_id,
      license_key, license_version, buyer_terms_version, seller_agreement_version,
      commission_bps
    ) values (
      p_client_request_id, v_seller.id, p_publisher_id, v_listing.id, v_version.id,
      p_offer_kind, v_price.id, v_terms.id,
      p_license_key, p_license_version, p_buyer_terms_version, p_seller_agreement_version,
      coalesce(v_terms.commission_bps, 0)
    ) returning * into v_offer;
    v_audit_action := 'marketplace_test_offer_configured';
  end if;
  v_result := pg_catalog.jsonb_build_object(
    'offerId', v_offer.id, 'listingId', v_offer.listing_id,
    'addonVersionId', v_offer.addon_version_id, 'offerKind', v_offer.offer_kind,
    'status', v_offer.status, 'commissionBps', v_offer.commission_bps,
    'commercialTermsCode', case when p_offer_kind = 'paid' then v_terms.terms_code else null end,
    'buyerTermsVersion', v_offer.buyer_terms_version,
    'testMode', true, 'idempotentReplay', false
  );
  insert into private.marketplace_offer_configuration_requests (
    client_request_id, requested_by, seller_account_id, offer_id,
    request_payload, result_payload
  ) values (
    p_client_request_id, p_actor_user_id, v_seller.id, v_offer.id,
    v_request_payload, v_result
  );
  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'user', v_audit_action,
    'marketplace_commercial_offer', v_offer.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'listing_id', v_listing.id, 'addon_version_id', v_version.id,
      'offer_kind', p_offer_kind, 'commission_bps', coalesce(v_terms.commission_bps, 0),
      'commercial_terms_code', case when p_offer_kind = 'paid' then v_terms.terms_code else null end,
      'publisher_id', p_publisher_id,
      'test_mode', true, 'publication_or_trust_changed', false
    )
  );
  return v_result;
end;
$$;

alter function public.configure_marketplace_test_offer(
  uuid, uuid, uuid, uuid, text, text, bigint, text, text, text, text, text, text, text
) owner to postgres;

create or replace function public.set_marketplace_test_offer_status(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_offer_id uuid,
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
  v_offer private.marketplace_commercial_offers%rowtype;
  v_seller private.economic_seller_accounts%rowtype;
  v_price private.economic_prices%rowtype;
  v_terms private.marketplace_commercial_term_versions%rowtype;
  v_request private.marketplace_offer_status_requests%rowtype;
  v_result jsonb;
  v_previous_status text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_client_request_id is null
     or p_offer_id is null
     or p_target_status is null
     or p_target_status not in ('active', 'suspended', 'retired')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'marketplace_test_offer_status_invalid';
  end if;
  if (p_target_status = 'active' and p_confirmation is distinct from 'ACTIVATE MARKETPLACE TEST OFFER')
     or (p_target_status = 'suspended' and p_confirmation is distinct from 'SUSPEND MARKETPLACE TEST OFFER')
     or (p_target_status = 'retired' and p_confirmation is distinct from 'RETIRE MARKETPLACE TEST OFFER') then
    raise exception using errcode = '22023', message = 'marketplace_test_offer_status_confirmation_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('marketplace_offer_status_request:' || p_client_request_id::text, 0)
  );
  select * into v_request
  from private.marketplace_offer_status_requests as request
  where request.client_request_id = p_client_request_id;
  if found then
    if v_request.requested_by <> p_actor_user_id
       or v_request.offer_id <> p_offer_id
       or v_request.target_status <> p_target_status
       or v_request.confirmation <> p_confirmation
       or v_request.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'marketplace_offer_status_idempotency_conflict';
    end if;
    return v_request.result_payload || pg_catalog.jsonb_build_object('idempotentReplay', true);
  end if;

  select * into v_offer
  from private.marketplace_commercial_offers as offer
  where offer.id = p_offer_id
  for update;
  select * into v_seller
  from private.economic_seller_accounts as seller
  where seller.id = v_offer.seller_account_id;
  if not found or v_seller.user_id <> p_actor_user_id then
    raise exception using errcode = '42501', message = 'marketplace_offer_owner_required';
  end if;
  if v_offer.status = 'retired' or v_offer.status = p_target_status
     or (p_target_status = 'suspended' and v_offer.status <> 'active') then
    raise exception using errcode = '55000', message = 'marketplace_offer_status_transition_invalid';
  end if;
  if p_target_status = 'active'
     and (private.economic_service_is_restricted(p_actor_user_id, 'marketplace_selling')
       or not private.marketplace_seller_is_eligible(p_actor_user_id)) then
    raise exception using errcode = '42501', message = 'marketplace_selling_restricted';
  end if;
  if p_target_status = 'active' and v_offer.offer_kind = 'paid' then
    if not private.economic_feature_enabled('marketplace_paid_offers')
       or v_seller.status <> 'ready'
       or not v_seller.charges_enabled
       or not v_seller.payouts_enabled then
      raise exception using errcode = '55000', message = 'marketplace_paid_offer_not_ready';
    end if;
    select * into v_terms
    from private.marketplace_commercial_term_versions
    where id = v_offer.commercial_terms_version_id
      and active = true and test_mode = true
      and approved_for_live_use = false and retired_at is null;
    if not found or not exists (
      select 1
      from private.economic_seller_onboarding_requests as request
      where request.seller_account_id = v_seller.id
        and request.requested_by = p_actor_user_id
        and request.seller_agreement_version = v_terms.seller_agreement_version
        and request.status = 'completed'
    ) then
      raise exception using errcode = '55000', message = 'marketplace_paid_offer_seller_terms_not_current';
    end if;
    select * into v_price from private.economic_prices where id = v_offer.price_id;
    if not exists (
      select 1 from private.economic_provider_catalog as catalog
      where catalog.provider = 'stripe'
        and catalog.price_code = v_price.price_code
        and catalog.active = true and catalog.test_mode = true
        and catalog.retired_at is null
    ) then
      raise exception using errcode = '55000', message = 'marketplace_test_offer_catalog_not_configured';
    end if;
  end if;
  if p_target_status = 'active' and not exists (
    select 1
    from public.marketplace_addon_versions as version
    join public.marketplace_listings as listing on listing.id = version.listing_id
    where version.id = v_offer.addon_version_id
      and version.review_status = 'approved' and version.published_at is not null
      and version.revoked_at is null
      and listing.listing_status = 'published' and listing.revoked_at is null
  ) then
    raise exception using errcode = '55000', message = 'marketplace_offer_version_no_longer_publishable';
  end if;
  v_previous_status := v_offer.status;
  update private.marketplace_commercial_offers
  set status = p_target_status,
      activated_at = case
        when p_target_status = 'active' then coalesce(activated_at, pg_catalog.now())
        else activated_at
      end,
      retired_at = case when p_target_status = 'retired' then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where id = v_offer.id returning * into v_offer;
  v_result := pg_catalog.jsonb_build_object(
    'offerId', v_offer.id,
    'status', v_offer.status,
    'offerKind', v_offer.offer_kind,
    'testMode', true,
    'idempotentReplay', false
  );
  insert into private.marketplace_offer_status_requests (
    client_request_id, requested_by, seller_account_id, offer_id,
    previous_status, target_status, confirmation, private_reason, result_payload
  ) values (
    p_client_request_id, p_actor_user_id, v_seller.id, v_offer.id,
    v_previous_status, p_target_status, p_confirmation, pg_catalog.btrim(p_reason), v_result
  );
  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'user', case p_target_status
      when 'active' then 'marketplace_test_offer_activated'
      when 'suspended' then 'marketplace_test_offer_suspended'
      else 'marketplace_test_offer_retired'
    end,
    'marketplace_commercial_offer', v_offer.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'offer_kind', v_offer.offer_kind,
      'previous_status', v_previous_status,
      'target_status', p_target_status,
      'test_mode', true,
      'publication_or_trust_changed', false
    )
  );
  return v_result;
end;
$$;

alter function public.set_marketplace_test_offer_status(uuid, uuid, uuid, text, text, text)
  owner to postgres;

create or replace function public.prepare_marketplace_purchase_checkout(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_offer_id uuid,
  p_source_route text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer private.marketplace_commercial_offers%rowtype;
  v_seller private.economic_seller_accounts%rowtype;
  v_price private.economic_prices%rowtype;
  v_terms private.marketplace_commercial_term_versions%rowtype;
  v_result jsonb;
  v_order_id uuid;
  v_contract private.marketplace_purchase_contracts%rowtype;
  v_license private.marketplace_licenses%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_actor_user_id is null then
    raise exception using errcode = '42501', message = 'marketplace_purchase_account_required';
  end if;
  select * into v_offer
  from private.marketplace_commercial_offers as offer
  where offer.id = p_offer_id and offer.status = 'active' and offer.offer_kind = 'paid';
  if not found
     or not private.economic_feature_enabled('marketplace_paid_offers') then
    raise exception using errcode = 'P0002', message = 'marketplace_paid_offer_not_found';
  end if;
  select * into v_seller
  from private.economic_seller_accounts
  where id = v_offer.seller_account_id;
  if v_seller.user_id = p_actor_user_id then
    raise exception using errcode = '42501', message = 'marketplace_seller_self_purchase_prohibited';
  end if;
  select license.* into v_license
  from private.marketplace_licenses as license
  where license.buyer_user_id = p_actor_user_id
    and license.offer_id = v_offer.id;
  if found then
    return pg_catalog.jsonb_build_object(
      'alreadyOwned', true,
      'checkoutPrepared', false,
      'licenseId', v_license.id,
      'offerId', v_offer.id,
      'listingId', v_license.listing_id,
      'addonVersionId', v_license.addon_version_id,
      'economicStatus', v_license.economic_status,
      'installAuthorized', false,
      'testMode', true
    );
  end if;
  if private.economic_service_is_restricted(v_seller.user_id, 'marketplace_selling')
     or not private.marketplace_seller_is_eligible(v_seller.user_id)
     or v_seller.status <> 'ready'
     or not v_seller.details_submitted
     or not v_seller.charges_enabled
     or not v_seller.payouts_enabled
     or v_seller.provider <> 'stripe'
     or v_seller.provider_account_reference is null
     or v_seller.provider_status_updated_at is null
     or v_seller.provider_status_updated_at < pg_catalog.now() - interval '24 hours' then
    raise exception using errcode = '55000', message = 'marketplace_paid_offer_not_ready';
  end if;
  if not exists (
    select 1 from public.marketplace_addon_versions as version
    join public.marketplace_listings as listing on listing.id = version.listing_id
    where version.id = v_offer.addon_version_id
      and version.review_status = 'approved' and version.published_at is not null
      and version.revoked_at is null
      and listing.listing_status = 'published' and listing.revoked_at is null
  ) then
    raise exception using errcode = '55000', message = 'marketplace_offer_unavailable';
  end if;
  select * into v_price from private.economic_prices where id = v_offer.price_id;
  select * into v_terms
  from private.marketplace_commercial_term_versions
  where id = v_offer.commercial_terms_version_id and active = true and retired_at is null;
  if not found or p_consent_version <> v_offer.buyer_terms_version
     or v_offer.buyer_terms_version <> v_terms.buyer_terms_version then
    raise exception using errcode = '22023', message = 'marketplace_buyer_terms_version_mismatch';
  end if;
  select contract.* into v_contract
  from private.marketplace_purchase_contracts as contract
  join private.economic_orders as existing_order on existing_order.id = contract.order_id
  where existing_order.client_request_id = p_client_request_id;
  if found then
    if v_contract.buyer_user_id <> p_actor_user_id
       or v_contract.offer_id <> v_offer.id then
      raise exception using errcode = '23505', message = 'marketplace_purchase_idempotency_conflict';
    end if;
  elsif exists (
    select 1
    from private.marketplace_purchase_contracts as existing_contract
    where existing_contract.buyer_user_id = p_actor_user_id
      and existing_contract.offer_id = v_offer.id
  ) then
    raise exception using errcode = '55000', message = 'marketplace_purchase_already_in_progress';
  end if;
  v_result := public.begin_economic_checkout(
    p_actor_user_id, p_client_request_id, 'marketplace_purchase',
    v_price.unit_amount_minor, v_price.currency, v_price.price_code,
    p_source_route, p_consent_version
  );
  v_order_id := (v_result ->> 'orderId')::uuid;
  select * into v_contract from private.marketplace_purchase_contracts where order_id = v_order_id;
  if found then
    if v_contract.offer_id <> v_offer.id or v_contract.buyer_user_id <> p_actor_user_id then
      raise exception using errcode = '23505', message = 'marketplace_purchase_contract_conflict';
    end if;
  else
    insert into private.marketplace_purchase_contracts (
      order_id, offer_id, buyer_user_id, seller_account_id,
      listing_id, addon_version_id, license_key_snapshot,
      license_version_snapshot, commission_bps_snapshot,
      gross_amount_minor, currency
    ) values (
      v_order_id, v_offer.id, p_actor_user_id, v_offer.seller_account_id,
      v_offer.listing_id, v_offer.addon_version_id, v_offer.license_key,
      v_offer.license_version, v_offer.commission_bps,
      v_price.unit_amount_minor, v_price.currency
    ) returning * into v_contract;
  end if;
  return v_result || pg_catalog.jsonb_build_object(
    'purchaseContractId', v_contract.id,
    'offerId', v_offer.id,
    'listingId', v_offer.listing_id,
    'addonVersionId', v_offer.addon_version_id,
    'licenseKey', v_offer.license_key,
    'licenseVersion', v_offer.license_version,
    'installAuthorized', false,
    'publicationOrTrustChanged', false,
    'testMode', true
  );
end;
$$;

alter function public.prepare_marketplace_purchase_checkout(uuid, uuid, uuid, text, text)
  owner to postgres;

create or replace function public.accept_marketplace_free_license(
  p_actor_user_id uuid,
  p_offer_id uuid,
  p_client_request_id uuid,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer private.marketplace_commercial_offers%rowtype;
  v_license private.marketplace_licenses%rowtype;
  v_seller_user_id uuid;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_actor_user_id is null or p_client_request_id is null
     or pg_catalog.char_length(coalesce(p_consent_version, '')) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'marketplace_free_license_acceptance_invalid';
  end if;
  select * into v_offer
  from private.marketplace_commercial_offers as offer
  where offer.id = p_offer_id and offer.status = 'active' and offer.offer_kind = 'free';
  if not found then
    raise exception using errcode = 'P0002', message = 'marketplace_free_offer_not_found';
  end if;
  if p_consent_version <> v_offer.buyer_terms_version then
    raise exception using errcode = '22023', message = 'marketplace_buyer_terms_version_mismatch';
  end if;
  perform private.require_active_economic_consent_bundle(
    'marketplace_free_license_bundle', p_consent_version
  );
  select seller.user_id into v_seller_user_id
  from private.economic_seller_accounts as seller
  where seller.id = v_offer.seller_account_id;
  if v_seller_user_id = p_actor_user_id then
    raise exception using errcode = '42501', message = 'marketplace_seller_self_purchase_prohibited';
  end if;
  if not exists (
    select 1 from public.marketplace_addon_versions as version
    join public.marketplace_listings as listing on listing.id = version.listing_id
    where version.id = v_offer.addon_version_id
      and version.review_status = 'approved'
      and version.revoked_at is null and version.published_at is not null
      and listing.listing_status = 'published' and listing.revoked_at is null
  ) then
    raise exception using errcode = '55000', message = 'marketplace_offer_unavailable';
  end if;
  select * into v_license
  from private.marketplace_licenses as license
  where license.client_request_id = p_client_request_id;
  if found then
    if v_license.buyer_user_id <> p_actor_user_id or v_license.offer_id <> p_offer_id then
      raise exception using errcode = '23505', message = 'marketplace_license_idempotency_conflict';
    end if;
    if not exists (
      select 1 from private.economic_consents as consent
      where consent.client_request_id = p_client_request_id
        and consent.user_id = p_actor_user_id
        and consent.document_key = 'marketplace_free_license_bundle'
        and consent.document_version = p_consent_version
        and consent.source_route = '/marketplace'
    ) then
      raise exception using errcode = '23505', message = 'marketplace_license_consent_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'licenseId', v_license.id, 'offerId', v_offer.id,
      'listingId', v_license.listing_id, 'addonVersionId', v_license.addon_version_id,
      'licenseKey', v_license.license_key, 'licenseVersion', v_license.license_version,
      'economicStatus', v_license.economic_status, 'alreadyOwned', false,
      'installAuthorized', false, 'testMode', true, 'idempotentReplay', true
    );
  end if;
  select * into v_license
  from private.marketplace_licenses as license
  where license.buyer_user_id = p_actor_user_id and license.offer_id = p_offer_id;
  if found then
    return pg_catalog.jsonb_build_object(
      'licenseId', v_license.id, 'offerId', v_offer.id,
      'listingId', v_license.listing_id, 'addonVersionId', v_license.addon_version_id,
      'licenseKey', v_license.license_key, 'licenseVersion', v_license.license_version,
      'economicStatus', v_license.economic_status, 'alreadyOwned', true,
      'installAuthorized', false, 'testMode', true, 'idempotentReplay', false
    );
  end if;
  if private.economic_service_is_restricted(v_seller_user_id, 'marketplace_selling')
     or not private.marketplace_seller_is_eligible(v_seller_user_id)
     or exists (
       select 1 from private.economic_seller_accounts as seller
       where seller.id = v_offer.seller_account_id
         and seller.status in ('restricted', 'closed')
     ) then
    raise exception using errcode = '55000', message = 'marketplace_offer_unavailable';
  end if;
  if private.economic_service_is_restricted(p_actor_user_id, 'marketplace_buying') then
    raise exception using errcode = '42501', message = 'marketplace_buying_restricted';
  end if;
  insert into private.marketplace_licenses (
    client_request_id, buyer_user_id, offer_id, listing_id, addon_version_id,
    license_key, license_version, acquisition_kind
  ) values (
    p_client_request_id, p_actor_user_id, v_offer.id, v_offer.listing_id,
    v_offer.addon_version_id, v_offer.license_key, v_offer.license_version,
    'free_acceptance'
  ) on conflict (buyer_user_id, offer_id) do nothing
  returning * into v_license;
  if not found then
    select * into v_license from private.marketplace_licenses
    where buyer_user_id = p_actor_user_id and offer_id = p_offer_id;
    return pg_catalog.jsonb_build_object(
      'licenseId', v_license.id, 'offerId', v_offer.id,
      'listingId', v_license.listing_id, 'addonVersionId', v_license.addon_version_id,
      'licenseKey', v_license.license_key, 'licenseVersion', v_license.license_version,
      'economicStatus', v_license.economic_status, 'alreadyOwned', true,
      'installAuthorized', false, 'testMode', true, 'idempotentReplay', false
    );
  end if;
  insert into private.economic_consents (
    user_id, document_key, document_version, source_route,
    client_request_id, metadata
  ) values (
    p_actor_user_id, 'marketplace_free_license_bundle', p_consent_version,
    '/marketplace', p_client_request_id,
    pg_catalog.jsonb_build_object('offer_id', v_offer.id, 'financial_payment', false)
  );
  return pg_catalog.jsonb_build_object(
    'licenseId', v_license.id, 'offerId', v_offer.id,
    'listingId', v_license.listing_id, 'addonVersionId', v_license.addon_version_id,
    'licenseKey', v_license.license_key, 'licenseVersion', v_license.license_version,
    'economicStatus', v_license.economic_status, 'alreadyOwned', false,
    'installAuthorized', false, 'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.accept_marketplace_free_license(uuid, uuid, uuid, text)
  owner to postgres;

create or replace function private.fulfill_paid_marketplace_license()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract private.marketplace_purchase_contracts%rowtype;
  v_license private.marketplace_licenses%rowtype;
  v_commission bigint;
begin
  if new.flow <> 'marketplace_purchase' or new.status <> 'paid' or old.status = 'paid' then
    return new;
  end if;
  select * into v_contract
  from private.marketplace_purchase_contracts as contract
  where contract.order_id = new.id
  for update;
  if not found then
    raise exception using errcode = '55000', message = 'marketplace_purchase_contract_missing';
  end if;
  -- Once a verified settlement has been quarantined, later paid projections
  -- (for example after a dispute is won) cannot silently revive fulfillment.
  -- Only the verified full-refund path resolves the durable hold.
  if exists (
    select 1
    from private.marketplace_fulfillment_holds as hold
    where hold.order_id = new.id
      and hold.purchase_contract_id = v_contract.id
      and hold.status = 'refund_required'
  ) then
    update private.marketplace_purchase_contracts
    set status = 'reconciliation_required', updated_at = pg_catalog.now()
    where id = v_contract.id;
    return new;
  end if;
  -- Payment truth is retained, but fulfillment is quarantined if safety,
  -- seller readiness, or publication changed while hosted Checkout was open.
  -- No license, entitlement, commission, payable, approval, or install power is
  -- created; private operators must refund/reconcile the verified payment.
  if not exists (
    select 1
    from private.marketplace_commercial_offers as offer
    join private.economic_seller_accounts as seller on seller.id = offer.seller_account_id
    join public.marketplace_listings as listing on listing.id = offer.listing_id
    join public.marketplace_addon_versions as version on version.id = offer.addon_version_id
    where offer.id = v_contract.offer_id
      and offer.status = 'active' and offer.offer_kind = 'paid'
      and seller.id = v_contract.seller_account_id
      and seller.status = 'ready'
      and seller.details_submitted and seller.charges_enabled and seller.payouts_enabled
      and seller.provider = 'stripe' and seller.provider_account_reference is not null
      and seller.provider_status_updated_at >= pg_catalog.now() - interval '24 hours'
      and private.marketplace_seller_is_eligible(seller.user_id)
      and not private.economic_service_is_restricted(seller.user_id, 'marketplace_selling')
      and listing.listing_status = 'published' and listing.revoked_at is null
      and version.review_status = 'approved' and version.published_at is not null
      and version.revoked_at is null
  ) then
    insert into private.marketplace_fulfillment_holds (
      order_id, purchase_contract_id, buyer_user_id, seller_account_id, offer_id
    ) values (
      new.id, v_contract.id, v_contract.buyer_user_id,
      v_contract.seller_account_id, v_contract.offer_id
    ) on conflict (order_id) do nothing;
    update private.marketplace_purchase_contracts
    set status = 'reconciliation_required', updated_at = pg_catalog.now()
    where id = v_contract.id;
    insert into private.economic_audit_events (
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'provider_webhook', 'marketplace_paid_fulfillment_quarantined',
      'economic_order', new.id,
      pg_catalog.jsonb_build_object(
        'reason_code', 'offer_unavailable_at_payment',
        'refund_required', true,
        'license_created', false,
        'seller_payable_created', false,
        'install_authorized', false
      )
    );
    return new;
  end if;
  select * into v_license
  from private.marketplace_licenses as license
  where license.buyer_user_id = v_contract.buyer_user_id
    and license.offer_id = v_contract.offer_id
  for update;
  if found then
    if v_license.order_id = new.id then
      return new;
    end if;
    insert into private.marketplace_license_conflicts (
      order_id, buyer_user_id, offer_id, existing_license_id,
      status
    ) values (
      new.id, v_contract.buyer_user_id, v_contract.offer_id, v_license.id,
      'refund_required'
    ) on conflict (order_id) do nothing;
    update private.marketplace_purchase_contracts
    set status = 'reconciliation_required', updated_at = pg_catalog.now()
    where id = v_contract.id;
    insert into private.economic_audit_events (
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'provider_webhook', 'marketplace_duplicate_license_payment_quarantined',
      'economic_order', new.id,
      pg_catalog.jsonb_build_object(
        'existing_license_id', v_license.id,
        'refund_required', true,
        'install_authorized', false
      )
    );
    return new;
  end if;
  insert into private.marketplace_licenses (
    buyer_user_id, offer_id, order_id, listing_id, addon_version_id,
    license_key, license_version, acquisition_kind
  ) values (
    v_contract.buyer_user_id, v_contract.offer_id, new.id,
    v_contract.listing_id, v_contract.addon_version_id,
    v_contract.license_key_snapshot, v_contract.license_version_snapshot,
    'paid_order'
  ) returning * into v_license;
  update private.marketplace_purchase_contracts
  set status = 'active', updated_at = pg_catalog.now()
  where id = v_contract.id;
  insert into private.marketplace_order_financial_state(order_id, license_id)
  values (new.id, v_license.id)
  on conflict (order_id) do nothing;

  v_commission := pg_catalog.floor(
    v_contract.gross_amount_minor::numeric * v_contract.commission_bps_snapshot::numeric / 10000
  )::bigint;
  insert into private.marketplace_commission_events (
    order_id, license_id, seller_account_id, event_type,
    gross_delta_minor, commission_delta_minor, payable_delta_minor,
    currency, idempotency_key
  ) values (
    new.id, v_license.id, v_contract.seller_account_id, 'sale',
    v_contract.gross_amount_minor, v_commission,
    v_contract.gross_amount_minor - v_commission,
    v_contract.currency, 'marketplace-sale:' || new.id::text
  ) on conflict (idempotency_key) do nothing;
  update private.marketplace_order_financial_state
  set sale_recorded = true, updated_at = pg_catalog.now()
  where order_id = new.id;
  insert into private.economic_entitlements (
    user_id, entitlement_key, source_type, source_id, status, starts_at
  ) values (
    v_contract.buyer_user_id, 'marketplace_version_license',
    'economic_order', new.id, 'active', coalesce(new.paid_at, pg_catalog.now())
  ) on conflict do nothing;
  return new;
end;
$$;

alter function private.fulfill_paid_marketplace_license() owner to postgres;
revoke all privileges on function private.fulfill_paid_marketplace_license()
  from public, anon, authenticated, service_role;

create trigger economic_orders_fulfill_marketplace_license
after update of status on private.economic_orders
for each row execute function private.fulfill_paid_marketplace_license();

create or replace function private.reconcile_marketplace_order_accounting(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract private.marketplace_purchase_contracts%rowtype;
  v_license private.marketplace_licenses%rowtype;
  v_state private.marketplace_order_financial_state%rowtype;
  v_refunded bigint;
  v_lost bigint;
  v_active_dispute bigint;
  v_refund_commission bigint;
  v_lost_commission bigint;
  v_base_payable bigint;
  v_hold bigint;
  v_delta_gross bigint;
  v_delta_commission bigint;
  v_delta_payable bigint;
begin
  select * into v_contract
  from private.marketplace_purchase_contracts as contract
  where contract.order_id = p_order_id
  for update;
  if not found then return; end if;
  if exists (
    select 1 from private.marketplace_fulfillment_holds as hold
    where hold.order_id = p_order_id and hold.status = 'refund_required'
  ) then
    select least(v_contract.gross_amount_minor, coalesce(pg_catalog.sum(refund.amount_minor), 0))
    into v_refunded from private.economic_refunds as refund
    where refund.order_id = p_order_id and refund.status = 'succeeded';
    if v_refunded >= v_contract.gross_amount_minor then
      update private.marketplace_fulfillment_holds
      set status = 'resolved', resolved_at = pg_catalog.now()
      where order_id = p_order_id and status = 'refund_required';
      update private.marketplace_purchase_contracts
      set status = 'refunded', updated_at = pg_catalog.now()
      where id = v_contract.id;
      insert into private.economic_audit_events (
        actor_kind, action, target_type, target_id, metadata
      ) values (
        'provider_webhook', 'marketplace_fulfillment_hold_refunded',
        'economic_order', p_order_id,
        pg_catalog.jsonb_build_object('license_created', false, 'seller_payable_created', false)
      );
    end if;
    return;
  end if;
  select * into v_license from private.marketplace_licenses where order_id = p_order_id for update;
  select * into v_state from private.marketplace_order_financial_state where order_id = p_order_id for update;
  if not found then return; end if;

  select least(v_contract.gross_amount_minor, coalesce(pg_catalog.sum(refund.amount_minor), 0))
  into v_refunded from private.economic_refunds as refund
  where refund.order_id = p_order_id and refund.status = 'succeeded';
  select least(v_contract.gross_amount_minor - v_refunded, coalesce(pg_catalog.sum(dispute.amount_minor), 0))
  into v_lost from private.economic_disputes as dispute
  where dispute.order_id = p_order_id and dispute.status = 'lost';
  select least(
    greatest(v_contract.gross_amount_minor - v_refunded - v_lost, 0),
    coalesce(pg_catalog.sum(dispute.amount_minor), 0)
  ) into v_active_dispute
  from private.economic_disputes as dispute
  where dispute.order_id = p_order_id
    and dispute.status in (
      'warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'
    );

  v_refund_commission := pg_catalog.floor(
    v_refunded::numeric * v_contract.commission_bps_snapshot::numeric / 10000
  )::bigint;
  v_lost_commission := pg_catalog.floor(
    v_lost::numeric * v_contract.commission_bps_snapshot::numeric / 10000
  )::bigint;
  v_base_payable := v_contract.gross_amount_minor
    - pg_catalog.floor(v_contract.gross_amount_minor::numeric * v_contract.commission_bps_snapshot / 10000)::bigint
    - (v_refunded - v_refund_commission)
    - (v_lost - v_lost_commission);
  v_hold := least(v_base_payable, pg_catalog.floor(
    v_active_dispute::numeric * (10000 - v_contract.commission_bps_snapshot)::numeric / 10000
  )::bigint);

  if v_refunded <> v_state.refunded_gross_minor
     or v_refund_commission <> v_state.refunded_commission_minor then
    v_delta_gross := -(v_refunded - v_state.refunded_gross_minor);
    v_delta_commission := -(v_refund_commission - v_state.refunded_commission_minor);
    v_delta_payable := v_delta_gross - v_delta_commission;
    insert into private.marketplace_commission_events (
      order_id, license_id, seller_account_id, event_type,
      gross_delta_minor, commission_delta_minor, payable_delta_minor,
      currency, idempotency_key
    ) values (
      p_order_id, v_license.id, v_contract.seller_account_id,
      case when v_delta_gross < 0 then 'refund' else 'refund_reversal' end,
      v_delta_gross, v_delta_commission, v_delta_payable, v_contract.currency,
      'marketplace-refund-state:' || p_order_id::text || ':' || v_refunded::text
    ) on conflict (idempotency_key) do nothing;
  end if;
  if v_lost <> v_state.lost_dispute_gross_minor
     or v_lost_commission <> v_state.lost_dispute_commission_minor then
    v_delta_gross := -(v_lost - v_state.lost_dispute_gross_minor);
    v_delta_commission := -(v_lost_commission - v_state.lost_dispute_commission_minor);
    v_delta_payable := v_delta_gross - v_delta_commission;
    insert into private.marketplace_commission_events (
      order_id, license_id, seller_account_id, event_type,
      gross_delta_minor, commission_delta_minor, payable_delta_minor,
      currency, idempotency_key
    ) values (
      p_order_id, v_license.id, v_contract.seller_account_id,
      case when v_delta_gross < 0 then 'chargeback' else 'chargeback_reversal' end,
      v_delta_gross, v_delta_commission, v_delta_payable, v_contract.currency,
      'marketplace-chargeback-state:' || p_order_id::text || ':' || v_lost::text
    ) on conflict (idempotency_key) do nothing;
  end if;
  if v_hold <> v_state.dispute_held_payable_minor then
    v_delta_payable := -(v_hold - v_state.dispute_held_payable_minor);
    insert into private.marketplace_commission_events (
      order_id, license_id, seller_account_id, event_type,
      gross_delta_minor, commission_delta_minor, payable_delta_minor,
      currency, idempotency_key
    ) values (
      p_order_id, v_license.id, v_contract.seller_account_id,
      case when v_delta_payable < 0 then 'dispute_hold' else 'dispute_release' end,
      0, 0, v_delta_payable, v_contract.currency,
      'marketplace-dispute-hold-state:' || p_order_id::text || ':' || v_hold::text
    ) on conflict (idempotency_key) do nothing;
  end if;

  update private.marketplace_order_financial_state
  set refunded_gross_minor = v_refunded,
      refunded_commission_minor = v_refund_commission,
      lost_dispute_gross_minor = v_lost,
      lost_dispute_commission_minor = v_lost_commission,
      dispute_held_payable_minor = v_hold,
      updated_at = pg_catalog.now()
  where order_id = p_order_id;
  update private.marketplace_purchase_contracts
  set status = case
    when v_active_dispute > 0 or v_lost > 0 then 'disputed'
    when v_refunded >= gross_amount_minor then 'refunded'
    when v_refunded > 0 then 'partially_refunded'
    else 'active'
  end, updated_at = pg_catalog.now()
  where order_id = p_order_id;
  update private.marketplace_licenses
  set economic_status = case
    when v_active_dispute > 0 or v_lost > 0 then 'disputed'
    when v_refunded >= v_contract.gross_amount_minor then 'refunded'
    when v_refunded > 0 then 'partially_refunded'
    else 'active'
  end, updated_at = pg_catalog.now()
  where id = v_license.id;
end;
$$;

alter function private.reconcile_marketplace_order_accounting(uuid) owner to postgres;
revoke all privileges on function private.reconcile_marketplace_order_accounting(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.marketplace_refund_accounting_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.reconcile_marketplace_order_accounting(new.order_id); return new; end;
$$;
create or replace function private.marketplace_dispute_accounting_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.reconcile_marketplace_order_accounting(new.order_id); return new; end;
$$;
alter function private.marketplace_refund_accounting_trigger() owner to postgres;
alter function private.marketplace_dispute_accounting_trigger() owner to postgres;
revoke all privileges on function private.marketplace_refund_accounting_trigger()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.marketplace_dispute_accounting_trigger()
  from public, anon, authenticated, service_role;
create trigger economic_refunds_reconcile_marketplace_accounting
after insert or update of status on private.economic_refunds
for each row execute function private.marketplace_refund_accounting_trigger();
create trigger economic_disputes_reconcile_marketplace_accounting
after insert or update of status on private.economic_disputes
for each row execute function private.marketplace_dispute_accounting_trigger();

create or replace function public.marketplace_commercial_offer_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'offerId', offer.id,
    'listingId', offer.listing_id,
    'addonVersionId', offer.addon_version_id,
    'listingSlug', listing.slug,
    'listingName', listing.name,
    'version', version.version,
    'offerKind', offer.offer_kind,
    'amountMinor', price.unit_amount_minor,
    'currency', price.currency,
    'licenseKey', offer.license_key,
    'licenseVersion', offer.license_version,
    'buyerTermsVersion', offer.buyer_terms_version,
    'paymentGrantsTrust', false,
    'purchaseInstallsAddon', false,
    'testMode', true
  ) order by listing.name, version.version), '[]'::jsonb)
  from private.marketplace_commercial_offers as offer
  join public.marketplace_listings as listing on listing.id = offer.listing_id
  join public.marketplace_addon_versions as version on version.id = offer.addon_version_id
  join private.economic_seller_accounts as seller on seller.id = offer.seller_account_id
  left join private.economic_prices as price on price.id = offer.price_id
  where offer.status = 'active'
    and (
      offer.offer_kind = 'free'
      or private.economic_feature_enabled('marketplace_paid_offers')
    )
    and listing.listing_status = 'published' and listing.revoked_at is null
    and version.review_status = 'approved' and version.published_at is not null
    and version.revoked_at is null
    and seller.status not in ('restricted', 'closed')
    and private.marketplace_seller_is_eligible(seller.user_id)
    and not private.economic_service_is_restricted(seller.user_id, 'marketplace_selling')
    and (
      offer.offer_kind = 'free'
      or (
        seller.status = 'ready'
        and seller.details_submitted
        and seller.charges_enabled
        and seller.payouts_enabled
        and seller.provider = 'stripe'
        and seller.provider_account_reference is not null
        and seller.provider_status_updated_at >= pg_catalog.now() - interval '24 hours'
      )
    );
$$;

alter function public.marketplace_commercial_offer_catalog() owner to postgres;

create or replace function public.current_user_marketplace_purchases()
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
    'licenses', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'licenseId', license.id,
        'listingId', license.listing_id,
        'addonVersionId', license.addon_version_id,
        'listingSlug', listing.slug,
        'listingName', listing.name,
        'version', version.version,
        'licenseKey', license.license_key,
        'licenseVersion', license.license_version,
        'acquisitionKind', license.acquisition_kind,
        'economicStatus', license.economic_status,
        'safetyStatus', case
          when listing.revoked_at is not null or version.revoked_at is not null then 'revoked'
          when listing.listing_status <> 'published' or version.review_status <> 'approved' then 'unavailable'
          else 'available'
        end,
        'installAuthorized', false,
        'acquiredAt', license.acquired_at
      ) order by license.acquired_at desc)
      from private.marketplace_licenses as license
      join public.marketplace_listings as listing on listing.id = license.listing_id
      join public.marketplace_addon_versions as version on version.id = license.addon_version_id
      where license.buyer_user_id = v_actor
    ), '[]'::jsonb),
    'testMode', true
  );
end;
$$;

alter function public.current_user_marketplace_purchases() owner to postgres;

create or replace function private.marketplace_available_seller_payable(
  p_seller_account_id uuid,
  p_currency text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pg_catalog.sum(event.payable_delta_minor)
    from private.marketplace_commission_events as event
    where event.seller_account_id = p_seller_account_id
      and event.currency = lower(p_currency)
  ), 0) - coalesce((
    select pg_catalog.sum(payout.amount_minor)
    from private.marketplace_payout_preparations as payout
    where payout.seller_account_id = p_seller_account_id
      and payout.currency = lower(p_currency)
      and payout.status in ('prepared', 'transfer_pending', 'transferred')
  ), 0)
$$;

alter function private.marketplace_available_seller_payable(uuid, text) owner to postgres;
revoke all privileges on function private.marketplace_available_seller_payable(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.marketplace_available_seller_payable_by_currency(
  p_seller_account_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_object_agg(
    currencies.currency,
    private.marketplace_available_seller_payable(p_seller_account_id, currencies.currency)
  ), '{}'::jsonb)
  from (
    select event.currency
    from private.marketplace_commission_events as event
    where event.seller_account_id = p_seller_account_id
    union
    select payout.currency
    from private.marketplace_payout_preparations as payout
    where payout.seller_account_id = p_seller_account_id
  ) as currencies
$$;

alter function private.marketplace_available_seller_payable_by_currency(uuid) owner to postgres;
revoke all privileges on function private.marketplace_available_seller_payable_by_currency(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.current_user_economic_seller_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_seller private.economic_seller_accounts%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;
  select * into v_seller from private.economic_seller_accounts where user_id = v_actor;
  if not found then
    return pg_catalog.jsonb_build_object(
      'eligible', private.marketplace_seller_is_eligible(v_actor),
      'configured', false, 'status', 'not_configured',
      'freeSellerAgreementVersion', null,
      'totalOwnedOfferCount', 0,
      'offersTruncated', false,
      'ownedOffers', '[]'::jsonb,
      'eligibleReviewedVersionCount', 0,
      'eligibleReviewedVersionsTruncated', false,
      'eligibleReviewedVersions', '[]'::jsonb,
      'publisherOptionCount', 0,
      'publisherOptionsTruncated', false,
      'publisherOptions', '[]'::jsonb,
      'testMode', true
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'eligible', private.marketplace_seller_is_eligible(v_actor),
    'configured', true,
    'status', v_seller.status,
    'detailsSubmitted', v_seller.details_submitted,
    'chargesEnabled', v_seller.charges_enabled,
    'payoutsEnabled', v_seller.payouts_enabled,
    'sellerAgreementVersion', (
      select request.seller_agreement_version
      from private.economic_seller_onboarding_requests as request
      where request.seller_account_id = v_seller.id
      order by request.created_at desc limit 1
    ),
    'stripeConnectDisclosureVersion', (
      select request.stripe_connect_disclosure_version
      from private.economic_seller_onboarding_requests as request
      where request.seller_account_id = v_seller.id
      order by request.created_at desc limit 1
    ),
    'freeSellerAgreementVersion', (
      select agreement.agreement_version
      from private.marketplace_free_seller_agreements as agreement
      where agreement.seller_account_id = v_seller.id
      order by agreement.accepted_at desc, agreement.client_request_id desc
      limit 1
    ),
    'activeOfferCount', (
      select pg_catalog.count(*) from private.marketplace_commercial_offers
      where seller_account_id = v_seller.id and status = 'active'
    ),
    'totalOwnedOfferCount', (
      select pg_catalog.count(*) from private.marketplace_commercial_offers
      where seller_account_id = v_seller.id
    ),
    'offersTruncated', (
      select pg_catalog.count(*) > 100 from private.marketplace_commercial_offers
      where seller_account_id = v_seller.id
    ),
    'ownedOffers', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'offerId', owned_offer.offer_id,
          'listingId', owned_offer.listing_id,
          'addonVersionId', owned_offer.addon_version_id,
          'listingSlug', owned_offer.listing_slug,
          'listingName', owned_offer.listing_name,
          'version', owned_offer.version,
          'publisherId', owned_offer.publisher_id,
          'offerKind', owned_offer.offer_kind,
          'status', owned_offer.status,
          'priceCode', owned_offer.price_code,
          'amountMinor', owned_offer.amount_minor,
          'currency', owned_offer.currency,
          'licenseKey', owned_offer.license_key,
          'licenseVersion', owned_offer.license_version,
          'buyerTermsVersion', owned_offer.buyer_terms_version,
          'sellerAgreementVersion', owned_offer.seller_agreement_version,
          'commercialTermsCode', owned_offer.commercial_terms_code,
          'commissionBps', owned_offer.commission_bps,
          'canRevise', owned_offer.can_revise,
          'activatedAt', owned_offer.activated_at,
          'retiredAt', owned_offer.retired_at,
          'updatedAt', owned_offer.updated_at
        ) order by owned_offer.updated_at desc, owned_offer.offer_id
      ), '[]'::jsonb)
      from (
        select
          offer.id as offer_id,
          offer.listing_id,
          offer.addon_version_id,
          listing.slug as listing_slug,
          listing.name as listing_name,
          addon_version.version,
          offer.publisher_id,
          offer.offer_kind,
          offer.status,
          price.price_code,
          price.unit_amount_minor as amount_minor,
          price.currency,
          offer.license_key,
          offer.license_version,
          offer.buyer_terms_version,
          offer.seller_agreement_version,
          terms.terms_code as commercial_terms_code,
          offer.commission_bps,
          offer.status = 'draft'
            and not exists (
              select 1 from private.marketplace_purchase_contracts as contract
              where contract.offer_id = offer.id
            )
            and not exists (
              select 1 from private.marketplace_licenses as license
              where license.offer_id = offer.id
            ) as can_revise,
          offer.activated_at,
          offer.retired_at,
          offer.updated_at
        from private.marketplace_commercial_offers as offer
        join public.marketplace_listings as listing on listing.id = offer.listing_id
        join public.marketplace_addon_versions as addon_version on addon_version.id = offer.addon_version_id
        left join private.economic_prices as price on price.id = offer.price_id
        left join private.marketplace_commercial_term_versions as terms
          on terms.id = offer.commercial_terms_version_id
        where offer.seller_account_id = v_seller.id
        order by offer.updated_at desc, offer.id
        limit 100
      ) as owned_offer
    ),
    'eligibleReviewedVersionCount', (
      select pg_catalog.count(*)
      from public.marketplace_addon_versions as addon_version
      join public.marketplace_listings as listing on listing.id = addon_version.listing_id
      join public.developer_profiles as developer on developer.id = listing.developer_profile_id
      where developer.user_id = v_actor
        and listing.listing_status = 'published'
        and listing.revoked_at is null
        and addon_version.review_status = 'approved'
        and addon_version.published_at is not null
        and addon_version.revoked_at is null
    ),
    'eligibleReviewedVersionsTruncated', (
      select pg_catalog.count(*) > 100
      from public.marketplace_addon_versions as addon_version
      join public.marketplace_listings as listing on listing.id = addon_version.listing_id
      join public.developer_profiles as developer on developer.id = listing.developer_profile_id
      where developer.user_id = v_actor
        and listing.listing_status = 'published'
        and listing.revoked_at is null
        and addon_version.review_status = 'approved'
        and addon_version.published_at is not null
        and addon_version.revoked_at is null
    ),
    'eligibleReviewedVersions', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'addonVersionId', eligible.addon_version_id,
          'listingId', eligible.listing_id,
          'listingSlug', eligible.listing_slug,
          'listingName', eligible.listing_name,
          'version', eligible.version
        ) order by eligible.listing_name, eligible.version, eligible.addon_version_id
      ), '[]'::jsonb)
      from (
        select
          addon_version.id as addon_version_id,
          listing.id as listing_id,
          listing.slug as listing_slug,
          listing.name as listing_name,
          addon_version.version
        from public.marketplace_addon_versions as addon_version
        join public.marketplace_listings as listing on listing.id = addon_version.listing_id
        join public.developer_profiles as developer on developer.id = listing.developer_profile_id
        where developer.user_id = v_actor
          and listing.listing_status = 'published'
          and listing.revoked_at is null
          and addon_version.review_status = 'approved'
          and addon_version.published_at is not null
          and addon_version.revoked_at is null
        order by listing.name, addon_version.version, addon_version.id
        limit 100
      ) as eligible
    ),
    'publisherOptions', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'publisherId', owned_publisher.publisher_id,
          'name', owned_publisher.name,
          'slug', owned_publisher.slug,
          'verified', owned_publisher.verified,
          'linked', owned_publisher.linked
        ) order by owned_publisher.name, owned_publisher.publisher_id
      ), '[]'::jsonb)
      from (
        select
          publisher.id as publisher_id,
          publisher.name,
          publisher.slug,
          publisher.verified,
          exists (
            select 1
            from private.economic_seller_publisher_links as link
            where link.seller_account_id = v_seller.id
              and link.publisher_id = publisher.id
              and link.unlinked_at is null
          ) as linked
        from public.publishers as publisher
        where publisher.owner_id = v_actor
        order by publisher.name, publisher.id
        limit 50
      ) as owned_publisher
    ),
    'publisherOptionCount', (
      select pg_catalog.count(*) from public.publishers as publisher
      where publisher.owner_id = v_actor
    ),
    'publisherOptionsTruncated', (
      select pg_catalog.count(*) > 50 from public.publishers as publisher
      where publisher.owner_id = v_actor
    ),
    'availablePayableByCurrency', private.marketplace_available_seller_payable_by_currency(v_seller.id),
    'payableByCurrency', private.marketplace_available_seller_payable_by_currency(v_seller.id),
    'payoutPreparationEnabled', private.economic_feature_enabled('marketplace_payout_preparation'),
    'payoutsEnabledByFeature', false,
    'payoutExecutionAvailable', false,
    'balancesAreTestRecords', true,
    'testMode', true,
    'providerIdentifiersExposed', false
  );
end;
$$;

alter function public.current_user_economic_seller_status() owner to postgres;

create or replace function public.operator_prepare_marketplace_test_payout(
  p_actor_user_id uuid,
  p_seller_account_id uuid,
  p_client_request_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller private.economic_seller_accounts%rowtype;
  v_preparation private.marketplace_payout_preparations%rowtype;
  v_available bigint;
  v_idempotent_replay boolean;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'marketplace_payout_manage');
  if not private.economic_feature_enabled('marketplace_payout_preparation')
     or p_confirmation is distinct from 'PREPARE TEST MARKETPLACE PAYOUT'
     or p_client_request_id is null
     or lower(coalesce(p_currency, '')) !~ '^[a-z]{3}$'
     or p_amount_minor is null or p_amount_minor <= 0
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '55000', message = 'marketplace_test_payout_not_authorized';
  end if;
  select * into v_seller
  from private.economic_seller_accounts as seller
  where seller.id = p_seller_account_id
    and seller.status = 'ready' and seller.payouts_enabled = true
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'marketplace_payout_seller_not_ready';
  end if;
  select * into v_preparation
  from private.marketplace_payout_preparations
  where client_request_id = p_client_request_id;
  v_idempotent_replay := found;
  if v_idempotent_replay then
    if v_preparation.seller_account_id <> v_seller.id
       or v_preparation.amount_minor <> p_amount_minor
       or v_preparation.currency <> lower(p_currency)
       or v_preparation.prepared_by <> p_actor_user_id
       or v_preparation.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'marketplace_payout_idempotency_conflict';
    end if;
  else
    v_available := private.marketplace_available_seller_payable(
      v_seller.id, lower(p_currency)
    );
    if p_amount_minor > v_available then
      raise exception using errcode = '22023', message = 'marketplace_payout_exceeds_available_payable';
    end if;
    insert into private.marketplace_payout_preparations (
      client_request_id, seller_account_id, amount_minor, currency,
      prepared_by, private_reason
    ) values (
      p_client_request_id, v_seller.id, p_amount_minor, lower(p_currency),
      p_actor_user_id, pg_catalog.btrim(p_reason)
    ) returning * into v_preparation;
  end if;
  return pg_catalog.jsonb_build_object(
    'payoutPreparationId', v_preparation.id,
    'sellerAccountId', v_seller.id,
    'amountMinor', v_preparation.amount_minor,
    'currency', v_preparation.currency,
    'status', v_preparation.status,
    'providerExecutionAvailable', false,
    'balancesAreTestRecords', true,
    'testMode', true,
    'idempotentReplay', v_idempotent_replay
  );
end;
$$;

alter function public.operator_prepare_marketplace_test_payout(
  uuid, uuid, uuid, bigint, text, text, text
) owner to postgres;

create or replace function public.attach_marketplace_test_transfer_result(
  p_actor_user_id uuid,
  p_payout_preparation_id uuid,
  p_provider_transfer_reference text,
  p_provider_status text,
  p_provider_response_sha256 text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_payout private.marketplace_payout_preparations%rowtype;
  v_event private.marketplace_payout_result_events%rowtype;
  v_target_status text;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'marketplace_payout_manage');
  if not private.economic_feature_enabled('marketplace_payouts')
     or coalesce(p_provider_transfer_reference, '') !~ '^tr_[A-Za-z0-9]{3,250}$'
     or p_provider_status not in ('pending', 'transferred', 'failed', 'canceled', 'reversed')
     or coalesce(p_provider_response_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'marketplace_test_payout_result_invalid';
  end if;
  select * into v_payout
  from private.marketplace_payout_preparations
  where id = p_payout_preparation_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'marketplace_payout_preparation_not_found';
  end if;
  v_target_status := case when p_provider_status = 'pending'
    then 'transfer_pending' else p_provider_status end;
  select * into v_event
  from private.marketplace_payout_result_events
  where payout_preparation_id = v_payout.id
    and provider_status = p_provider_status;
  if found then
    if v_event.provider_transfer_reference <> p_provider_transfer_reference
       or v_event.provider_response_sha256 <> p_provider_response_sha256
       or v_event.actor_user_id <> p_actor_user_id
       or v_event.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'marketplace_payout_result_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'payoutPreparationId', v_payout.id,
      'sellerAccountId', v_payout.seller_account_id,
      'providerOperation', 'stripe_connect_transfer',
      'status', v_target_status, 'testMode', true,
      'idempotentReplay', true
    );
  end if;
  if v_payout.provider_transfer_reference is not null
     and v_payout.provider_transfer_reference <> p_provider_transfer_reference then
    raise exception using errcode = '23505', message = 'marketplace_payout_provider_reference_conflict';
  end if;
  if not (
    (v_payout.status = 'prepared' and v_target_status in ('transfer_pending', 'transferred', 'failed', 'canceled'))
    or (v_payout.status = 'transfer_pending' and v_target_status in ('transferred', 'failed', 'canceled'))
    or (v_payout.status = 'transferred' and v_target_status = 'reversed')
  ) then
    raise exception using errcode = '55000', message = 'marketplace_payout_result_transition_invalid';
  end if;
  insert into private.marketplace_payout_result_events(
    payout_preparation_id, provider_status, provider_transfer_reference,
    provider_response_sha256, actor_user_id, private_reason
  ) values (
    v_payout.id, p_provider_status, p_provider_transfer_reference,
    p_provider_response_sha256, p_actor_user_id, pg_catalog.btrim(p_reason)
  );
  update private.marketplace_payout_preparations
  set provider = 'stripe', provider_transfer_reference = p_provider_transfer_reference,
      provider_response_sha256 = p_provider_response_sha256,
      status = v_target_status,
      completed_at = case when p_provider_status = 'transferred' then pg_catalog.now() else completed_at end,
      updated_at = pg_catalog.now()
  where id = v_payout.id returning * into v_payout;
  return pg_catalog.jsonb_build_object(
    'payoutPreparationId', v_payout.id,
    'sellerAccountId', v_payout.seller_account_id,
    'providerOperation', 'stripe_connect_transfer',
    'status', v_payout.status,
    'testMode', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.attach_marketplace_test_transfer_result(
  uuid, uuid, text, text, text, text
) owner to postgres;

do $marketplace_economic_function_acl$
begin
  revoke all privileges on function public.accept_marketplace_free_seller_agreement(
    uuid, uuid, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.prepare_economic_seller_onboarding(
    uuid, uuid, text, text, text
  )
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.attach_economic_seller_provider_account(uuid, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.record_economic_seller_provider_status(
    uuid, uuid, text, boolean, boolean, boolean, text, timestamptz, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.get_economic_seller_provider_context(uuid, uuid)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.link_economic_seller_publisher(uuid, uuid, uuid, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.configure_marketplace_test_commercial_terms(
    uuid, uuid, text, integer, text, text, boolean, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.configure_marketplace_test_offer(
    uuid, uuid, uuid, uuid, text, text, bigint, text,
    text, text, text, text, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.set_marketplace_test_offer_status(uuid, uuid, uuid, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.prepare_marketplace_purchase_checkout(uuid, uuid, uuid, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.accept_marketplace_free_license(uuid, uuid, uuid, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.marketplace_commercial_offer_catalog()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.current_user_marketplace_purchases()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.current_user_economic_seller_status()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_prepare_marketplace_test_payout(
    uuid, uuid, uuid, bigint, text, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.attach_marketplace_test_transfer_result(
    uuid, uuid, text, text, text, text
  ) from public, anon, authenticated, service_role;
end
$marketplace_economic_function_acl$;

grant execute on function public.accept_marketplace_free_seller_agreement(
  uuid, uuid, text, text
) to service_role;
grant execute on function public.prepare_economic_seller_onboarding(
  uuid, uuid, text, text, text
) to service_role;
grant execute on function public.attach_economic_seller_provider_account(uuid, text, text) to service_role;
grant execute on function public.record_economic_seller_provider_status(
  uuid, uuid, text, boolean, boolean, boolean, text, timestamptz, text
) to service_role;
grant execute on function public.get_economic_seller_provider_context(uuid, uuid) to service_role;
grant execute on function public.link_economic_seller_publisher(uuid, uuid, uuid, text) to service_role;
grant execute on function public.configure_marketplace_test_commercial_terms(
  uuid, uuid, text, integer, text, text, boolean, text, text
) to service_role;
grant execute on function public.configure_marketplace_test_offer(
  uuid, uuid, uuid, uuid, text, text, bigint, text,
  text, text, text, text, text, text
) to service_role;
grant execute on function public.set_marketplace_test_offer_status(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.prepare_marketplace_purchase_checkout(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.accept_marketplace_free_license(uuid, uuid, uuid, text) to service_role;
grant execute on function public.marketplace_commercial_offer_catalog() to anon, authenticated;
grant execute on function public.current_user_marketplace_purchases() to authenticated;
grant execute on function public.current_user_economic_seller_status() to authenticated;
grant execute on function public.operator_prepare_marketplace_test_payout(
  uuid, uuid, uuid, bigint, text, text, text
) to service_role;
grant execute on function public.attach_marketplace_test_transfer_result(
  uuid, uuid, text, text, text, text
) to service_role;

comment on table private.marketplace_licenses is
  'Immutable version-bound economic licenses. License ownership never approves, trusts, ranks, publishes, downloads, or installs an add-on.';
comment on table private.marketplace_commission_events is
  'Append-only test seller/platform allocation events. Gross, commission, payable, refunds, and dispute holds remain separately reportable.';
comment on function public.current_user_economic_seller_status is
  'Self-only private seller readiness and aggregate payable projection; provider/KYC identifiers are omitted.';
comment on function public.operator_prepare_marketplace_test_payout(uuid, uuid, uuid, bigint, text, text, text) is
  'Creates an audited internal test payout preparation from private seller payables. This release performs no provider transfer and promises no real payout.';

commit;
