\set ON_ERROR_STOP on

do $economic_behavior$
declare
  v_user uuid := '10000000-0000-4000-8000-000000000001';
  v_other_user uuid := '10000000-0000-4000-8000-000000000002';
  v_order uuid := '20000000-0000-4000-8000-000000000001';
  v_reordered_order uuid := '20000000-0000-4000-8000-000000000002';
  v_price uuid;
  v_result jsonb;
  v_summary jsonb;
  v_count integer;
  v_units bigint;
  v_missing_units bigint;
  v_status text;
  v_cancel boolean;
  v_period_end timestamptz;
  v_program_id uuid;
  v_sandbox_recurring_program_id uuid;
  v_sandbox_starter_program_id uuid;
  v_payment_id uuid;
  v_credit_lot_id uuid;
  v_grant_id uuid;
  v_job_post_id uuid := '50000000-0000-4000-8000-000000000001';
  v_post_id uuid := '50000000-0000-4000-8000-000000000002';
  v_organization_id uuid := '60000000-0000-4000-8000-000000000001';
  v_engagement_id uuid := '60000000-0000-4000-8000-000000000002';
  v_sponsorship_id uuid := '60000000-0000-4000-8000-000000000003';
  v_org_order uuid := '60000000-0000-4000-8000-000000000004';
  v_sponsor_order uuid := '60000000-0000-4000-8000-000000000005';
  v_pending_engagement_id uuid := '60000000-0000-4000-8000-000000000006';
  v_pending_sponsorship_id uuid := '60000000-0000-4000-8000-000000000007';
  v_other_engagement_id uuid := '60000000-0000-4000-8000-000000000008';
  v_other_sponsorship_id uuid := '60000000-0000-4000-8000-000000000009';
  v_withdrawal_sponsorship_id uuid := '60000000-0000-4000-8000-000000000010';
  v_late_org_order uuid := '63000000-0000-4000-8000-000000000001';
  v_late_org_engagement uuid := '63000000-0000-4000-8000-000000000002';
  v_late_org_payment uuid := '63000000-0000-4000-8000-000000000003';
  v_late_sponsor_order uuid := '63000000-0000-4000-8000-000000000004';
  v_late_sponsorship uuid := '63000000-0000-4000-8000-000000000005';
  v_late_sponsor_payment uuid := '63000000-0000-4000-8000-000000000006';
  v_org_price uuid;
  v_sponsor_price uuid;
  v_marketplace_publisher_id uuid := '71000000-0000-4000-8000-000000000010';
  v_marketplace_listing_id uuid := '71000000-0000-4000-8000-000000000011';
  v_marketplace_version_id uuid := '71000000-0000-4000-8000-000000000012';
  v_marketplace_offer_id uuid;
  v_marketplace_seller_id uuid;
  v_marketplace_paid_listing_id uuid := '73000000-0000-4000-8000-000000000001';
  v_marketplace_paid_version_id uuid := '73000000-0000-4000-8000-000000000002';
  v_marketplace_paid_offer_id uuid := '73000000-0000-4000-8000-000000000003';
  v_marketplace_paid_price_id uuid := '73000000-0000-4000-8000-000000000004';
  v_marketplace_paid_terms_id uuid := '73000000-0000-4000-8000-000000000005';
  v_marketplace_held_order_id uuid := '73000000-0000-4000-8000-000000000006';
  v_marketplace_held_contract_id uuid := '73000000-0000-4000-8000-000000000007';
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  update private.economic_feature_flags
  set enabled = true
  where feature_key = 'economic_webhooks';

  insert into auth.users(id, email, email_confirmed_at, created_at, updated_at, is_anonymous)
  values
    (v_user, 'economic-fixture@example.invalid', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), false),
    (v_other_user, 'other-economic-fixture@example.invalid', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), false),
    ('10000000-0000-4000-8000-000000000003', 'unconfirmed-economic@example.invalid', null, pg_catalog.now(), pg_catalog.now(), false),
    ('10000000-0000-4000-8000-000000000004', 'anonymous-economic@example.invalid', pg_catalog.now(), pg_catalog.now(), pg_catalog.now(), true);
  if not private.economic_account_is_recoverable(v_user)
     or private.economic_account_is_recoverable('10000000-0000-4000-8000-000000000003')
     or private.economic_account_is_recoverable('10000000-0000-4000-8000-000000000004') then
    raise exception 'recoverable economic account boundary accepted an unconfirmed or anonymous Auth identity';
  end if;

  -- Provider-facing seller operations are durable, replay-aware, and
  -- actor-bounded even when a client rotates request UUIDs.
  insert into public.developer_profiles(user_id, display_name, status)
  values (v_user, 'Disposable economic developer', 'active');
  update private.economic_feature_flags
  set enabled = true
  where feature_key = 'marketplace_seller_onboarding';
  v_result := public.prepare_economic_seller_onboarding(
    v_user, '71000000-0000-4000-8000-000000000001',
    '2026-07-16', 'stripe-connect-test-2026-07-16', '/marketplace/account'
  );
  if v_result ->> 'idempotentReplay' <> 'false' then
    raise exception 'first seller onboarding request was treated as a replay: %', v_result;
  end if;
  v_result := public.prepare_economic_seller_onboarding(
    v_user, '71000000-0000-4000-8000-000000000001',
    '2026-07-16', 'stripe-connect-test-2026-07-16', '/marketplace/account'
  );
  if v_result ->> 'idempotentReplay' <> 'true' then
    raise exception 'seller onboarding replay was not recognized: %', v_result;
  end if;
  v_result := public.accept_marketplace_free_seller_agreement(
    v_user, '71000000-0000-4000-8000-000000000020',
    '2026-07-16', '/marketplace/account'
  );
  if v_result ->> 'idempotentReplay' <> 'false' then
    raise exception 'first free-seller agreement acceptance was treated as a replay: %', v_result;
  end if;
  v_result := public.accept_marketplace_free_seller_agreement(
    v_user, '71000000-0000-4000-8000-000000000020',
    '2026-07-16', '/marketplace/account'
  );
  if v_result ->> 'idempotentReplay' <> 'true' then
    raise exception 'free-seller agreement replay was not recognized: %', v_result;
  end if;
  begin
    perform public.prepare_economic_seller_onboarding(
      v_user, '71000000-0000-4000-8000-000000000002',
      '2026-07-16', 'stripe-connect-test-2026-07-16', '/marketplace/account'
    );
    raise exception 'rotated seller onboarding request bypassed its cooldown';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  perform public.attach_economic_seller_provider_account(
    (v_result ->> 'sellerAccountId')::uuid, 'stripe', 'acct_disposablefixture'
  );
  v_result := public.get_economic_seller_provider_context(
    v_user, '71000000-0000-4000-8000-000000000003'
  );
  if v_result ->> 'idempotentReplay' <> 'false'
     or v_result ->> 'providerAccountReference' <> 'acct_disposablefixture' then
    raise exception 'first seller status refresh preparation was invalid: %', v_result;
  end if;
  begin
    perform public.get_economic_seller_provider_context(
      v_user, '71000000-0000-4000-8000-000000000003'
    );
    raise exception 'incomplete same-key seller status refresh bypassed its cooldown';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  update private.economic_seller_provider_status_requests
  set last_attempt_at = pg_catalog.now() - interval '31 seconds'
  where client_request_id = '71000000-0000-4000-8000-000000000003';
  v_result := public.get_economic_seller_provider_context(
    v_user, '71000000-0000-4000-8000-000000000003'
  );
  if v_result ->> 'idempotentReplay' <> 'false' then
    raise exception 'failed same-key seller status refresh was not safely retryable: %', v_result;
  end if;
  perform public.record_economic_seller_provider_status(
    (v_result ->> 'sellerAccountId')::uuid,
    '71000000-0000-4000-8000-000000000003',
    'acct_disposablefixture', true, true, true, null,
    pg_catalog.now(), pg_catalog.repeat('a', 64)
  );
  select seller.id into v_marketplace_seller_id
  from private.economic_seller_accounts as seller
  where seller.user_id = v_user;
  v_result := public.get_economic_seller_provider_context(
    v_user, '71000000-0000-4000-8000-000000000003'
  );
  if v_result ->> 'idempotentReplay' <> 'true' then
    raise exception 'completed seller status refresh replay was not recognized: %', v_result;
  end if;
  begin
    perform public.get_economic_seller_provider_context(
      v_user, '71000000-0000-4000-8000-000000000004'
    );
    raise exception 'rotated seller status request bypassed its cooldown';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  -- Marketplace seller commands are durable and recoverable. A draft can be
  -- revised by a new command, while lifecycle transitions are terminally
  -- journaled and never change review, publisher verification, or install state.
  insert into public.profiles(id, username, display_name)
  values (v_user, 'economic-fixture-user', 'Disposable economic fixture')
  on conflict (id) do nothing;
  insert into public.publishers(id, owner_id, name, slug, verified)
  values (
    v_marketplace_publisher_id, v_user,
    'Disposable economic publisher', 'disposable-economic-publisher', false
  );
  v_result := public.link_economic_seller_publisher(
    v_user, v_marketplace_publisher_id,
    '71000000-0000-4000-8000-000000000013',
    'Disposable fixture links an owned publisher without verification.'
  );
  if v_result ->> 'idempotentReplay' <> 'false'
     or v_result ->> 'publisherVerifiedChanged' <> 'false' then
    raise exception 'publisher link first command was unsafe: %', v_result;
  end if;
  v_result := public.link_economic_seller_publisher(
    v_user, v_marketplace_publisher_id,
    '71000000-0000-4000-8000-000000000013',
    'Disposable fixture links an owned publisher without verification.'
  );
  if v_result ->> 'idempotentReplay' <> 'true' then
    raise exception 'publisher link replay was not durable: %', v_result;
  end if;
  select pg_catalog.count(*) into v_count
  from private.economic_audit_events
  where action = 'economic_seller_publisher_linked'
    and target_id = (v_result ->> 'sellerAccountId')::uuid;
  -- target_id is the link ID rather than the seller ID; assert by request count
  -- and action count for this otherwise isolated disposable database instead.
  select pg_catalog.count(*) into v_count
  from private.economic_audit_events
  where action = 'economic_seller_publisher_linked';
  if v_count <> 1 then
    raise exception 'publisher link replay duplicated its audit event: %', v_count;
  end if;
  begin
    perform public.link_economic_seller_publisher(
      v_user, v_marketplace_publisher_id,
      '71000000-0000-4000-8000-000000000013',
      'A changed reason must conflict with the durable publisher command.'
    );
    raise exception 'publisher link request UUID was reused with changed input';
  exception when unique_violation then
    null;
  end;

  perform public.accept_marketplace_free_seller_agreement(
    v_user, '71000000-0000-4000-8000-000000000014',
    '2026-07-16', '/marketplace/account'
  );
  insert into public.marketplace_listings(
    id, addon_id, developer_profile_id, name, slug,
    current_version, listing_status, published_at
  ) select
    v_marketplace_listing_id, 'disposable-economic-addon', developer.id,
    'Disposable economic add-on', 'disposable-economic-addon',
    '1.0.0', 'published', pg_catalog.now()
  from public.developer_profiles as developer
  where developer.user_id = v_user;
  insert into public.marketplace_addon_versions(
    id, listing_id, version, review_status, published_at
  ) values (
    v_marketplace_version_id, v_marketplace_listing_id,
    '1.0.0', 'approved', pg_catalog.now()
  );
  v_result := public.configure_marketplace_test_offer(
    v_user, '71000000-0000-4000-8000-000000000015',
    v_marketplace_version_id, v_marketplace_publisher_id,
    'free', null, null, null,
    'elysia.fixture', '1.0', '2026-07-16', null, '2026-07-16',
    'Disposable fixture configures a free reviewed test offer.'
  );
  v_marketplace_offer_id := (v_result ->> 'offerId')::uuid;
  if v_result ->> 'idempotentReplay' <> 'false' then
    raise exception 'fresh offer configure reported unstable FOUND replay state: %', v_result;
  end if;
  v_result := public.configure_marketplace_test_offer(
    v_user, '71000000-0000-4000-8000-000000000015',
    v_marketplace_version_id, v_marketplace_publisher_id,
    'free', null, null, null,
    'elysia.fixture', '1.0', '2026-07-16', null, '2026-07-16',
    'Disposable fixture configures a free reviewed test offer.'
  );
  if v_result ->> 'idempotentReplay' <> 'true'
     or (v_result ->> 'offerId')::uuid <> v_marketplace_offer_id then
    raise exception 'offer configure replay was not exact: %', v_result;
  end if;
  v_result := public.configure_marketplace_test_offer(
    v_user, '71000000-0000-4000-8000-000000000016',
    v_marketplace_version_id, v_marketplace_publisher_id,
    'free', null, null, null,
    'elysia.fixture', '1.1', '2026-07-16', null, '2026-07-16',
    'Disposable fixture safely revises the still-draft free offer.'
  );
  if (v_result ->> 'offerId')::uuid <> v_marketplace_offer_id
     or (select license_version from private.marketplace_commercial_offers where id = v_marketplace_offer_id) <> '1.1'
     or (select pg_catalog.count(*) from private.marketplace_commercial_offers where addon_version_id = v_marketplace_version_id) <> 1 then
    raise exception 'draft offer revision created a duplicate or failed to revise: %', v_result;
  end if;
  v_result := public.set_marketplace_test_offer_status(
    v_user, '71000000-0000-4000-8000-000000000017',
    v_marketplace_offer_id, 'active', 'ACTIVATE MARKETPLACE TEST OFFER',
    'Disposable fixture activates only the reviewed version-bound free offer.'
  );
  if v_result ->> 'status' <> 'active' or v_result ->> 'idempotentReplay' <> 'false' then
    raise exception 'offer activation command failed: %', v_result;
  end if;
  v_result := public.set_marketplace_test_offer_status(
    v_user, '71000000-0000-4000-8000-000000000017',
    v_marketplace_offer_id, 'active', 'ACTIVATE MARKETPLACE TEST OFFER',
    'Disposable fixture activates only the reviewed version-bound free offer.'
  );
  if v_result ->> 'idempotentReplay' <> 'true' then
    raise exception 'offer activation replay was not durable: %', v_result;
  end if;
  if pg_catalog.jsonb_array_length(public.marketplace_commercial_offer_catalog()) <> 1 then
    raise exception 'eligible active free offer was missing from the catalog';
  end if;
  insert into private.economic_service_restrictions (
    user_id, scope, reason_code, private_reason, source_type
  ) values (
    v_user, 'marketplace_selling', 'disposable_fixture_hold',
    'Disposable fixture proves seller restrictions are checked at acquisition time.',
    'disposable_test'
  );
  if pg_catalog.jsonb_array_length(public.marketplace_commercial_offer_catalog()) <> 0 then
    raise exception 'seller-restricted active offer remained in the public catalog';
  end if;
  begin
    perform public.accept_marketplace_free_license(
      v_other_user, v_marketplace_offer_id,
      '71000000-0000-4000-8000-000000000021', '2026-07-16'
    );
    raise exception 'seller restriction allowed a new free Marketplace license';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  update private.economic_service_restrictions
  set lifted_by = v_user, lifted_at = pg_catalog.now(),
      lift_reason = 'Disposable fixture restores the seller after the acquisition-time guard.'
  where user_id = v_user and scope = 'marketplace_selling' and lifted_at is null;
  if pg_catalog.jsonb_array_length(public.marketplace_commercial_offer_catalog()) <> 1 then
    raise exception 'lifting a seller restriction did not restore the still-active offer';
  end if;
  v_result := public.set_marketplace_test_offer_status(
    v_user, '71000000-0000-4000-8000-000000000018',
    v_marketplace_offer_id, 'suspended', 'SUSPEND MARKETPLACE TEST OFFER',
    'Disposable fixture suspends the offer without changing listing review.'
  );
  begin
    perform public.configure_marketplace_test_offer(
      v_user, '71000000-0000-4000-8000-000000000019',
      v_marketplace_version_id, v_marketplace_publisher_id,
      'free', null, null, null,
      'elysia.fixture', '2.0', '2026-07-16', null, '2026-07-16',
      'A suspended offer must be immutable even with a fresh request UUID.'
    );
    raise exception 'suspended offer remained revisable';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  v_result := public.set_marketplace_test_offer_status(
    v_user, '71000000-0000-4000-8000-000000000020',
    v_marketplace_offer_id, 'retired', 'RETIRE MARKETPLACE TEST OFFER',
    'Disposable fixture retires the offer without changing install authority.'
  );
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
  v_summary := public.current_user_economic_seller_status();
  if v_summary ->> 'totalOwnedOfferCount' <> '1'
     or v_summary ->> 'offersTruncated' <> 'false'
     or v_summary -> 'ownedOffers' -> 0 ->> 'status' <> 'retired'
     or v_summary -> 'ownedOffers' -> 0 ->> 'canRevise' <> 'false'
     or v_summary ->> 'eligibleReviewedVersionCount' <> '1'
     or v_summary ->> 'publisherOptionCount' <> '1' then
    raise exception 'bounded Marketplace offer recovery projection failed: %', v_summary;
  end if;
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);

  -- An unresolved paid-fulfillment hold is terminal until a verified full
  -- refund. Restoring seller/listing eligibility and projecting the order back
  -- to paid (as after a won dispute) must not mint a license or seller payable.
  insert into public.marketplace_listings(
    id, addon_id, developer_profile_id, name, slug,
    current_version, listing_status, published_at
  ) select
    v_marketplace_paid_listing_id, 'disposable-held-addon', developer.id,
    'Disposable held paid add-on', 'disposable-held-paid-addon',
    '1.0.0', 'published', pg_catalog.now()
  from public.developer_profiles as developer
  where developer.user_id = v_user;
  insert into public.marketplace_addon_versions(
    id, listing_id, version, review_status, published_at
  ) values (
    v_marketplace_paid_version_id, v_marketplace_paid_listing_id,
    '1.0.0', 'approved', pg_catalog.now()
  );
  insert into private.economic_prices(
    id, price_code, product_key, currency, unit_amount_minor
  ) values (
    v_marketplace_paid_price_id, 'marketplace_test_hold_fixture_usd',
    'marketplace_purchase', 'usd', 500
  );
  insert into private.marketplace_commercial_term_versions(
    id, client_request_id, terms_code, commission_bps,
    seller_agreement_version, buyer_terms_version, active,
    configured_by, private_reason
  ) values (
    v_marketplace_paid_terms_id, '73000000-0000-4000-8000-000000000008',
    'marketplace_test_hold_fixture', 1000,
    '2026-07-16', '2026-07-16', true, v_user,
    'Disposable fixture models a recovered eligible paid offer behind an unresolved hold.'
  );
  insert into private.marketplace_commercial_offers(
    id, client_request_id, seller_account_id, publisher_id,
    listing_id, addon_version_id, offer_kind, price_id,
    commercial_terms_version_id, license_key, license_version,
    buyer_terms_version, seller_agreement_version, commission_bps,
    status, activated_at
  ) values (
    v_marketplace_paid_offer_id, '73000000-0000-4000-8000-000000000009',
    v_marketplace_seller_id, v_marketplace_publisher_id,
    v_marketplace_paid_listing_id, v_marketplace_paid_version_id,
    'paid', v_marketplace_paid_price_id, v_marketplace_paid_terms_id,
    'elysia.fixture.held', '1.0', '2026-07-16', '2026-07-16', 1000,
    'active', pg_catalog.now()
  );
  insert into private.economic_orders(
    id, client_request_id, user_id, flow, status, currency,
    subtotal_minor, total_minor, source_route, consent_version, paid_at
  ) values (
    v_marketplace_held_order_id, '73000000-0000-4000-8000-000000000010',
    v_other_user, 'marketplace_purchase', 'disputed', 'usd',
    500, 500, '/marketplace', '2026-07-16', pg_catalog.now()
  );
  insert into private.marketplace_purchase_contracts(
    id, order_id, offer_id, buyer_user_id, seller_account_id,
    listing_id, addon_version_id, license_key_snapshot,
    license_version_snapshot, commission_bps_snapshot,
    gross_amount_minor, currency, status
  ) values (
    v_marketplace_held_contract_id, v_marketplace_held_order_id,
    v_marketplace_paid_offer_id, v_other_user, v_marketplace_seller_id,
    v_marketplace_paid_listing_id, v_marketplace_paid_version_id,
    'elysia.fixture.held', '1.0', 1000, 500, 'usd',
    'reconciliation_required'
  );
  insert into private.marketplace_fulfillment_holds(
    order_id, purchase_contract_id, buyer_user_id, seller_account_id, offer_id
  ) values (
    v_marketplace_held_order_id, v_marketplace_held_contract_id,
    v_other_user, v_marketplace_seller_id, v_marketplace_paid_offer_id
  );
  update private.economic_orders
  set status = 'paid', updated_at = pg_catalog.now()
  where id = v_marketplace_held_order_id;
  if exists (
    select 1 from private.marketplace_licenses
    where order_id = v_marketplace_held_order_id
  ) or exists (
    select 1 from private.marketplace_commission_events
    where order_id = v_marketplace_held_order_id
  ) or exists (
    select 1 from private.economic_entitlements
    where source_type = 'economic_order' and source_id = v_marketplace_held_order_id
  ) or not exists (
    select 1 from private.marketplace_fulfillment_holds
    where order_id = v_marketplace_held_order_id and status = 'refund_required'
  ) then
    raise exception 'unresolved Marketplace fulfillment hold revived license, entitlement, or payable state';
  end if;

  if exists (
    select 1
    from private.economic_legal_document_versions as document
    where document.content_sha256 !~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'economic legal document row lacks a canonical lowercase sha256';
  end if;
  if exists (
    select 1
    from private.economic_active_legal_consent_bundles as active_bundle
    join private.economic_legal_consent_bundle_versions as bundle
      on bundle.bundle_key = active_bundle.bundle_key
     and bundle.bundle_version = active_bundle.bundle_version
    cross join lateral pg_catalog.jsonb_each(bundle.document_manifest) as manifest(document_key, document)
    where (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(manifest.document)) <> 3
       or manifest.document ->> 'contentSha256' !~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'active consent bundle lacks an exact immutable document hash';
  end if;
  v_summary := public.economic_public_capabilities();
  if v_summary -> 'legalDocumentVersions' -> 'supportOneTime' ->> 'contentSha256'
       <> 'a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9'
     or v_summary -> 'legalConsentBundles' -> 'support_one_time_checkout_bundle'
          -> 'documents' -> 'supportTerms' ->> 'contentSha256'
       <> 'a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9' then
    raise exception 'public capabilities lost canonical legal content hashes: %', v_summary;
  end if;
  begin
    insert into private.economic_legal_consent_bundle_versions (
      bundle_key, bundle_version, public_path, document_manifest
    ) values (
      'fixture_invalid_hash_bundle', 'fixture-v1', '/legal/support-and-billing-terms',
      '{"supportTerms":{"version":"2026-07-16","path":"/legal/support-and-billing-terms"}}'::jsonb
    );
    raise exception 'consent bundle accepted a document without content sha256';
  exception when check_violation then
    null;
  end;

  if exists (
    select 1
    from private.economic_active_legal_consent_bundles as active_bundle
    join private.economic_legal_consent_bundle_versions as bundle
      on bundle.bundle_key = active_bundle.bundle_key
     and bundle.bundle_version = active_bundle.bundle_version
    where active_bundle.bundle_key = 'support_recurring_checkout_bundle'
      and bundle.document_manifest ? 'sandboxCreditTerms'
  ) then
    raise exception 'repository default recurring consent unexpectedly promises sandbox credits';
  end if;
  insert into private.economic_operator_assignments(user_id, capability, reason)
  values (v_user, 'sandbox_credits_adjust', 'Disposable recurring program activation fixture.');
  perform public.configure_sandbox_test_credit_program(
    'sandbox_test_unreviewed_recurring_fixture', 'recurring_support',
    'support_monthly_commons_usd', 100, 30, false, false,
    'CONFIGURE UNAPPROVED SANDBOX TEST PROGRAM',
    'Disposable fixture binds the current non-promissory consent bundle.'
  );
  begin
    perform public.set_sandbox_test_credit_program_status(
      v_user, '49000000-0000-4000-8000-000000000001',
      'sandbox_test_unreviewed_recurring_fixture', true,
      'ACTIVATE UNAPPROVED SANDBOX TEST PROGRAM',
      'Disposable fixture proves undisclosed recurring grants cannot activate.'
    );
    raise exception 'recurring program activated without sandbox-credit consent disclosure';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  -- The disposable database now simulates a future, separately reviewed UI and
  -- consent release. Production remains on the non-promissory bundle above.
  insert into private.economic_legal_consent_bundle_versions (
    bundle_key, bundle_version, public_path, document_manifest
  ) values (
    'support_recurring_checkout_bundle', 'fixture-recurring-sandbox-v1',
    '/legal/support-and-billing-terms',
    '{"recurringSupportTerms":{"version":"2026-07-16","path":"/legal/support-and-billing-terms","contentSha256":"a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9"},"refundPolicy":{"version":"2026-07-16","path":"/legal/refund-and-cancellation-policy","contentSha256":"55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"},"privacyDisclosure":{"version":"2026-07-16","path":"/legal/privacy-policy","contentSha256":"d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"},"sandboxCreditTerms":{"version":"2026-07-16","path":"/legal/sandbox-credit-terms","contentSha256":"0935b5242ee9079dd0246b8e051b371839bf08ebd43c59480305e542553fc8d6"}}'::jsonb
  );
  update private.economic_active_legal_consent_bundles
  set bundle_version = 'fixture-recurring-sandbox-v1', activated_at = pg_catalog.now()
  where bundle_key = 'support_recurring_checkout_bundle';

  select id into v_price from private.economic_prices
  where price_code = 'support_monthly_commons_usd';

  insert into private.economic_orders(
    id, client_request_id, user_id, flow, status, currency,
    subtotal_minor, total_minor, source_route, consent_version,
    provider, provider_session_reference
  ) values
    (v_order, '30000000-0000-4000-8000-000000000001', v_user,
      'support_recurring', 'checkout_created', 'usd', 500, 500,
      '/support', 'fixture-recurring-sandbox-v1', 'stripe', 'cs_test_recurring_fixture_1'),
    (v_reordered_order, '30000000-0000-4000-8000-000000000002', v_user,
      'support_recurring', 'checkout_created', 'usd', 500, 500,
      '/support', 'fixture-recurring-sandbox-v1', 'stripe', 'cs_test_recurring_fixture_2');

  insert into private.economic_order_items(
    order_id, product_key, price_id, price_code_snapshot,
    product_name_snapshot, quantity, unit_amount_minor,
    total_amount_minor, currency, recurring_interval_snapshot
  ) values
    (v_order, 'support_recurring', v_price, 'support_monthly_commons_usd',
      'Sustain Elysia monthly', 1, 500, 500, 'usd', 'month'),
    (v_reordered_order, 'support_recurring', v_price, 'support_monthly_commons_usd',
      'Sustain Elysia monthly', 1, 500, 500, 'usd', 'month');

  -- Program quantities are explicit operator input, never migration-invented.
  -- Configuration is inert until a distinct attributed activation action.
  v_result := public.configure_sandbox_test_credit_program(
    'sandbox_test_recurring_fixture', 'recurring_support',
    'support_monthly_commons_usd', 100, 30, false, false,
    'CONFIGURE UNAPPROVED SANDBOX TEST PROGRAM',
    'Disposable fixture configures an inactive recurring payment program.'
  );
  v_sandbox_recurring_program_id := (v_result ->> 'programVersionId')::uuid;
  if v_result ->> 'active' <> 'false'
     or v_result ->> 'sourcePriceCode' <> 'support_monthly_commons_usd'
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_result)) <> 10 then
    raise exception 'recurring sandbox program configuration contract drifted: %', v_result;
  end if;
  if not exists (
    select 1 from private.sandbox_credit_program_versions as program
    where program.id = v_sandbox_recurring_program_id
      and program.source_consent_bundle_version_snapshot = 'fixture-recurring-sandbox-v1'
      and program.sandbox_credit_terms_version_snapshot = '2026-07-16'
  ) then
    raise exception 'recurring sandbox program did not bind reviewed legal artifacts';
  end if;
  begin
    perform public.configure_sandbox_test_credit_program(
      'sandbox_test_recurring_active_rejected', 'recurring_support',
      'support_monthly_commons_usd', 100, 30, false, true,
      'CONFIGURE UNAPPROVED SANDBOX TEST PROGRAM',
      'Disposable fixture proves configuration cannot silently activate.'
    );
    raise exception 'sandbox program configuration silently activated a program';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  v_result := public.configure_sandbox_test_credit_program(
    'sandbox_test_starter_fixture', 'starter', null, 25, null, true, false,
    'CONFIGURE UNAPPROVED SANDBOX TEST PROGRAM',
    'Disposable fixture configures an inactive one-time starter program.'
  );
  v_sandbox_starter_program_id := (v_result ->> 'programVersionId')::uuid;

  -- Recurring Checkout completion has no PaymentIntent. It associates the
  -- customer/subscription and leaves monetary truth to invoice.paid.
  v_result := public.process_economic_provider_event(
    'stripe', 'evt_checkout_recurring_no_pi_1', 'checkout.session.completed',
    '2026-07-16 01:00:00+00', repeat('a', 64),
    pg_catalog.jsonb_build_object(
      'economicOrderId', v_order, 'providerObjectReference', 'cs_test_recurring_fixture_1',
      'customerReference', 'cus_fixture_1', 'subscriptionReference', 'sub_fixture_1',
      'amountMinor', 500, 'currency', 'usd', 'paymentStatus', 'paid', 'livemode', false
    )
  );
  if v_result ->> 'status' <> 'processed' then
    raise exception 'recurring Checkout without PI was not processed: %', v_result;
  end if;
  update private.economic_feature_flags
  set enabled = true
  where feature_key = 'customer_portal';
  v_result := public.prepare_economic_customer_portal(
    v_user, '72000000-0000-4000-8000-000000000001'
  );
  if v_result ->> 'idempotentReplay' <> 'false' then
    raise exception 'first customer portal request was treated as a replay: %', v_result;
  end if;
  v_result := public.prepare_economic_customer_portal(
    v_user, '72000000-0000-4000-8000-000000000001'
  );
  if v_result ->> 'idempotentReplay' <> 'true' then
    raise exception 'customer portal replay was not recognized: %', v_result;
  end if;
  begin
    perform public.prepare_economic_customer_portal(
      v_user, '72000000-0000-4000-8000-000000000002'
    );
    raise exception 'rotated customer portal request bypassed its cooldown';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  select status into v_status from private.economic_orders where id = v_order;
  if v_status <> 'processing' then
    raise exception 'recurring Checkout prematurely became monetary truth: %', v_status;
  end if;
  select pg_catalog.count(*) into v_count
  from private.economic_payment_transactions where order_id = v_order;
  if v_count <> 0 then
    raise exception 'recurring Checkout without PI created a payment transaction';
  end if;

  v_result := public.process_economic_provider_event(
    'stripe', 'evt_subscription_canceling_1', 'customer.subscription.updated',
    '2026-07-16 02:00:00+00', repeat('b', 64),
    pg_catalog.jsonb_build_object(
      'subscriptionReference', 'sub_fixture_1', 'customerReference', 'cus_fixture_1',
      'subscriptionStatus', 'active', 'cancelAtPeriodEnd', true,
      'currentPeriodStart', '2026-07-16 00:00:00+00',
      'currentPeriodEnd', '2026-08-16 00:00:00+00', 'livemode', false
    )
  );
  if v_result ->> 'status' <> 'processed' then
    raise exception 'authoritative subscription update failed: %', v_result;
  end if;

  for v_count in 1..3 loop
    v_result := public.process_economic_provider_event(
      'stripe', 'evt_invoice_paid_' || v_count, 'invoice.paid',
      pg_catalog.make_timestamptz(2026, 7, 16, 2 + v_count, 0, 0, 'UTC'),
      repeat(v_count::text, 64),
      pg_catalog.jsonb_build_object(
        'subscriptionReference', 'sub_fixture_1',
        'customerReference', 'cus_fixture_1',
        'paymentReference', 'pi_fixture_' || v_count,
        'amountMinor', 500, 'currency', 'usd', 'paymentStatus', 'paid', 'livemode', false
      )
    );
    if v_result ->> 'status' <> 'processed' then
      raise exception 'recurring invoice % failed: %', v_count, v_result;
    end if;
  end loop;
  select pg_catalog.count(*) into v_count
  from private.economic_payment_transactions
  where order_id = v_order and transaction_type = 'payment' and status = 'succeeded';
  if v_count <> 3 then
    raise exception 'recurring renewals were not transaction-scoped: %', v_count;
  end if;
  select pg_catalog.count(*) into v_count
  from private.sandbox_credit_recurring_payment_fulfillments;
  if v_count <> 0 then
    raise exception 'inactive recurring sandbox program granted credits: %', v_count;
  end if;
  select status, cancel_at_period_end, current_period_end
  into v_status, v_cancel, v_period_end
  from private.economic_subscriptions
  where provider = 'stripe' and provider_subscription_reference = 'sub_fixture_1';
  if v_status <> 'canceling' or not v_cancel
     or v_period_end <> '2026-08-16 00:00:00+00'::timestamptz then
    raise exception 'invoice delivery erased authoritative subscription fields: %, %, %',
      v_status, v_cancel, v_period_end;
  end if;

  -- A later-created invoice delivered before an older lifecycle event must not
  -- prevent that lifecycle stream from contributing its sparse cancel fields.
  perform public.process_economic_provider_event(
    'stripe', 'evt_checkout_recurring_no_pi_2', 'checkout.session.completed',
    '2026-07-16 01:00:00+00', repeat('c', 64),
    pg_catalog.jsonb_build_object(
      'economicOrderId', v_reordered_order,
      'providerObjectReference', 'cs_test_recurring_fixture_2',
      'customerReference', 'cus_fixture_1', 'subscriptionReference', 'sub_fixture_2',
      'amountMinor', 500, 'currency', 'usd', 'paymentStatus', 'paid', 'livemode', false
    )
  );
  perform public.process_economic_provider_event(
    'stripe', 'evt_invoice_before_subscription_update', 'invoice.paid',
    '2026-07-16 03:00:00+00', repeat('d', 64),
    pg_catalog.jsonb_build_object(
      'subscriptionReference', 'sub_fixture_2', 'customerReference', 'cus_fixture_1',
      'paymentReference', 'pi_fixture_reordered',
      'amountMinor', 500, 'currency', 'usd', 'paymentStatus', 'paid', 'livemode', false
    )
  );
  perform public.process_economic_provider_event(
    'stripe', 'evt_older_subscription_update_delivered_late', 'customer.subscription.updated',
    '2026-07-16 02:00:00+00', repeat('e', 64),
    pg_catalog.jsonb_build_object(
      'subscriptionReference', 'sub_fixture_2', 'subscriptionStatus', 'active',
      'cancelAtPeriodEnd', true, 'currentPeriodEnd', '2026-08-20 00:00:00+00',
      'livemode', false
    )
  );
  select status, cancel_at_period_end, current_period_end
  into v_status, v_cancel, v_period_end
  from private.economic_subscriptions
  where provider = 'stripe' and provider_subscription_reference = 'sub_fixture_2';
  if v_status <> 'canceling' or not v_cancel
     or v_period_end <> '2026-08-20 00:00:00+00'::timestamptz then
    raise exception 'reordered lifecycle update was lost: %, %, %', v_status, v_cancel, v_period_end;
  end if;

  -- Older refund state must not drive downstream order transitions after losing
  -- the per-refund UPSERT ordering race.
  perform public.process_economic_provider_event(
    'stripe', 'evt_refund_failed_newer', 'refund.updated',
    '2026-07-16 08:00:00+00', repeat('f', 64),
    pg_catalog.jsonb_build_object(
      'refundReference', 're_fixture_1', 'paymentReference', 'pi_fixture_2',
      'amountMinor', 500, 'currency', 'usd', 'status', 'failed', 'livemode', false
    )
  );
  perform public.process_economic_provider_event(
    'stripe', 'evt_refund_succeeded_older', 'refund.created',
    '2026-07-16 07:00:00+00', repeat('0', 64),
    pg_catalog.jsonb_build_object(
      'refundReference', 're_fixture_1', 'paymentReference', 'pi_fixture_2',
      'amountMinor', 500, 'currency', 'usd', 'status', 'succeeded', 'livemode', false
    )
  );
  select status into v_status from private.economic_refunds
  where provider = 'stripe' and provider_refund_reference = 're_fixture_1';
  if v_status <> 'failed' then raise exception 'older refund state won: %', v_status; end if;
  select status into v_status from private.economic_orders where id = v_order;
  if v_status <> 'paid' then raise exception 'older refund delivery changed order: %', v_status; end if;

  -- The same persisted-state rule applies to disputes and entitlement suspension.
  perform public.process_economic_provider_event(
    'stripe', 'evt_dispute_won_newer', 'charge.dispute.closed',
    '2026-07-16 10:00:00+00', repeat('1', 64),
    pg_catalog.jsonb_build_object(
      'disputeReference', 'dp_fixture_1', 'paymentReference', 'pi_fixture_1',
      'amountMinor', 500, 'currency', 'usd', 'status', 'won', 'livemode', false
    )
  );
  perform public.process_economic_provider_event(
    'stripe', 'evt_dispute_open_older', 'charge.dispute.created',
    '2026-07-16 09:00:00+00', repeat('2', 64),
    pg_catalog.jsonb_build_object(
      'disputeReference', 'dp_fixture_1', 'paymentReference', 'pi_fixture_1',
      'amountMinor', 500, 'currency', 'usd', 'status', 'needs_response', 'livemode', false
    )
  );
  select status into v_status from private.economic_disputes
  where provider = 'stripe' and provider_dispute_reference = 'dp_fixture_1';
  if v_status <> 'won' then raise exception 'older dispute state won: %', v_status; end if;
  select status into v_status from private.economic_orders where id = v_order;
  if v_status <> 'paid' then raise exception 'older dispute delivery re-suspended order: %', v_status; end if;

  -- A payment-family success delivered after durable refund truth must derive
  -- the final status instead of resurrecting paid fulfillment.
  perform public.process_economic_provider_event(
    'stripe', 'evt_refund_succeeded_before_late_payment', 'refund.created',
    '2026-07-16 11:00:00+00', repeat('4', 64),
    pg_catalog.jsonb_build_object(
      'refundReference', 're_fixture_late_success', 'paymentReference', 'pi_fixture_3',
      'amountMinor', 500, 'currency', 'usd', 'status', 'succeeded', 'livemode', false
    )
  );
  select status into v_status from private.economic_orders where id = v_order;
  if v_status <> 'partially_refunded' then
    raise exception 'successful refund did not establish partial-refund truth: %', v_status;
  end if;
  perform public.process_economic_provider_event(
    'stripe', 'evt_payment_success_delivered_after_refund', 'payment_intent.succeeded',
    '2026-07-16 06:00:00+00', repeat('5', 64),
    pg_catalog.jsonb_build_object(
      'paymentReference', 'pi_fixture_3', 'amountMinor', 500,
      'currency', 'usd', 'paymentStatus', 'succeeded', 'livemode', false
    )
  );
  select status into v_status from private.economic_orders where id = v_order;
  if v_status <> 'partially_refunded' then
    raise exception 'late payment success resurrected a partially refunded order: %', v_status;
  end if;

  -- Active dispute truth likewise outranks a delayed success event. The
  -- success event must not retrigger paid sidecars before returning to dispute.
  perform public.process_economic_provider_event(
    'stripe', 'evt_active_dispute_before_late_payment', 'charge.dispute.created',
    '2026-07-16 12:00:00+00', repeat('6', 64),
    pg_catalog.jsonb_build_object(
      'disputeReference', 'dp_fixture_late_success', 'paymentReference', 'pi_fixture_1',
      'amountMinor', 500, 'currency', 'usd', 'status', 'needs_response', 'livemode', false
    )
  );
  perform public.process_economic_provider_event(
    'stripe', 'evt_payment_success_delivered_after_dispute', 'payment_intent.succeeded',
    '2026-07-16 06:30:00+00', repeat('7', 64),
    pg_catalog.jsonb_build_object(
      'paymentReference', 'pi_fixture_1', 'amountMinor', 500,
      'currency', 'usd', 'paymentStatus', 'succeeded', 'livemode', false
    )
  );
  select status into v_status from private.economic_orders where id = v_order;
  if v_status <> 'disputed' then
    raise exception 'late payment success resurrected a disputed order: %', v_status;
  end if;

  v_result := public.process_economic_provider_event(
    'stripe', 'evt_unknown_signed', 'customer.created',
    '2026-07-16 11:00:00+00', repeat('3', 64),
    pg_catalog.jsonb_build_object('livemode', false)
  );
  if v_result ->> 'status' <> 'ignored' then
    raise exception 'unknown signed event was not safely ignored: %', v_result;
  end if;

  -- Explicitly assignable feature management can toggle reviewed test features,
  -- while provider payout execution remains unactivatable.
  insert into private.economic_operator_assignments(user_id, capability, reason)
  select v_user, capability, 'Disposable economic behavior fixture.'
  from unnest(array[
    'economic_orders_view', 'economic_payments_view', 'economic_refunds_manage',
    'economic_reconciliation_manage', 'recurring_support_manage',
    'sandbox_credits_adjust', 'job_fee_assess', 'marketplace_payout_manage',
    'organization_billing_manage', 'sponsorship_manage',
    'economic_assistance_manage', 'economic_account_requests_manage',
    'economic_audit_view', 'accounting_export', 'economic_feature_flags_manage'
  ]) as capability
  on conflict do nothing;

  v_result := public.export_economic_accounting_events(
    v_user, '75000000-0000-4000-8000-000000000001',
    '2026-07-16 00:00:00+00', '2026-07-18 00:00:00+00',
    null, null, 50
  );
  if v_result ->> 'exportVersion' <> 'economic-accounting-v1'
     or v_result ->> 'providerIdentifiersExposed' <> 'false'
     or v_result ->> 'personalContactDataExposed' <> 'false'
     or v_result ->> 'idempotentReplay' <> 'false'
     or pg_catalog.jsonb_typeof(v_result -> 'entries') <> 'array' then
    raise exception 'bounded accounting export returned an unsafe or malformed projection: %', v_result;
  end if;
  v_summary := public.export_economic_accounting_events(
    v_user, '75000000-0000-4000-8000-000000000001',
    '2026-07-16 00:00:00+00', '2026-07-18 00:00:00+00',
    null, null, 50
  );
  if v_summary ->> 'idempotentReplay' <> 'true'
     or v_summary - 'idempotentReplay' <> v_result - 'idempotentReplay' then
    raise exception 'accounting export replay did not preserve its exact durable result: %', v_summary;
  end if;
  select pg_catalog.count(*) into v_count
  from private.economic_audit_events
  where action = 'economic_accounting_export_generated'
    and target_id = '75000000-0000-4000-8000-000000000001';
  if v_count <> 1 then
    raise exception 'accounting export replay duplicated or omitted its audit event: %', v_count;
  end if;

  v_result := public.set_sandbox_test_credit_program_status(
    v_user, '49000000-0000-4000-8000-000000000002',
    'sandbox_test_recurring_fixture', true,
    'ACTIVATE UNAPPROVED SANDBOX TEST PROGRAM',
    'Disposable fixture activates a disclosed test recurring grant program.'
  );
  if v_result ->> 'active' <> 'true'
     or v_result ->> 'authorityChanged' <> 'false'
     or v_result ->> 'idempotentReplay' <> 'false' then
    raise exception 'reviewed recurring sandbox program activation failed: %', v_result;
  end if;
  v_result := public.set_sandbox_test_credit_program_status(
    v_user, '49000000-0000-4000-8000-000000000002',
    'sandbox_test_recurring_fixture', true,
    'ACTIVATE UNAPPROVED SANDBOX TEST PROGRAM',
    'Disposable fixture activates a disclosed test recurring grant program.'
  );
  if v_result ->> 'idempotentReplay' <> 'true' then
    raise exception 'program activation action was not idempotent: %', v_result;
  end if;
  begin
    perform public.grant_sandbox_credit_program(
      v_user, 'sandbox_test_recurring_fixture', 'manual-recurring-grant',
      'sandbox-recurring:manual',
      'Disposable fixture proves recurring grants require verified payment truth.'
    );
    raise exception 'recurring program accepted a grant without a verified payment';
  exception when insufficient_privilege then
    null;
  end;

  for v_count in 4..6 loop
    v_result := public.process_economic_provider_event(
      'stripe', 'evt_invoice_paid_' || v_count, 'invoice.paid',
      pg_catalog.make_timestamptz(2026, 7, 16, 8 + v_count, 0, 0, 'UTC'),
      repeat(v_count::text, 64),
      pg_catalog.jsonb_build_object(
        'subscriptionReference', 'sub_fixture_1',
        'customerReference', 'cus_fixture_1',
        'paymentReference', 'pi_fixture_' || v_count,
        'amountMinor', 500, 'currency', 'usd', 'paymentStatus', 'paid', 'livemode', false
      )
    );
    if v_result ->> 'status' <> 'processed' then
      raise exception 'active recurring sandbox invoice % failed: %', v_count, v_result;
    end if;
  end loop;
  select pg_catalog.count(*) into v_count
  from private.sandbox_credit_recurring_payment_fulfillments
  where program_version_id = v_sandbox_recurring_program_id;
  if v_count <> 3 then
    raise exception 'recurring program did not create one fulfillment per payment: %', v_count;
  end if;
  perform public.process_economic_provider_event(
    'stripe', 'evt_invoice_paid_6', 'invoice.paid',
    '2026-07-16 14:00:00+00', repeat('6', 64),
    pg_catalog.jsonb_build_object(
      'subscriptionReference', 'sub_fixture_1', 'customerReference', 'cus_fixture_1',
      'paymentReference', 'pi_fixture_6', 'amountMinor', 500,
      'currency', 'usd', 'paymentStatus', 'paid', 'livemode', false
    )
  );
  select pg_catalog.count(*) into v_count
  from private.sandbox_credit_recurring_payment_fulfillments
  where program_version_id = v_sandbox_recurring_program_id;
  if v_count <> 3 then
    raise exception 'recurring provider replay duplicated a grant: %', v_count;
  end if;

  perform public.process_economic_provider_event(
    'stripe', 'evt_refund_recurring_payment_4', 'refund.updated',
    '2026-07-16 15:00:00+00', repeat('7', 64),
    pg_catalog.jsonb_build_object(
      'refundReference', 're_recurring_fixture_4', 'paymentReference', 'pi_fixture_4',
      'amountMinor', 500, 'currency', 'usd', 'status', 'succeeded', 'livemode', false
    )
  );
  select fulfillment.status, fulfillment.permanent_adjusted_units
  into v_status, v_units
  from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
  join private.economic_payment_transactions as payment
    on payment.id = fulfillment.payment_transaction_id
  where payment.provider_transaction_reference = 'pi_fixture_4';
  if v_status <> 'fully_adjusted' or v_units <> 100 then
    raise exception 'payment-scoped recurring refund compensation failed: %, %', v_status, v_units;
  end if;
  if exists (
    select 1
    from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
    join private.economic_payment_transactions as payment
      on payment.id = fulfillment.payment_transaction_id
    where payment.provider_transaction_reference in ('pi_fixture_5', 'pi_fixture_6')
      and (fulfillment.permanent_adjusted_units <> 0 or fulfillment.dispute_held_units <> 0)
  ) then
    raise exception 'one payment refund altered another recurring credit lot';
  end if;

  perform public.process_economic_provider_event(
    'stripe', 'evt_dispute_recurring_payment_5_open', 'charge.dispute.created',
    '2026-07-16 16:00:00+00', repeat('8', 64),
    pg_catalog.jsonb_build_object(
      'disputeReference', 'dp_recurring_fixture_5', 'paymentReference', 'pi_fixture_5',
      'amountMinor', 200, 'currency', 'usd', 'status', 'needs_response', 'livemode', false
    )
  );
  select fulfillment.status, fulfillment.dispute_held_units
  into v_status, v_units
  from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
  join private.economic_payment_transactions as payment
    on payment.id = fulfillment.payment_transaction_id
  where payment.provider_transaction_reference = 'pi_fixture_5';
  if v_status <> 'dispute_held' or v_units <> 40 then
    raise exception 'recurring payment dispute hold failed: %, %', v_status, v_units;
  end if;
  perform public.process_economic_provider_event(
    'stripe', 'evt_dispute_recurring_payment_5_won', 'charge.dispute.closed',
    '2026-07-16 17:00:00+00', repeat('9', 64),
    pg_catalog.jsonb_build_object(
      'disputeReference', 'dp_recurring_fixture_5', 'paymentReference', 'pi_fixture_5',
      'amountMinor', 200, 'currency', 'usd', 'status', 'won', 'livemode', false
    )
  );
  select fulfillment.status, fulfillment.dispute_held_units
  into v_status, v_units
  from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
  join private.economic_payment_transactions as payment
    on payment.id = fulfillment.payment_transaction_id
  where payment.provider_transaction_reference = 'pi_fixture_5';
  if v_status <> 'active' or v_units <> 0 then
    raise exception 'won recurring payment dispute did not release its lot: %, %', v_status, v_units;
  end if;

  select fulfillment.credit_lot_id into v_credit_lot_id
  from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
  join private.economic_payment_transactions as payment
    on payment.id = fulfillment.payment_transaction_id
  where payment.provider_transaction_reference = 'pi_fixture_6';
  update private.sandbox_credit_lots set consumed_units = 80 where id = v_credit_lot_id;
  perform public.process_economic_provider_event(
    'stripe', 'evt_dispute_recurring_payment_6_lost', 'charge.dispute.closed',
    '2026-07-16 18:00:00+00', repeat('a1', 32),
    pg_catalog.jsonb_build_object(
      'disputeReference', 'dp_recurring_fixture_6', 'paymentReference', 'pi_fixture_6',
      'amountMinor', 500, 'currency', 'usd', 'status', 'lost', 'livemode', false
    )
  );
  select fulfillment.status, fulfillment.permanent_adjusted_units
  into v_status, v_units
  from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
  where fulfillment.credit_lot_id = v_credit_lot_id;
  select shortfall.missing_units into v_missing_units
  from private.sandbox_credit_recurring_adjustment_shortfalls as shortfall
  join private.sandbox_credit_recurring_payment_fulfillments as fulfillment
    on fulfillment.id = shortfall.fulfillment_id
  where fulfillment.credit_lot_id = v_credit_lot_id
    and shortfall.status = 'open';
  if v_status <> 'reconciliation_required' or v_units <> 20 or v_missing_units <> 80 then
    raise exception 'recurring payment adjustment shortfall was not durable: %, %, %',
      v_status, v_units, v_missing_units;
  end if;
  if not exists (
    select 1 from private.economic_audit_events as event
    where event.action = 'sandbox_recurring_payment_credit_reconciled'
      and event.target_type = 'sandbox_credit_recurring_payment_fulfillment'
      and event.metadata ->> 'shortfall_open' = 'true'
  ) then
    raise exception 'recurring payment compensation shortfall was not audited';
  end if;

  perform public.set_sandbox_test_credit_program_status(
    v_user, '49000000-0000-4000-8000-000000000003',
    'sandbox_test_recurring_fixture', false,
    'DEACTIVATE UNAPPROVED SANDBOX TEST PROGRAM',
    'Disposable fixture disables future recurring sandbox grants.'
  );
  perform public.process_economic_provider_event(
    'stripe', 'evt_invoice_paid_7', 'invoice.paid',
    '2026-07-16 19:00:00+00', repeat('b1', 32),
    pg_catalog.jsonb_build_object(
      'subscriptionReference', 'sub_fixture_1', 'customerReference', 'cus_fixture_1',
      'paymentReference', 'pi_fixture_7', 'amountMinor', 500,
      'currency', 'usd', 'paymentStatus', 'paid', 'livemode', false
    )
  );
  select pg_catalog.count(*) into v_count
  from private.sandbox_credit_recurring_payment_fulfillments
  where program_version_id = v_sandbox_recurring_program_id;
  if v_count <> 3 then
    raise exception 'deactivated recurring program granted another payment: %', v_count;
  end if;

  perform public.set_sandbox_test_credit_program_status(
    v_user, '49000000-0000-4000-8000-000000000004',
    'sandbox_test_starter_fixture', true,
    'ACTIVATE UNAPPROVED SANDBOX TEST PROGRAM',
    'Disposable fixture activates a reviewed one-time starter grant.'
  );
  v_result := public.operator_grant_sandbox_credit_program(
    v_user, '49000000-0000-4000-8000-000000000005', v_other_user,
    'sandbox_test_starter_fixture', 'fixture-starter-eligibility',
    'Disposable fixture issues an attributed configured starter grant.'
  );
  if v_result ->> 'authorityChanged' <> 'false'
     or v_result ->> 'idempotentReplay' <> 'false' then
    raise exception 'configured operator program grant failed: %', v_result;
  end if;
  v_result := public.operator_grant_sandbox_credit_program(
    v_user, '49000000-0000-4000-8000-000000000005', v_other_user,
    'sandbox_test_starter_fixture', 'fixture-starter-eligibility',
    'Disposable fixture issues an attributed configured starter grant.'
  );
  if v_result ->> 'idempotentReplay' <> 'true' then
    raise exception 'configured operator grant replay was not idempotent: %', v_result;
  end if;
  begin
    perform public.operator_grant_sandbox_credit_program(
      v_user, '49000000-0000-4000-8000-000000000006', v_other_user,
      'sandbox_test_starter_fixture', 'fixture-starter-second-attempt',
      'Disposable fixture proves the one-time program is enforced.'
    );
    raise exception 'one-time configured program granted twice';
  exception when unique_violation then
    null;
  end;
  perform public.set_sandbox_test_credit_program_status(
    v_user, '49000000-0000-4000-8000-000000000007',
    'sandbox_test_starter_fixture', false,
    'DEACTIVATE UNAPPROVED SANDBOX TEST PROGRAM',
    'Disposable fixture deactivates the one-time starter grant.'
  );
  begin
    perform public.operator_grant_sandbox_credit_program(
      v_user, '49000000-0000-4000-8000-000000000008', v_user,
      'sandbox_test_starter_fixture', 'fixture-starter-after-deactivation',
      'Disposable fixture proves inactive operator programs are inert.'
    );
    raise exception 'inactive configured program remained grantable';
  exception when no_data_found then
    null;
  end;

  v_result := public.set_economic_test_feature(
    v_user, '40000000-0000-4000-8000-000000000001',
    'sandbox_credit_display', true, 'ENABLE TEST ECONOMIC FEATURE',
    'Disposable fixture enables a harmless private projection.'
  );
  if coalesce((v_result ->> 'enabled')::boolean, false) is not true then
    raise exception 'reviewed feature toggle failed: %', v_result;
  end if;
  begin
    perform public.set_economic_test_feature(
      v_user, '40000000-0000-4000-8000-000000000002',
      'marketplace_payouts', true, 'ENABLE TEST ECONOMIC FEATURE',
      'Disposable fixture must prove provider payout execution is unavailable.'
    );
    raise exception 'marketplace payout execution unexpectedly activated';
  exception when insufficient_privilege then
    null;
  end;

  perform public.set_economic_test_feature(
    v_user, '40000000-0000-4000-8000-000000000004',
    'organization_contract_workflow', true, 'ENABLE TEST ECONOMIC FEATURE',
    'Disposable fixture enables reviewed organization contract preparation.'
  );
  perform public.set_economic_test_feature(
    v_user, '40000000-0000-4000-8000-000000000005',
    'organization_billing', true, 'ENABLE TEST ECONOMIC FEATURE',
    'Disposable fixture enables test organization checkout prerequisites.'
  );
  begin
    perform public.set_economic_test_feature(
      v_user, '40000000-0000-4000-8000-000000000006',
      'sponsorship_checkout', true, 'ENABLE TEST ECONOMIC FEATURE',
      'Disposable fixture proves sponsorship checkout fails before ethical review.'
    );
    raise exception 'sponsorship checkout unexpectedly activated before ethical review';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  perform public.set_economic_test_feature(
    v_user, '40000000-0000-4000-8000-000000000007',
    'sponsorship_review_workflow', true, 'ENABLE TEST ECONOMIC FEATURE',
    'Disposable fixture enables reviewed sponsorship preparation.'
  );
  perform public.set_economic_test_feature(
    v_user, '40000000-0000-4000-8000-000000000008',
    'sponsorship_checkout', true, 'ENABLE TEST ECONOMIC FEATURE',
    'Disposable fixture enables the separate sponsorship checkout switch.'
  );
  v_result := public.economic_public_capabilities();
  if v_result ->> 'organizationServiceCheckoutEnabled' <> 'true'
     or v_result ->> 'sponsorshipCheckoutEnabled' <> 'true' then
    raise exception 'public capabilities lost separate organization/sponsorship DB switches: %', v_result;
  end if;

  perform public.configure_economic_test_price(
    v_user, 'fixture_organization_service_usd', 'organization_service', 4200,
    'usd', 'fixture-org-price-v1',
    '42000000-0000-4000-8000-000000000008',
    'Disposable fixture creates an organization service test price.'
  );
  perform public.configure_economic_test_price(
    v_user, 'fixture_sponsorship_usd', 'sponsorship', 8400,
    'usd', 'fixture-sponsor-price-v1',
    '42000000-0000-4000-8000-000000000009',
    'Disposable fixture creates a sponsorship test price.'
  );
  select id into v_org_price from private.economic_prices
  where price_code = 'fixture_organization_service_usd';
  select id into v_sponsor_price from private.economic_prices
  where price_code = 'fixture_sponsorship_usd';

  v_result := public.set_economic_test_feature(
    v_user, '40000000-0000-4000-8000-000000000003',
    'economic_assistance_workflow', true, 'ENABLE TEST ECONOMIC FEATURE',
    'Disposable fixture enables the audited assistance lifecycle.'
  );
  v_result := public.operator_configure_assistance_program(
    v_user, '41000000-0000-4000-8000-000000000001',
    'fixture_job_waiver', 'waiver', 'job_post_fee', 'Fixture job waiver',
    'fixture-terms-v1', pg_catalog.now() - interval '1 day',
    pg_catalog.now() + interval '30 days', 10, false,
    'Disposable fixture creates a draft assistance program.'
  );
  v_program_id := (v_result ->> 'programId')::uuid;
  v_result := public.operator_set_economic_assistance_program_status(
    v_user, '41000000-0000-4000-8000-000000000002', v_program_id,
    'active', 'ACTIVATE TEST ECONOMIC ASSISTANCE PROGRAM',
    'Disposable fixture activates the reviewed assistance program.'
  );
  if v_result ->> 'status' <> 'active' then
    raise exception 'assistance program activation failed: %', v_result;
  end if;

  insert into public.commune_posts(
    id, user_id, post_type, title, body, visibility, status, moderation_status
  ) values (
    v_post_id, v_user, 'job_post', 'Fixture opportunity',
    'Synthetic disposable Job Post.', 'private_draft', 'draft', 'not_submitted'
  );
  insert into public.commune_job_posts(id, post_id, author_user_id)
  values (v_job_post_id, v_post_id, v_user);
  v_result := public.operator_issue_economic_assistance_grant(
    v_user, '41000000-0000-4000-8000-000000000003',
    'fixture_job_waiver', v_user, v_job_post_id, null,
    pg_catalog.now() + interval '14 days', null, null,
    'Disposable fixture issues one private Job Post waiver.'
  );
  v_grant_id := (v_result ->> 'grantId')::uuid;
  perform public.operator_assess_job_post_fee(
    v_user, v_job_post_id, 'waived', null, v_grant_id, null,
    '41000000-0000-4000-8000-000000000004',
    'Disposable fixture consumes the private Job Post waiver.'
  );
  v_result := public.operator_reconcile_job_post_assistance_grant(
    v_user, '41000000-0000-4000-8000-000000000005',
    v_job_post_id, v_grant_id, 'revoke',
    'RECONCILE AND END TEST JOB POST ASSISTANCE',
    'Disposable fixture detaches and ends consumed Job assistance.'
  );
  if v_result ->> 'grantStatus' <> 'revoked'
     or v_result ->> 'economicStatus' <> 'not_assessed' then
    raise exception 'consumed Job assistance remained irreconcilable: %', v_result;
  end if;
  perform public.operator_set_economic_assistance_program_status(
    v_user, '41000000-0000-4000-8000-000000000006', v_program_id,
    'paused', 'PAUSE TEST ECONOMIC ASSISTANCE PROGRAM',
    'Disposable fixture pauses further assistance issuance.'
  );
  perform public.operator_set_economic_assistance_program_status(
    v_user, '41000000-0000-4000-8000-000000000007', v_program_id,
    'active', 'ACTIVATE TEST ECONOMIC ASSISTANCE PROGRAM',
    'Disposable fixture reactivates the reviewed assistance program.'
  );
  v_result := public.operator_set_economic_assistance_program_status(
    v_user, '41000000-0000-4000-8000-000000000008', v_program_id,
    'retired', 'RETIRE TEST ECONOMIC ASSISTANCE PROGRAM',
    'Disposable fixture permanently retires the assistance program.'
  );
  if v_result ->> 'status' <> 'retired' then
    raise exception 'assistance program retirement failed: %', v_result;
  end if;

  -- Reconciliation holds have explicit operator exits; neither silently alters
  -- Commons identity or turns a financial hold into community punishment.
  insert into private.economic_orders(
    id, client_request_id, user_id, flow, status, currency,
    subtotal_minor, total_minor, source_route, consent_version, paid_at
  ) values
    (v_org_order, '42000000-0000-4000-8000-000000000001', v_user,
      'organization_service', 'paid', 'usd', 4200, 4200,
      '/organizations', '2026-07-16', pg_catalog.now()),
    (v_sponsor_order, '42000000-0000-4000-8000-000000000002', v_user,
      'sponsorship', 'paid', 'usd', 8400, 8400,
      '/support', '2026-07-16', pg_catalog.now());
  insert into private.economic_organizations(
    id, client_request_id, account_name, initial_contact_user_id,
    status, created_by
  ) values (
    v_organization_id, '42000000-0000-4000-8000-000000000003',
    'Disposable fixture organization', v_user, 'active', v_user
  );
  insert into private.economic_organization_memberships(
    client_request_id, organization_id, user_id, relationship, granted_by, reason
  ) values
    ('42000000-0000-4000-8000-000000000010', v_organization_id, v_user,
      'authorized_signer', v_user, 'Disposable fixture authorizes the current signer.'),
    ('42000000-0000-4000-8000-000000000011', v_organization_id, v_other_user,
      'authorized_signer', v_user, 'Disposable fixture authorizes a distinct signer for isolation tests.');
  insert into private.organization_service_engagements(
    id, client_request_id, organization_id, service_code, status,
    authorized_signer_user_id, statement_of_work_version,
    service_terms_version, data_handling_disclosure_version,
    price_id, order_id, starts_at, created_by, reviewed_by, reviewed_at,
    private_reason
  ) values (
    v_engagement_id, '42000000-0000-4000-8000-000000000004',
    v_organization_id, 'fixture_service', 'reconciliation_required', v_user,
    'fixture-sow-v1', '2026-07-16', 'fixture-data-v1',
    v_org_price, v_org_order, pg_catalog.now(), v_user, v_user, pg_catalog.now(),
    'Disposable fixture begins in an explicit reconciliation hold.'
  );
  v_result := public.operator_review_organization_service_engagement(
    v_user, v_engagement_id, '42000000-0000-4000-8000-000000000005',
    'resolve_resume', 'RESOLVE TEST ORGANIZATION RECONCILIATION AS ACTIVE',
    'Disposable fixture resolves the organization financial hold.'
  );
  if v_result ->> 'status' <> 'active' then
    raise exception 'organization reconciliation had no exit: %', v_result;
  end if;
  insert into private.sponsorship_agreements(
    id, client_request_id, organization_id, authorized_signer_user_id,
    status, agreement_version, disclosure_version, purpose_code,
    price_id, order_id, created_by, reviewed_by, reviewed_at, private_reason
  ) values (
    v_sponsorship_id, '42000000-0000-4000-8000-000000000006',
    v_organization_id, v_user, 'reconciliation_required',
    'fixture-sponsor-v1', 'fixture-sponsor-data-v1', 'fixture_ecology',
    v_sponsor_price, v_sponsor_order, v_user, v_user, pg_catalog.now(),
    'Disposable fixture begins with no public recognition or control.'
  );
  v_result := public.operator_review_sponsorship_agreement(
    v_user, v_sponsorship_id, '42000000-0000-4000-8000-000000000007',
    'resolve_resume', 'RESOLVE TEST SPONSORSHIP RECONCILIATION AS ACTIVE',
    'Disposable fixture resolves the sponsorship financial hold.'
  );
  if v_result ->> 'status' <> 'active'
     or coalesce((v_result ->> 'grantsAuthority')::boolean, true) then
    raise exception 'sponsorship reconciliation exit violated boundaries: %', v_result;
  end if;

  insert into private.economic_consents(
    user_id, order_id, document_key, document_version, source_route, client_request_id
  ) values
    (v_user, v_sponsor_order, 'sponsorship_no_control_agreement',
      'fixture-sponsor-v1', '/organizations', '42000000-0000-4000-8000-000000000012'),
    (v_user, v_sponsor_order, 'sponsorship_data_disclosure',
      'fixture-sponsor-data-v1', '/organizations', '42000000-0000-4000-8000-000000000012');

  insert into private.organization_service_engagements(
    id, client_request_id, organization_id, service_code, status,
    authorized_signer_user_id, statement_of_work_version,
    service_terms_version, data_handling_disclosure_version,
    price_id, created_by, private_reason
  ) values
    (v_pending_engagement_id, '42000000-0000-4000-8000-000000000013',
      v_organization_id, 'fixture_pending_service', 'contract_pending', v_user,
      'fixture-pending-sow-v1', 'fixture-pending-service-v1', 'fixture-pending-data-v1',
      v_org_price, v_user, 'Disposable fixture exposes only signer-safe checkout facts.'),
    (v_other_engagement_id, '42000000-0000-4000-8000-000000000014',
      v_organization_id, 'fixture_other_service', 'contract_pending', v_other_user,
      'fixture-other-sow-v1', 'fixture-other-service-v1', 'fixture-other-data-v1',
      v_org_price, v_user, 'Disposable fixture must remain hidden from the current signer.');

  insert into private.sponsorship_agreements(
    id, client_request_id, organization_id, authorized_signer_user_id,
    status, agreement_version, disclosure_version, purpose_code,
    public_recognition_opt_in, price_id, created_by, private_reason
  ) values
    (v_pending_sponsorship_id, '42000000-0000-4000-8000-000000000015',
      v_organization_id, v_user, 'contract_pending',
      'fixture-pending-sponsor-v1', 'fixture-pending-sponsor-data-v1',
      'fixture_pending_ecology', false, v_sponsor_price, v_user,
      'Disposable fixture exposes a private signer checkout decision.'),
    (v_other_sponsorship_id, '42000000-0000-4000-8000-000000000016',
      v_organization_id, v_other_user, 'contract_pending',
      'fixture-other-sponsor-v1', 'fixture-other-sponsor-data-v1',
      'fixture_other_ecology', false, v_sponsor_price, v_user,
      'Disposable fixture must remain hidden from the current signer.'),
    (v_withdrawal_sponsorship_id, '42000000-0000-4000-8000-000000000017',
      v_organization_id, v_user, 'canceled',
      'fixture-withdrawal-sponsor-v1', 'fixture-withdrawal-data-v1',
      'fixture_withdrawal', true, v_sponsor_price, v_user,
      'Disposable fixture proves recognition consent can still be withdrawn.');
  v_result := public.set_current_user_sponsorship_recognition_preference(
    v_user, v_withdrawal_sponsorship_id,
    '42000000-0000-4000-8000-000000000018', false, '/organizations',
    'fixture-withdrawal-sponsor-v1', 'fixture-withdrawal-data-v1'
  );
  if v_result ->> 'publicRecognitionOptIn' <> 'false' then
    raise exception 'sponsorship recognition withdrawal was blocked after eligibility changed: %', v_result;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
  v_summary := public.current_user_economic_organization_status();
  if v_summary ->> 'financialDetailsPrivate' <> 'true'
     or v_summary ->> 'affectsCommonsIdentity' <> 'false'
     or pg_catalog.jsonb_array_length(v_summary -> 'organizations') <> 1 then
    raise exception 'private organization signer projection boundary failed: %', v_summary;
  end if;
  select item.value into v_result
  from pg_catalog.jsonb_array_elements(
    v_summary -> 'organizations' -> 0 -> 'engagements'
  ) as item(value)
  where item.value ->> 'engagementId' = v_pending_engagement_id::text;
  if v_result is null
     or not (v_result ?& array[
       'engagementId', 'status', 'serviceCode', 'statementOfWorkVersion',
       'serviceTermsVersion', 'dataHandlingDisclosureVersion',
       'amountMinor', 'currency', 'checkoutAvailable'
     ])
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_result)) <> 9
     or v_result ->> 'checkoutAvailable' <> 'true'
     or v_result ->> 'amountMinor' <> '4200'
     or v_result ?| array['orderId', 'provider', 'privateReason', 'contact'] then
    raise exception 'organization signer checkout projection is unsafe or incomplete: %', v_result;
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(
      v_summary -> 'organizations' -> 0 -> 'engagements'
    ) as item(value)
    where item.value ->> 'engagementId' = v_other_engagement_id::text
  ) then
    raise exception 'another organization signer engagement leaked into the self projection';
  end if;
  select item.value into v_result
  from pg_catalog.jsonb_array_elements(
    v_summary -> 'organizations' -> 0 -> 'sponsorshipAgreements'
  ) as item(value)
  where item.value ->> 'agreementId' = v_pending_sponsorship_id::text;
  if v_result is null
     or not (v_result ?& array[
       'agreementId', 'status', 'agreementVersion', 'disclosureVersion',
       'amountMinor', 'currency', 'publicRecognitionOptIn',
       'publicRecognitionApproved', 'checkoutAvailable',
       'recognitionPreferenceAvailable'
     ])
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_result)) <> 10
     or v_result ->> 'checkoutAvailable' <> 'true'
     or v_result ->> 'recognitionPreferenceAvailable' <> 'false'
     or v_result ->> 'amountMinor' <> '8400'
     or v_result ?| array['orderId', 'provider', 'privateReason', 'contact'] then
    raise exception 'sponsorship signer checkout projection is unsafe or incomplete: %', v_result;
  end if;
  select item.value into v_result
  from pg_catalog.jsonb_array_elements(
    v_summary -> 'organizations' -> 0 -> 'sponsorshipAgreements'
  ) as item(value)
  where item.value ->> 'agreementId' = v_sponsorship_id::text;
  if v_result ->> 'checkoutAvailable' <> 'false'
     or v_result ->> 'recognitionPreferenceAvailable' <> 'true' then
    raise exception 'paid sponsorship consent eligibility was guessed incorrectly: %', v_result;
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(
      v_summary -> 'organizations' -> 0 -> 'sponsorshipAgreements'
    ) as item(value)
    where item.value ->> 'agreementId' = v_other_sponsorship_id::text
  ) then
    raise exception 'another sponsorship signer workflow leaked into the self projection';
  end if;
  v_summary := public.current_user_economic_account_summary();
  if pg_catalog.jsonb_array_length(v_summary -> 'paymentTransactions') <> 8
     or pg_catalog.jsonb_array_length(v_summary -> 'receipts') <> 8 then
    raise exception 'transaction receipt projection lost recurring payments: %', v_summary;
  end if;
  v_summary := public.current_user_economic_operator_overview();
  if pg_catalog.jsonb_typeof(v_summary -> 'refundablePaymentQueue') <> 'array'
     or not (v_summary -> 'refundablePaymentQueue' -> 0 ? 'paymentTransactionId')
     or v_summary ->> 'queueLimit' <> '10'
     or v_summary ->> 'providerIdentifiersExposed' <> 'false' then
    raise exception 'operator overview transaction queue is unsafe or incomplete: %', v_summary;
  end if;
  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_summary -> 'sandboxCorrectionQueue') as item(value)
    where item.value ->> 'fulfillmentScope' = 'recurring_support_payment'
      and item.value ? 'paymentTransactionId'
      and item.value ->> 'paymentTransactionId' is not null
  ) then
    raise exception 'recurring payment shortfall was absent from the bounded correction queue';
  end if;
  v_summary := public.current_user_economic_audit_events(null, null, 20);
  if pg_catalog.jsonb_typeof(v_summary -> 'events') <> 'array'
     or v_summary ->> 'providerIdentifiersExposed' <> 'false' then
    raise exception 'bounded audit projection failed: %', v_summary;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);

  -- A payment settling after cancellation or rejection is quarantined. An
  -- operator cannot terminalize the target while money remains settled, a
  -- partial refund is insufficient, and only durable succeeded refunds that
  -- cover the complete verified payment restore the intended terminal state.
  insert into private.economic_orders(
    id, client_request_id, user_id, flow, status, currency,
    subtotal_minor, total_minor, source_route, consent_version
  ) values
    (v_late_org_order, '63000000-0000-4000-8000-000000000011', v_user,
      'organization_service', 'checkout_created', 'usd', 4200, 4200,
      '/organizations', '2026-07-16'),
    (v_late_sponsor_order, '63000000-0000-4000-8000-000000000012', v_user,
      'sponsorship', 'checkout_created', 'usd', 8400, 8400,
      '/organizations', '2026-07-16');
  insert into private.organization_service_engagements(
    id, client_request_id, organization_id, service_code, status,
    authorized_signer_user_id, statement_of_work_version,
    service_terms_version, data_handling_disclosure_version,
    entitlement_state, support_agreement_state, price_id, order_id,
    created_by, private_reason
  ) values (
    v_late_org_engagement, '63000000-0000-4000-8000-000000000013',
    v_organization_id, 'fixture_late_service', 'canceled', v_user,
    'fixture-late-sow-v1', 'fixture-late-service-v1', 'fixture-late-data-v1',
    'ended', 'terminated', v_org_price, v_late_org_order, v_user,
    'Disposable fixture canceled this engagement before its delayed payment settled.'
  );
  insert into private.sponsorship_agreements(
    id, client_request_id, organization_id, authorized_signer_user_id,
    status, agreement_version, disclosure_version, purpose_code,
    price_id, order_id, created_by, reviewed_by, reviewed_at, private_reason
  ) values (
    v_late_sponsorship, '63000000-0000-4000-8000-000000000014',
    v_organization_id, v_user, 'rejected', 'fixture-late-sponsor-v1',
    'fixture-late-sponsor-data-v1', 'fixture_late_ecology',
    v_sponsor_price, v_late_sponsor_order, v_user, v_user, pg_catalog.now(),
    'Disposable fixture rejected this sponsorship before its delayed payment settled.'
  );
  insert into private.economic_payment_transactions(
    id, order_id, provider, provider_transaction_reference,
    transaction_type, status, gross_amount_minor, currency, occurred_at
  ) values
    (v_late_org_payment, v_late_org_order, 'stripe', 'pi_late_org_fixture',
      'payment', 'succeeded', 4200, 'usd', pg_catalog.now()),
    (v_late_sponsor_payment, v_late_sponsor_order, 'stripe', 'pi_late_sponsor_fixture',
      'payment', 'succeeded', 8400, 'usd', pg_catalog.now());

  update private.economic_orders
  set status = 'paid', paid_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id in (v_late_org_order, v_late_sponsor_order);
  if not exists (
       select 1 from private.organization_sponsorship_settlement_holds
       where order_id = v_late_org_order and status = 'open'
         and organization_service_engagement_id = v_late_org_engagement
         and resolution_target_status = 'canceled'
     ) or not exists (
       select 1 from private.organization_sponsorship_settlement_holds
       where order_id = v_late_sponsor_order and status = 'open'
         and sponsorship_agreement_id = v_late_sponsorship
         and resolution_target_status = 'rejected'
     ) or (select status from private.organization_service_engagements
       where id = v_late_org_engagement) <> 'reconciliation_required'
     or (select status from private.sponsorship_agreements
       where id = v_late_sponsorship) <> 'reconciliation_required' then
    raise exception 'late organization/sponsorship settlement was not quarantined';
  end if;
  begin
    perform public.operator_review_organization_service_engagement(
      v_user, v_late_org_engagement,
      '63000000-0000-4000-8000-000000000015',
      'resolve_cancel', 'RESOLVE TEST ORGANIZATION RECONCILIATION AS CANCELED',
      'Disposable fixture must not bypass a settled-payment refund hold.'
    );
    raise exception 'operator resolved a late-settlement hold without a full refund';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  insert into private.economic_refunds(
    order_id, payment_transaction_id, provider, provider_refund_reference,
    amount_minor, currency, status
  ) values (
    v_late_org_order, v_late_org_payment, 'stripe', 're_late_org_partial_fixture',
    2000, 'usd', 'succeeded'
  );
  update private.economic_orders
  set status = 'partially_refunded', updated_at = pg_catalog.now()
  where id = v_late_org_order;
  if (select status from private.organization_sponsorship_settlement_holds
      where order_id = v_late_org_order) <> 'open'
     or (select status from private.organization_service_engagements
      where id = v_late_org_engagement) <> 'reconciliation_required' then
    raise exception 'partial refund incorrectly resolved a late-settlement hold';
  end if;

  -- Exercise the replay edge too: an order can be reconciled to refunded before
  -- its final durable refund delivery arrives. The open hold must remain until
  -- that succeeded refund row exists, then resolve from the refund trigger.
  update private.economic_orders
  set status = 'refunded', refunded_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_late_org_order;
  if (select status from private.organization_sponsorship_settlement_holds
      where order_id = v_late_org_order) <> 'open' then
    raise exception 'refunded order state alone incorrectly resolved a late-settlement hold';
  end if;

  insert into private.economic_refunds(
    order_id, payment_transaction_id, provider, provider_refund_reference,
    amount_minor, currency, status
  ) values
    (v_late_org_order, v_late_org_payment, 'stripe', 're_late_org_final_fixture',
      2200, 'usd', 'succeeded'),
    (v_late_sponsor_order, v_late_sponsor_payment, 'stripe', 're_late_sponsor_fixture',
      8400, 'usd', 'succeeded');
  update private.economic_orders
  set status = 'refunded', refunded_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_late_sponsor_order;
  if (select status from private.organization_sponsorship_settlement_holds
      where order_id = v_late_org_order) <> 'resolved_full_refund'
     or (select status from private.organization_sponsorship_settlement_holds
      where order_id = v_late_sponsor_order) <> 'resolved_full_refund'
     or (select status from private.organization_service_engagements
      where id = v_late_org_engagement) <> 'canceled'
     or (select status from private.sponsorship_agreements
      where id = v_late_sponsorship) <> 'rejected' then
    raise exception 'full verified refund did not resolve late-settlement quarantine';
  end if;
  if (select pg_catalog.count(*)
      from private.organization_sponsorship_settlement_hold_events
      where event_type = 'full_refund_verified'
        and hold_id in (
          select id from private.organization_sponsorship_settlement_holds
          where order_id in (v_late_org_order, v_late_sponsor_order)
        )) <> 2 then
    raise exception 'late-settlement full-refund resolution was not durably audited';
  end if;
  begin
    update private.organization_sponsorship_settlement_hold_events
    set metadata = '{}'::jsonb
    where hold_id = (
      select id from private.organization_sponsorship_settlement_holds
      where order_id = v_late_org_order
    );
    raise exception 'late-settlement hold audit was mutable';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  insert into private.economic_orders (
    id, client_request_id, user_id, flow, status, currency,
    subtotal_minor, total_minor, source_route, consent_version,
    checkout_expires_at
  ) values (
    '72000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000002',
    v_user, 'support_one_time', 'checkout_created', 'usd',
    500, 500, '/support', '2026-07-16',
    pg_catalog.now() - interval '1 minute'
  );
  v_result := public.expire_stale_economic_checkouts(100);
  select status into v_status from private.economic_orders
  where id = '72000000-0000-4000-8000-000000000001';
  if v_result ->> 'expired' <> '1'
     or v_result ->> 'canonicalFinancialTruth' <> 'false'
     or v_status <> 'failed'
     or not exists (
       select 1 from private.economic_orders
       where id = '72000000-0000-4000-8000-000000000001'
         and failure_code = 'checkout_session_expired'
     ) then
    raise exception 'bounded stale Checkout expiry did not fail closed: %', v_result;
  end if;
end
$economic_behavior$;

do $economic_acl$
declare
  v_signature regprocedure;
  v_public_read regprocedure[] := array[
    'public.economic_public_capabilities()'::regprocedure,
    'public.marketplace_commercial_offer_catalog()'::regprocedure,
    'public.sandbox_credit_pack_catalog()'::regprocedure
  ];
  v_authenticated regprocedure[] := array[
    'public.create_badge_credit_event(uuid,text,integer,text,uuid,uuid,boolean,text,text)'::regprocedure,
    'public.current_user_economic_account_summary()'::regprocedure,
    'public.current_user_economic_audit_events(timestamptz,uuid,integer)'::regprocedure,
    'public.current_user_economic_closure_readiness()'::regprocedure,
    'public.current_user_economic_operator_overview()'::regprocedure,
    'public.current_user_economic_organization_status()'::regprocedure,
    'public.current_user_economic_seller_status()'::regprocedure,
    'public.current_user_job_post_economic_status(uuid)'::regprocedure,
    'public.current_user_marketplace_purchases()'::regprocedure,
    'public.current_user_sandbox_credit_summary()'::regprocedure,
    'public.evaluate_badges_for_user(uuid)'::regprocedure,
    'public.finalize_commune_sandbox_run(uuid,uuid,text,text,boolean,text,text,text,integer,integer,boolean,jsonb,integer,integer,integer,bigint,integer,bigint,boolean,text)'::regprocedure,
    'public.grant_free_member_for_user(uuid)'::regprocedure,
    'public.grant_user_badge(uuid,text,text,text,uuid)'::regprocedure,
    'public.lift_user_badge_suppression(uuid,text,text)'::regprocedure,
    'public.reserve_commune_sandbox_run(uuid,text,text,text,uuid,uuid,uuid,text,text,text,integer)'::regprocedure,
    'public.review_commune_job_post(uuid,text,text)'::regprocedure,
    'public.revoke_badge_credit_event(uuid,text)'::regprocedure,
    'public.revoke_user_badge(uuid,text,text)'::regprocedure,
    'public.set_current_user_support_recognition(uuid,boolean,text)'::regprocedure
  ];
  v_service regprocedure[] := array[
    'public.accept_marketplace_free_license(uuid,uuid,uuid,text)'::regprocedure,
    'public.accept_marketplace_free_seller_agreement(uuid,uuid,text,text)'::regprocedure,
    'public.attach_economic_checkout_provider_session(uuid,text,text,text)'::regprocedure,
    'public.attach_economic_checkout_billing_customer(uuid,text,text)'::regprocedure,
    'public.attach_economic_seller_provider_account(uuid,text,text)'::regprocedure,
    'public.attach_economic_test_refund_result(uuid,uuid,uuid,text,text,timestamptz,text,text)'::regprocedure,
    'public.attach_marketplace_test_transfer_result(uuid,uuid,text,text,text,text)'::regprocedure,
    'public.begin_economic_checkout(uuid,uuid,text,bigint,text,text,text,text)'::regprocedure,
    'public.bootstrap_economic_operator(uuid,text)'::regprocedure,
    'public.configure_economic_test_price(uuid,text,text,bigint,text,text,uuid,text)'::regprocedure,
    'public.configure_marketplace_test_commercial_terms(uuid,uuid,text,integer,text,text,boolean,text,text)'::regprocedure,
    'public.configure_marketplace_test_offer(uuid,uuid,uuid,uuid,text,text,bigint,text,text,text,text,text,text,text)'::regprocedure,
    'public.configure_sandbox_test_credit_pack(text,text,bigint,text,bigint,integer,text,text,text)'::regprocedure,
    'public.configure_sandbox_test_credit_program(text,text,text,bigint,integer,boolean,boolean,text,text)'::regprocedure,
    'public.create_economic_notification(uuid,text,text,uuid,text)'::regprocedure,
    'public.deliver_economic_notification_outbox(integer)'::regprocedure,
    'public.expire_stale_economic_checkouts(integer)'::regprocedure,
    'public.export_economic_accounting_events(uuid,uuid,timestamptz,timestamptz,timestamptz,uuid,integer)'::regprocedure,
    'public.fail_economic_checkout_attempt(uuid,text)'::regprocedure,
    'public.get_economic_seller_provider_context(uuid,uuid)'::regprocedure,
    'public.grant_sandbox_credit_program(uuid,text,text,text,text)'::regprocedure,
    'public.grant_sandbox_credit_units(uuid,bigint,text,text,timestamptz,text,text)'::regprocedure,
    'public.link_economic_seller_publisher(uuid,uuid,uuid,text)'::regprocedure,
    'public.lookup_economic_order_status(text,uuid)'::regprocedure,
    'public.lookup_economic_test_catalog_reference(text,text)'::regprocedure,
    'public.operator_assess_job_post_fee(uuid,uuid,text,text,uuid,uuid,uuid,text)'::regprocedure,
    'public.operator_close_sponsorship_assistance_allocation(uuid,uuid,uuid,text)'::regprocedure,
    'public.operator_configure_assistance_program(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,integer,boolean,text)'::regprocedure,
    'public.operator_create_economic_organization(uuid,uuid,text,text,uuid,text)'::regprocedure,
    'public.operator_create_organization_service_engagement(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,text)'::regprocedure,
    'public.operator_create_sponsorship_agreement(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text)'::regprocedure,
    'public.operator_create_sponsorship_assistance_allocation(uuid,uuid,uuid,uuid,text,bigint,text,text)'::regprocedure,
    'public.operator_end_economic_assistance_grant(uuid,uuid,uuid,text,text)'::regprocedure,
    'public.operator_grant_sandbox_credit_units(uuid,uuid,bigint,text,text,timestamptz,text,text)'::regprocedure,
    'public.operator_grant_sandbox_credit_program(uuid,uuid,uuid,text,text,text)'::regprocedure,
    'public.operator_issue_economic_assistance_grant(uuid,uuid,text,uuid,uuid,bigint,timestamptz,uuid,bigint,text)'::regprocedure,
    'public.operator_mark_reconciliation_needed(uuid,uuid,uuid,text)'::regprocedure,
    'public.operator_place_refund_hold(uuid,uuid,uuid,bigint,uuid,text)'::regprocedure,
    'public.operator_prepare_marketplace_test_payout(uuid,uuid,uuid,bigint,text,text,text)'::regprocedure,
    'public.operator_prepare_test_refund(uuid,uuid,uuid,text,text)'::regprocedure,
    'public.operator_reconcile_job_post_assistance_grant(uuid,uuid,uuid,uuid,text,text,text)'::regprocedure,
    'public.operator_review_organization_service_engagement(uuid,uuid,uuid,text,text,text)'::regprocedure,
    'public.operator_review_sponsorship_agreement(uuid,uuid,uuid,text,text,text)'::regprocedure,
    'public.operator_set_economic_assistance_program_status(uuid,uuid,uuid,text,text,text)'::regprocedure,
    'public.operator_set_economic_organization_membership(uuid,uuid,uuid,uuid,text,boolean,text)'::regprocedure,
    'public.operator_set_economic_service_restriction(uuid,uuid,uuid,uuid,text,text,timestamptz,boolean,text)'::regprocedure,
    'public.operator_set_sponsorship_public_recognition(uuid,uuid,uuid,boolean,text,text)'::regprocedure,
    'public.operator_update_economic_account_action(uuid,uuid,text,uuid,text,timestamptz,text)'::regprocedure,
    'public.prepare_economic_customer_portal(uuid,uuid)'::regprocedure,
    'public.prepare_economic_seller_onboarding(uuid,uuid,text,text,text)'::regprocedure,
    'public.prepare_job_post_economic_checkout(uuid,uuid,uuid,text,text)'::regprocedure,
    'public.prepare_marketplace_purchase_checkout(uuid,uuid,uuid,text,text)'::regprocedure,
    'public.prepare_organization_service_checkout(uuid,uuid,uuid,text,text,text,text,text)'::regprocedure,
    'public.prepare_sandbox_credit_checkout(uuid,uuid,text,text,text)'::regprocedure,
    'public.prepare_sponsorship_checkout(uuid,uuid,uuid,text,text,text,text)'::regprocedure,
    'public.process_economic_provider_event(text,text,text,timestamptz,text,jsonb)'::regprocedure,
    'public.public_sponsorship_recognition()'::regprocedure,
    'public.public_support_recognition()'::regprocedure,
    'public.reconcile_sandbox_credit_expirations(uuid)'::regprocedure,
    'public.record_economic_customer_portal_session(uuid,uuid,text)'::regprocedure,
    'public.record_economic_seller_provider_status(uuid,uuid,text,boolean,boolean,boolean,text,timestamptz,text)'::regprocedure,
    'public.record_economic_test_catalog_reference(text,text,text,text,text)'::regprocedure,
    'public.request_economic_account_action(uuid,uuid,text,text,text)'::regprocedure,
    'public.set_current_user_sponsorship_recognition_preference(uuid,uuid,uuid,boolean,text,text,text)'::regprocedure,
    'public.set_marketplace_test_offer_status(uuid,uuid,uuid,text,text,text)'::regprocedure,
    'public.set_economic_operator_assignment(uuid,uuid,text,boolean,text)'::regprocedure,
    'public.set_sandbox_test_credit_program_status(uuid,uuid,text,boolean,text,text)'::regprocedure,
    'public.set_economic_test_feature(uuid,uuid,text,boolean,text,text)'::regprocedure
  ];
  v_no_direct_execute regprocedure[] := array[
    'public.award_badge_if_missing(uuid,text,text,text,text,uuid,uuid)'::regprocedure,
    'public.backfill_free_member_badges()'::regprocedure,
    'public.normalize_marketplace_install_intent()'::regprocedure,
    'public.resolve_user_saved_addon_identifiers()'::regprocedure,
    'public.synchronize_user_badge_updated_at()'::regprocedure,
    'public.synchronize_user_notification_read_state()'::regprocedure
  ];
  v_security_invoker regprocedure[] := array[
    'public.synchronize_user_badge_updated_at()'::regprocedure
  ];
  v_governed regprocedure[];
  v_expected_anon boolean;
  v_expected_authenticated boolean;
  v_expected_service boolean;
  v_public_execute boolean;
  v_function record;
  v_relation record;
  v_manifest_count integer;
begin
  v_governed := v_public_read || v_authenticated || v_service || v_no_direct_execute;
  select pg_catalog.count(distinct signature)
  into v_manifest_count
  from pg_catalog.unnest(v_governed) as governed(signature);
  if v_manifest_count <> pg_catalog.cardinality(v_governed) then
    raise exception 'economic function ACL manifest contains a duplicate signature';
  end if;

  foreach v_signature in array v_governed loop
    v_expected_anon := v_signature = any(v_public_read);
    v_expected_authenticated := v_signature = any(v_public_read)
      or v_signature = any(v_authenticated);
    v_expected_service := v_signature = any(v_service);
    if pg_catalog.has_function_privilege('anon', v_signature, 'EXECUTE')
         is distinct from v_expected_anon
       or pg_catalog.has_function_privilege('authenticated', v_signature, 'EXECUTE')
         is distinct from v_expected_authenticated
       or pg_catalog.has_function_privilege('service_role', v_signature, 'EXECUTE')
         is distinct from v_expected_service then
      raise exception 'function ACL differs from explicit allowlist: % (anon %, authenticated %, service %)',
        v_signature, v_expected_anon, v_expected_authenticated, v_expected_service;
    end if;
    select exists (
      select 1
      from pg_catalog.pg_proc as procedure
      cross join lateral pg_catalog.aclexplode(
        coalesce(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
      ) as acl
      where procedure.oid = v_signature
        and acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ) into v_public_execute;
    if v_public_execute then
      raise exception 'function has an implicit or explicit PUBLIC execute grant: %', v_signature;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_proc as procedure
      where procedure.oid = v_signature
        and procedure.prosecdef = not (v_signature = any(v_security_invoker))
        and 'search_path=""' = any(coalesce(procedure.proconfig, array[]::text[]))
    ) then
      raise exception 'governed function has an unexpected security mode or search_path: %', v_signature;
    end if;
  end loop;

  if pg_catalog.has_schema_privilege('anon', 'private', 'USAGE')
     or pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'private schema is exposed to a browser role';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_namespace as namespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
    ) as acl
    where namespace.nspname = 'private'
      and acl.grantee = 0
      and acl.privilege_type = 'USAGE'
  ) then
    raise exception 'private schema has PUBLIC usage';
  end if;
  if pg_catalog.to_regclass('private.job_post_payment_holds') is null
     or not exists (
       select 1
       from pg_catalog.pg_class as relation
       join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'private'
         and relation.relname = 'job_post_payment_holds'
         and relation.relrowsecurity
     ) then
    raise exception 'Job Post delayed-payment quarantine table is absent or lacks RLS';
  end if;
  if pg_catalog.to_regclass('private.organization_sponsorship_settlement_holds') is null
     or pg_catalog.to_regclass('private.organization_sponsorship_settlement_hold_events') is null
     or exists (
       select 1
       from pg_catalog.pg_class as relation
       join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'private'
         and relation.relname in (
           'organization_sponsorship_settlement_holds',
           'organization_sponsorship_settlement_hold_events'
         )
         and not relation.relrowsecurity
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'private.organization_sponsorship_settlement_holds',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'private.organization_sponsorship_settlement_hold_events',
       'SELECT,INSERT,UPDATE,DELETE'
     ) then
    raise exception 'organization/sponsorship settlement quarantine is absent, exposed, or lacks RLS';
  end if;

  for v_relation in
    select relation.oid, relation.relname, relation.relkind, relation.relrowsecurity
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    if pg_catalog.has_table_privilege(
      'anon', v_relation.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or pg_catalog.has_table_privilege(
      'authenticated', v_relation.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) then
      raise exception 'private relation exposed to a browser role: %', v_relation.relname;
    end if;
    if exists (
      select 1
      from pg_catalog.pg_class as relation
      cross join lateral pg_catalog.aclexplode(
        coalesce(relation.relacl, pg_catalog.acldefault(
          case when relation.relkind = 'S' then 'S'::"char" else 'r'::"char" end,
          relation.relowner
        ))
      ) as acl
      where relation.oid = v_relation.oid
        and acl.grantee = 0
        and acl.privilege_type in (
          'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
        )
    ) then
      raise exception 'private relation has PUBLIC privileges: %', v_relation.relname;
    end if;
    if v_relation.relkind in ('r', 'p')
       and v_relation.relname <> 'sandbox_proxy_secrets'
       and not v_relation.relrowsecurity then
      raise exception 'new private table lacks RLS: %', v_relation.relname;
    end if;
  end loop;

  for v_function in
    select procedure.oid::regprocedure as signature
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
  loop
    if pg_catalog.has_function_privilege('anon', v_function.signature, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_function.signature, 'EXECUTE')
       or exists (
         select 1
         from pg_catalog.pg_proc as procedure
         cross join lateral pg_catalog.aclexplode(
           coalesce(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
         ) as acl
         where procedure.oid = v_function.signature
           and acl.grantee = 0
           and acl.privilege_type = 'EXECUTE'
       ) then
      raise exception 'private function exposed to a browser or PUBLIC role: %', v_function.signature;
    end if;
  end loop;
end
$economic_acl$;

select 'Economic database behavior checks ok.' as result;
