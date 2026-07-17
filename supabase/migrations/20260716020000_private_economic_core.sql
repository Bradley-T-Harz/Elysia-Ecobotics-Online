-- Provider-neutral, private economic kernel. Stripe is an initial test-mode rail,
-- not the domain model. All live and externally consequential features are
-- disabled by default and every mutation RPC is service-role-only.

begin;

create schema if not exists private;
alter schema private owner to postgres;
revoke all on schema private from public, anon, authenticated;

create table private.economic_feature_flags (
  feature_key text primary key,
  enabled boolean not null default false,
  test_mode_only boolean not null default true,
  reason text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint economic_feature_flags_key_check
    check (feature_key ~ '^[a-z][a-z0-9_]{2,80}$')
);

create table private.economic_feature_flag_actions (
  client_request_id uuid primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  feature_key text not null references private.economic_feature_flags(feature_key) on delete restrict,
  enabled boolean not null,
  confirmation text not null,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint economic_feature_flag_action_confirmation_check check (
    (enabled and confirmation = 'ENABLE TEST ECONOMIC FEATURE')
    or (not enabled and confirmation = 'DISABLE TEST ECONOMIC FEATURE')
  ),
  constraint economic_feature_flag_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

insert into private.economic_feature_flags(feature_key, enabled, test_mode_only, reason)
values
  ('support_checkout', false, true, 'Requires explicit Stripe test-mode activation.'),
  ('recurring_support', false, true, 'Recurring support requires separate test-mode consent and portal activation.'),
  ('economic_webhooks', false, true, 'Requires a configured and verified test webhook endpoint.'),
  ('test_refund_execution', false, true, 'Provider refund execution requires a separate test-only operator kill switch.'),
  ('customer_portal', false, true, 'Requires Stripe test customer portal configuration.'),
  ('sandbox_credit_purchase', false, true, 'Test rates and cost measurements require approval.'),
  ('sandbox_credit_display', false, true, 'Private balances remain hidden until the ledger projection is explicitly enabled.'),
  ('sandbox_credit_enforcement', false, true, 'Operational sandbox access remains unchanged until approved.'),
  ('job_post_fee_enforcement', false, true, 'Job review remains unchanged until fee policy activation.'),
  ('marketplace_paid_offers', false, true, 'Paid offers require legal and commercial review.'),
  ('marketplace_seller_onboarding', false, true, 'Stripe Connect remains test-mode and unactivated.'),
  ('marketplace_payout_preparation', false, true, 'Internal test payable allocation and payout preparation records only; no provider transfer is executed.'),
  ('marketplace_payouts', false, true, 'Unavailable in this release. Provider payout execution, result reconciliation, EIN, banking, tax, legal, and explicit operational approval require a future release.'),
  ('organization_billing', false, true, 'Professional services remain manually negotiated.'),
  ('organization_contract_workflow', false, true, 'Requires operator-reviewed contracts, disclosures, and test catalog configuration.'),
  ('sponsorship_checkout', false, true, 'Ethically reviewed sponsorship checkout has a separate fail-closed acquisition switch.'),
  ('sponsorship_review_workflow', false, true, 'Requires ethical review and a countersigned no-control agreement.'),
  ('economic_assistance_workflow', false, true, 'Requires an approved waiver or subsidy program and audited grant issuance.'),
  ('sponsorship_display', false, true, 'Sponsorship recognition remains private unless separately approved.'),
  ('live_stripe', false, false, 'Live Stripe activation is forbidden in this repository release; EIN, banking, legal, tax, and operational approval remain external prerequisites.'),
  ('public_support_recognition', false, true, 'Public economic recognition is not enabled.')
on conflict (feature_key) do nothing;

-- Legal-document versions are server truth. Version rows are immutable; a
-- separate active pointer permits a later forward migration to activate a new
-- reviewed version without rewriting acceptance history.
create or replace function private.economic_legal_manifest_is_valid(p_manifest jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_document jsonb;
begin
  if pg_catalog.jsonb_typeof(p_manifest) <> 'object' then
    return false;
  end if;
  if not exists (select 1 from pg_catalog.jsonb_each(p_manifest)) then
    return false;
  end if;
  for v_document in select value from pg_catalog.jsonb_each(p_manifest)
  loop
    if pg_catalog.jsonb_typeof(v_document) <> 'object' then
      return false;
    end if;
    if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_document)) <> 3
       or not (v_document ? 'version')
       or not (v_document ? 'path')
       or not (v_document ? 'contentSha256')
       or coalesce(v_document ->> 'version', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'
       or coalesce(v_document ->> 'path', '') !~ '^/[A-Za-z0-9/_?&=.%:-]*$'
       or coalesce(v_document ->> 'contentSha256', '') !~ '^[0-9a-f]{64}$' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter function private.economic_legal_manifest_is_valid(jsonb) owner to postgres;
revoke all privileges on function private.economic_legal_manifest_is_valid(jsonb)
  from public, anon, authenticated, service_role;

create table private.economic_legal_document_versions (
  document_key text not null,
  document_version text not null,
  public_path text not null,
  content_sha256 text not null,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (document_key, document_version),
  constraint economic_legal_document_versions_key_check check (
    document_key ~ '^[a-z][a-z0-9_]{2,100}$'
    and pg_catalog.char_length(document_version) between 1 and 120
  ),
  constraint economic_legal_document_versions_path_check check (
    public_path ~ '^/[A-Za-z0-9/_?&=.%:-]*$'
  ),
  constraint economic_legal_document_versions_content_sha256_check check (
    content_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create table private.economic_active_legal_documents (
  document_key text primary key,
  document_version text not null,
  activated_at timestamptz not null default now(),
  foreign key (document_key, document_version)
    references private.economic_legal_document_versions(document_key, document_version)
    on delete restrict,
  constraint economic_active_legal_documents_key_check
    check (document_key ~ '^[a-z][a-z0-9_]{2,100}$')
);

create table private.economic_legal_consent_bundle_versions (
  bundle_key text not null,
  bundle_version text not null,
  public_path text not null,
  document_manifest jsonb not null,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (bundle_key, bundle_version),
  constraint economic_legal_consent_bundle_key_check check (
    bundle_key ~ '^[a-z][a-z0-9_]{2,100}$'
    and pg_catalog.char_length(bundle_version) between 1 and 120
  ),
  constraint economic_legal_consent_bundle_path_check
    check (public_path ~ '^/[A-Za-z0-9/_?&=.%:-]*$'),
  constraint economic_legal_consent_bundle_manifest_check
    check (private.economic_legal_manifest_is_valid(document_manifest))
);

create table private.economic_active_legal_consent_bundles (
  bundle_key text primary key,
  bundle_version text not null,
  activated_at timestamptz not null default now(),
  foreign key (bundle_key, bundle_version)
    references private.economic_legal_consent_bundle_versions(bundle_key, bundle_version)
    on delete restrict
);

insert into private.economic_legal_document_versions(
  document_key, document_version, public_path, content_sha256
) values
  ('support_and_billing_terms', '2026-07-16', '/legal/support-and-billing-terms', 'a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9'),
  ('recurring_support_terms', '2026-07-16', '/legal/support-and-billing-terms', 'a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9'),
  ('support_recognition_consent', '2026-07-16', '/legal/support-and-billing-terms', 'a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9'),
  ('economic_data_export_request', '2026-07-16', '/legal/privacy-policy', 'd2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046'),
  ('economic_account_closure_request', '2026-07-16', '/legal/account-closure-financial-retention', '9a9ce6fb29063e659e97936e9f1337e53c26cd34248d860d54533c2fec0bd36e'),
  ('marketplace_seller_agreement', '2026-07-16', '/legal/marketplace-commerce-terms', 'f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97'),
  ('marketplace_free_seller_agreement', '2026-07-16', '/legal/marketplace-commerce-terms', 'f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97'),
  ('marketplace_buyer_terms', '2026-07-16', '/legal/marketplace-commerce-terms', 'f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97'),
  ('stripe_connect_seller_disclosure', 'stripe-connect-test-2026-07-16', '/legal/marketplace-commerce-terms', 'f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97'),
  ('refund_and_cancellation_policy', '2026-07-16', '/legal/refund-and-cancellation-policy', '55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3'),
  ('privacy_policy', '2026-07-16', '/legal/privacy-policy', 'd2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046'),
  ('sandbox_credit_terms', '2026-07-16', '/legal/sandbox-credit-terms', '0935b5242ee9079dd0246b8e051b371839bf08ebd43c59480305e542553fc8d6'),
  ('job_post_fee_terms', '2026-07-16', '/legal/job-post-fee-terms', 'ac05dc2722b77486e2ae20a89665d9e721806940809ff54fd803c25cb133b747'),
  ('marketplace_commerce_terms', '2026-07-16', '/legal/marketplace-commerce-terms', 'f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97'),
  ('organization_services_terms', '2026-07-16', '/legal/organization-services-terms', 'bcce00db17bceb807fc3a10a4be378630439e9be3c2b3cc1987b93fef8c1a6f4'),
  ('sponsorship_independence_policy', '2026-07-16', '/legal/sponsorship-independence-policy', '9f1c84832dca67e60a1716d1d7b8d42a77da1f62feb9a6af1ce5cbfb3c295ceb')
on conflict (document_key, document_version) do nothing;

insert into private.economic_active_legal_documents(document_key, document_version)
select document_key, document_version
from private.economic_legal_document_versions
on conflict (document_key) do nothing;

insert into private.economic_legal_consent_bundle_versions(
  bundle_key, bundle_version, public_path, document_manifest
) values
  ('support_one_time_checkout_bundle', '2026-07-16', '/legal/support-and-billing-terms',
    '{"supportTerms":{"version":"2026-07-16","path":"/legal/support-and-billing-terms","contentSha256":"a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9"},"refundPolicy":{"version":"2026-07-16","path":"/legal/refund-and-cancellation-policy","contentSha256":"55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"}}'::jsonb),
  ('support_recurring_checkout_bundle', '2026-07-16', '/legal/support-and-billing-terms',
    '{"recurringSupportTerms":{"version":"2026-07-16","path":"/legal/support-and-billing-terms","contentSha256":"a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9"},"refundPolicy":{"version":"2026-07-16","path":"/legal/refund-and-cancellation-policy","contentSha256":"55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"}}'::jsonb),
  ('sandbox_credits_checkout_bundle', '2026-07-16', '/legal/sandbox-credit-terms',
    '{"sandboxCreditTerms":{"version":"2026-07-16","path":"/legal/sandbox-credit-terms","contentSha256":"0935b5242ee9079dd0246b8e051b371839bf08ebd43c59480305e542553fc8d6"},"refundPolicy":{"version":"2026-07-16","path":"/legal/refund-and-cancellation-policy","contentSha256":"55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"}}'::jsonb),
  ('job_post_fee_checkout_bundle', '2026-07-16', '/legal/job-post-fee-terms',
    '{"jobPostFeeTerms":{"version":"2026-07-16","path":"/legal/job-post-fee-terms","contentSha256":"ac05dc2722b77486e2ae20a89665d9e721806940809ff54fd803c25cb133b747"},"refundPolicy":{"version":"2026-07-16","path":"/legal/refund-and-cancellation-policy","contentSha256":"55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"}}'::jsonb),
  ('marketplace_purchase_checkout_bundle', '2026-07-16', '/legal/marketplace-commerce-terms',
    '{"marketplaceBuyerTerms":{"version":"2026-07-16","path":"/legal/marketplace-commerce-terms","contentSha256":"f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"},"refundPolicy":{"version":"2026-07-16","path":"/legal/refund-and-cancellation-policy","contentSha256":"55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"}}'::jsonb),
  ('marketplace_free_license_bundle', '2026-07-16', '/legal/marketplace-commerce-terms',
    '{"marketplaceLicenseTerms":{"version":"2026-07-16","path":"/legal/marketplace-commerce-terms","contentSha256":"f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"}}'::jsonb),
  ('organization_service_checkout_bundle', '2026-07-16', '/legal/organization-services-terms',
    '{"organizationServiceTerms":{"version":"2026-07-16","path":"/legal/organization-services-terms","contentSha256":"bcce00db17bceb807fc3a10a4be378630439e9be3c2b3cc1987b93fef8c1a6f4"},"refundPolicy":{"version":"2026-07-16","path":"/legal/refund-and-cancellation-policy","contentSha256":"55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"}}'::jsonb),
  ('sponsorship_checkout_bundle', '2026-07-16', '/legal/sponsorship-independence-policy',
    '{"sponsorshipTerms":{"version":"2026-07-16","path":"/legal/sponsorship-independence-policy","contentSha256":"9f1c84832dca67e60a1716d1d7b8d42a77da1f62feb9a6af1ce5cbfb3c295ceb"},"refundPolicy":{"version":"2026-07-16","path":"/legal/refund-and-cancellation-policy","contentSha256":"55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"}}'::jsonb)
on conflict (bundle_key, bundle_version) do nothing;

insert into private.economic_active_legal_consent_bundles(bundle_key, bundle_version)
select bundle_key, bundle_version
from private.economic_legal_consent_bundle_versions
on conflict (bundle_key) do nothing;

create table private.economic_products (
  product_key text primary key,
  product_kind text not null,
  display_name text not null,
  description text not null,
  active boolean not null default true,
  test_mode_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint economic_products_key_check
    check (product_key ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint economic_products_kind_check check (
    product_kind in (
      'support_one_time', 'support_recurring', 'sandbox_credits',
      'job_post_fee', 'marketplace_purchase', 'organization_service',
      'sponsorship'
    )
  )
);

insert into private.economic_products(
  product_key, product_kind, display_name, description
)
values
  ('support_one_time', 'support_one_time', 'Support Elysia', 'Optional one-time support. No authority, role, badge, or membership is purchased.'),
  ('support_recurring', 'support_recurring', 'Sustain Elysia monthly', 'Optional recurring support. Cancellation never changes community standing.'),
  ('sandbox_credits', 'sandbox_credits', 'Online sandbox credits', 'Metered hosted execution only; safety limits and governance remain unchanged.'),
  ('job_post_fee', 'job_post_fee', 'Commercial Job Post fee', 'Economic publication condition only; payment never approves content.'),
  ('marketplace_purchase', 'marketplace_purchase', 'Marketplace license', 'Financial license only; purchase never installs or approves an add-on.'),
  ('organization_service', 'organization_service', 'Organization service', 'Private professional service engagement.'),
  ('sponsorship', 'sponsorship', 'Ethical sponsorship', 'Scoped support without editorial, governance, moderation, or review control.')
on conflict (product_key) do nothing;

create table private.economic_prices (
  id uuid primary key default gen_random_uuid(),
  price_code text not null unique,
  product_key text not null references private.economic_products(product_key),
  currency text not null,
  unit_amount_minor bigint,
  minimum_amount_minor bigint,
  maximum_amount_minor bigint,
  recurring_interval text,
  recurring_interval_count integer,
  active boolean not null default true,
  test_mode_only boolean not null default true,
  provider text,
  provider_price_reference text,
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint economic_prices_code_check
    check (price_code ~ '^[a-z][a-z0-9_]{2,120}$'),
  constraint economic_prices_currency_check check (currency ~ '^[a-z]{3}$'),
  constraint economic_prices_amount_check check (
    (unit_amount_minor is not null and unit_amount_minor > 0)
    or (
      unit_amount_minor is null
      and minimum_amount_minor is not null
      and maximum_amount_minor is not null
      and minimum_amount_minor > 0
      and maximum_amount_minor >= minimum_amount_minor
    )
  ),
  constraint economic_prices_interval_check check (
    (recurring_interval is null and recurring_interval_count is null)
    or (
      recurring_interval in ('day', 'week', 'month', 'year')
      and recurring_interval_count between 1 and 12
    )
  ),
  constraint economic_prices_provider_pair_check check (
    (provider is null) = (provider_price_reference is null)
  )
);

insert into private.economic_prices(
  price_code, product_key, currency, unit_amount_minor,
  minimum_amount_minor, maximum_amount_minor,
  recurring_interval, recurring_interval_count
)
values
  ('support_one_time_custom_usd', 'support_one_time', 'usd', null, 100, 50000, null, null),
  ('support_monthly_seed_usd', 'support_recurring', 'usd', 100, null, null, 'month', 1),
  ('support_monthly_commons_usd', 'support_recurring', 'usd', 500, null, null, 'month', 1),
  ('support_monthly_infrastructure_usd', 'support_recurring', 'usd', 1200, null, null, 'month', 1),
  ('support_monthly_sandbox_usd', 'support_recurring', 'usd', 2500, null, null, 'month', 1),
  ('support_monthly_50_usd', 'support_recurring', 'usd', 5000, null, null, 'month', 1)
on conflict (price_code) do nothing;

create table private.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  provider_customer_reference text,
  contact_hash text,
  status text not null default 'pending',
  test_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint billing_customers_provider_check
    check (provider ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint billing_customers_status_check
    check (status in ('pending', 'active', 'restricted', 'archived')),
  constraint billing_customers_contact_hash_check
    check (contact_hash is null or contact_hash ~ '^[0-9a-f]{64}$')
);

create unique index billing_customers_user_provider_idx
  on private.billing_customers(user_id, provider)
  where user_id is not null and archived_at is null;
create unique index billing_customers_provider_reference_idx
  on private.billing_customers(provider, provider_customer_reference)
  where provider_customer_reference is not null;

create table private.economic_orders (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique
    default encode(extensions.gen_random_bytes(18), 'hex'),
  client_request_id uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  billing_customer_id uuid references private.billing_customers(id) on delete set null,
  flow text not null,
  status text not null default 'pending',
  currency text not null,
  subtotal_minor bigint not null,
  total_minor bigint not null,
  source_route text not null,
  consent_version text not null,
  provider text,
  provider_session_reference text,
  failure_code text,
  failure_message text,
  provider_event_created_at timestamptz,
  checkout_expires_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint economic_orders_flow_check check (
    flow in (
      'support_one_time', 'support_recurring', 'sandbox_credits',
      'job_post_fee', 'marketplace_purchase', 'organization_service',
      'sponsorship'
    )
  ),
  constraint economic_orders_status_check check (
    status in (
      'pending', 'checkout_created', 'processing', 'paid', 'failed',
      'canceled', 'partially_refunded', 'refunded', 'disputed'
    )
  ),
  constraint economic_orders_currency_check check (currency ~ '^[a-z]{3}$'),
  constraint economic_orders_amount_check check (
    subtotal_minor > 0 and total_minor > 0 and total_minor = subtotal_minor
  ),
  constraint economic_orders_source_route_check check (
    pg_catalog.char_length(source_route) between 1 and 300
    and source_route like '/%'
  ),
  constraint economic_orders_consent_check
    check (pg_catalog.char_length(consent_version) between 1 and 120),
  constraint economic_orders_metadata_check
    check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

create unique index economic_orders_provider_session_idx
  on private.economic_orders(provider, provider_session_reference)
  where provider_session_reference is not null;
create index economic_orders_user_created_idx
  on private.economic_orders(user_id, created_at desc)
  where user_id is not null;
create index economic_orders_status_created_idx
  on private.economic_orders(status, created_at desc);

create table private.economic_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.economic_orders(id) on delete restrict,
  product_key text not null references private.economic_products(product_key),
  price_id uuid not null references private.economic_prices(id),
  price_code_snapshot text not null,
  product_name_snapshot text not null,
  quantity integer not null default 1,
  unit_amount_minor bigint not null,
  total_amount_minor bigint not null,
  currency text not null,
  recurring_interval_snapshot text,
  created_at timestamptz not null default now(),
  constraint economic_order_items_quantity_check check (quantity between 1 and 100000),
  constraint economic_order_items_amount_check check (
    unit_amount_minor > 0
    and total_amount_minor = unit_amount_minor * quantity::bigint
  ),
  constraint economic_order_items_currency_check check (currency ~ '^[a-z]{3}$')
);

create index economic_order_items_order_idx on private.economic_order_items(order_id);

create table private.economic_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.economic_orders(id) on delete restrict,
  webhook_event_id uuid,
  provider text not null,
  provider_transaction_reference text,
  transaction_type text not null,
  status text not null,
  gross_amount_minor bigint not null,
  processor_fee_minor bigint,
  net_amount_minor bigint,
  currency text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint economic_payment_transactions_type_check check (
    transaction_type in ('authorization', 'payment', 'failure', 'refund', 'dispute', 'adjustment')
  ),
  constraint economic_payment_transactions_status_check check (
    status in ('pending', 'succeeded', 'failed', 'canceled', 'refunded', 'disputed')
  ),
  constraint economic_payment_transactions_currency_check check (currency ~ '^[a-z]{3}$')
  ,constraint economic_payment_transactions_amounts_check check (
    gross_amount_minor >= 0
    and (processor_fee_minor is null or processor_fee_minor between 0 and gross_amount_minor)
    and (net_amount_minor is null or net_amount_minor between 0 and gross_amount_minor)
    and (processor_fee_minor is null or net_amount_minor is null
      or net_amount_minor = gross_amount_minor - processor_fee_minor)
    and (transaction_type <> 'payment' or status <> 'succeeded' or gross_amount_minor > 0)
  )
);

create index economic_payment_transactions_order_idx
  on private.economic_payment_transactions(order_id, occurred_at desc);
create index economic_payment_transactions_provider_idx
  on private.economic_payment_transactions(provider, provider_transaction_reference)
  where provider_transaction_reference is not null;
create unique index economic_payment_transactions_logical_payment_idx
  on private.economic_payment_transactions(
    provider, provider_transaction_reference, transaction_type
  )
  where provider_transaction_reference is not null;
create unique index economic_payment_transactions_event_type_idx
  on private.economic_payment_transactions(webhook_event_id, transaction_type)
  where webhook_event_id is not null;

create table private.economic_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.economic_orders(id) on delete restrict,
  payment_transaction_id uuid not null references private.economic_payment_transactions(id) on delete restrict,
  provider text not null,
  provider_refund_reference text not null,
  amount_minor bigint not null,
  currency text not null,
  status text not null,
  reason text,
  requested_by uuid references auth.users(id) on delete set null,
  provider_event_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_refund_reference),
  constraint economic_refunds_amount_check check (amount_minor > 0),
  constraint economic_refunds_currency_check check (currency ~ '^[a-z]{3}$'),
  constraint economic_refunds_status_check check (
    status in ('pending', 'succeeded', 'failed', 'canceled')
  )
);

create table private.economic_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.economic_orders(id) on delete restrict,
  payment_transaction_id uuid not null references private.economic_payment_transactions(id) on delete restrict,
  provider text not null,
  provider_dispute_reference text not null,
  amount_minor bigint not null,
  currency text not null,
  status text not null,
  reason_code text,
  provider_event_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (provider, provider_dispute_reference),
  constraint economic_disputes_amount_check check (amount_minor > 0),
  constraint economic_disputes_currency_check check (currency ~ '^[a-z]{3}$'),
  constraint economic_disputes_status_check check (
    status in (
      'warning_needs_response', 'warning_under_review', 'warning_closed',
      'needs_response', 'under_review', 'won', 'lost', 'prevented'
    )
  )
);

create index economic_refunds_payment_transaction_idx
  on private.economic_refunds(payment_transaction_id, status, created_at);
create index economic_disputes_payment_transaction_idx
  on private.economic_disputes(payment_transaction_id, status, created_at);

create table private.economic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  billing_customer_id uuid not null references private.billing_customers(id) on delete restrict,
  originating_order_id uuid references private.economic_orders(id) on delete set null,
  price_id uuid not null references private.economic_prices(id),
  provider text not null,
  provider_subscription_reference text not null,
  status text not null,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  provider_event_created_at timestamptz,
  provider_subscription_event_created_at timestamptz,
  provider_invoice_event_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_reference),
  constraint economic_subscriptions_status_check check (
    status in ('incomplete', 'active', 'past_due', 'grace_period', 'canceling', 'canceled', 'ended')
  )
);

create index economic_subscriptions_user_idx
  on private.economic_subscriptions(user_id, status, updated_at desc);

create table private.economic_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  event_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload_sha256 text not null,
  normalized_event jsonb not null,
  processing_status text not null default 'received',
  processing_attempts integer not null default 1,
  processed_at timestamptz,
  processing_error text,
  unique (provider, provider_event_id),
  constraint economic_webhook_payload_hash_check
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint economic_webhook_normalized_check
    check (pg_catalog.jsonb_typeof(normalized_event) = 'object'),
  constraint economic_webhook_status_check check (
    processing_status in ('received', 'processed', 'duplicate', 'ignored_out_of_order', 'unmatched', 'failed')
  )
);

create index economic_webhook_events_processing_idx
  on private.economic_webhook_events(processing_status, received_at);

alter table private.economic_payment_transactions
  add constraint economic_payment_transactions_webhook_event_fkey
  foreign key (webhook_event_id) references private.economic_webhook_events(id) on delete restrict;

create table private.economic_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references private.economic_orders(id) on delete restrict,
  document_key text not null,
  document_version text not null,
  source_route text not null,
  accepted_at timestamptz not null default now(),
  client_request_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint economic_consents_document_check check (
    document_key ~ '^[a-z][a-z0-9_]{2,100}$'
    and pg_catalog.char_length(document_version) between 1 and 120
  ),
  constraint economic_consents_metadata_check
    check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

create index economic_consents_user_idx
  on private.economic_consents(user_id, accepted_at desc)
  where user_id is not null;
create unique index economic_consents_request_document_idx
  on private.economic_consents(client_request_id, document_key);

create table private.economic_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint economic_audit_actor_kind_check check (
    actor_kind in ('system', 'user', 'economic_operator', 'provider_webhook')
  ),
  constraint economic_audit_metadata_check
    check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

create index economic_audit_events_target_idx
  on private.economic_audit_events(target_type, target_id, created_at desc);
create index economic_audit_events_actor_idx
  on private.economic_audit_events(actor_user_id, created_at desc)
  where actor_user_id is not null;

create table private.economic_operator_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  capability text not null,
  granted_by uuid references auth.users(id) on delete set null,
  reason text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text,
  constraint economic_operator_capability_check check (
    capability in (
      'economic_orders_view', 'economic_payments_view',
      'economic_operator_assignments_manage',
      'economic_feature_flags_manage',
      'economic_refunds_manage', 'economic_reconciliation_manage',
      'recurring_support_manage', 'sandbox_credits_adjust',
      'job_fee_assess', 'marketplace_payout_manage',
      'organization_billing_manage', 'sponsorship_manage',
      'economic_assistance_manage', 'economic_account_requests_manage',
      'economic_audit_view', 'accounting_export'
    )
  )
);

create unique index economic_operator_assignments_active_idx
  on private.economic_operator_assignments(user_id, capability)
  where revoked_at is null;

create table private.economic_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete restrict,
  organization_id uuid,
  entitlement_key text not null,
  source_type text not null,
  source_id uuid,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  constraint economic_entitlements_owner_check
    check ((user_id is not null) <> (organization_id is not null)),
  constraint economic_entitlements_status_check
    check (status in ('pending', 'active', 'expired', 'revoked', 'suspended'))
);

create index economic_entitlements_user_idx
  on private.economic_entitlements(user_id, entitlement_key, status)
  where user_id is not null;

create table private.economic_service_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null,
  reason_code text not null,
  private_reason text,
  source_type text,
  source_id uuid,
  imposed_by uuid references auth.users(id) on delete set null,
  imposed_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_by uuid references auth.users(id) on delete set null,
  lifted_at timestamptz,
  lift_reason text,
  constraint economic_service_restrictions_scope_check check (
    scope in (
      'billing', 'recurring_support', 'sandbox', 'marketplace_buying',
      'marketplace_selling', 'job_posting'
    )
  ),
  constraint economic_service_restrictions_lift_check check (
    (lifted_at is null and lifted_by is null)
    or (lifted_at is not null and lifted_by is not null)
  )
);

create index economic_service_restrictions_active_idx
  on private.economic_service_restrictions(user_id, scope)
  where lifted_at is null;

create table private.economic_customer_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  billing_customer_id uuid not null references private.billing_customers(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  client_request_id uuid not null unique,
  provider_session_reference text,
  status text not null default 'prepared',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (provider_session_reference),
  constraint economic_customer_portal_status_check
    check (status in ('prepared', 'created', 'failed', 'expired'))
);

create index economic_customer_portal_sessions_user_created_idx
  on private.economic_customer_portal_sessions(user_id, created_at desc);

-- Private relations are deliberately unavailable through the Data API. RLS is
-- still enabled as defense in depth in case schema exposure changes later.
do $private_economic_table_hardening$
declare
  v_table text;
begin
  foreach v_table in array array[
    'economic_feature_flags', 'economic_feature_flag_actions', 'economic_legal_document_versions',
    'economic_active_legal_documents', 'economic_legal_consent_bundle_versions',
    'economic_active_legal_consent_bundles', 'economic_products', 'economic_prices',
    'billing_customers', 'economic_orders', 'economic_order_items',
    'economic_payment_transactions', 'economic_refunds', 'economic_disputes',
    'economic_subscriptions', 'economic_webhook_events', 'economic_consents',
    'economic_audit_events', 'economic_operator_assignments',
    'economic_entitlements', 'economic_service_restrictions',
    'economic_customer_portal_sessions'
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
$private_economic_table_hardening$;

create or replace function private.economic_caller_is_service_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.role() = 'service_role', false)
    or coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

alter function private.economic_caller_is_service_role() owner to postgres;
revoke all privileges on function private.economic_caller_is_service_role()
  from public, anon, authenticated, service_role;

create or replace function private.prevent_economic_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'economic_history_is_append_only';
end;
$$;

alter function private.prevent_economic_history_mutation() owner to postgres;
revoke all privileges on function private.prevent_economic_history_mutation()
  from public, anon, authenticated, service_role;

create trigger economic_payment_transactions_are_append_only
before update or delete on private.economic_payment_transactions
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_legal_document_versions_are_append_only
before update or delete on private.economic_legal_document_versions
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_legal_consent_bundle_versions_are_append_only
before update or delete on private.economic_legal_consent_bundle_versions
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_consents_are_append_only
before update or delete on private.economic_consents
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_audit_events_are_append_only
before update or delete on private.economic_audit_events
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_feature_flag_actions_are_append_only
before update or delete on private.economic_feature_flag_actions
for each row execute function private.prevent_economic_history_mutation();

create or replace function private.economic_feature_enabled(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select flag.enabled and flag.test_mode_only
    from private.economic_feature_flags as flag
    where flag.feature_key = p_feature_key
  ), false);
$$;

alter function private.economic_feature_enabled(text) owner to postgres;
revoke all privileges on function private.economic_feature_enabled(text)
  from public, anon, authenticated, service_role;

create or replace function private.economic_service_is_restricted(
  p_user_id uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from private.economic_service_restrictions as restriction
    where restriction.user_id = p_user_id
      and restriction.scope = p_scope
      and restriction.lifted_at is null
      and (restriction.expires_at is null or restriction.expires_at > pg_catalog.now())
  )
$$;

alter function private.economic_service_is_restricted(uuid, text) owner to postgres;
revoke all privileges on function private.economic_service_is_restricted(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.economic_account_is_recoverable(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from auth.users as account
    where account.id = p_user_id
      and account.deleted_at is null
      and account.is_anonymous is false
      and account.email is not null
      and pg_catalog.char_length(pg_catalog.btrim(account.email)) > 3
      and account.email_confirmed_at is not null
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
  ), false)
$$;

alter function private.economic_account_is_recoverable(uuid) owner to postgres;
revoke all privileges on function private.economic_account_is_recoverable(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.active_economic_legal_version(p_document_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select active_document.document_version
  from private.economic_active_legal_documents as active_document
  where active_document.document_key = p_document_key
$$;

alter function private.active_economic_legal_version(text) owner to postgres;
revoke all privileges on function private.active_economic_legal_version(text)
  from public, anon, authenticated, service_role;

create or replace function private.active_economic_legal_content_sha256(p_document_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select document.content_sha256
  from private.economic_active_legal_documents as active_document
  join private.economic_legal_document_versions as document
    on document.document_key = active_document.document_key
   and document.document_version = active_document.document_version
  where active_document.document_key = p_document_key
$$;

alter function private.active_economic_legal_content_sha256(text) owner to postgres;
revoke all privileges on function private.active_economic_legal_content_sha256(text)
  from public, anon, authenticated, service_role;

create or replace function private.require_active_economic_legal_version(
  p_document_key text,
  p_document_version text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.active_economic_legal_version(p_document_key)
       is distinct from p_document_version then
    raise exception using errcode = '22023', message = 'economic_legal_document_version_invalid';
  end if;
end;
$$;

alter function private.require_active_economic_legal_version(text, text) owner to postgres;
revoke all privileges on function private.require_active_economic_legal_version(text, text)
  from public, anon, authenticated, service_role;

create or replace function private.economic_checkout_bundle_key(p_flow text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case p_flow
    when 'support_one_time' then 'support_one_time_checkout_bundle'
    when 'support_recurring' then 'support_recurring_checkout_bundle'
    when 'sandbox_credits' then 'sandbox_credits_checkout_bundle'
    when 'job_post_fee' then 'job_post_fee_checkout_bundle'
    when 'marketplace_purchase' then 'marketplace_purchase_checkout_bundle'
    when 'organization_service' then 'organization_service_checkout_bundle'
    when 'sponsorship' then 'sponsorship_checkout_bundle'
    else null
  end
$$;

alter function private.economic_checkout_bundle_key(text) owner to postgres;
revoke all privileges on function private.economic_checkout_bundle_key(text)
  from public, anon, authenticated, service_role;

create or replace function private.require_active_economic_consent_bundle(
  p_bundle_key text,
  p_bundle_version text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from private.economic_active_legal_consent_bundles as active_bundle
    where active_bundle.bundle_key = p_bundle_key
      and active_bundle.bundle_version = p_bundle_version
  ) then
    raise exception using errcode = '22023', message = 'economic_legal_consent_bundle_version_invalid';
  end if;
end;
$$;

alter function private.require_active_economic_consent_bundle(text, text) owner to postgres;
revoke all privileges on function private.require_active_economic_consent_bundle(text, text)
  from public, anon, authenticated, service_role;

create or replace function private.expire_stale_economic_checkouts_core(
  p_limit integer,
  p_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_expired integer := 0;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'economic_checkout_expiry_limit_invalid';
  end if;
  for v_order in
    select * from private.economic_orders as candidate
    where candidate.status in ('pending', 'checkout_created')
      and candidate.checkout_expires_at is not null
      and candidate.checkout_expires_at <= pg_catalog.now()
      and (p_user_id is null or candidate.user_id = p_user_id)
    order by candidate.checkout_expires_at, candidate.id
    for update skip locked
    limit p_limit
  loop
    update private.economic_orders
    set status = 'failed', failure_code = 'checkout_session_expired',
        failure_message = null, failed_at = coalesce(failed_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    where id = v_order.id;
    insert into private.economic_audit_events (
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'system', 'checkout_expired', 'economic_order', v_order.id,
      pg_catalog.jsonb_build_object(
        'previous_status', v_order.status,
        'provider_event_required_for_payment_truth', true,
        'test_mode', true
      )
    );
    v_expired := v_expired + 1;
  end loop;
  return v_expired;
end;
$$;

alter function private.expire_stale_economic_checkouts_core(integer, uuid) owner to postgres;
revoke all privileges on function private.expire_stale_economic_checkouts_core(integer, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.begin_economic_checkout_core(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_flow text,
  p_amount_minor bigint,
  p_currency text,
  p_price_code text,
  p_source_route text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing private.economic_orders%rowtype;
  v_order private.economic_orders%rowtype;
  v_price record;
  v_feature_key text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'economic_client_request_id_required';
  end if;

  if p_actor_user_id is not null
     and not exists (select 1 from auth.users as account where account.id = p_actor_user_id) then
    raise exception using errcode = '23503', message = 'economic_actor_not_found';
  end if;

  if p_actor_user_id is not null
     and not private.economic_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'economic_recoverable_account_required';
  end if;

  if p_actor_user_id is null and p_flow <> 'support_one_time' then
    raise exception using errcode = '42501', message = 'economic_account_required';
  end if;

  if p_actor_user_id is not null and (
    private.economic_service_is_restricted(p_actor_user_id, 'billing')
    or private.economic_service_is_restricted(
      p_actor_user_id,
      case p_flow
        when 'support_recurring' then 'recurring_support'
        when 'sandbox_credits' then 'sandbox'
        when 'marketplace_purchase' then 'marketplace_buying'
        when 'job_post_fee' then 'job_posting'
        else 'billing'
      end
    )
  ) then
    raise exception using errcode = '42501', message = 'economic_service_scope_restricted';
  end if;

  v_feature_key := case p_flow
    when 'support_one_time' then 'support_checkout'
    when 'support_recurring' then 'recurring_support'
    when 'sandbox_credits' then 'sandbox_credit_purchase'
    when 'job_post_fee' then 'job_post_fee_enforcement'
    when 'marketplace_purchase' then 'marketplace_paid_offers'
    when 'organization_service' then 'organization_billing'
    when 'sponsorship' then 'sponsorship_checkout'
    else null
  end;

  if v_feature_key is null then
    raise exception using errcode = '22023', message = 'economic_flow_invalid';
  end if;

  if not private.economic_feature_enabled(v_feature_key) then
    raise exception using errcode = '55000', message = 'economic_feature_disabled';
  end if;

  -- Every provider checkout is reconciled from verified provider events. This
  -- runtime dependency remains fail-closed even if an operator later disables
  -- flags in an otherwise invalid order.
  if not private.economic_feature_enabled('economic_webhooks') then
    raise exception using errcode = '55000', message = 'economic_verified_webhooks_required';
  end if;

  if p_flow = 'support_recurring'
     and not private.economic_feature_enabled('support_checkout') then
    raise exception using errcode = '55000', message = 'economic_support_checkout_disabled';
  end if;

  if p_flow = 'support_recurring'
     and not private.economic_feature_enabled('customer_portal') then
    raise exception using errcode = '55000', message = 'economic_customer_portal_required';
  end if;

  if p_flow = 'sandbox_credits'
     and not private.economic_feature_enabled('sandbox_credit_display') then
    raise exception using errcode = '55000', message = 'sandbox_credit_display_required';
  end if;

  if p_flow = 'marketplace_purchase'
     and not private.economic_feature_enabled('marketplace_seller_onboarding') then
    raise exception using errcode = '55000', message = 'marketplace_paid_prerequisites_required';
  end if;

  select
    price.*,
    product.product_kind,
    product.display_name,
    product.active as product_active,
    product.test_mode_only as product_test_mode_only
  into v_price
  from private.economic_prices as price
  join private.economic_products as product on product.product_key = price.product_key
  where price.price_code = p_price_code;

  if not found
     or not v_price.active
     or not v_price.product_active
     or not v_price.test_mode_only
     or not v_price.product_test_mode_only
     or v_price.product_kind <> p_flow then
    raise exception using errcode = '22023', message = 'economic_price_invalid';
  end if;

  if lower(coalesce(p_currency, '')) <> v_price.currency then
    raise exception using errcode = '22023', message = 'economic_currency_invalid';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'economic_amount_invalid';
  end if;

  if v_price.unit_amount_minor is not null
     and p_amount_minor <> v_price.unit_amount_minor then
    raise exception using errcode = '22023', message = 'economic_fixed_amount_mismatch';
  end if;

  if v_price.unit_amount_minor is null and (
    p_amount_minor < v_price.minimum_amount_minor
    or p_amount_minor > v_price.maximum_amount_minor
  ) then
    raise exception using errcode = '22023', message = 'economic_variable_amount_out_of_range';
  end if;

  if coalesce(p_source_route, '') !~ '^/[A-Za-z0-9/_?&=.%:-]*$'
     or pg_catalog.char_length(p_source_route) > 300 then
    raise exception using errcode = '22023', message = 'economic_source_route_invalid';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_consent_version, ''))) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'economic_consent_version_required';
  end if;

  perform private.require_active_economic_consent_bundle(
    private.economic_checkout_bundle_key(p_flow), p_consent_version
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_client_request_id::text, 0)
  );

  select * into v_existing
  from private.economic_orders as existing_order
  where existing_order.client_request_id = p_client_request_id;

  if found then
    if v_existing.user_id is distinct from p_actor_user_id
       or v_existing.flow <> p_flow
       or v_existing.total_minor <> p_amount_minor
       or v_existing.currency <> lower(p_currency)
       or v_existing.source_route <> p_source_route
       or v_existing.consent_version <> p_consent_version then
      raise exception using errcode = '23505', message = 'economic_checkout_idempotency_conflict';
    end if;

    return pg_catalog.jsonb_build_object(
      'orderId', v_existing.id,
      'publicReference', v_existing.public_reference,
      'idempotencyKey', 'checkout:' || p_client_request_id::text,
      'amountMinor', v_existing.total_minor,
      'currency', v_existing.currency,
      'providerCustomerReference', (
        select customer.provider_customer_reference
        from private.billing_customers as customer
        where customer.id = v_existing.billing_customer_id
      ),
      'providerProductReference', (
        select catalog.provider_product_reference
        from private.economic_provider_catalog as catalog
        where catalog.provider = 'stripe' and catalog.price_code = p_price_code
          and catalog.active = true and catalog.test_mode = true and catalog.retired_at is null
      ),
      'providerPriceReference', (
        select catalog.provider_price_reference
        from private.economic_provider_catalog as catalog
        where catalog.provider = 'stripe' and catalog.price_code = p_price_code
          and catalog.active = true and catalog.test_mode = true and catalog.retired_at is null
      ),
      'status', v_existing.status,
      'idempotentReplay', true,
      'testMode', true
    );
  end if;

  -- Repository-side circuit breaker. This is deliberately identity-minimal:
  -- no IP, device fingerprint, or behavioral profile is stored. Cloudflare and
  -- provider rate limiting remain required defense-in-depth at activation.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      coalesce(p_actor_user_id::text, 'economic-guest-checkout-global'), 1
    )
  );
  -- Stripe Checkout is explicitly created with a 30-minute lifetime. The
  -- stored deadline includes a five-minute skew margin (and a longer
  -- pre-attachment crash margin), so this cannot race a still-open Session.
  if p_actor_user_id is not null then
    perform private.expire_stale_economic_checkouts_core(20, p_actor_user_id);
  end if;
  -- Until the first verified Checkout event establishes one canonical Stripe
  -- Customer for this Website Account, allow only the same idempotent order to
  -- be retried. The per-user advisory lock makes two new tabs observe this
  -- rule serially, preventing different provider customers from being created
  -- for the database's one active (user, provider) relationship.
  if p_actor_user_id is not null
     and not exists (
       select 1
       from private.billing_customers as customer
       where customer.user_id = p_actor_user_id
         and customer.provider = 'stripe'
         and customer.archived_at is null
         and customer.provider_customer_reference is not null
     )
     and exists (
       select 1
       from private.economic_orders as initializing_order
       where initializing_order.user_id = p_actor_user_id
         and initializing_order.status in ('pending', 'checkout_created', 'processing')
     ) then
    raise exception using
      errcode = '55000',
      message = 'economic_billing_customer_initialization_in_progress';
  elsif p_actor_user_id is not null and (
    select pg_catalog.count(*)
    from private.economic_orders as recent_order
    where recent_order.user_id = p_actor_user_id
      and recent_order.status in ('pending', 'checkout_created', 'processing')
      and recent_order.created_at > pg_catalog.now() - interval '15 minutes'
  ) >= 8 then
    raise exception using errcode = '55000', message = 'economic_checkout_velocity_limited';
  elsif p_actor_user_id is null and (
    select pg_catalog.count(*)
    from private.economic_orders as recent_order
    where recent_order.user_id is null
      and recent_order.status in ('pending', 'checkout_created', 'processing')
      and recent_order.created_at > pg_catalog.now() - interval '5 minutes'
  ) >= 100 then
    raise exception using errcode = '55000', message = 'economic_guest_checkout_circuit_open';
  end if;

  insert into private.economic_orders (
    client_request_id, user_id, flow, status, currency,
    subtotal_minor, total_minor, source_route, consent_version,
    checkout_expires_at, metadata
  ) values (
    p_client_request_id,
    p_actor_user_id,
    p_flow,
    'pending',
    lower(p_currency),
    p_amount_minor,
    p_amount_minor,
    p_source_route,
    p_consent_version,
    pg_catalog.now() + interval '40 minutes',
    pg_catalog.jsonb_build_object(
      'test_mode', true,
      'no_authority_or_membership_effect', true
    )
  ) returning * into v_order;

  insert into private.economic_order_items (
    order_id, product_key, price_id, price_code_snapshot,
    product_name_snapshot, quantity, unit_amount_minor,
    total_amount_minor, currency, recurring_interval_snapshot
  ) values (
    v_order.id,
    v_price.product_key,
    v_price.id,
    v_price.price_code,
    v_price.display_name,
    1,
    p_amount_minor,
    p_amount_minor,
    lower(p_currency),
    v_price.recurring_interval
  );

  insert into private.economic_consents (
    user_id, order_id, document_key, document_version,
    source_route, client_request_id, metadata
  ) values (
    p_actor_user_id,
    v_order.id,
    private.economic_checkout_bundle_key(p_flow),
    p_consent_version,
    p_source_route,
    p_client_request_id,
    pg_catalog.jsonb_build_object('flow', p_flow, 'test_mode', true)
  );

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, metadata
  ) values (
    p_actor_user_id,
    case when p_actor_user_id is null then 'system' else 'user' end,
    'checkout_prepared',
    'economic_order',
    v_order.id,
    pg_catalog.jsonb_build_object('flow', p_flow, 'test_mode', true)
  );

  return pg_catalog.jsonb_build_object(
    'orderId', v_order.id,
    'publicReference', v_order.public_reference,
    'idempotencyKey', 'checkout:' || p_client_request_id::text,
    'amountMinor', v_order.total_minor,
    'currency', v_order.currency,
    'providerCustomerReference', null,
    'providerProductReference', (
      select catalog.provider_product_reference
      from private.economic_provider_catalog as catalog
      where catalog.provider = 'stripe' and catalog.price_code = p_price_code
        and catalog.active = true and catalog.test_mode = true and catalog.retired_at is null
    ),
    'providerPriceReference', (
      select catalog.provider_price_reference
      from private.economic_provider_catalog as catalog
      where catalog.provider = 'stripe' and catalog.price_code = p_price_code
        and catalog.active = true and catalog.test_mode = true and catalog.retired_at is null
    ),
    'status', v_order.status,
    'idempotentReplay', false,
    'testMode', true
  );
end;
$$;

alter function private.begin_economic_checkout_core(uuid, uuid, text, bigint, text, text, text, text)
  owner to postgres;

create or replace function private.upsert_economic_billing_customer(
  p_user_id uuid,
  p_provider text,
  p_provider_customer_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer private.billing_customers%rowtype;
begin
  if nullif(p_provider_customer_reference, '') is null then
    return null;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_provider || ':' || p_provider_customer_reference, 0)
  );

  select * into v_customer
  from private.billing_customers as customer
  where customer.provider = p_provider
    and customer.provider_customer_reference = p_provider_customer_reference
  for update;

  if found then
    if v_customer.user_id is not null
       and p_user_id is not null
       and v_customer.user_id <> p_user_id then
      raise exception using errcode = '23505', message = 'economic_billing_customer_owner_conflict';
    end if;
    update private.billing_customers
    set
      user_id = coalesce(user_id, p_user_id),
      status = 'active',
      updated_at = pg_catalog.now()
    where id = v_customer.id;
    return v_customer.id;
  end if;

  if p_user_id is not null then
    select * into v_customer
    from private.billing_customers as customer
    where customer.user_id = p_user_id
      and customer.provider = p_provider
      and customer.archived_at is null
    for update;

    if found then
      if v_customer.provider_customer_reference is not null
         and v_customer.provider_customer_reference <> p_provider_customer_reference then
        raise exception using errcode = '23505', message = 'economic_billing_customer_reference_conflict';
      end if;
      update private.billing_customers
      set
        provider_customer_reference = p_provider_customer_reference,
        status = 'active',
        updated_at = pg_catalog.now()
      where id = v_customer.id;
      return v_customer.id;
    end if;
  end if;

  insert into private.billing_customers (
    user_id, provider, provider_customer_reference, status, test_mode
  ) values (
    p_user_id, p_provider, p_provider_customer_reference, 'active', true
  ) returning * into v_customer;

  return v_customer.id;
end;
$$;

alter function private.upsert_economic_billing_customer(uuid, text, text) owner to postgres;
revoke all privileges on function private.upsert_economic_billing_customer(uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.attach_economic_checkout_billing_customer(
  p_order_id uuid,
  p_provider text,
  p_provider_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_customer private.billing_customers%rowtype;
  v_customer_id uuid;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if coalesce(p_provider, '') !~ '^[a-z][a-z0-9_]{1,40}$'
     or pg_catalog.char_length(coalesce(p_provider_customer_id, '')) not between 1 and 255 then
    raise exception using errcode = '22023', message = 'economic_provider_reference_invalid';
  end if;

  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_order_not_found';
  end if;
  if v_order.user_id is null then
    raise exception using errcode = '55000', message = 'economic_guest_customer_link_forbidden';
  end if;
  if not private.economic_account_is_recoverable(v_order.user_id) then
    raise exception using errcode = '42501', message = 'economic_recoverable_account_required';
  end if;
  if v_order.status not in ('pending', 'checkout_created')
     and not (
       v_order.status = 'failed'
       and v_order.failure_code = 'provider_customer_creation_failed'
     ) then
    raise exception using errcode = '55000', message = 'economic_checkout_transition_invalid';
  end if;

  if v_order.billing_customer_id is not null then
    select * into v_customer
    from private.billing_customers as customer
    where customer.id = v_order.billing_customer_id
    for update;
    if not found
       or v_customer.user_id is distinct from v_order.user_id
       or v_customer.provider <> p_provider
       or v_customer.provider_customer_reference <> p_provider_customer_id then
      raise exception using errcode = '23505', message = 'economic_provider_customer_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'orderId', v_order.id,
      'status', v_order.status,
      'idempotentReplay', true,
      'testMode', true
    );
  end if;

  v_customer_id := private.upsert_economic_billing_customer(
    v_order.user_id, p_provider, p_provider_customer_id
  );
  update private.economic_orders
  set
    billing_customer_id = v_customer_id,
    provider = p_provider,
    status = case when status = 'failed' then 'pending' else status end,
    checkout_expires_at = case
      when status = 'failed' then pg_catalog.now() + interval '40 minutes'
      else checkout_expires_at
    end,
    failure_code = case when status = 'failed' then null else failure_code end,
    failure_message = case when status = 'failed' then null else failure_message end,
    failed_at = case when status = 'failed' then null else failed_at end,
    updated_at = pg_catalog.now()
  where id = v_order.id;

  insert into private.economic_audit_events(
    actor_kind, action, target_type, target_id, metadata
  ) values (
    'system', 'checkout_billing_customer_attached',
    'economic_order', v_order.id,
    pg_catalog.jsonb_build_object(
      'provider', p_provider,
      'before_provider_session_creation', true,
      'provider_reference_exposed', false,
      'test_mode', true
    )
  );
  return pg_catalog.jsonb_build_object(
    'orderId', v_order.id,
    'status', 'pending',
    'idempotentReplay', false,
    'testMode', true
  );
end;
$$;

alter function public.attach_economic_checkout_billing_customer(uuid, text, text)
  owner to postgres;

create or replace function public.attach_economic_checkout_provider_session(
  p_order_id uuid,
  p_provider text,
  p_provider_session_id text,
  p_provider_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_customer_id uuid;
  v_current_customer_reference text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  if coalesce(p_provider, '') !~ '^[a-z][a-z0-9_]{1,40}$'
     or pg_catalog.char_length(coalesce(p_provider_session_id, '')) not between 1 and 255
     or pg_catalog.char_length(coalesce(p_provider_customer_id, '')) > 255 then
    raise exception using errcode = '22023', message = 'economic_provider_reference_invalid';
  end if;

  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'economic_order_not_found';
  end if;

  if v_order.status not in ('pending', 'checkout_created')
     and not (
       v_order.status = 'failed'
       and v_order.failure_code = 'provider_checkout_creation_failed'
       and (v_order.provider is null or v_order.provider = p_provider)
       and (
         v_order.provider_session_reference is null
         or v_order.provider_session_reference = p_provider_session_id
       )
     ) then
    raise exception using errcode = '55000', message = 'economic_checkout_transition_invalid';
  end if;

  if v_order.provider_session_reference is not null
     and (
       v_order.provider <> p_provider
       or v_order.provider_session_reference <> p_provider_session_id
     ) then
    raise exception using errcode = '23505', message = 'economic_provider_session_conflict';
  end if;

  -- Every account-linked Checkout must establish its one canonical provider
  -- Customer before a payable Session can be created. This prevents a locally
  -- expired Session and a delayed signed webhook from racing a second Customer.
  if v_order.user_id is not null and v_order.billing_customer_id is null then
    raise exception using errcode = '55000', message = 'economic_billing_customer_required';
  end if;

  if v_order.billing_customer_id is not null then
    select customer.provider_customer_reference
    into v_current_customer_reference
    from private.billing_customers as customer
    where customer.id = v_order.billing_customer_id;
  end if;

  if v_order.status = 'checkout_created'
     and v_order.provider = p_provider
     and v_order.provider_session_reference = p_provider_session_id then
    if v_current_customer_reference is not distinct from nullif(p_provider_customer_id, '') then
      return pg_catalog.jsonb_build_object(
        'orderId', p_order_id,
        'status', 'checkout_created',
        'idempotentReplay', true,
        'testMode', true
      );
    elsif v_current_customer_reference is not null then
      raise exception using errcode = '23505', message = 'economic_provider_customer_conflict';
    end if;
  end if;

  if nullif(p_provider_customer_id, '') is not null then
    v_customer_id := private.upsert_economic_billing_customer(
      v_order.user_id, p_provider, p_provider_customer_id
    );
  end if;

  update private.economic_orders
  set
    billing_customer_id = coalesce(v_customer_id, billing_customer_id),
    provider = p_provider,
    provider_session_reference = p_provider_session_id,
    status = 'checkout_created',
    checkout_expires_at = pg_catalog.now() + interval '35 minutes',
    failure_code = null,
    failure_message = null,
    failed_at = null,
    updated_at = pg_catalog.now()
  where id = p_order_id;

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, metadata
  ) values (
    'system',
    case
      when v_order.status = 'failed' then 'checkout_provider_session_recovered'
      else 'checkout_provider_session_attached'
    end,
    'economic_order', p_order_id,
    pg_catalog.jsonb_build_object(
      'provider', p_provider,
      'recovered_from_ambiguous_failure', v_order.status = 'failed',
      'test_mode', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'orderId', p_order_id,
    'status', 'checkout_created',
    'idempotentReplay', false,
    'testMode', true
  );
end;
$$;

alter function public.attach_economic_checkout_provider_session(uuid, text, text, text)
  owner to postgres;

create or replace function public.fail_economic_checkout_attempt(
  p_order_id uuid,
  p_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_failure_code, ''))) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'economic_failure_code_invalid';
  end if;

  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'economic_order_not_found';
  end if;

  if v_order.status in ('paid', 'partially_refunded', 'refunded', 'disputed') then
    raise exception using errcode = '55000', message = 'economic_paid_order_cannot_fail';
  end if;

  if v_order.status = 'failed' then
    if v_order.failure_code = pg_catalog.left(pg_catalog.btrim(p_failure_code), 120) then
      return pg_catalog.jsonb_build_object(
        'orderId', p_order_id, 'status', 'failed', 'idempotentReplay', true
      );
    end if;
    raise exception using errcode = '23505', message = 'economic_checkout_failure_conflict';
  end if;

  update private.economic_orders
  set
    status = 'failed',
    failure_code = pg_catalog.left(pg_catalog.btrim(p_failure_code), 120),
    failure_message = null,
    failed_at = coalesce(failed_at, pg_catalog.now()),
    updated_at = pg_catalog.now()
  where id = p_order_id;

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, metadata
  ) values (
    'system', 'checkout_failed', 'economic_order', p_order_id,
    pg_catalog.jsonb_build_object('failure_code', pg_catalog.left(p_failure_code, 120))
  );

  return pg_catalog.jsonb_build_object(
    'orderId', p_order_id, 'status', 'failed', 'idempotentReplay', false
  );
end;
$$;

alter function public.fail_economic_checkout_attempt(uuid, text) owner to postgres;

create or replace function public.expire_stale_economic_checkouts(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  v_expired := private.expire_stale_economic_checkouts_core(p_limit, null);
  return pg_catalog.jsonb_build_object(
    'expired', v_expired,
    'canonicalFinancialTruth', false,
    'testMode', true
  );
end;
$$;

alter function public.expire_stale_economic_checkouts(integer) owner to postgres;

create or replace function public.process_economic_provider_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_payload_sha256 text,
  p_normalized_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event private.economic_webhook_events%rowtype;
  v_existing private.economic_webhook_events%rowtype;
  v_order private.economic_orders%rowtype;
  v_order_id uuid;
  v_amount_minor bigint;
  v_currency text;
  v_payment_status text;
  v_provider_object_reference text;
  v_provider_payment_id text;
  v_provider_customer_id text;
  v_provider_subscription_id text;
  v_provider_refund_id text;
  v_provider_dispute_id text;
  v_subscription_status text;
  v_price private.economic_prices%rowtype;
  v_customer_id uuid;
  v_refund_amount bigint;
  v_total_refunded bigint;
  v_refund_status text;
  v_existing_refund private.economic_refunds%rowtype;
  v_existing_dispute private.economic_disputes%rowtype;
  v_dispute_status text;
  v_payment_transaction private.economic_payment_transactions%rowtype;
  v_total_gross bigint;
  v_projected_order_status text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  if not private.economic_feature_enabled('economic_webhooks') then
    raise exception using errcode = '55000', message = 'economic_webhooks_disabled';
  end if;

  if coalesce((p_normalized_event ->> 'livemode')::boolean, false) then
    raise exception using errcode = '42501', message = 'economic_live_provider_event_rejected';
  end if;

  if coalesce(p_provider, '') !~ '^[a-z][a-z0-9_]{1,40}$'
     or pg_catalog.char_length(coalesce(p_provider_event_id, '')) not between 1 and 255
     or pg_catalog.char_length(coalesce(p_event_type, '')) not between 1 and 180
     or p_event_created_at is null
     or coalesce(p_payload_sha256, '') !~ '^[0-9a-f]{64}$'
     or pg_catalog.jsonb_typeof(coalesce(p_normalized_event, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'economic_provider_event_invalid';
  end if;

  select * into v_existing
  from private.economic_webhook_events as existing_event
  where existing_event.provider = p_provider
    and existing_event.provider_event_id = p_provider_event_id;

  if found then
    if v_existing.payload_sha256 <> p_payload_sha256
       or v_existing.event_type <> p_event_type then
      raise exception using errcode = '23505', message = 'economic_provider_event_conflict';
    end if;
    if v_existing.processing_status = 'failed' then
      update private.economic_webhook_events
      set
        processing_status = 'received',
        processing_attempts = processing_attempts + 1,
        processing_error = null,
        processed_at = null
      where id = v_existing.id
      returning * into v_event;
    else
      return pg_catalog.jsonb_build_object(
        'eventId', v_existing.id,
        'status', 'duplicate',
        'idempotentReplay', true
      );
    end if;
  end if;

  if v_event.id is null then
    insert into private.economic_webhook_events (
      provider, provider_event_id, event_type, event_created_at,
      payload_sha256, normalized_event
    ) values (
      p_provider, p_provider_event_id, p_event_type, p_event_created_at,
      p_payload_sha256, p_normalized_event
    ) returning * into v_event;
  end if;

  -- The verified provider signature authenticates an event; it does not
  -- authorize an arbitrary event name to mutate economic state. Unsupported
  -- signed events are retained for reconciliation and acknowledged as ignored.
  if p_event_type not in (
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled',
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'refund.created',
    'refund.updated',
    'refund.failed',
    'charge.dispute.created',
    'charge.dispute.updated',
    'charge.dispute.closed',
    'charge.dispute.funds_withdrawn',
    'charge.dispute.funds_reinstated'
  ) then
    update private.economic_webhook_events
    set processing_status = 'unmatched', processing_error = null,
        processed_at = pg_catalog.now()
    where id = v_event.id;
    return pg_catalog.jsonb_build_object(
      'eventId', v_event.id, 'status', 'ignored',
      'reason', 'unsupported_event_type', 'idempotentReplay', false
    );
  end if;

  begin
  begin
    v_order_id := nullif(coalesce(
      p_normalized_event ->> 'economicOrderId',
      p_normalized_event ->> 'orderId',
      p_normalized_event ->> 'order_id'
    ), '')::uuid;
  exception when invalid_text_representation then
    v_order_id := null;
  end;

  v_provider_object_reference := nullif(p_normalized_event ->> 'providerObjectReference', '');
  v_provider_payment_id := nullif(coalesce(
    p_normalized_event ->> 'paymentReference',
    p_normalized_event ->> 'providerPaymentId',
    p_normalized_event ->> 'provider_payment_id'
  ), '');
  v_provider_customer_id := nullif(coalesce(
    p_normalized_event ->> 'customerReference',
    p_normalized_event ->> 'providerCustomerId',
    p_normalized_event ->> 'provider_customer_id'
  ), '');
  v_provider_subscription_id := nullif(coalesce(
    p_normalized_event ->> 'subscriptionReference',
    p_normalized_event ->> 'providerSubscriptionId',
    p_normalized_event ->> 'provider_subscription_id'
  ), '');
  v_provider_refund_id := nullif(coalesce(
    p_normalized_event ->> 'refundReference',
    p_normalized_event ->> 'providerRefundId',
    p_normalized_event ->> 'provider_refund_id'
  ), '');
  v_provider_dispute_id := nullif(coalesce(
    p_normalized_event ->> 'disputeReference',
    p_normalized_event ->> 'providerDisputeId',
    p_normalized_event ->> 'provider_dispute_id'
  ), '');

  -- Provider lifecycle events do not consistently repeat Checkout metadata.
  -- Resolve from durable provider references before classifying an event as
  -- unmatched. No customer-only fallback is used because one customer can own
  -- multiple unrelated orders.
  if v_order_id is null and v_provider_object_reference is not null then
    select candidate.id into v_order_id
    from private.economic_orders as candidate
    where candidate.provider = p_provider
      and candidate.provider_session_reference = v_provider_object_reference
    limit 1;
  end if;

  if v_order_id is null and coalesce(v_provider_payment_id, v_provider_object_reference) is not null then
    select transaction.order_id into v_order_id
    from private.economic_payment_transactions as transaction
    where transaction.provider = p_provider
      and transaction.provider_transaction_reference = coalesce(v_provider_payment_id, v_provider_object_reference)
    order by transaction.occurred_at desc
    limit 1;
  end if;

  if v_order_id is null and coalesce(v_provider_subscription_id, v_provider_object_reference) is not null then
    select subscription.originating_order_id into v_order_id
    from private.economic_subscriptions as subscription
    where subscription.provider = p_provider
      and subscription.provider_subscription_reference = coalesce(v_provider_subscription_id, v_provider_object_reference)
    order by subscription.updated_at desc
    limit 1;
  end if;

  if v_order_id is null and coalesce(v_provider_refund_id, v_provider_object_reference) is not null then
    select refund.order_id into v_order_id
    from private.economic_refunds as refund
    where refund.provider = p_provider
      and refund.provider_refund_reference = coalesce(v_provider_refund_id, v_provider_object_reference)
    limit 1;
  end if;

  if v_order_id is null and coalesce(v_provider_dispute_id, v_provider_object_reference) is not null then
    select dispute.order_id into v_order_id
    from private.economic_disputes as dispute
    where dispute.provider = p_provider
      and dispute.provider_dispute_reference = coalesce(v_provider_dispute_id, v_provider_object_reference)
    limit 1;
  end if;

  if v_order_id is null then
    update private.economic_webhook_events
    set
      processing_status = case
        when p_event_type like 'checkout.%'
          or p_event_type like 'payment_intent.%'
          or p_event_type like 'invoice.%'
          or p_event_type like 'customer.subscription.%'
          or p_event_type like '%refund%'
          or p_event_type like '%dispute%'
        then 'failed'
        else 'unmatched'
      end,
      processing_error = case
        when p_event_type like 'checkout.%'
          or p_event_type like 'payment_intent.%'
          or p_event_type like 'invoice.%'
          or p_event_type like 'customer.subscription.%'
          or p_event_type like '%refund%'
          or p_event_type like '%dispute%'
        then 'economic_order_unresolved'
        else null
      end,
      processed_at = case
        when p_event_type like 'checkout.%'
          or p_event_type like 'payment_intent.%'
          or p_event_type like 'invoice.%'
          or p_event_type like 'customer.subscription.%'
          or p_event_type like '%refund%'
          or p_event_type like '%dispute%'
        then null
        else pg_catalog.now()
      end
    where id = v_event.id;
    return pg_catalog.jsonb_build_object(
      'eventId', v_event.id,
      'status', case
        when p_event_type like 'checkout.%'
          or p_event_type like 'payment_intent.%'
          or p_event_type like 'invoice.%'
          or p_event_type like 'customer.subscription.%'
          or p_event_type like '%refund%'
          or p_event_type like '%dispute%'
        then 'retry'
        else 'ignored'
      end,
      'idempotentReplay', false
    );
  end if;

  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = v_order_id
  for update;

  if not found then
    update private.economic_webhook_events
    set
      processing_status = 'failed',
      processing_error = 'economic_order_not_found',
      processed_at = null
    where id = v_event.id;
    return pg_catalog.jsonb_build_object(
      'eventId', v_event.id, 'status', 'retry', 'idempotentReplay', false
    );
  end if;

  -- The order timestamp belongs only to the Checkout Session stream. Invoice,
  -- PaymentIntent, subscription, refund, and dispute streams have independent
  -- durable records and must not suppress one another when delivery is reordered.
  if p_event_type like 'checkout.session.%'
     and v_order.provider_event_created_at is not null
     and p_event_created_at < v_order.provider_event_created_at then
    update private.economic_webhook_events
    set processing_status = 'ignored_out_of_order', processed_at = pg_catalog.now()
    where id = v_event.id;
    return pg_catalog.jsonb_build_object(
      'eventId', v_event.id,
      'orderId', v_order.id,
      'status', 'ignored',
      'idempotentReplay', false
    );
  end if;

  begin
    v_amount_minor := nullif(coalesce(
      p_normalized_event ->> 'amountMinor',
      p_normalized_event ->> 'amount_minor'
    ), '')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    v_amount_minor := null;
  end;
  v_currency := lower(coalesce(
    p_normalized_event ->> 'currency', v_order.currency
  ));
  v_payment_status := lower(coalesce(
    p_normalized_event ->> 'paymentStatus',
    p_normalized_event ->> 'payment_status',
    ''
  ));

  if v_provider_customer_id is not null then
    v_customer_id := private.upsert_economic_billing_customer(
      v_order.user_id, p_provider, v_provider_customer_id
    );

    update private.economic_orders
    set billing_customer_id = coalesce(billing_customer_id, v_customer_id)
    where id = v_order.id;
  else
    v_customer_id := v_order.billing_customer_id;
  end if;

  -- A recurring Checkout Session establishes the durable customer/subscription
  -- association, but the Session itself is not the monetary transaction. Stripe
  -- subscription-mode Sessions can be complete/paid without exposing a direct
  -- PaymentIntent. The corresponding invoice.paid event records each actual
  -- charge (including renewals) against the same originating order.
  if p_event_type in (
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded'
    )
    and v_order.flow = 'support_recurring'
    and v_provider_subscription_id is not null then
    if (v_amount_minor is not null and v_amount_minor <> v_order.total_minor)
       or v_currency <> v_order.currency then
      raise exception using errcode = '22023', message = 'economic_provider_amount_mismatch';
    end if;
    update private.economic_orders
    set
      status = case
        when status in ('paid', 'partially_refunded', 'refunded', 'disputed') then status
        else 'processing'
      end,
      provider = coalesce(provider, p_provider),
      provider_event_created_at = p_event_created_at,
      failure_code = null,
      failure_message = null,
      updated_at = pg_catalog.now()
    where id = v_order.id;
  elsif p_event_type in (
    'checkout.session.async_payment_succeeded',
    'payment_intent.succeeded', 'invoice.paid'
  ) or (
    p_event_type = 'checkout.session.completed'
    and v_payment_status in ('paid', 'no_payment_required')
  ) or (
    v_payment_status in ('paid', 'succeeded')
    and (
      p_event_type like 'checkout.%'
      or p_event_type like 'payment_intent.%'
      or p_event_type like 'invoice.%'
    )
  ) then
    if v_amount_minor is null
       or v_amount_minor <> v_order.total_minor
       or v_currency <> v_order.currency
       or v_provider_payment_id is null then
      raise exception using errcode = '22023', message = 'economic_provider_amount_mismatch';
    end if;

    insert into private.economic_payment_transactions (
      order_id, webhook_event_id, provider, provider_transaction_reference,
      transaction_type, status, gross_amount_minor, currency, occurred_at
    ) values (
      v_order.id, v_event.id, p_provider, v_provider_payment_id,
      'payment', 'succeeded', v_amount_minor, v_currency, p_event_created_at
    ) on conflict do nothing;
    select * into v_payment_transaction
    from private.economic_payment_transactions as transaction
    where transaction.provider = p_provider
      and transaction.provider_transaction_reference = v_provider_payment_id
      and transaction.transaction_type = 'payment';
    if not found
       or v_payment_transaction.order_id <> v_order.id
       or v_payment_transaction.status <> 'succeeded'
       or v_payment_transaction.gross_amount_minor <> v_amount_minor
       or v_payment_transaction.currency <> v_currency then
      raise exception using errcode = '23505', message = 'economic_payment_reference_conflict';
    end if;

    -- Payment-family events can be delivered after refund/dispute events. The
    -- final order state is derived once from durable financial records so a
    -- delayed success cannot transiently retrigger paid fulfillment or revive
    -- an already refunded/disputed order.
    select coalesce(pg_catalog.sum(transaction.gross_amount_minor), 0)
    into v_total_gross
    from private.economic_payment_transactions as transaction
    where transaction.order_id = v_order.id
      and transaction.transaction_type = 'payment'
      and transaction.status in ('succeeded', 'refunded', 'disputed');
    select coalesce(pg_catalog.sum(refund.amount_minor), 0)
    into v_total_refunded
    from private.economic_refunds as refund
    where refund.order_id = v_order.id
      and refund.status = 'succeeded';
    v_projected_order_status := case
      when v_total_gross > 0 and v_total_refunded >= v_total_gross then 'refunded'
      when exists (
        select 1
        from private.economic_disputes as dispute
        where dispute.order_id = v_order.id
          and dispute.status in (
            'warning_needs_response', 'warning_under_review',
            'needs_response', 'under_review', 'lost'
          )
      ) then 'disputed'
      when v_total_refunded > 0 then 'partially_refunded'
      else 'paid'
    end;
    update private.economic_orders
    set
      status = v_projected_order_status,
      provider = coalesce(provider, p_provider),
      paid_at = coalesce(paid_at, p_event_created_at),
      refunded_at = case
        when v_projected_order_status = 'refunded' then coalesce(refunded_at, p_event_created_at)
        else refunded_at
      end,
      provider_event_created_at = case
        when p_event_type like 'checkout.session.%' then p_event_created_at
        else provider_event_created_at
      end,
      failure_code = null,
      failure_message = null,
      updated_at = pg_catalog.now()
    where id = v_order.id;
  elsif p_event_type in (
    'checkout.session.async_payment_failed', 'payment_intent.payment_failed',
    'invoice.payment_failed'
  ) or (
    v_payment_status = 'failed'
    and (
      p_event_type like 'checkout.%'
      or p_event_type like 'payment_intent.%'
      or p_event_type like 'invoice.%'
    )
  ) then
    if v_order.status not in ('paid', 'partially_refunded', 'refunded', 'disputed') then
      update private.economic_orders
      set
        status = 'failed',
        failure_code = 'provider_payment_failed',
        failed_at = coalesce(failed_at, p_event_created_at),
        provider_event_created_at = case
          when p_event_type like 'checkout.session.%' then p_event_created_at
          else provider_event_created_at
        end,
        updated_at = pg_catalog.now()
      where id = v_order.id;
    end if;

    insert into private.economic_payment_transactions (
      order_id, webhook_event_id, provider, provider_transaction_reference,
      transaction_type, status, gross_amount_minor, currency, occurred_at
    ) values (
      v_order.id, v_event.id, p_provider, v_provider_payment_id,
      'failure', 'failed', coalesce(v_amount_minor, v_order.total_minor),
      v_order.currency, p_event_created_at
    ) on conflict do nothing;
  elsif p_event_type in ('checkout.session.expired', 'payment_intent.canceled') then
    if v_order.status not in ('paid', 'partially_refunded', 'refunded', 'disputed') then
      update private.economic_orders
      set
        status = 'canceled',
        canceled_at = coalesce(canceled_at, p_event_created_at),
        provider_event_created_at = case
          when p_event_type like 'checkout.session.%' then p_event_created_at
          else provider_event_created_at
        end,
        failure_code = case
          when p_event_type = 'checkout.session.expired' then 'provider_checkout_expired'
          else 'provider_payment_canceled'
        end,
        updated_at = pg_catalog.now()
      where id = v_order.id;
    end if;
  end if;

  if v_provider_subscription_id is not null and v_order.user_id is not null then
    select price.* into v_price
    from private.economic_order_items as item
    join private.economic_prices as price on price.id = item.price_id
    where item.order_id = v_order.id
    order by item.created_at
    limit 1;

    v_subscription_status := case lower(coalesce(
      p_normalized_event ->> 'subscriptionStatus',
      p_normalized_event ->> 'subscription_status',
      case
        when p_event_type = 'invoice.payment_failed' then 'past_due'
        when p_event_type = 'customer.subscription.deleted' then 'ended'
        when p_event_type = 'invoice.paid' then 'active'
        when p_event_type = 'checkout.session.async_payment_succeeded' then 'active'
        when p_event_type = 'checkout.session.completed'
          and v_payment_status in ('paid', 'no_payment_required') then 'active'
        else 'incomplete'
      end
    ))
      when 'trialing' then 'active'
      when 'active' then 'active'
      when 'past_due' then 'past_due'
      when 'unpaid' then 'grace_period'
      when 'paused' then 'grace_period'
      when 'canceled' then 'canceled'
      when 'canceling' then 'canceling'
      when 'ended' then 'ended'
      else 'incomplete'
    end;
    if p_event_type like 'customer.subscription.%'
       and v_subscription_status = 'active'
       and coalesce(nullif(coalesce(
         p_normalized_event ->> 'cancelAtPeriodEnd',
         p_normalized_event ->> 'cancel_at_period_end'
       ), '')::boolean, false) then
      v_subscription_status := 'canceling';
    end if;

    insert into private.economic_subscriptions (
      user_id, billing_customer_id, originating_order_id, price_id,
      provider, provider_subscription_reference, status,
      cancel_at_period_end, current_period_start, current_period_end,
      canceled_at, ended_at, provider_event_created_at,
      provider_subscription_event_created_at, provider_invoice_event_created_at
    ) values (
      v_order.user_id,
      v_customer_id,
      v_order.id,
      v_price.id,
      p_provider,
      v_provider_subscription_id,
      v_subscription_status,
      coalesce(nullif(coalesce(
        p_normalized_event ->> 'cancelAtPeriodEnd',
        p_normalized_event ->> 'cancel_at_period_end'
      ), '')::boolean, false),
      nullif(coalesce(
        p_normalized_event ->> 'currentPeriodStart',
        p_normalized_event ->> 'current_period_start'
      ), '')::timestamptz,
      nullif(coalesce(
        p_normalized_event ->> 'currentPeriodEnd',
        p_normalized_event ->> 'current_period_end'
      ), '')::timestamptz,
      case when v_subscription_status in ('canceled', 'ended') then p_event_created_at else null end,
      case when v_subscription_status = 'ended' then p_event_created_at else null end,
      p_event_created_at,
      case when p_event_type like 'customer.subscription.%' then p_event_created_at else null end,
      case when p_event_type like 'invoice.%' then p_event_created_at else null end
    )
    on conflict (provider, provider_subscription_reference)
    do update set
      status = case
        when p_event_type like 'customer.subscription.%'
          and (private.economic_subscriptions.provider_subscription_event_created_at is null
            or private.economic_subscriptions.provider_subscription_event_created_at <= p_event_created_at)
        then case
          when excluded.cancel_at_period_end and excluded.status = 'active' then 'canceling'
          else excluded.status
        end
        when p_event_type = 'invoice.payment_failed'
          and (private.economic_subscriptions.provider_invoice_event_created_at is null
            or private.economic_subscriptions.provider_invoice_event_created_at <= p_event_created_at)
        then case
          when private.economic_subscriptions.status in ('canceled', 'ended')
            then private.economic_subscriptions.status
          else 'past_due'
        end
        when p_event_type = 'invoice.paid'
          and (private.economic_subscriptions.provider_invoice_event_created_at is null
            or private.economic_subscriptions.provider_invoice_event_created_at <= p_event_created_at)
        then case
          when private.economic_subscriptions.status in ('canceled', 'ended')
            then private.economic_subscriptions.status
          when private.economic_subscriptions.cancel_at_period_end then 'canceling'
          when private.economic_subscriptions.status in ('past_due', 'grace_period', 'incomplete') then 'active'
          else private.economic_subscriptions.status
        end
        -- Checkout is only an initialization source. Once a subscription row
        -- exists, it cannot overwrite lifecycle/invoice state.
        else private.economic_subscriptions.status
      end,
      cancel_at_period_end = case
        when p_event_type like 'customer.subscription.%'
          and (p_normalized_event ? 'cancelAtPeriodEnd'
            or p_normalized_event ? 'cancel_at_period_end')
          and (private.economic_subscriptions.provider_subscription_event_created_at is null
            or private.economic_subscriptions.provider_subscription_event_created_at <= p_event_created_at)
        then excluded.cancel_at_period_end
        else private.economic_subscriptions.cancel_at_period_end
      end,
      current_period_start = case
        when (p_normalized_event ? 'currentPeriodStart'
            or p_normalized_event ? 'current_period_start')
          and (
            (p_event_type like 'customer.subscription.%'
              and (private.economic_subscriptions.provider_subscription_event_created_at is null
                or private.economic_subscriptions.provider_subscription_event_created_at <= p_event_created_at))
            or (p_event_type like 'invoice.%'
              and (private.economic_subscriptions.provider_invoice_event_created_at is null
                or private.economic_subscriptions.provider_invoice_event_created_at <= p_event_created_at))
          )
        then excluded.current_period_start
        else private.economic_subscriptions.current_period_start
      end,
      current_period_end = case
        when (p_normalized_event ? 'currentPeriodEnd'
            or p_normalized_event ? 'current_period_end')
          and (
            (p_event_type like 'customer.subscription.%'
              and (private.economic_subscriptions.provider_subscription_event_created_at is null
                or private.economic_subscriptions.provider_subscription_event_created_at <= p_event_created_at))
            or (p_event_type like 'invoice.%'
              and (private.economic_subscriptions.provider_invoice_event_created_at is null
                or private.economic_subscriptions.provider_invoice_event_created_at <= p_event_created_at))
          )
        then excluded.current_period_end
        else private.economic_subscriptions.current_period_end
      end,
      canceled_at = case
        when p_event_type like 'customer.subscription.%'
          and (private.economic_subscriptions.provider_subscription_event_created_at is null
            or private.economic_subscriptions.provider_subscription_event_created_at <= p_event_created_at)
        then coalesce(private.economic_subscriptions.canceled_at, excluded.canceled_at)
        else private.economic_subscriptions.canceled_at
      end,
      ended_at = case
        when p_event_type like 'customer.subscription.%'
          and (private.economic_subscriptions.provider_subscription_event_created_at is null
            or private.economic_subscriptions.provider_subscription_event_created_at <= p_event_created_at)
        then coalesce(private.economic_subscriptions.ended_at, excluded.ended_at)
        else private.economic_subscriptions.ended_at
      end,
      provider_event_created_at = greatest(
        private.economic_subscriptions.provider_event_created_at,
        excluded.provider_event_created_at
      ),
      provider_subscription_event_created_at = case
        when p_event_type like 'customer.subscription.%' then greatest(
          private.economic_subscriptions.provider_subscription_event_created_at,
          p_event_created_at
        )
        else private.economic_subscriptions.provider_subscription_event_created_at
      end,
      provider_invoice_event_created_at = case
        when p_event_type like 'invoice.%' then greatest(
          private.economic_subscriptions.provider_invoice_event_created_at,
          p_event_created_at
        )
        else private.economic_subscriptions.provider_invoice_event_created_at
      end,
      updated_at = pg_catalog.now();
  end if;

  if p_event_type like '%refund%' or v_provider_refund_id is not null then
    begin
      v_refund_amount := coalesce(
        nullif(p_normalized_event ->> 'amountMinor', '')::bigint,
        nullif(p_normalized_event ->> 'refundAmountMinor', '')::bigint,
        nullif(p_normalized_event ->> 'refund_amount_minor', '')::bigint
      );
    exception when invalid_text_representation or numeric_value_out_of_range then
      v_refund_amount := null;
    end;

    if v_provider_refund_id is not null and v_refund_amount > 0 then
      select transaction.* into v_payment_transaction
      from private.economic_payment_transactions as transaction
      where transaction.provider = p_provider
        and transaction.provider_transaction_reference = v_provider_payment_id
        and transaction.transaction_type = 'payment'
        and transaction.status in ('succeeded', 'refunded', 'disputed');
      if not found then
        select transaction.* into v_payment_transaction
        from private.economic_refunds as existing_refund
        join private.economic_payment_transactions as transaction
          on transaction.id = existing_refund.payment_transaction_id
        where existing_refund.provider = p_provider
          and existing_refund.provider_refund_reference = v_provider_refund_id;
      end if;
      if not found or v_payment_transaction.order_id <> v_order.id
         or v_refund_amount > v_payment_transaction.gross_amount_minor
         or v_currency <> v_payment_transaction.currency then
        raise exception using errcode = '22023', message = 'economic_refund_amount_or_currency_invalid';
      end if;

      v_refund_status := case lower(coalesce(
        p_normalized_event ->> 'status',
        p_normalized_event ->> 'refundStatus',
        'succeeded'
      ))
        when 'failed' then 'failed'
        when 'canceled' then 'canceled'
        when 'pending' then 'pending'
        else 'succeeded'
      end;

      select refund.* into v_existing_refund
      from private.economic_refunds as refund
      where refund.provider = p_provider
        and refund.provider_refund_reference = v_provider_refund_id;
      if found and (
        v_existing_refund.order_id <> v_order.id
        or v_existing_refund.payment_transaction_id <> v_payment_transaction.id
        or v_existing_refund.amount_minor <> v_refund_amount
        or v_existing_refund.currency <> v_payment_transaction.currency
      ) then
        raise exception using errcode = '23505', message = 'economic_refund_reference_amount_conflict';
      end if;
      if found and v_existing_refund.provider_event_created_at is not null
         and v_existing_refund.provider_event_created_at > p_event_created_at then
        v_refund_status := v_existing_refund.status;
      end if;

      select coalesce(pg_catalog.sum(refund.amount_minor), 0)
      into v_total_refunded
      from private.economic_refunds as refund
      where refund.payment_transaction_id = v_payment_transaction.id
        and refund.status in ('pending', 'succeeded')
        and not (
          refund.provider = p_provider
          and refund.provider_refund_reference = v_provider_refund_id
        );
      if v_refund_status in ('pending', 'succeeded')
         and v_total_refunded + v_refund_amount > v_payment_transaction.gross_amount_minor then
        raise exception using errcode = '22023', message = 'economic_refund_total_exceeds_payment';
      end if;

      insert into private.economic_refunds (
        order_id, payment_transaction_id, provider, provider_refund_reference, amount_minor,
        currency, status, provider_event_created_at
      ) values (
        v_order.id,
        v_payment_transaction.id,
        p_provider,
        v_provider_refund_id,
        v_refund_amount,
        v_order.currency,
        v_refund_status,
        p_event_created_at
      )
      on conflict (provider, provider_refund_reference)
      do update set
        status = excluded.status,
        provider_event_created_at = excluded.provider_event_created_at,
        updated_at = pg_catalog.now()
      where private.economic_refunds.provider_event_created_at is null
         or private.economic_refunds.provider_event_created_at <= excluded.provider_event_created_at
      returning * into v_existing_refund;

      if v_existing_refund.id is null then
        select * into v_existing_refund
        from private.economic_refunds as refund
        where refund.provider = p_provider
          and refund.provider_refund_reference = v_provider_refund_id;
      end if;
      -- Downstream order transitions must use the durable post-upsert state,
      -- never the status carried by an older delivery that lost the UPSERT race.
      v_refund_status := v_existing_refund.status;

      select coalesce(pg_catalog.sum(refund.amount_minor), 0)
      into v_total_refunded
      from private.economic_refunds as refund
      where refund.order_id = v_order.id
        and refund.status = 'succeeded';
      select coalesce(pg_catalog.sum(transaction.gross_amount_minor), 0)
      into v_total_gross
      from private.economic_payment_transactions as transaction
      where transaction.order_id = v_order.id
        and transaction.transaction_type = 'payment'
        and transaction.status in ('succeeded', 'refunded', 'disputed');

      -- Pending provider refunds do not become financial truth. Only a verified
      -- succeeded state changes the order's refunded total; failed/canceled
      -- states restore the prior paid/partial state unless a dispute remains.
      if v_refund_status = 'succeeded' then
        update private.economic_orders
        set
          status = case when v_total_refunded >= v_total_gross then 'refunded' else 'partially_refunded' end,
          refunded_at = case when v_total_refunded >= v_total_gross then p_event_created_at else refunded_at end,
          updated_at = pg_catalog.now()
        where id = v_order.id;
      elsif v_refund_status in ('failed', 'canceled') and not exists (
        select 1
        from private.economic_disputes as dispute
        where dispute.order_id = v_order.id
          and dispute.status in (
            'warning_needs_response', 'warning_under_review',
            'needs_response', 'under_review', 'lost'
          )
      ) then
        update private.economic_orders
        set
          status = case
            when v_total_refunded >= v_total_gross then 'refunded'
            when v_total_refunded > 0 then 'partially_refunded'
            else 'paid'
          end,
          updated_at = pg_catalog.now()
        where id = v_order.id;
      end if;
    end if;
  end if;

  if p_event_type like '%dispute%' or v_provider_dispute_id is not null then
    if v_provider_dispute_id is not null then
      v_dispute_status := case lower(coalesce(
        p_normalized_event ->> 'status',
        p_normalized_event ->> 'disputeStatus',
        ''
      ))
        when 'warning_needs_response' then 'warning_needs_response'
        when 'warning_under_review' then 'warning_under_review'
        when 'warning_closed' then 'warning_closed'
        when 'under_review' then 'under_review'
        when 'needs_response' then 'needs_response'
        when 'won' then 'won'
        when 'lost' then 'lost'
        when 'prevented' then 'prevented'
        else null
      end;

      if v_dispute_status is null then
        raise exception using errcode = '22023', message = 'economic_dispute_status_unrecognized';
      end if;
      select transaction.* into v_payment_transaction
      from private.economic_payment_transactions as transaction
      where transaction.provider = p_provider
        and transaction.provider_transaction_reference = v_provider_payment_id
        and transaction.transaction_type = 'payment'
        and transaction.status in ('succeeded', 'refunded', 'disputed');
      if not found then
        select transaction.* into v_payment_transaction
        from private.economic_disputes as existing_dispute
        join private.economic_payment_transactions as transaction
          on transaction.id = existing_dispute.payment_transaction_id
        where existing_dispute.provider = p_provider
          and existing_dispute.provider_dispute_reference = v_provider_dispute_id;
      end if;
      if not found or v_payment_transaction.order_id <> v_order.id
         or v_amount_minor is null
         or v_amount_minor not between 1 and v_payment_transaction.gross_amount_minor
         or v_currency <> v_payment_transaction.currency then
        raise exception using errcode = '22023', message = 'economic_dispute_amount_or_currency_invalid';
      end if;

      select dispute.* into v_existing_dispute
      from private.economic_disputes as dispute
      where dispute.provider = p_provider
        and dispute.provider_dispute_reference = v_provider_dispute_id;
      if found and (
        v_existing_dispute.order_id <> v_order.id
        or v_existing_dispute.payment_transaction_id <> v_payment_transaction.id
        or v_existing_dispute.amount_minor <> v_amount_minor
        or v_existing_dispute.currency <> v_payment_transaction.currency
      ) then
        raise exception using errcode = '23505', message = 'economic_dispute_reference_amount_conflict';
      end if;

      insert into private.economic_disputes (
        order_id, payment_transaction_id, provider, provider_dispute_reference, amount_minor,
        currency, status, reason_code, provider_event_created_at, closed_at
      ) values (
        v_order.id,
        v_payment_transaction.id,
        p_provider,
        v_provider_dispute_id,
        v_amount_minor,
        v_order.currency,
        v_dispute_status,
        nullif(coalesce(p_normalized_event ->> 'reasonCode', p_normalized_event ->> 'disputeReason'), ''),
        p_event_created_at,
        case when v_dispute_status in ('warning_closed', 'won', 'lost', 'prevented') then p_event_created_at else null end
      )
      on conflict (provider, provider_dispute_reference)
      do update set
        status = excluded.status,
        reason_code = excluded.reason_code,
        provider_event_created_at = excluded.provider_event_created_at,
        closed_at = excluded.closed_at,
        updated_at = pg_catalog.now()
      where private.economic_disputes.provider_event_created_at is null
         or private.economic_disputes.provider_event_created_at <= excluded.provider_event_created_at
      returning * into v_existing_dispute;

      if v_existing_dispute.id is null then
        select * into v_existing_dispute
        from private.economic_disputes as dispute
        where dispute.provider = p_provider
          and dispute.provider_dispute_reference = v_provider_dispute_id;
      end if;
      -- As with refunds, entitlement/order transitions follow persisted state.
      v_dispute_status := v_existing_dispute.status;

      if v_dispute_status in ('warning_closed', 'won', 'prevented') and not exists (
        select 1 from private.economic_disputes as other_dispute
        where other_dispute.order_id = v_order.id
          and other_dispute.id <> (
            select current_dispute.id from private.economic_disputes as current_dispute
            where current_dispute.provider = p_provider
              and current_dispute.provider_dispute_reference = v_provider_dispute_id
          )
          and other_dispute.status in (
            'warning_needs_response', 'warning_under_review',
            'needs_response', 'under_review', 'lost'
          )
      ) then
        select coalesce(pg_catalog.sum(refund.amount_minor), 0)
        into v_total_refunded
        from private.economic_refunds as refund
        where refund.order_id = v_order.id
          and refund.status = 'succeeded';
        select coalesce(pg_catalog.sum(transaction.gross_amount_minor), 0)
        into v_total_gross
        from private.economic_payment_transactions as transaction
        where transaction.order_id = v_order.id
          and transaction.transaction_type = 'payment'
          and transaction.status in ('succeeded', 'refunded', 'disputed');

        update private.economic_orders
        set
          status = case
            when v_total_refunded >= v_total_gross then 'refunded'
            when v_total_refunded > 0 then 'partially_refunded'
            else 'paid'
          end,
          updated_at = pg_catalog.now()
        where id = v_order.id;

        update private.economic_entitlements
        set status = 'active'
        where source_type = 'economic_order'
          and source_id = v_order.id
          and status = 'suspended'
          and revoked_at is null
          and (ends_at is null or ends_at > pg_catalog.now());
      else
        update private.economic_orders
        set status = 'disputed', updated_at = pg_catalog.now()
        where id = v_order.id
          and status not in ('refunded');

        update private.economic_entitlements
        set status = 'suspended'
        where source_type = 'economic_order'
          and source_id = v_order.id
          and status in ('pending', 'active');
      end if;
    end if;
  end if;

  update private.economic_webhook_events
  set processing_status = 'processed', processed_at = pg_catalog.now()
  where id = v_event.id;

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, metadata
  ) values (
    'provider_webhook',
    'provider_event_processed',
    'economic_order',
    v_order.id,
    pg_catalog.jsonb_build_object(
      'provider', p_provider,
      'event_type', p_event_type,
      'webhook_event_id', v_event.id,
      'test_mode', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'eventId', v_event.id,
    'orderId', v_order.id,
    'status', 'processed',
    'idempotentReplay', false
  );
exception when others then
    update private.economic_webhook_events
    set
      processing_status = 'failed',
      processing_error = pg_catalog.left(sqlerrm, 500),
      processed_at = pg_catalog.now()
    where id = v_event.id;

    return pg_catalog.jsonb_build_object(
      'eventId', v_event.id,
      'orderId', v_order_id,
      'status', 'retry',
      'retryable', true,
      'idempotentReplay', false
    );
  end;
end;
$$;

alter function public.process_economic_provider_event(text, text, text, timestamptz, text, jsonb)
  owner to postgres;

create or replace function public.prepare_economic_customer_portal(
  p_actor_user_id uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer private.billing_customers%rowtype;
  v_session private.economic_customer_portal_sessions%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if not private.economic_feature_enabled('customer_portal') then
    raise exception using errcode = '55000', message = 'economic_customer_portal_disabled';
  end if;
  if p_actor_user_id is null or p_client_request_id is null then
    raise exception using errcode = '22023', message = 'economic_portal_actor_and_request_required';
  end if;

  select * into v_session
  from private.economic_customer_portal_sessions as existing_session
  where existing_session.client_request_id = p_client_request_id;
  if found then
    if v_session.user_id <> p_actor_user_id then
      raise exception using errcode = '23505', message = 'economic_portal_idempotency_conflict';
    end if;
    select * into v_customer from private.billing_customers where id = v_session.billing_customer_id;
    return pg_catalog.jsonb_build_object(
      'portalRequestId', v_session.id,
      'billingCustomerId', v_customer.id,
      'provider', v_customer.provider,
      'providerCustomerReference', v_customer.provider_customer_reference,
      'providerCustomerId', v_customer.provider_customer_reference,
      'idempotentReplay', true
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('economic_customer_portal:' || p_actor_user_id::text, 0)
  );
  if exists (
    select 1
    from private.economic_customer_portal_sessions as recent_session
    where recent_session.user_id = p_actor_user_id
      and recent_session.created_at > pg_catalog.now() - interval '30 seconds'
  ) or (
    select pg_catalog.count(*)
    from private.economic_customer_portal_sessions as hourly_session
    where hourly_session.user_id = p_actor_user_id
      and hourly_session.created_at > pg_catalog.now() - interval '1 hour'
  ) >= 10 then
    raise exception using errcode = '55000', message = 'economic_customer_portal_rate_limited';
  end if;

  select * into v_customer
  from private.billing_customers as customer
  where customer.user_id = p_actor_user_id
    and customer.status = 'active'
    and customer.archived_at is null
    and customer.provider_customer_reference is not null
  order by customer.updated_at desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'economic_billing_customer_not_found';
  end if;

  insert into private.economic_customer_portal_sessions (
    billing_customer_id, user_id, client_request_id
  ) values (
    v_customer.id, p_actor_user_id, p_client_request_id
  ) returning * into v_session;

  return pg_catalog.jsonb_build_object(
    'portalRequestId', v_session.id,
    'billingCustomerId', v_customer.id,
    'provider', v_customer.provider,
    'providerCustomerReference', v_customer.provider_customer_reference,
    'providerCustomerId', v_customer.provider_customer_reference,
    'idempotentReplay', false
  );
end;
$$;

alter function public.prepare_economic_customer_portal(uuid, uuid) owner to postgres;

create or replace function public.record_economic_customer_portal_session(
  p_portal_request_id uuid,
  p_billing_customer_id uuid,
  p_provider_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session private.economic_customer_portal_sessions%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if pg_catalog.char_length(coalesce(p_provider_session_id, '')) not between 1 and 255 then
    raise exception using errcode = '22023', message = 'economic_portal_session_invalid';
  end if;

  select * into v_session
  from private.economic_customer_portal_sessions as portal_session
  where portal_session.id = p_portal_request_id
    and portal_session.billing_customer_id = p_billing_customer_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'economic_portal_request_not_found';
  end if;

  if v_session.status = 'created' then
    if v_session.provider_session_reference <> p_provider_session_id then
      raise exception using errcode = '23505', message = 'economic_portal_session_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'portalRequestId', v_session.id,
      'status', 'created',
      'idempotentReplay', true
    );
  end if;

  if v_session.status <> 'prepared' then
    raise exception using errcode = '55000', message = 'economic_portal_request_not_prepared';
  end if;

  update private.economic_customer_portal_sessions
  set
    provider_session_reference = p_provider_session_id,
    status = 'created',
    expires_at = pg_catalog.now() + interval '30 minutes'
  where id = v_session.id;

  return pg_catalog.jsonb_build_object(
    'portalRequestId', v_session.id,
    'status', 'created',
    'idempotentReplay', false
  );
end;
$$;

alter function public.record_economic_customer_portal_session(uuid, uuid, text) owner to postgres;

create or replace function public.lookup_economic_order_status(
  p_public_reference text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if coalesce(p_public_reference, '') !~ '^[0-9a-f]{36}$' then
    raise exception using errcode = '22023', message = 'economic_public_reference_invalid';
  end if;

  select * into v_order
  from private.economic_orders as target_order
  where target_order.public_reference = p_public_reference;

  if not found
     or (v_order.user_id is not null and v_order.user_id is distinct from p_actor_user_id) then
    raise exception using errcode = 'P0002', message = 'economic_order_not_found';
  end if;

  return pg_catalog.jsonb_build_object(
    'publicReference', v_order.public_reference,
    'flow', v_order.flow,
    'cadence', case when v_order.flow = 'support_recurring' then 'monthly' else 'one_time' end,
    'status', v_order.status,
    'createdAt', v_order.created_at,
    'paidAt', v_order.paid_at,
    'failedAt', v_order.failed_at,
    'refundedAt', v_order.refunded_at,
    'testMode', true
  ) || case
    when v_order.user_id is not null then pg_catalog.jsonb_build_object(
      'amountMinor', v_order.total_minor,
      'currency', v_order.currency
    )
    else '{}'::jsonb
  end;
end;
$$;

alter function public.lookup_economic_order_status(text, uuid) owner to postgres;

create or replace function public.current_user_economic_account_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;

  return pg_catalog.jsonb_build_object(
    'testMode', true,
    'orders', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'publicReference', recent_order.public_reference,
        'flow', recent_order.flow,
        'status', recent_order.status,
        'amountMinor', recent_order.total_minor,
        'currency', recent_order.currency,
        'createdAt', recent_order.created_at,
        'paidAt', recent_order.paid_at
      ) order by recent_order.created_at desc)
      from (
        select * from private.economic_orders as owned_order
        where owned_order.user_id = v_actor
        order by owned_order.created_at desc
        limit 50
      ) as recent_order
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'status', subscription.status,
        'cancelAtPeriodEnd', subscription.cancel_at_period_end,
        'currentPeriodEnd', subscription.current_period_end,
        'graceEndsAt', subscription.grace_ends_at
      ) order by subscription.updated_at desc)
      from private.economic_subscriptions as subscription
      where subscription.user_id = v_actor
    ), '[]'::jsonb),
    'activeRestrictions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'scope', restriction.scope,
        'reasonCode', restriction.reason_code,
        'expiresAt', restriction.expires_at
      ) order by restriction.imposed_at desc)
      from private.economic_service_restrictions as restriction
      where restriction.user_id = v_actor
        and restriction.lifted_at is null
        and (restriction.expires_at is null or restriction.expires_at > pg_catalog.now())
    ), '[]'::jsonb),
    'moneyDoesNotGrantAuthority', true
  );
end;
$$;

alter function public.current_user_economic_account_summary() owner to postgres;

create or replace function public.economic_public_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'testModeOnly', true,
    'livePaymentsEnabled', false,
    'supportCheckoutEnabled', private.economic_feature_enabled('support_checkout'),
    'recurringSupportEnabled', private.economic_feature_enabled('recurring_support'),
    'economicWebhooksEnabled', private.economic_feature_enabled('economic_webhooks'),
    'customerPortalEnabled', private.economic_feature_enabled('customer_portal'),
    'sandboxCreditPurchaseEnabled', private.economic_feature_enabled('sandbox_credit_purchase'),
    'sandboxCreditDisplayEnabled', private.economic_feature_enabled('sandbox_credit_display'),
    'sandboxCreditEnforcementEnabled', private.economic_feature_enabled('sandbox_credit_enforcement'),
    'jobPostFeeEnabled', private.economic_feature_enabled('job_post_fee_enforcement'),
    'marketplacePaidOffersEnabled', private.economic_feature_enabled('marketplace_paid_offers'),
    'marketplaceSellerOnboardingEnabled', private.economic_feature_enabled('marketplace_seller_onboarding'),
    'marketplacePayoutPreparationEnabled', private.economic_feature_enabled('marketplace_payout_preparation'),
    'marketplacePayoutsEnabled', private.economic_feature_enabled('marketplace_payouts'),
    'organizationServiceCheckoutEnabled', private.economic_feature_enabled('organization_billing'),
    'sponsorshipCheckoutEnabled', private.economic_feature_enabled('sponsorship_checkout'),
    'sponsorshipDisplayEnabled', private.economic_feature_enabled('sponsorship_display'),
    'legalDocumentVersions', pg_catalog.jsonb_build_object(
      'supportOneTime', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('support_and_billing_terms'),
        'path', '/legal/support-and-billing-terms',
        'contentSha256', private.active_economic_legal_content_sha256('support_and_billing_terms')
      ),
      'supportRecurring', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('recurring_support_terms'),
        'path', '/legal/support-and-billing-terms',
        'contentSha256', private.active_economic_legal_content_sha256('recurring_support_terms')
      ),
      'supportRecognition', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('support_recognition_consent'),
        'path', '/legal/support-and-billing-terms',
        'contentSha256', private.active_economic_legal_content_sha256('support_recognition_consent')
      ),
      'dataExportRequest', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('economic_data_export_request'),
        'path', '/legal/privacy-policy',
        'contentSha256', private.active_economic_legal_content_sha256('economic_data_export_request')
      ),
      'economicAccountClosureRequest', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('economic_account_closure_request'),
        'path', '/legal/account-closure-financial-retention',
        'contentSha256', private.active_economic_legal_content_sha256('economic_account_closure_request')
      ),
      'marketplaceSellerAgreement', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('marketplace_seller_agreement'),
        'path', '/legal/marketplace-commerce-terms',
        'contentSha256', private.active_economic_legal_content_sha256('marketplace_seller_agreement')
      ),
      'marketplaceFreeSellerAgreement', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('marketplace_free_seller_agreement'),
        'path', '/legal/marketplace-commerce-terms',
        'contentSha256', private.active_economic_legal_content_sha256('marketplace_free_seller_agreement')
      ),
      'stripeConnectSellerDisclosure', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('stripe_connect_seller_disclosure'),
        'path', '/legal/marketplace-commerce-terms',
        'contentSha256', private.active_economic_legal_content_sha256('stripe_connect_seller_disclosure')
      ),
      'marketplaceBuyerTerms', pg_catalog.jsonb_build_object(
        'version', private.active_economic_legal_version('marketplace_buyer_terms'),
        'path', '/legal/marketplace-commerce-terms',
        'contentSha256', private.active_economic_legal_content_sha256('marketplace_buyer_terms')
      )
    ),
    'legalConsentBundles', coalesce((
      select pg_catalog.jsonb_object_agg(
        active_bundle.bundle_key,
        pg_catalog.jsonb_build_object(
          'version', active_bundle.bundle_version,
          'path', bundle.public_path,
          'documents', bundle.document_manifest
        )
      )
      from private.economic_active_legal_consent_bundles as active_bundle
      join private.economic_legal_consent_bundle_versions as bundle
        on bundle.bundle_key = active_bundle.bundle_key
       and bundle.bundle_version = active_bundle.bundle_version
    ), '{}'::jsonb),
    'liveStripeEnabled', false,
    'paymentGrantsAuthority', false
  );
$$;

alter function public.economic_public_capabilities() owner to postgres;

create or replace function public.set_economic_test_feature(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_feature_key text,
  p_enabled boolean,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_action private.economic_feature_flag_actions%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'economic_feature_flags_manage'
  );
  if p_client_request_id is null
     or p_confirmation is distinct from (case when coalesce(p_enabled, false)
       then 'ENABLE TEST ECONOMIC FEATURE' else 'DISABLE TEST ECONOMIC FEATURE' end)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_feature_reason_required';
  end if;
  if p_feature_key = 'live_stripe' then
    raise exception using errcode = '42501', message = 'economic_live_stripe_activation_forbidden';
  elsif p_feature_key = 'marketplace_payouts' and coalesce(p_enabled, false) then
    raise exception using errcode = '42501', message = 'economic_marketplace_payout_execution_unavailable';
  end if;
  if not exists (
    select 1 from private.economic_feature_flags as feature
    where feature.feature_key = p_feature_key and feature.test_mode_only = true
  ) then
    raise exception using errcode = 'P0002', message = 'economic_feature_not_found';
  end if;
  select * into v_action from private.economic_feature_flag_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.actor_user_id <> p_actor_user_id
       or v_action.feature_key <> p_feature_key
       or v_action.enabled <> coalesce(p_enabled, false)
       or v_action.confirmation <> p_confirmation
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_feature_action_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'featureKey', v_action.feature_key, 'enabled', v_action.enabled,
      'testModeOnly', true, 'idempotentReplay', true
    );
  end if;

  if coalesce(p_enabled, false) then
    if p_feature_key = 'support_checkout'
       and not private.economic_feature_enabled('economic_webhooks') then
      raise exception using errcode = '55000', message = 'economic_verified_webhooks_required';
    elsif p_feature_key = 'recurring_support'
       and (
         not private.economic_feature_enabled('support_checkout')
         or not private.economic_feature_enabled('economic_webhooks')
         or not private.economic_feature_enabled('customer_portal')
       ) then
      raise exception using errcode = '55000', message = 'recurring_support_prerequisites_required';
    elsif p_feature_key = 'test_refund_execution'
       and not private.economic_feature_enabled('economic_webhooks') then
      raise exception using errcode = '55000', message = 'test_refund_webhooks_required';
    elsif p_feature_key = 'sandbox_credit_purchase'
       and (
         not private.economic_feature_enabled('sandbox_credit_display')
         or not private.economic_feature_enabled('economic_webhooks')
       ) then
      raise exception using errcode = '55000', message = 'sandbox_credit_purchase_prerequisites_required';
    elsif p_feature_key = 'sandbox_credit_enforcement'
       and not private.economic_feature_enabled('sandbox_credit_display') then
      raise exception using errcode = '55000', message = 'sandbox_credit_display_required';
    elsif p_feature_key = 'job_post_fee_enforcement'
       and (
         not private.economic_feature_enabled('economic_webhooks')
         or not exists (
           select 1
           from private.economic_prices as price
           join private.economic_products as product
             on product.product_key = price.product_key
           where product.product_kind = 'job_post_fee'
             and product.active = true
             and price.active = true
             and price.test_mode_only = true
         )
       ) then
      raise exception using errcode = '55000', message = 'job_post_fee_prerequisites_required';
    elsif p_feature_key = 'marketplace_paid_offers'
       and (
         not private.economic_feature_enabled('marketplace_seller_onboarding')
         or not private.economic_feature_enabled('economic_webhooks')
      ) then
      raise exception using errcode = '55000', message = 'marketplace_paid_prerequisites_required';
    elsif p_feature_key = 'marketplace_payout_preparation'
       and not private.economic_feature_enabled('marketplace_seller_onboarding') then
      raise exception using errcode = '55000', message = 'marketplace_payout_preparation_prerequisites_required';
    elsif p_feature_key = 'organization_billing'
       and (
         not private.economic_feature_enabled('organization_contract_workflow')
         or not private.economic_feature_enabled('economic_webhooks')
       ) then
      raise exception using errcode = '55000', message = 'organization_billing_prerequisites_required';
    elsif p_feature_key = 'sponsorship_checkout'
       and (
         not private.economic_feature_enabled('sponsorship_review_workflow')
         or not private.economic_feature_enabled('economic_webhooks')
       ) then
      raise exception using errcode = '55000', message = 'sponsorship_checkout_prerequisites_required';
    elsif p_feature_key = 'sponsorship_display'
       and not private.economic_feature_enabled('sponsorship_review_workflow') then
      raise exception using errcode = '55000', message = 'sponsorship_review_workflow_required';
    end if;
  end if;

  update private.economic_feature_flags
  set
    enabled = coalesce(p_enabled, false),
    reason = pg_catalog.left(pg_catalog.btrim(p_reason), 1000),
    updated_by = p_actor_user_id,
    updated_at = pg_catalog.now()
  where feature_key = p_feature_key;

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'test_feature_changed', 'economic_feature',
    pg_catalog.left(pg_catalog.btrim(p_reason), 1000),
    pg_catalog.jsonb_build_object(
      'feature_key', p_feature_key,
      'enabled', coalesce(p_enabled, false),
      'client_request_id', p_client_request_id,
      'test_mode_only', true
    )
  );
  insert into private.economic_feature_flag_actions(
    client_request_id, actor_user_id, feature_key, enabled,
    confirmation, private_reason
  ) values (
    p_client_request_id, p_actor_user_id, p_feature_key,
    coalesce(p_enabled, false), p_confirmation, pg_catalog.btrim(p_reason)
  );

  return pg_catalog.jsonb_build_object(
    'featureKey', p_feature_key,
    'enabled', coalesce(p_enabled, false),
    'testModeOnly', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.set_economic_test_feature(uuid, uuid, text, boolean, text, text) owner to postgres;

-- All economic RPCs lose PostgreSQL's default PUBLIC EXECUTE before the exact
-- server/browser grants are restored.
revoke all privileges on function private.begin_economic_checkout_core(uuid, uuid, text, bigint, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.attach_economic_checkout_billing_customer(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.attach_economic_checkout_provider_session(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.fail_economic_checkout_attempt(uuid, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.expire_stale_economic_checkouts(integer)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.process_economic_provider_event(text, text, text, timestamptz, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.prepare_economic_customer_portal(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.record_economic_customer_portal_session(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.lookup_economic_order_status(text, uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.current_user_economic_account_summary()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.economic_public_capabilities()
  from public, anon, authenticated, service_role;
revoke all privileges on function public.set_economic_test_feature(uuid, uuid, text, boolean, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.attach_economic_checkout_billing_customer(uuid, text, text)
  to service_role;
grant execute on function public.attach_economic_checkout_provider_session(uuid, text, text, text)
  to service_role;
grant execute on function public.fail_economic_checkout_attempt(uuid, text)
  to service_role;
grant execute on function public.expire_stale_economic_checkouts(integer)
  to service_role;
grant execute on function public.process_economic_provider_event(text, text, text, timestamptz, text, jsonb)
  to service_role;
grant execute on function public.prepare_economic_customer_portal(uuid, uuid)
  to service_role;
grant execute on function public.record_economic_customer_portal_session(uuid, uuid, text)
  to service_role;
grant execute on function public.lookup_economic_order_status(text, uuid)
  to service_role;
grant execute on function public.set_economic_test_feature(uuid, uuid, text, boolean, text, text)
  to service_role;
grant execute on function public.current_user_economic_account_summary()
  to authenticated;
grant execute on function public.economic_public_capabilities()
  to anon, authenticated;

comment on schema private is
  'Non-public operational and economic records. No browser or public Data API access.';
comment on table private.economic_orders is
  'Provider-neutral private order truth. Browser redirects never mark an order paid.';
comment on table private.economic_webhook_events is
  'Idempotent normalized provider-event inbox. Raw provider payloads and secrets are not retained.';
comment on table private.economic_operator_assignments is
  'Private finance capabilities independent of profiles.is_admin and community user_roles.';
comment on table private.economic_service_restrictions is
  'Economic-service-only restrictions; never a community ban, profile removal, or role revocation.';

commit;
