-- One environment per economic database; never share live and sandbox databases.
-- This migration records capability, not activation. Every acquisition flag stays OFF.
begin;
create function private.economic_runtime_mode() returns text language sql stable security definer set search_path='' as $$
 select runtime_mode from private.economic_provider_readiness where provider='stripe';
$$;
create function private.economic_is_test_mode() returns boolean language sql stable security definer set search_path='' as $$
 select private.economic_runtime_mode()='test';
$$;
create function private.guard_economic_environment() returns trigger language plpgsql set search_path='' as $$
begin
 if new.runtime_mode is distinct from old.runtime_mode and (
   exists(select 1 from private.economic_orders) or exists(select 1 from private.billing_customers)
   or exists(select 1 from private.economic_webhook_events) or exists(select 1 from private.economic_provider_catalog)
 ) then raise exception using errcode='55000',message='economic_environment_has_records_use_separate_database'; end if;
 if new.runtime_mode='live' and (new.review_status<>'passed' or new.account_reference is null) then
   raise exception using errcode='55000',message='economic_live_account_approval_required'; end if;
 return new;
end;
$$;
create trigger economic_environment_isolation before update on private.economic_provider_readiness for each row execute function private.guard_economic_environment();

create or replace function private.economic_caller_is_service_role()
returns boolean language sql stable security definer set search_path='' as $$
 select (coalesce(auth.role()='service_role',false) or coalesce(current_setting('request.jwt.claim.role',true),'')='service_role')
 and (private.economic_is_test_mode() or (
  coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-elysia-billing-mode','')='live'
  and coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-elysia-stripe-account','')=
   (select account_reference from private.economic_provider_readiness where provider='stripe')
 ));
$$;

create or replace function private.economic_feature_enabled(p_feature_key text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare f private.economic_feature_flags%rowtype; p private.economic_provider_readiness%rowtype;
begin
 -- Immutable program boundary, independent of configurable switches.
 if p_feature_key in ('marketplace_paid_offers','marketplace_seller_onboarding','marketplace_payout_preparation','marketplace_payouts','sandbox_credit_purchase') then return false; end if;
 select * into f from private.economic_feature_flags where feature_key=p_feature_key;
 if f.enabled is distinct from true then return false; end if;
 if p_feature_key in ('sandbox_credit_display','sandbox_credit_enforcement') then return true; end if;
 if private.economic_is_test_mode() then return f.test_mode_only; end if;
 select * into p from private.economic_provider_readiness where provider='stripe';
 if p.review_status<>'passed' or p.account_reference is null then return false; end if;
 -- Management and reconciliation remain available during acquisition pauses.
 if p_feature_key in ('customer_portal','economic_webhooks','test_refund_execution') then return true; end if;
 if p_feature_key in ('support_checkout','recurring_support','job_post_fee_enforcement','organization_billing','sponsorship_checkout') then
   if not exists(select 1 from private.economic_feature_flags where feature_key='live_stripe' and enabled) then return false;end if;
   return p.webhook_verified_at is not null and p.event_coverage_verified_at is not null
    and p.receipt_configuration_verified_at is not null and p.last_preflight_at is not null
    and f.sandbox_qualified_at is not null and nullif(f.sandbox_evidence_ref,'') is not null
    and nullif(f.tax_decision_ref,'') is not null and f.tax_behavior='disabled'
    and f.legal_qualified_at is not null and f.rollout_authorized_at is not null
    and (p_feature_key<>'recurring_support' or p.portal_configuration_verified_at is not null);
 end if;
 return f.enabled;
end;
$$;

-- Provider mode is explicit on all authoritative monetary/event records.
alter table private.economic_orders add column provider_environment text not null default private.economic_runtime_mode() check(provider_environment in ('test','live'));
alter table private.economic_payment_transactions add column provider_environment text not null default private.economic_runtime_mode() check(provider_environment in ('test','live'));
alter table private.economic_subscriptions add column provider_environment text not null default private.economic_runtime_mode() check(provider_environment in ('test','live'));
alter table private.economic_refunds add column provider_environment text not null default private.economic_runtime_mode() check(provider_environment in ('test','live'));
alter table private.economic_disputes add column provider_environment text not null default private.economic_runtime_mode() check(provider_environment in ('test','live'));
alter table private.economic_webhook_events add column provider_environment text not null default private.economic_runtime_mode() check(provider_environment in ('test','live'));
alter table private.economic_provider_catalog drop constraint economic_provider_catalog_test_only_check;
create function private.guard_economic_record_environment() returns trigger language plpgsql set search_path='' as $$
begin
 if new.provider_environment is distinct from private.economic_runtime_mode() then
  raise exception using errcode='42501',message='economic_record_environment_mismatch'; end if;
 if tg_op='UPDATE' and new.provider_environment is distinct from old.provider_environment then
  raise exception using errcode='42501',message='economic_record_environment_immutable'; end if;
 return new;
end;
$$;
create trigger economic_record_environment before insert or update on private.economic_orders for each row execute function private.guard_economic_record_environment();
create trigger economic_record_environment before insert or update on private.economic_payment_transactions for each row execute function private.guard_economic_record_environment();
create trigger economic_record_environment before insert or update on private.economic_subscriptions for each row execute function private.guard_economic_record_environment();
create trigger economic_record_environment before insert or update on private.economic_refunds for each row execute function private.guard_economic_record_environment();
create trigger economic_record_environment before insert or update on private.economic_disputes for each row execute function private.guard_economic_record_environment();
create trigger economic_record_environment before insert or update on private.economic_webhook_events for each row execute function private.guard_economic_record_environment();
-- Late settlement enrichment is append-only, like the payment it describes.
create table private.economic_provider_settlements (
 id uuid primary key default gen_random_uuid(),
 payment_transaction_id uuid not null references private.economic_payment_transactions(id),
 provider_event_reference text not null,
 provider_environment text not null default private.economic_runtime_mode() check(provider_environment in ('test','live')),
 receipt_url text check(receipt_url is null or receipt_url ~ '^https://pay[.]stripe[.]com/[^[:space:]]+$'),
 balance_transaction_reference text,
 processor_fee_minor bigint, net_amount_minor bigint,
 completeness integer not null check(completeness between 1 and 3),
 created_at timestamptz not null default now(),
 unique(payment_transaction_id,provider_event_reference,completeness),
 check((processor_fee_minor is null)=(net_amount_minor is null)),
 check((processor_fee_minor is null and net_amount_minor is null) or (processor_fee_minor>=0 and net_amount_minor>=0))
);
alter table private.economic_provider_settlements enable row level security;
revoke all on private.economic_provider_settlements from public,anon,authenticated,service_role;
create trigger provider_settlement_append_only before update or delete on private.economic_provider_settlements for each row execute function private.prevent_economic_history_mutation();
create trigger economic_record_environment before insert or update on private.economic_provider_settlements for each row execute function private.guard_economic_record_environment();
create function private.record_economic_provider_settlement(p_event jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare tx private.economic_payment_transactions%rowtype; fee bigint; net bigint; url text; completeness integer;
begin
 if not private.economic_caller_is_service_role() then raise exception using errcode='42501',message='economic_service_role_required'; end if;
 if p_event->>'providerPaymentId' is null then return; end if;
 select * into tx from private.economic_payment_transactions where provider='stripe'
  and provider_transaction_reference=p_event->>'providerPaymentId' and transaction_type='payment' and status='succeeded' for update;
 if not found then return; end if;
 if tx.provider_environment<>private.economic_runtime_mode() or tx.gross_amount_minor<>(p_event->>'amountMinor')::bigint
  or tx.currency<>p_event->>'currency' then raise exception using errcode='22023',message='provider_settlement_scope_mismatch'; end if;
 fee:=(p_event->>'processorFeeMinor')::bigint; net:=(p_event->>'netAmountMinor')::bigint; url:=p_event->>'providerReceiptUrl';
 if (fee is null)<>(net is null) or fee<0 or net<0 or (fee+net)<>tx.gross_amount_minor then
  raise exception using errcode='22023',message='provider_settlement_amount_mismatch'; end if;
 if fee is not null and (exists(select 1 from private.economic_provider_settlements e where e.payment_transaction_id=tx.id and e.processor_fee_minor<>fee)
  or (tx.processor_fee_minor is not null and tx.processor_fee_minor<>fee)) then
  raise exception using errcode='22023',message='provider_settlement_conflict'; end if;
 completeness:=(case when fee is not null then 2 else 0 end)+(case when url is not null then 1 else 0 end);
 if completeness=0 then return; end if;
 insert into private.economic_provider_settlements(payment_transaction_id,provider_event_reference,receipt_url,balance_transaction_reference,processor_fee_minor,net_amount_minor,completeness)
 values(tx.id,p_event->>'providerEventId',url,p_event->>'providerBalanceTransactionId',fee,net,completeness) on conflict do nothing;
 if found then
  insert into private.economic_audit_events(actor_kind,action,target_type,target_id,metadata)
   values('provider_webhook','provider_settlement_confirmed','economic_payment_transaction',tx.id,
    jsonb_build_object('event_reference',p_event->>'providerEventId','payload_sha256',p_event->>'payloadSha256','receipt_available',url is not null,'processor_fee_known',fee is not null));
 end if;
end;
$$;
revoke all on function private.record_economic_provider_settlement(jsonb) from public,anon,authenticated,service_role;
create function private.economic_payment_settlement(p_transaction_id uuid)
returns table(receipt_url text,processor_fee_minor bigint,net_amount_minor bigint)
language sql stable security definer set search_path='' as $$
 select (select e.receipt_url from private.economic_provider_settlements e where e.payment_transaction_id=p_transaction_id and e.receipt_url is not null order by created_at desc,id desc limit 1),
 (select e.processor_fee_minor from private.economic_provider_settlements e where e.payment_transaction_id=p_transaction_id and e.processor_fee_minor is not null order by created_at desc,id desc limit 1),
 (select e.net_amount_minor from private.economic_provider_settlements e where e.payment_transaction_id=p_transaction_id and e.net_amount_minor is not null order by created_at desc,id desc limit 1);
$$;
revoke all on function private.economic_payment_settlement(uuid) from public,anon,authenticated,service_role;

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
        'test_mode', private.economic_is_test_mode()
      )
    );
    v_expired := v_expired + 1;
  end loop;
  return v_expired;
end;
$$;

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

  if p_flow not in ('support_one_time','support_recurring','job_post_fee','organization_service','sponsorship') then
    raise exception using errcode='42501',message='third_party_money_hard_off';
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
    'checkoutExpiresAt', v_existing.checkout_expires_at,
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
          and catalog.active = true and catalog.test_mode = private.economic_is_test_mode() and catalog.retired_at is null
      ),
      'providerPriceReference', (
        select catalog.provider_price_reference
        from private.economic_provider_catalog as catalog
        where catalog.provider = 'stripe' and catalog.price_code = p_price_code
          and catalog.active = true and catalog.test_mode = private.economic_is_test_mode() and catalog.retired_at is null
      ),
      'status', v_existing.status,
      'idempotentReplay', true,
      'testMode', private.economic_is_test_mode()
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
      'test_mode', private.economic_is_test_mode(),
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
    pg_catalog.jsonb_build_object('flow', p_flow, 'test_mode', private.economic_is_test_mode())
  );

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, metadata
  ) values (
    p_actor_user_id,
    case when p_actor_user_id is null then 'system' else 'user' end,
    'checkout_prepared',
    'economic_order',
    v_order.id,
    pg_catalog.jsonb_build_object('flow', p_flow, 'test_mode', private.economic_is_test_mode())
  );

  return pg_catalog.jsonb_build_object(
    'orderId', v_order.id,
    'publicReference', v_order.public_reference,
    'checkoutExpiresAt', v_order.checkout_expires_at,
    'idempotencyKey', 'checkout:' || p_client_request_id::text,
    'amountMinor', v_order.total_minor,
    'currency', v_order.currency,
    'providerCustomerReference', null,
    'providerProductReference', (
      select catalog.provider_product_reference
      from private.economic_provider_catalog as catalog
      where catalog.provider = 'stripe' and catalog.price_code = p_price_code
        and catalog.active = true and catalog.test_mode = private.economic_is_test_mode() and catalog.retired_at is null
    ),
    'providerPriceReference', (
      select catalog.provider_price_reference
      from private.economic_provider_catalog as catalog
      where catalog.provider = 'stripe' and catalog.price_code = p_price_code
        and catalog.active = true and catalog.test_mode = private.economic_is_test_mode() and catalog.retired_at is null
    ),
    'status', v_order.status,
    'idempotentReplay', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
    p_user_id, p_provider, p_provider_customer_reference, 'active', private.economic_is_test_mode()
  ) returning * into v_customer;

  return v_customer.id;
end;
$$;

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
      'testMode', private.economic_is_test_mode()
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
      'test_mode', private.economic_is_test_mode()
    )
  );
  return pg_catalog.jsonb_build_object(
    'orderId', v_order.id,
    'status', 'pending',
    'idempotentReplay', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
        'testMode', private.economic_is_test_mode()
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
      'test_mode', private.economic_is_test_mode()
    )
  );

  return pg_catalog.jsonb_build_object(
    'orderId', p_order_id,
    'status', 'checkout_created',
    'idempotentReplay', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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

  if (p_normalized_event ->> 'livemode')::boolean is distinct from (not private.economic_is_test_mode()) then
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

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_provider_event_id,0));

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
      perform private.record_economic_provider_settlement(p_normalized_event);
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
      'test_mode', private.economic_is_test_mode()
    )
  );

  perform private.record_economic_provider_settlement(p_normalized_event);
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
    'testMode', private.economic_is_test_mode()
  ) || case
    when v_order.user_id is not null then pg_catalog.jsonb_build_object(
      'amountMinor', v_order.total_minor,
      'currency', v_order.currency
    )
    else '{}'::jsonb
  end;
end;
$$;

create or replace function public.current_user_economic_account_summary()
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
    'testMode', private.economic_is_test_mode(),
    'orders', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'publicReference', recent.public_reference, 'flow', recent.flow,
      'status', recent.status, 'amountMinor', recent.total_minor,
      'currency', recent.currency, 'createdAt', recent.created_at,
      'paidAt', recent.paid_at, 'refundedAt', recent.refunded_at
    ) order by recent.created_at desc) from (
      select * from private.economic_orders where user_id = v_actor
      order by created_at desc limit 50
    ) as recent), '[]'::jsonb),
    'paymentTransactions', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'transactionId', recent_payment.id,
        'publicReference', recent_payment.public_reference,
        'flow', recent_payment.flow,
        'status', recent_payment.status,
        'amountMinor', recent_payment.gross_amount_minor,
        'currency', recent_payment.currency,
        'occurredAt', recent_payment.occurred_at,
        'receiptAvailable', false,
        'providerIdentifiersExposed', false
      ) order by recent_payment.occurred_at desc, recent_payment.id desc
    ) from (
      select transaction.id, economic_order.public_reference, economic_order.flow,
        transaction.status, transaction.gross_amount_minor,
        transaction.currency, transaction.occurred_at
      from private.economic_payment_transactions as transaction
      left join lateral private.economic_payment_settlement(transaction.id) settlement on true
      join private.economic_orders as economic_order on economic_order.id = transaction.order_id
      where economic_order.user_id = v_actor
        and transaction.transaction_type = 'payment'
      order by transaction.occurred_at desc, transaction.id desc
      limit 100
    ) as recent_payment), '[]'::jsonb),
    'subscriptions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'status', subscription.status,
      'cancelAtPeriodEnd', subscription.cancel_at_period_end,
      'currentPeriodEnd', subscription.current_period_end,
      'graceEndsAt', subscription.grace_ends_at,
      'amountMinor', price.unit_amount_minor,
      'currency', price.currency
    ) order by subscription.updated_at desc)
      from private.economic_subscriptions as subscription
      join private.economic_prices as price on price.id = subscription.price_id
      where subscription.user_id = v_actor), '[]'::jsonb),
    'receipts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'transactionId', recent_receipt.id,
      'publicReference', recent_receipt.public_reference,
      'flow', recent_receipt.flow, 'status', recent_receipt.status,
      'amountMinor', recent_receipt.gross_amount_minor,
      'currency', recent_receipt.currency,
      'occurredAt', recent_receipt.occurred_at,
      'recordVersion', 'payment-record-v1',
      'payee', case when recent_receipt.flow = 'marketplace_purchase' then null else 'EcoSyneva Commons LLC' end,
      'orderStatus', recent_receipt.order_status,
      'refundedAmountMinor', recent_receipt.refunded_amount_minor,
      'receiptUrl', recent_receipt.receipt_url,
      'testMode', private.economic_is_test_mode(),
      'receiptAvailable', recent_receipt.receipt_url is not null,
      'providerIdentifiersExposed', false
    ) order by recent_receipt.occurred_at desc, recent_receipt.id desc) from (
      select transaction.id, economic_order.public_reference, economic_order.flow,
        transaction.status, transaction.gross_amount_minor,
        transaction.currency, transaction.occurred_at, settlement.receipt_url, economic_order.status as order_status,
        (select coalesce(sum(refund.amount_minor), 0) from private.economic_refunds refund
          where refund.payment_transaction_id = transaction.id and refund.order_id = economic_order.id
            and refund.currency = transaction.currency and refund.status = 'succeeded') as refunded_amount_minor
      from private.economic_payment_transactions as transaction
      left join lateral private.economic_payment_settlement(transaction.id) settlement on true
      join private.economic_orders as economic_order on economic_order.id = transaction.order_id
      where economic_order.user_id = v_actor
        and transaction.transaction_type = 'payment'
      order by transaction.occurred_at desc, transaction.id desc
      limit 100
    ) as recent_receipt), '[]'::jsonb),
    'sandboxCredits', public.current_user_sandbox_credit_summary(),
    'marketplacePurchases', public.current_user_marketplace_purchases(),
    'marketplaceSeller', public.current_user_economic_seller_status(),
    'jobPosts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'jobPostId', condition.job_post_id,
      'classification', condition.classification,
      'status', condition.condition_status,
      'amountMinor', price.unit_amount_minor,
      'currency', price.currency,
      'termsVersion', condition.terms_version
    ) order by condition.updated_at desc)
      from private.job_post_economic_conditions as condition
      left join private.economic_prices as price on price.id = condition.price_id
      where condition.author_user_id = v_actor), '[]'::jsonb),
    'assistance', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'scope', grant_record.scope, 'status', grant_record.status,
      'expiresAt', grant_record.expires_at,
      'publiclyVisible', false
    ) order by grant_record.granted_at desc)
      from private.economic_assistance_grants as grant_record
      where grant_record.beneficiary_user_id = v_actor), '[]'::jsonb),
    'recognition', coalesce((select pg_catalog.jsonb_build_object(
      'optedIn', preference.opted_in,
      'eligible', exists (
        select 1 from private.economic_orders as support_order
        where support_order.user_id = v_actor
          and support_order.flow in ('support_one_time', 'support_recurring')
          and support_order.status in ('paid', 'partially_refunded')
      ),
      'eligibilityRevokedAt', preference.eligibility_revoked_at,
      'eligibilityExpiresAt', preference.eligibility_expires_at,
      'publicDisplayEnabled', private.economic_feature_enabled('public_support_recognition'),
      'amountsPublic', false, 'grantsAuthority', false
    ) from private.economic_support_recognition_preferences as preference
      where preference.user_id = v_actor), pg_catalog.jsonb_build_object(
        'optedIn', false,
        'eligible', exists (
          select 1 from private.economic_orders as support_order
          where support_order.user_id = v_actor
            and support_order.flow in ('support_one_time', 'support_recurring')
            and support_order.status in ('paid', 'partially_refunded')
        ),
        'eligibilityRevokedAt', null,
        'eligibilityExpiresAt', null,
        'publicDisplayEnabled', private.economic_feature_enabled('public_support_recognition'),
        'amountsPublic', false, 'grantsAuthority', false
      )),
    'accountRequests', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'requestId', request.id, 'requestType', request.request_type,
      'status', request.status, 'submittedAt', request.submitted_at,
      'providerCancellationRequired', request.provider_cancellation_required,
      'financialRecordsRetained', true, 'authProfileUnchanged', true
    ) order by request.submitted_at desc)
      from private.economic_account_action_requests as request
      where request.user_id = v_actor), '[]'::jsonb),
    'activeRestrictions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'scope', restriction.scope, 'reasonCode', restriction.reason_code,
      'expiresAt', restriction.expires_at
    ) order by restriction.imposed_at desc)
      from private.economic_service_restrictions as restriction
      where restriction.user_id = v_actor and restriction.lifted_at is null
        and (restriction.expires_at is null or restriction.expires_at > pg_catalog.now())), '[]'::jsonb),
    'closureReadiness', private.economic_account_closure_obligations(v_actor),
    'warnings', (
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'code', 'order_failed',
        'publicReference', failed_order.public_reference,
        'guidance', 'Review the failed checkout or begin a new checkout. Community standing is unchanged.'
      ) order by failed_order.updated_at desc) from (
        select * from private.economic_orders
        where user_id = v_actor and status = 'failed'
        order by updated_at desc limit 10
      ) as failed_order), '[]'::jsonb)
      ||
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'code', 'subscription_attention_required',
        'guidance', 'Open billing management to review or cancel recurring support. Community standing is unchanged.'
      ) order by attention.updated_at desc) from (
        select * from private.economic_subscriptions
        where user_id = v_actor and status in ('past_due', 'grace_period', 'incomplete')
        order by updated_at desc limit 10
      ) as attention), '[]'::jsonb)
      ||
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'code', 'marketplace_fulfillment_review',
        'publicReference', held.public_reference,
        'guidance', 'Payment completed, but Marketplace fulfillment was safely held for private review and refund. No add-on was installed and community standing is unchanged.'
      ) order by held.created_at desc) from (
        select hold.created_at, held_order.public_reference
        from private.marketplace_fulfillment_holds as hold
        join private.economic_orders as held_order on held_order.id = hold.order_id
        where hold.buyer_user_id = v_actor and hold.status = 'refund_required'
        order by hold.created_at desc limit 10
      ) as held), '[]'::jsonb)
      ||
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'code', 'job_post_payment_review',
        'publicReference', held.public_reference,
        'guidance', 'Payment completed after the Job Post was no longer eligible. Publication was withheld and a private full-refund review is required; community standing is unchanged.'
      ) order by held.opened_at desc) from (
        select hold.opened_at, held_order.public_reference
        from private.job_post_payment_holds as hold
        join private.economic_orders as held_order on held_order.id = hold.order_id
        where hold.author_user_id = v_actor and hold.status = 'refund_required'
        order by hold.opened_at desc limit 10
      ) as held), '[]'::jsonb)
      ||
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'code', held.warning_code,
        'publicReference', held.public_reference,
        'guidance', held.guidance
      ) order by held.opened_at desc) from (
        select hold.opened_at, held_order.public_reference,
          case when hold.organization_service_engagement_id is not null
            then 'organization_service_payment_review'
            else 'sponsorship_payment_review' end as warning_code,
          case when hold.organization_service_engagement_id is not null
            then 'Payment settled after the organization service engagement became ineligible or terminal. Service activation was withheld and a private full-refund review is required; community standing is unchanged.'
            else 'Payment settled after the sponsorship agreement became ineligible or terminal. Sponsorship activation and recognition were withheld and a private full-refund review is required; community standing is unchanged.' end as guidance
        from private.organization_sponsorship_settlement_holds as hold
        join private.economic_orders as held_order on held_order.id = hold.order_id
        left join private.organization_service_engagements as engagement
          on engagement.id = hold.organization_service_engagement_id
        left join private.sponsorship_agreements as sponsorship
          on sponsorship.id = hold.sponsorship_agreement_id
        where hold.status = 'open'
          and (engagement.authorized_signer_user_id = v_actor
            or sponsorship.authorized_signer_user_id = v_actor)
        order by hold.opened_at desc limit 10
      ) as held), '[]'::jsonb)
    ),
    'providerIdentifiersExposed', false,
    'moneyDoesNotGrantAuthority', true
  );
end;
$$;

create or replace function public.economic_public_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'testModeOnly', private.economic_is_test_mode(),
    'livePaymentsEnabled', not private.economic_is_test_mode() and (private.economic_feature_enabled('support_checkout') or private.economic_feature_enabled('recurring_support') or private.economic_feature_enabled('job_post_fee_enforcement') or private.economic_feature_enabled('organization_billing') or private.economic_feature_enabled('sponsorship_checkout')),
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
      'testModeOnly', private.economic_is_test_mode(), 'idempotentReplay', true
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
    'testModeOnly', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

create or replace function public.record_economic_test_catalog_reference(
  p_product_key text,
  p_price_code text,
  p_provider text,
  p_provider_product_id text,
  p_provider_price_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price private.economic_prices%rowtype;
  v_catalog private.economic_provider_catalog%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  if coalesce(p_provider, '') !~ '^[a-z][a-z0-9_]{1,40}$'
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_provider_product_id, ''))) not between 1 and 255
     or ((p_price_code is null) <> (nullif(pg_catalog.btrim(coalesce(p_provider_price_id, '')), '') is null))
     or (
       p_provider_price_id is not null
       and pg_catalog.char_length(pg_catalog.btrim(p_provider_price_id)) not between 1 and 255
     ) then
    raise exception using errcode = '22023', message = 'economic_provider_catalog_reference_invalid';
  end if;

  if p_price_code is null then
    if p_product_key not in ('support_one_time','job_post_fee','organization_service','sponsorship')
       or not exists (
         select 1 from private.economic_products as product
         where product.product_key = p_product_key
           and product.active = true
           and product.test_mode_only = true
       ) then
      raise exception using errcode = 'P0002', message = 'economic_test_product_not_found';
    end if;
  else
    select * into v_price
    from private.economic_prices as price
    where price.price_code = p_price_code
      and price.product_key = p_product_key
      and price.test_mode_only = true
      and price.active = true
      and price.retired_at is null;

    if not found then
      raise exception using errcode = 'P0002', message = 'economic_test_price_not_found';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_provider || ':' || p_product_key || ':' || coalesce(p_price_code, 'product-only'), 0)
  );

  select * into v_catalog
  from private.economic_provider_catalog as catalog
  where catalog.provider = p_provider
    and (
      (p_price_code is not null and catalog.price_code = p_price_code)
      or (p_price_code is null and catalog.price_code is null and catalog.product_key = p_product_key)
    )
  for update;

  if found then
    update private.economic_provider_catalog
    set
      product_key = p_product_key,
      provider_product_reference = pg_catalog.btrim(p_provider_product_id),
      provider_price_reference = nullif(pg_catalog.btrim(coalesce(p_provider_price_id, '')), ''),
      test_mode = private.economic_is_test_mode(),
      active = true,
      retired_at = null,
      updated_at = pg_catalog.now()
    where id = v_catalog.id
    returning * into v_catalog;
  else
    insert into private.economic_provider_catalog (
      product_key, price_code, provider,
      provider_product_reference, provider_price_reference,
      test_mode, active
    ) values (
      p_product_key,
      p_price_code,
      p_provider,
      pg_catalog.btrim(p_provider_product_id),
      nullif(pg_catalog.btrim(coalesce(p_provider_price_id, '')), ''),
      private.economic_is_test_mode(),
      true
    ) returning * into v_catalog;
  end if;

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, metadata
  ) values (
    'system',
    'test_provider_catalog_reference_recorded',
    'economic_provider_catalog',
    v_catalog.id,
    pg_catalog.jsonb_build_object(
      'product_key', v_catalog.product_key,
      'price_code', v_catalog.price_code,
      'provider', v_catalog.provider,
      'test_mode', private.economic_is_test_mode()
    )
  );

  return pg_catalog.jsonb_build_object(
    'productKey', v_catalog.product_key,
    'priceCode', v_catalog.price_code,
    'provider', v_catalog.provider,
    'providerProductReference', v_catalog.provider_product_reference,
    'providerPriceReference', v_catalog.provider_price_reference,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.lookup_economic_test_catalog_reference(
  p_price_code text,
  p_provider text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_catalog private.economic_provider_catalog%rowtype;
  v_product_key text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  select price.product_key into v_product_key
  from private.economic_prices as price
  where price.price_code = p_price_code;

  select * into v_catalog
  from private.economic_provider_catalog as catalog
  where catalog.provider = p_provider
    and (
      catalog.price_code = p_price_code
      or (
        catalog.price_code is null
        and v_product_key in ('support_one_time','job_post_fee','organization_service','sponsorship')
        and catalog.product_key = v_product_key
      )
    )
    and catalog.test_mode = private.economic_is_test_mode()
    and catalog.active = true
    and catalog.retired_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'economic_test_catalog_reference_not_found';
  end if;

  return pg_catalog.jsonb_build_object(
    'productKey', v_catalog.product_key,
    'priceCode', v_catalog.price_code,
    'provider', v_catalog.provider,
    'providerProductReference', v_catalog.provider_product_reference,
    'providerPriceReference', v_catalog.provider_price_reference,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.begin_economic_checkout(
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
  v_catalog private.economic_provider_catalog%rowtype;
  v_result jsonb;
  v_product_key text;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;

  select price.product_key into v_product_key
  from private.economic_prices as price
  where price.price_code = p_price_code;

  select * into v_catalog
  from private.economic_provider_catalog as catalog
  where catalog.provider = 'stripe'
    and (
      catalog.price_code = p_price_code
      or (
        catalog.price_code is null
        and v_product_key in ('support_one_time','job_post_fee','organization_service','sponsorship')
        and catalog.product_key = v_product_key
      )
    )
    and catalog.test_mode = private.economic_is_test_mode()
    and catalog.active = true
    and catalog.retired_at is null
  order by catalog.price_code is null limit 1;

  if not found then
    raise exception using errcode = '55000', message = 'economic_test_catalog_not_configured';
  end if;

  v_result := private.begin_economic_checkout_core(
    p_actor_user_id,
    p_client_request_id,
    p_flow,
    p_amount_minor,
    p_currency,
    p_price_code,
    p_source_route,
    p_consent_version
  );

  return v_result || pg_catalog.jsonb_build_object(
    'providerProductReference', v_catalog.provider_product_reference,
    'providerPriceReference', v_catalog.provider_price_reference
  );
end;
$$;

create or replace function public.reconcile_sandbox_credit_expirations(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservations integer;
  v_units bigint;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '23503', message = 'sandbox_credit_user_not_found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  v_reservations := private.release_expired_sandbox_credit_reservations(p_user_id);
  v_units := private.expire_sandbox_credit_lots(p_user_id);
  return pg_catalog.jsonb_build_object(
    'userId', p_user_id,
    'releasedReservations', v_reservations,
    'expiredUnits', v_units,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.grant_sandbox_credit_units(
  p_user_id uuid,
  p_units bigint,
  p_source_type text,
  p_source_reference text,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot private.sandbox_credit_lots%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '23503', message = 'sandbox_credit_user_not_found';
  end if;
  if p_units is null or p_units not between 1 and 1000000000 then
    raise exception using errcode = '22023', message = 'sandbox_credit_units_invalid';
  end if;
  if p_source_type not in (
    'starter', 'recurring_support', 'purchased', 'sponsored',
    'waiver', 'waived', 'operational', 'operator', 'test'
  ) then
    raise exception using errcode = '22023', message = 'sandbox_credit_source_invalid';
  end if;
  if pg_catalog.char_length(coalesce(p_idempotency_key, '')) not between 8 and 255 then
    raise exception using errcode = '22023', message = 'sandbox_credit_idempotency_key_invalid';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sandbox_credit_reason_required';
  end if;
  if p_expires_at is not null and p_expires_at <= pg_catalog.now() then
    raise exception using errcode = '22023', message = 'sandbox_credit_expiration_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select * into v_lot
  from private.sandbox_credit_lots as lot
  where lot.idempotency_key = p_idempotency_key;

  if found then
    if v_lot.user_id <> p_user_id
       or v_lot.granted_units <> p_units
       or v_lot.source_category <> p_source_type
       or v_lot.source_reference is distinct from nullif(p_source_reference, '')
       or v_lot.expires_at is distinct from p_expires_at then
      raise exception using errcode = '23505', message = 'sandbox_credit_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'creditLotId', v_lot.id,
      'grantedUnits', v_lot.granted_units,
      'sourceCategory', v_lot.source_category,
      'expiresAt', v_lot.expires_at,
      'idempotentReplay', true,
      'testMode', private.economic_is_test_mode()
    );
  end if;

  insert into private.sandbox_credit_lots (
    user_id, source_category, source_reference, granted_units,
    idempotency_key, private_reason, expires_at
  ) values (
    p_user_id, p_source_type, nullif(p_source_reference, ''), p_units,
    p_idempotency_key, pg_catalog.btrim(p_reason), p_expires_at
  ) returning * into v_lot;

  insert into private.sandbox_credit_ledger_entries (
    user_id, credit_lot_id, entry_type, units_delta,
    balance_delta_units, reserved_delta_units,
    source_category, idempotency_key
  ) values (
    p_user_id, v_lot.id, 'grant', p_units,
    p_units, 0,
    p_source_type, 'ledger:' || p_idempotency_key
  );

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    'system', 'sandbox_credit_granted', 'sandbox_credit_lot', v_lot.id,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'user_id', p_user_id,
      'units', p_units,
      'source_category', p_source_type,
      'test_mode', private.economic_is_test_mode()
    )
  );

  return pg_catalog.jsonb_build_object(
    'creditLotId', v_lot.id,
    'grantedUnits', v_lot.granted_units,
    'sourceCategory', v_lot.source_category,
    'expiresAt', v_lot.expires_at,
    'idempotentReplay', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.bootstrap_economic_operator(
  p_actor_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.economic_operator_assignments%rowtype;
  v_stale_assignment private.economic_operator_assignments%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_operator_reason_required';
  end if;
  if p_actor_user_id is null
     or not exists (
       select 1
       from auth.users as account
       where account.id = p_actor_user_id
         and account.deleted_at is null
         and account.is_anonymous is false
         and (account.banned_until is null or account.banned_until <= pg_catalog.now())
     )
     -- The repository currently has two unresolved administrator sources.
     -- Bootstrap fails closed unless both independently agree; neither source
     -- alone may create the first finance operator.
     or not public.has_role(p_actor_user_id, 'administrator'::public.app_role)
     or not coalesce((
       select profile.is_admin
       from public.profiles as profile
       where profile.id = p_actor_user_id
     ), false) then
    raise exception using errcode = '42501', message = 'economic_operator_bootstrap_admin_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('economic-operator-bootstrap', 0));
  -- Explicit break-glass recovery closes expired or account-ineligible rows
  -- before deciding whether a capable assignment manager still exists. The
  -- service-role caller must still supply an account accepted by both existing
  -- administrator sources; every automatic closure is audited.
  for v_stale_assignment in
    select assignment.*
    from private.economic_operator_assignments as assignment
    join auth.users as account on account.id = assignment.user_id
    where assignment.revoked_at is null
      and (
        (assignment.expires_at is not null and assignment.expires_at <= pg_catalog.now())
        or account.deleted_at is not null
        or account.is_anonymous is true
        or (account.banned_until is not null and account.banned_until > pg_catalog.now())
      )
    for update of assignment
  loop
    update private.economic_operator_assignments
    set revoked_at = pg_catalog.now(), revoked_by = p_actor_user_id,
        revocation_reason = 'Explicit bootstrap recovery closed an expired or ineligible assignment.'
    where id = v_stale_assignment.id;
    insert into private.economic_audit_events (
      actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
    ) values (
      p_actor_user_id, 'economic_operator',
      'economic_operator_ineligible_assignment_closed',
      'economic_operator_assignment', v_stale_assignment.id,
      pg_catalog.btrim(p_reason),
      pg_catalog.jsonb_build_object(
        'target_user_id', v_stale_assignment.user_id,
        'capability', v_stale_assignment.capability,
        'break_glass_recovery', true,
        'test_mode', private.economic_is_test_mode()
      )
    );
  end loop;
  if exists (
    select 1 from private.economic_operator_assignments as assignment
    where assignment.capability = 'economic_operator_assignments_manage'
      and private.economic_operator_has_capability(
        assignment.user_id, 'economic_operator_assignments_manage'
      )
  ) then
    raise exception using errcode = '55000', message = 'economic_operator_bootstrap_closed';
  end if;

  insert into private.economic_operator_assignments (
    user_id, capability, granted_by, reason
  ) values (
    p_actor_user_id,
    'economic_operator_assignments_manage',
    p_actor_user_id,
    pg_catalog.btrim(p_reason)
  ) returning * into v_assignment;

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'economic_operator_bootstrapped',
    'economic_operator_assignment', v_assignment.id,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object('capability', v_assignment.capability, 'test_mode', private.economic_is_test_mode())
  );

  return pg_catalog.jsonb_build_object(
    'assignmentId', v_assignment.id,
    'userId', v_assignment.user_id,
    'capability', v_assignment.capability,
    'active', true,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.operator_prepare_test_refund(
  p_actor_user_id uuid,
  p_refund_request_id uuid,
  p_approval_client_request_id uuid,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.economic_refund_requests%rowtype;
  v_order private.economic_orders%rowtype;
  v_payment private.economic_payment_transactions%rowtype;
  v_provider_payment_reference text;
  v_refunded bigint;
  v_other_holds bigint;
begin
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'economic_refunds_manage'
  );
  if p_approval_client_request_id is null then
    raise exception using errcode = '22023', message = 'economic_client_request_id_required';
  end if;
  if p_confirmation is distinct from 'AUTHORIZE TEST REFUND' then
    raise exception using errcode = '22023', message = 'economic_test_refund_confirmation_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_refund_approval_reason_required';
  end if;
  if coalesce((
    select flag.enabled
    from private.economic_feature_flags as flag
    where flag.feature_key = 'live_stripe'
  ), false) then
    raise exception using errcode = '55000', message = 'economic_test_refund_path_disabled_in_live_mode';
  end if;
  if not private.economic_feature_enabled('test_refund_execution') then
    raise exception using errcode = '55000', message = 'economic_test_refund_execution_disabled';
  end if;

  select * into v_request
  from private.economic_refund_requests as request
  where request.id = p_refund_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_refund_request_not_found';
  end if;
  if v_request.requested_by = p_actor_user_id then
    raise exception using errcode = '42501', message = 'economic_refund_self_approval_prohibited';
  end if;

  if v_request.approval_client_request_id is not null then
    if v_request.approval_client_request_id <> p_approval_client_request_id
       or v_request.approved_by <> p_actor_user_id
       or v_request.approval_reason <> pg_catalog.btrim(p_reason)
       or v_request.approval_confirmation_version <> 'test-refund-v1' then
      raise exception using errcode = '23505', message = 'economic_refund_approval_idempotency_conflict';
    end if;

    select transaction.*
    into v_payment
    from private.economic_payment_transactions as transaction
    where transaction.id = v_request.payment_transaction_id
      and transaction.order_id = v_request.order_id
      and transaction.provider = 'stripe'
      and transaction.transaction_type = 'payment'
      and transaction.status in ('succeeded', 'refunded', 'disputed');
    v_provider_payment_reference := v_payment.provider_transaction_reference;

    return pg_catalog.jsonb_build_object(
      'refundRequestId', v_request.id,
      'orderId', v_request.order_id,
      'paymentTransactionId', v_request.payment_transaction_id,
      'provider', 'stripe',
      'providerPaymentReference', v_provider_payment_reference,
      'amountMinor', v_request.amount_minor,
      'currency', v_request.currency,
      'providerIdempotencyKey', 'refund:' || v_request.id::text,
      'status', v_request.status,
      'testMode', private.economic_is_test_mode(),
      'idempotentReplay', true
    );
  end if;

  if v_request.status <> 'held_for_review' then
    raise exception using errcode = '55000', message = 'economic_refund_request_not_held';
  end if;

  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = v_request.order_id
  for update;
  if not found or v_order.status not in ('paid', 'partially_refunded', 'disputed') then
    raise exception using errcode = '55000', message = 'economic_order_not_refundable';
  end if;
  if v_order.provider is distinct from 'stripe' then
    raise exception using errcode = '55000', message = 'economic_test_refund_provider_not_ready';
  end if;

  select transaction.*
  into v_payment
  from private.economic_payment_transactions as transaction
  where transaction.id = v_request.payment_transaction_id
    and transaction.order_id = v_order.id
    and transaction.provider = 'stripe'
    and transaction.transaction_type = 'payment'
    and transaction.status in ('succeeded', 'refunded', 'disputed');
  v_provider_payment_reference := v_payment.provider_transaction_reference;
  if v_provider_payment_reference is null then
    raise exception using errcode = '55000', message = 'economic_provider_payment_reference_missing';
  end if;

  select coalesce(pg_catalog.sum(refund.amount_minor), 0)
  into v_refunded
  from private.economic_refunds as refund
  where refund.payment_transaction_id = v_payment.id
    and refund.status in ('pending', 'succeeded');

  select coalesce(pg_catalog.sum(request.amount_minor), 0)
  into v_other_holds
  from private.economic_refund_requests as request
  where request.payment_transaction_id = v_payment.id
    and request.id <> v_request.id
    and request.status in ('held_for_review', 'approved_for_provider', 'provider_pending');

  if v_refunded + v_other_holds + v_request.amount_minor > v_payment.gross_amount_minor then
    raise exception using errcode = '22023', message = 'economic_refund_total_exceeds_payment';
  end if;

  update private.economic_refund_requests
  set
    status = 'approved_for_provider',
    approval_client_request_id = p_approval_client_request_id,
    approved_by = p_actor_user_id,
    approval_reason = pg_catalog.btrim(p_reason),
    approval_confirmation_version = 'test-refund-v1',
    approved_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where id = v_request.id
  returning * into v_request;

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'test_refund_approved_for_provider',
    'economic_refund_request', v_request.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'order_id', v_order.id,
      'payment_transaction_id', v_payment.id,
      'amount_minor', v_request.amount_minor,
      'currency', v_request.currency,
      'confirmation_version', 'test-refund-v1',
      'test_mode', private.economic_is_test_mode()
    )
  );

  -- This response is service-role-only and intentionally includes the provider
  -- payment reference needed by the server-to-server Stripe refund call. It is
  -- never an authenticated/browser projection.
  return pg_catalog.jsonb_build_object(
    'refundRequestId', v_request.id,
    'orderId', v_request.order_id,
    'paymentTransactionId', v_request.payment_transaction_id,
    'provider', 'stripe',
    'providerPaymentReference', v_provider_payment_reference,
    'amountMinor', v_request.amount_minor,
    'currency', v_request.currency,
    'providerIdempotencyKey', 'refund:' || v_request.id::text,
    'status', v_request.status,
    'testMode', private.economic_is_test_mode(),
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.attach_economic_test_refund_result(
  p_actor_user_id uuid,
  p_refund_request_id uuid,
  p_provider_attach_client_request_id uuid,
  p_provider_refund_reference text,
  p_provider_status text,
  p_provider_event_created_at timestamptz,
  p_provider_response_sha256 text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.economic_refund_requests%rowtype;
  v_order private.economic_orders%rowtype;
  v_existing_refund private.economic_refunds%rowtype;
  v_refund private.economic_refunds%rowtype;
  v_payment private.economic_payment_transactions%rowtype;
  v_other_refunds bigint;
  v_succeeded_refunds bigint;
  v_total_gross bigint;
begin
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'economic_refunds_manage'
  );
  if p_provider_attach_client_request_id is null then
    raise exception using errcode = '22023', message = 'economic_client_request_id_required';
  end if;
  if coalesce(p_provider_refund_reference, '') !~ '^re_[A-Za-z0-9_]{3,250}$'
     or p_provider_status not in ('pending', 'succeeded', 'failed', 'canceled')
     or coalesce(p_provider_response_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'economic_test_refund_provider_result_invalid';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_refund_attachment_reason_required';
  end if;
  if coalesce((
    select flag.enabled
    from private.economic_feature_flags as flag
    where flag.feature_key = 'live_stripe'
  ), false) then
    raise exception using errcode = '55000', message = 'economic_test_refund_path_disabled_in_live_mode';
  end if;
  if not private.economic_feature_enabled('test_refund_execution') then
    raise exception using errcode = '55000', message = 'economic_test_refund_execution_disabled';
  end if;

  select * into v_request
  from private.economic_refund_requests as request
  where request.id = p_refund_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_refund_request_not_found';
  end if;
  if v_request.requested_by = p_actor_user_id
     or v_request.approved_by is distinct from p_actor_user_id then
    raise exception using errcode = '42501', message = 'economic_refund_approved_operator_required';
  end if;

  if v_request.provider_attach_client_request_id is not null then
    if v_request.provider_attach_client_request_id <> p_provider_attach_client_request_id
       or v_request.provider_refund_reference <> p_provider_refund_reference
       or v_request.provider_response_sha256 <> p_provider_response_sha256
       or v_request.status <> (case p_provider_status
         when 'succeeded' then 'completed'
         when 'failed' then 'rejected'
         when 'canceled' then 'canceled'
         else 'provider_pending' end) then
      raise exception using errcode = '23505', message = 'economic_refund_attachment_idempotency_conflict';
    end if;
    select * into v_existing_refund
    from private.economic_refunds as refund
    where refund.provider = 'stripe'
      and refund.provider_refund_reference = p_provider_refund_reference;
    if not found
       or v_existing_refund.payment_transaction_id <> v_request.payment_transaction_id
       or v_existing_refund.status <> p_provider_status
       or v_existing_refund.provider_event_created_at <> p_provider_event_created_at
       or v_existing_refund.reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_refund_attachment_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'refundRequestId', v_request.id,
      'orderId', v_request.order_id,
      'paymentTransactionId', v_request.payment_transaction_id,
      'status', v_request.status,
      'providerStatus', case
        when v_request.status = 'completed' then 'succeeded'
        when v_request.status = 'rejected' then 'failed'
        when v_request.status = 'canceled' then 'canceled'
        else 'pending'
      end,
      'testMode', private.economic_is_test_mode(),
      'idempotentReplay', true
    );
  end if;

  if v_request.status <> 'approved_for_provider' then
    raise exception using errcode = '55000', message = 'economic_refund_not_approved_for_provider';
  end if;
  if p_provider_event_created_at is null
     or p_provider_event_created_at > pg_catalog.now() + interval '5 minutes'
     or p_provider_event_created_at < v_request.approved_at - interval '5 minutes' then
    raise exception using errcode = '22023', message = 'economic_refund_provider_timestamp_invalid';
  end if;

  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = v_request.order_id
  for update;
  if not found or v_order.provider is distinct from 'stripe' then
    raise exception using errcode = '55000', message = 'economic_test_refund_provider_not_ready';
  end if;
  select * into v_payment
  from private.economic_payment_transactions as transaction
  where transaction.id = v_request.payment_transaction_id
    and transaction.order_id = v_order.id
    and transaction.provider = 'stripe'
    and transaction.transaction_type = 'payment'
    and transaction.status in ('succeeded', 'refunded', 'disputed')
  for update;
  if not found or v_payment.provider_transaction_reference is null then
    raise exception using errcode = '55000', message = 'economic_refund_payment_not_refundable';
  end if;

  select * into v_existing_refund
  from private.economic_refunds as refund
  where refund.provider = 'stripe'
    and refund.provider_refund_reference = p_provider_refund_reference
  for update;
  if found and (
    v_existing_refund.order_id <> v_order.id
    or v_existing_refund.payment_transaction_id <> v_payment.id
    or v_existing_refund.amount_minor <> v_request.amount_minor
    or v_existing_refund.currency <> v_request.currency
  ) then
    raise exception using errcode = '23505', message = 'economic_refund_reference_conflict';
  end if;

  select coalesce(pg_catalog.sum(refund.amount_minor), 0)
  into v_other_refunds
  from private.economic_refunds as refund
  where refund.payment_transaction_id = v_payment.id
    and refund.status in ('pending', 'succeeded')
    and not (
      refund.provider = 'stripe'
      and refund.provider_refund_reference = p_provider_refund_reference
    );
  if p_provider_status in ('pending', 'succeeded')
     and v_other_refunds + v_request.amount_minor > v_payment.gross_amount_minor then
    raise exception using errcode = '22023', message = 'economic_refund_total_exceeds_payment';
  end if;

  insert into private.economic_refunds (
    order_id, payment_transaction_id, provider, provider_refund_reference, amount_minor,
    currency, status, reason, requested_by, provider_event_created_at
  ) values (
    v_order.id, v_payment.id, 'stripe', p_provider_refund_reference, v_request.amount_minor,
    v_request.currency, p_provider_status, pg_catalog.btrim(p_reason),
    v_request.requested_by, p_provider_event_created_at
  )
  on conflict (provider, provider_refund_reference)
  do update set
    status = excluded.status,
    reason = excluded.reason,
    provider_event_created_at = excluded.provider_event_created_at,
    updated_at = pg_catalog.now()
  where private.economic_refunds.provider_event_created_at is null
     or private.economic_refunds.provider_event_created_at <= excluded.provider_event_created_at
  returning * into v_refund;

  if v_refund.id is null then
    select * into v_refund
    from private.economic_refunds as refund
    where refund.provider = 'stripe'
      and refund.provider_refund_reference = p_provider_refund_reference;
  end if;

  update private.economic_refund_requests
  set
    status = case p_provider_status
      when 'succeeded' then 'completed'
      when 'failed' then 'rejected'
      when 'canceled' then 'canceled'
      else 'provider_pending'
    end,
    provider_attach_client_request_id = p_provider_attach_client_request_id,
    provider_refund_reference = p_provider_refund_reference,
    provider_response_sha256 = p_provider_response_sha256,
    provider_attached_by = p_actor_user_id,
    provider_attached_at = pg_catalog.now(),
    completed_at = case when p_provider_status = 'succeeded' then pg_catalog.now() else null end,
    updated_at = pg_catalog.now()
  where id = v_request.id
  returning * into v_request;

  select coalesce(pg_catalog.sum(refund.amount_minor), 0)
  into v_succeeded_refunds
  from private.economic_refunds as refund
  where refund.order_id = v_order.id
    and refund.status = 'succeeded';
  select coalesce(pg_catalog.sum(transaction.gross_amount_minor), 0)
  into v_total_gross
  from private.economic_payment_transactions as transaction
  where transaction.order_id = v_order.id
    and transaction.transaction_type = 'payment'
    and transaction.status in ('succeeded', 'refunded', 'disputed');

  if not exists (
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
        when v_succeeded_refunds >= v_total_gross then 'refunded'
        when v_succeeded_refunds > 0 then 'partially_refunded'
        else 'paid'
      end,
      refunded_at = case
        when v_succeeded_refunds >= v_total_gross then coalesce(refunded_at, p_provider_event_created_at)
        else refunded_at
      end,
      updated_at = pg_catalog.now()
    where id = v_order.id;
  end if;

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'test_refund_provider_result_attached',
    'economic_refund_request', v_request.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'order_id', v_order.id,
      'payment_transaction_id', v_payment.id,
      'economic_refund_id', v_refund.id,
      'provider_status', p_provider_status,
      'amount_minor', v_request.amount_minor,
      'currency', v_request.currency,
      'test_mode', private.economic_is_test_mode()
    )
  );

  return pg_catalog.jsonb_build_object(
    'refundRequestId', v_request.id,
    'orderId', v_request.order_id,
    'paymentTransactionId', v_request.payment_transaction_id,
    'economicRefundId', v_refund.id,
    'status', v_request.status,
    'providerStatus', p_provider_status,
    'testMode', private.economic_is_test_mode(),
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.current_user_economic_operator_overview()
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
    'authorized', exists (select 1 from private.economic_operator_assignments
      where user_id = v_actor and revoked_at is null
        and (expires_at is null or expires_at > pg_catalog.now())),
    'capabilities', coalesce((select pg_catalog.jsonb_agg(capability order by capability)
      from private.economic_operator_assignments
      where user_id = v_actor and revoked_at is null
        and (expires_at is null or expires_at > pg_catalog.now())), '[]'::jsonb),
    'queueLimit', 10,
    'orderQueue', case when private.economic_operator_has_capability(v_actor, 'economic_orders_view') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'orderId', item.id, 'publicReference', item.public_reference,
        'flow', item.flow, 'status', item.status,
        'amountMinor', item.total_minor, 'currency', item.currency,
        'createdAt', item.created_at
      ) order by item.created_at desc) from (
        select * from private.economic_orders order by created_at desc limit 10
      ) as item), '[]'::jsonb) else null end,
    'paymentQueue', case when private.economic_operator_has_capability(v_actor, 'economic_payments_view') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'paymentTransactionId', item.id, 'orderId', item.order_id,
        'publicReference', item.public_reference, 'flow', item.flow,
        'status', item.status, 'grossAmountMinor', item.gross_amount_minor,
        'processorFeeMinor', item.processor_fee_minor,
        'netAmountMinor', item.net_amount_minor, 'currency', item.currency,
        'occurredAt', item.occurred_at
      ) order by item.occurred_at desc, item.id desc) from (
        select transaction.id, transaction.order_id, economic_order.public_reference,
          economic_order.flow, transaction.status, transaction.gross_amount_minor,
          coalesce(transaction.processor_fee_minor,settlement.processor_fee_minor) as processor_fee_minor, coalesce(transaction.net_amount_minor,settlement.net_amount_minor) as net_amount_minor,
          transaction.currency, transaction.occurred_at
        from private.economic_payment_transactions as transaction
        left join lateral private.economic_payment_settlement(transaction.id) settlement on true
        join private.economic_orders as economic_order on economic_order.id = transaction.order_id
        where transaction.transaction_type = 'payment'
        order by transaction.occurred_at desc, transaction.id desc limit 10
      ) as item), '[]'::jsonb) else null end,
    'refundablePaymentQueue', case when private.economic_operator_has_capability(v_actor, 'economic_refunds_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'paymentTransactionId', item.id, 'orderId', item.order_id,
        'publicReference', item.public_reference, 'flow', item.flow,
        'status', item.status, 'grossAmountMinor', item.gross_amount_minor,
        'refundableAmountMinor', item.refundable_amount_minor,
        'currency', item.currency, 'occurredAt', item.occurred_at
      ) order by item.occurred_at desc, item.id desc) from (
        select candidate.* from (
          select transaction.id, transaction.order_id, economic_order.public_reference,
            economic_order.flow, transaction.status, transaction.gross_amount_minor,
            transaction.currency, transaction.occurred_at,
            greatest(
              transaction.gross_amount_minor
                - coalesce(provider_refund.amount_minor, 0)
                - coalesce(operator_hold.amount_minor, 0),
              0
            ) as refundable_amount_minor
          from private.economic_payment_transactions as transaction
          join private.economic_orders as economic_order on economic_order.id = transaction.order_id
          left join lateral (
            select pg_catalog.sum(refund.amount_minor) as amount_minor
            from private.economic_refunds as refund
            where refund.payment_transaction_id = transaction.id
              and refund.status in ('pending', 'succeeded')
          ) as provider_refund on true
          left join lateral (
            select pg_catalog.sum(request.amount_minor) as amount_minor
            from private.economic_refund_requests as request
            where request.payment_transaction_id = transaction.id
              and request.status in ('held_for_review', 'approved_for_provider', 'provider_pending')
              and request.provider_refund_reference is null
          ) as operator_hold on true
          where transaction.transaction_type = 'payment'
            and transaction.status in ('succeeded', 'refunded', 'disputed')
        ) as candidate
        where candidate.refundable_amount_minor > 0
        order by candidate.occurred_at desc, candidate.id desc limit 10
      ) as item), '[]'::jsonb) else null end,
    'refundQueue', case when private.economic_operator_has_capability(v_actor, 'economic_refunds_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'requestId', item.id, 'orderId', item.order_id,
        'paymentTransactionId', item.payment_transaction_id, 'status', item.status,
        'amountMinor', item.amount_minor, 'currency', item.currency,
        'createdAt', item.created_at
      ) order by item.created_at) from (
        select * from private.economic_refund_requests
        where status in ('held_for_review', 'approved_for_provider', 'provider_pending')
        order by created_at limit 10
      ) as item), '[]'::jsonb) else null end,
    'subscriptionQueue', case when private.economic_operator_has_capability(v_actor, 'recurring_support_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'subscriptionId', item.id, 'userId', item.user_id,
        'originatingOrderId', item.originating_order_id, 'status', item.status,
        'cancelAtPeriodEnd', item.cancel_at_period_end,
        'currentPeriodEnd', item.current_period_end, 'updatedAt', item.updated_at
      ) order by item.updated_at desc) from (
        select * from private.economic_subscriptions
        where status in ('incomplete', 'active', 'past_due', 'grace_period', 'canceling')
        order by updated_at desc limit 10
      ) as item), '[]'::jsonb) else null end,
    'disputeQueue', case when private.economic_operator_has_capability(v_actor, 'economic_reconciliation_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'disputeId', item.id, 'orderId', item.order_id,
        'paymentTransactionId', item.payment_transaction_id,
        'status', item.status, 'reasonCode', item.reason_code,
        'amountMinor', item.amount_minor, 'currency', item.currency,
        'createdAt', item.created_at, 'updatedAt', item.updated_at
      ) order by item.updated_at desc) from (
        select * from private.economic_disputes
        where status in ('warning_needs_response', 'warning_under_review', 'needs_response', 'under_review', 'lost')
        order by updated_at desc limit 10
      ) as item), '[]'::jsonb) else null end,
    'webhookQueue', case when private.economic_operator_has_capability(v_actor, 'economic_reconciliation_manage')
      or private.economic_operator_has_capability(v_actor, 'economic_audit_view') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'eventId', item.id, 'eventType', item.event_type,
        'processingStatus', item.processing_status,
        'processingAttempts', item.processing_attempts,
        'eventCreatedAt', item.event_created_at, 'receivedAt', item.received_at
      ) order by item.received_at desc) from (
        select * from private.economic_webhook_events
        where processing_status in ('received', 'failed', 'unmatched')
        order by received_at desc limit 10
      ) as item), '[]'::jsonb) else null end,
    'reconciliationQueue', case when private.economic_operator_has_capability(v_actor, 'economic_reconciliation_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'caseId', item.id, 'orderId', item.order_id,
        'caseKind', item.case_kind,
        'status', item.status, 'openedAt', item.opened_at
      ) order by item.opened_at) from (
        select open_item.* from (
          select reconciliation.id, reconciliation.order_id,
            'economic_reconciliation_case'::text as case_kind,
            reconciliation.status, reconciliation.opened_at
          from private.economic_reconciliation_cases as reconciliation
          where reconciliation.status in ('open', 'investigating', 'waiting_for_provider')
          union all
          select hold.id, hold.order_id, 'marketplace_fulfillment_hold'::text,
            'open'::text, hold.created_at
          from private.marketplace_fulfillment_holds as hold
          where hold.status = 'refund_required'
          union all
          select hold.id, hold.order_id, 'job_post_payment_hold'::text,
            'open'::text, hold.opened_at
          from private.job_post_payment_holds as hold
          where hold.status = 'refund_required'
          union all
          select hold.id, hold.order_id,
            case when hold.organization_service_engagement_id is not null
              then 'organization_service_settlement_hold'::text
              else 'sponsorship_settlement_hold'::text end,
            'open'::text, hold.opened_at
          from private.organization_sponsorship_settlement_holds as hold
          where hold.status = 'open'
        ) as open_item
        order by opened_at limit 10
      ) as item), '[]'::jsonb) else null end,
    'sandboxCorrectionQueue', case when private.economic_operator_has_capability(v_actor, 'sandbox_credits_adjust') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'shortfallId', item.id, 'fulfillmentId', item.fulfillment_id,
        'fulfillmentScope', item.fulfillment_scope,
        'orderId', item.order_id,
        'paymentTransactionId', item.payment_transaction_id,
        'adjustmentKind', item.adjustment_kind,
        'targetUnits', item.target_units, 'appliedUnits', item.applied_units,
        'missingUnits', item.missing_units, 'status', item.status,
        'createdAt', item.created_at
      ) order by item.created_at) from (
        select * from (
          select shortfall.id, shortfall.fulfillment_id,
            'sandbox_credit_order'::text as fulfillment_scope,
            fulfillment.order_id, null::uuid as payment_transaction_id,
            shortfall.adjustment_kind, shortfall.target_units,
            shortfall.applied_units, shortfall.missing_units,
            shortfall.status, shortfall.created_at
          from private.sandbox_credit_adjustment_shortfalls as shortfall
          join private.sandbox_credit_order_fulfillments as fulfillment
            on fulfillment.id = shortfall.fulfillment_id
          where shortfall.status in ('open', 'reviewed')
          union all
          select shortfall.id, shortfall.fulfillment_id,
            'recurring_support_payment'::text as fulfillment_scope,
            fulfillment.order_id, fulfillment.payment_transaction_id,
            shortfall.adjustment_kind, shortfall.target_units,
            shortfall.applied_units, shortfall.missing_units,
            shortfall.status, shortfall.created_at
          from private.sandbox_credit_recurring_adjustment_shortfalls as shortfall
          join private.sandbox_credit_recurring_payment_fulfillments as fulfillment
            on fulfillment.id = shortfall.fulfillment_id
          where shortfall.status in ('open', 'reviewed')
        ) as open_shortfall
        order by created_at limit 10
      ) as item), '[]'::jsonb) else null end,
    'jobPostEconomicQueue', case when private.economic_operator_has_capability(v_actor, 'job_fee_assess') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'conditionId', item.id, 'jobPostId', item.job_post_id,
        'authorUserId', item.author_user_id, 'classification', item.classification,
        'status', item.condition_status, 'orderId', item.order_id,
        'termsVersion', item.terms_version, 'updatedAt', item.updated_at
      ) order by item.updated_at) from (
        select * from private.job_post_economic_conditions
        where condition_status in (
          'not_assessed', 'payment_required', 'payment_pending',
          'refunded', 'disputed', 'reconciliation_required'
        )
        order by updated_at limit 10
      ) as item), '[]'::jsonb) else null end,
    'sellerPayableQueue', case when private.economic_operator_has_capability(v_actor, 'marketplace_payout_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'sellerAccountId', item.seller_account_id, 'currency', item.currency,
        'availablePayableMinor', item.available_payable_minor,
        'sellerStatus', item.seller_status
      ) order by item.seller_account_id, item.currency) from (
        select seller.id as seller_account_id, currency_row.currency,
          private.marketplace_available_seller_payable(seller.id, currency_row.currency) as available_payable_minor,
          seller.status as seller_status
        from private.economic_seller_accounts as seller
        join lateral (
          select distinct event.currency
          from private.marketplace_commission_events as event
          where event.seller_account_id = seller.id
        ) as currency_row on true
        where private.marketplace_available_seller_payable(seller.id, currency_row.currency) > 0
        order by seller.id, currency_row.currency limit 10
      ) as item), '[]'::jsonb) else null end,
    'sellerPayoutPreparationQueue', case when private.economic_operator_has_capability(v_actor, 'marketplace_payout_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'payoutPreparationId', item.id, 'sellerAccountId', item.seller_account_id,
        'amountMinor', item.amount_minor, 'currency', item.currency,
        'status', item.status, 'createdAt', item.created_at
      ) order by item.created_at) from (
        select * from private.marketplace_payout_preparations
        where status in ('prepared', 'transfer_pending') order by created_at limit 10
      ) as item), '[]'::jsonb) else null end,
    'organizationServiceQueue', case when private.economic_operator_has_capability(v_actor, 'organization_billing_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'engagementId', item.id, 'organizationId', item.organization_id,
        'serviceCode', item.service_code, 'status', item.status,
        'entitlementState', item.entitlement_state,
        'supportAgreementState', item.support_agreement_state,
        'orderId', item.order_id, 'updatedAt', item.updated_at
      ) order by item.updated_at) from (
        select * from private.organization_service_engagements
        where status in ('contract_pending', 'active', 'reconciliation_required')
        order by updated_at limit 10
      ) as item), '[]'::jsonb) else null end,
    'sponsorshipQueue', case when private.economic_operator_has_capability(v_actor, 'sponsorship_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'sponsorshipAgreementId', item.id, 'organizationId', item.organization_id,
        'status', item.status, 'purposeCode', item.purpose_code,
        'publicRecognitionOptIn', item.public_recognition_opt_in,
        'publicRecognitionApproved', item.public_recognition_approved,
        'orderId', item.order_id, 'updatedAt', item.updated_at
      ) order by item.updated_at) from (
        select * from private.sponsorship_agreements
        where status in ('ethical_review', 'contract_pending', 'active', 'reconciliation_required')
        order by updated_at limit 10
      ) as item), '[]'::jsonb) else null end,
    'accountRequestQueue', case when private.economic_operator_has_capability(v_actor, 'economic_account_requests_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'requestId', item.id, 'requestType', item.request_type,
        'status', item.status, 'submittedAt', item.submitted_at,
        'providerCancellationRequired', item.provider_cancellation_required
      ) order by item.submitted_at) from (
        select * from private.economic_account_action_requests
        where status in ('submitted', 'identity_verification', 'operator_review', 'processing')
        order by submitted_at limit 10
      ) as item), '[]'::jsonb) else null end,
    'assistanceProgramQueue', case when private.economic_operator_has_capability(v_actor, 'economic_assistance_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'programId', item.id, 'programCode', item.program_code,
        'kind', item.assistance_kind, 'scope', item.scope,
        'status', item.status, 'startsAt', item.starts_at,
        'endsAt', item.ends_at, 'updatedAt', item.updated_at
      ) order by item.updated_at desc) from (
        select * from private.economic_assistance_programs
        order by updated_at desc limit 10
      ) as item), '[]'::jsonb) else null end,
    'assistanceQueue', case when private.economic_operator_has_capability(v_actor, 'economic_assistance_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'grantId', item.id, 'scope', item.scope,
        'status', item.status, 'expiresAt', item.expires_at
      ) order by item.granted_at desc) from (
        select * from private.economic_assistance_grants order by granted_at desc limit 10
      ) as item), '[]'::jsonb) else null end,
    'featureFlags', case when private.economic_operator_has_capability(v_actor, 'economic_feature_flags_manage') then
      coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'featureKey', flag.feature_key, 'enabled', flag.enabled,
        'testModeOnly', flag.test_mode_only, 'updatedAt', flag.updated_at
      ) order by flag.feature_key) from (
        select * from private.economic_feature_flags
        where feature_key = any(array[
          'support_checkout', 'recurring_support', 'economic_webhooks',
          'test_refund_execution', 'customer_portal',
          'sandbox_credit_purchase', 'sandbox_credit_display',
          'sandbox_credit_enforcement', 'job_post_fee_enforcement',
          'marketplace_paid_offers', 'marketplace_seller_onboarding',
          'marketplace_payout_preparation', 'marketplace_payouts',
          'organization_billing', 'organization_contract_workflow',
          'sponsorship_checkout', 'sponsorship_review_workflow',
          'economic_assistance_workflow', 'sponsorship_display',
          'live_stripe', 'public_support_recognition'
        ]::text[])
        order by feature_key
        limit 25
      ) as flag), '[]'::jsonb)
      else null end,
    'providerIdentifiersExposed', false,
    'personalContactDataExposed', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.configure_sandbox_test_credit_pack(
  p_pack_code text,
  p_price_code text,
  p_amount_minor bigint,
  p_currency text,
  p_granted_units bigint,
  p_expires_after_days integer,
  p_disclosure_version text,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price private.economic_prices%rowtype;
  v_pack private.sandbox_credit_pack_versions%rowtype;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_confirmation is distinct from 'CONFIGURE UNAPPROVED SANDBOX TEST PACK' then
    raise exception using errcode = '22023', message = 'sandbox_test_pack_confirmation_required';
  end if;
  if coalesce(p_pack_code, '') !~ '^sandbox_test_[a-z0-9_]{3,80}$'
     or coalesce(p_price_code, '') !~ '^sandbox_test_[a-z0-9_]{3,100}_usd$'
     or lower(coalesce(p_currency, '')) <> 'usd'
     or p_amount_minor is null or p_amount_minor not between 50 and 100000
     or p_granted_units is null or p_granted_units not between 1 and 1000000000
     or (p_expires_after_days is not null and p_expires_after_days not between 1 and 3650)
     or pg_catalog.char_length(coalesce(p_disclosure_version, '')) not between 1 and 120
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sandbox_test_pack_configuration_invalid';
  end if;
  if coalesce((
    select flag.enabled from private.economic_feature_flags as flag
    where flag.feature_key = 'live_stripe'
  ), false) then
    raise exception using errcode = '55000', message = 'sandbox_test_pack_configuration_disabled_in_live_mode';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sandbox-pack:' || p_pack_code, 0)
  );

  select * into v_price
  from private.economic_prices as price
  where price.price_code = p_price_code
  for update;
  if found then
    if v_price.product_key <> 'sandbox_credits'
       or v_price.currency <> 'usd'
       or v_price.unit_amount_minor <> p_amount_minor
       or v_price.recurring_interval is not null
       or not v_price.test_mode_only then
      raise exception using errcode = '23505', message = 'sandbox_test_pack_price_conflict';
    end if;
  else
    insert into private.economic_prices (
      price_code, product_key, currency, unit_amount_minor,
      active, test_mode_only
    ) values (
      p_price_code, 'sandbox_credits', 'usd', p_amount_minor,
      true, true
    ) returning * into v_price;
  end if;

  select * into v_pack
  from private.sandbox_credit_pack_versions as pack
  where pack.pack_code = p_pack_code
  for update;
  if found then
    if v_pack.price_id <> v_price.id
       or v_pack.granted_units <> p_granted_units
       or v_pack.expires_after_days is distinct from p_expires_after_days
       or v_pack.disclosure_version <> p_disclosure_version then
      raise exception using errcode = '23505', message = 'sandbox_test_pack_version_conflict';
    end if;
  else
    insert into private.sandbox_credit_pack_versions (
      pack_code, price_id, granted_units, expires_after_days,
      disclosure_version, active, test_mode, approved_for_live_use
    ) values (
      p_pack_code, v_price.id, p_granted_units, p_expires_after_days,
      p_disclosure_version, true, true, false
    ) returning * into v_pack;
  end if;

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    'system', 'sandbox_test_credit_pack_configured',
    'sandbox_credit_pack_version', v_pack.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'pack_code', v_pack.pack_code,
      'price_code', v_price.price_code,
      'amount_minor', v_price.unit_amount_minor,
      'currency', v_price.currency,
      'granted_units', v_pack.granted_units,
      'approved_for_live_use', false,
      'test_mode', private.economic_is_test_mode()
    )
  );

  return pg_catalog.jsonb_build_object(
    'packVersionId', v_pack.id,
    'packCode', v_pack.pack_code,
    'priceCode', v_price.price_code,
    'amountMinor', v_price.unit_amount_minor,
    'currency', v_price.currency,
    'grantedUnits', v_pack.granted_units,
    'expiresAfterDays', v_pack.expires_after_days,
    'approvedForLiveUse', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.configure_sandbox_test_credit_program(
  p_program_code text,
  p_source_category text,
  p_source_price_code text,
  p_granted_units bigint,
  p_expires_after_days integer,
  p_one_time_per_user boolean,
  p_active boolean,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price private.economic_prices%rowtype;
  v_program private.sandbox_credit_program_versions%rowtype;
  v_consent_bundle_version text;
  v_sandbox_terms_version text;
begin
  if p_source_category='recurring_support' then raise exception using errcode='42501',message='support_to_compute_hard_off';end if;
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_confirmation is distinct from 'CONFIGURE UNAPPROVED SANDBOX TEST PROGRAM' then
    raise exception using errcode = '22023', message = 'sandbox_test_program_confirmation_required';
  end if;
  if coalesce(p_program_code, '') !~ '^sandbox_test_[a-z0-9_]{3,80}$'
     or p_source_category not in (
       'starter', 'recurring_support', 'sponsored', 'waiver', 'waived',
       'operational', 'test'
     )
     or p_granted_units is null or p_granted_units not between 1 and 1000000000
     or (p_expires_after_days is not null and p_expires_after_days not between 1 and 3650)
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sandbox_test_program_configuration_invalid';
  end if;

  if coalesce(p_active, false) then
    raise exception using errcode = '55000', message = 'sandbox_test_program_activation_requires_operator_review';
  end if;
  if p_source_category = 'recurring_support'
     and coalesce(p_one_time_per_user, false) then
    raise exception using errcode = '22023', message = 'sandbox_recurring_program_must_grant_per_payment';
  end if;
  if p_source_category = 'recurring_support'
     and coalesce(p_source_price_code, '') = '' then
    raise exception using errcode = '22023', message = 'sandbox_recurring_program_source_price_required';
  elsif p_source_category <> 'recurring_support' and p_source_price_code is not null then
    raise exception using errcode = '22023', message = 'sandbox_test_program_source_price_not_allowed';
  end if;

  if p_source_category = 'recurring_support' then
    select * into v_price
    from private.economic_prices as price
    where price.price_code = p_source_price_code
      and price.product_key = 'support_recurring'
      and price.unit_amount_minor is not null
      and price.recurring_interval is not null
      and price.recurring_interval_count is not null
      and price.active = true
      and price.test_mode_only = true
      and price.retired_at is null;
    if not found then
      raise exception using errcode = 'P0002', message = 'sandbox_recurring_program_test_price_not_found';
    end if;
    select active_bundle.bundle_version into v_consent_bundle_version
    from private.economic_active_legal_consent_bundles as active_bundle
    where active_bundle.bundle_key = 'support_recurring_checkout_bundle';
    select active_document.document_version into v_sandbox_terms_version
    from private.economic_active_legal_documents as active_document
    where active_document.document_key = 'sandbox_credit_terms';
    if v_consent_bundle_version is null or v_sandbox_terms_version is null then
      raise exception using errcode = '55000', message = 'sandbox_recurring_program_legal_artifact_missing';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sandbox-program:' || p_program_code, 0)
  );
  select * into v_program
  from private.sandbox_credit_program_versions as program
  where program.program_code = p_program_code
  for update;
  if found then
    if v_program.source_category <> p_source_category
       or v_program.source_price_id is distinct from v_price.id
       or v_program.source_price_code_snapshot is distinct from v_price.price_code
       or v_program.source_amount_minor_snapshot is distinct from v_price.unit_amount_minor
       or v_program.source_currency_snapshot is distinct from v_price.currency
       or v_program.source_recurring_interval_snapshot is distinct from v_price.recurring_interval
       or v_program.source_recurring_interval_count_snapshot is distinct from v_price.recurring_interval_count
       or v_program.source_consent_bundle_version_snapshot is distinct from v_consent_bundle_version
       or v_program.sandbox_credit_terms_version_snapshot is distinct from v_sandbox_terms_version
       or v_program.granted_units <> p_granted_units
       or v_program.expires_after_days is distinct from p_expires_after_days
       or v_program.one_time_per_user <> coalesce(p_one_time_per_user, false) then
      raise exception using errcode = '23505', message = 'sandbox_test_program_version_conflict';
    end if;
  else
    insert into private.sandbox_credit_program_versions (
      program_code, source_category, source_price_id,
      source_price_code_snapshot, source_amount_minor_snapshot,
      source_currency_snapshot, source_recurring_interval_snapshot,
      source_recurring_interval_count_snapshot,
      source_consent_bundle_version_snapshot,
      sandbox_credit_terms_version_snapshot, granted_units,
      expires_after_days, one_time_per_user, active, test_mode,
      approved_for_live_use, retired_at
    ) values (
      p_program_code, p_source_category, v_price.id,
      v_price.price_code, v_price.unit_amount_minor, v_price.currency,
      v_price.recurring_interval, v_price.recurring_interval_count,
      v_consent_bundle_version, v_sandbox_terms_version,
      p_granted_units,
      p_expires_after_days, coalesce(p_one_time_per_user, false),
      false, true, false, pg_catalog.now()
    ) returning * into v_program;
  end if;

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    'system', 'sandbox_test_credit_program_configured',
    'sandbox_credit_program_version', v_program.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'program_code', v_program.program_code,
      'source_category', v_program.source_category,
      'source_price_code', v_program.source_price_code_snapshot,
      'consent_bundle_version', v_program.source_consent_bundle_version_snapshot,
      'sandbox_credit_terms_version', v_program.sandbox_credit_terms_version_snapshot,
      'granted_units', v_program.granted_units,
      'active', v_program.active,
      'approved_for_live_use', false,
      'test_mode', private.economic_is_test_mode()
    )
  );

  return pg_catalog.jsonb_build_object(
    'programVersionId', v_program.id,
    'programCode', v_program.program_code,
    'sourceCategory', v_program.source_category,
    'sourcePriceCode', v_program.source_price_code_snapshot,
    'grantedUnits', v_program.granted_units,
    'expiresAfterDays', v_program.expires_after_days,
    'oneTimePerUser', v_program.one_time_per_user,
    'active', v_program.active,
    'approvedForLiveUse', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.prepare_sandbox_credit_checkout(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_pack_code text,
  p_source_route text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack private.sandbox_credit_pack_versions%rowtype;
  v_price private.economic_prices%rowtype;
  v_result jsonb;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_actor_user_id is null then
    raise exception using errcode = '42501', message = 'sandbox_credit_purchase_account_required';
  end if;
  if not private.economic_feature_enabled('sandbox_credit_display')
     or not private.economic_feature_enabled('sandbox_credit_purchase') then
    raise exception using errcode = '55000', message = 'sandbox_credit_purchase_unavailable';
  end if;

  select pack.* into v_pack
  from private.sandbox_credit_pack_versions as pack
  where pack.pack_code = p_pack_code
    and pack.active = true
    and pack.test_mode = true
    and pack.approved_for_live_use = false
    and pack.retired_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'sandbox_credit_pack_not_found';
  end if;
  select * into v_price
  from private.economic_prices as price
  where price.id = v_pack.price_id
    and price.active = true
    and price.test_mode_only = true
    and price.retired_at is null;
  if not found or v_price.unit_amount_minor is null then
    raise exception using errcode = '55000', message = 'sandbox_credit_pack_price_unavailable';
  end if;

  v_result := public.begin_economic_checkout(
    p_actor_user_id, p_client_request_id, 'sandbox_credits',
    v_price.unit_amount_minor, v_price.currency, v_price.price_code,
    p_source_route, p_consent_version
  );

  return v_result || pg_catalog.jsonb_build_object(
    'packCode', v_pack.pack_code,
    'grantedUnits', v_pack.granted_units,
    'expiresAfterDays', v_pack.expires_after_days,
    'rateApprovedForLiveUse', false,
    'automaticPurchase', false,
    'safetyPrivilegesChanged', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.sandbox_credit_pack_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'available',
      private.economic_feature_enabled('sandbox_credit_display')
      and private.economic_feature_enabled('sandbox_credit_purchase'),
    'testMode', private.economic_is_test_mode(),
    'packs', case
      when private.economic_feature_enabled('sandbox_credit_display')
       and private.economic_feature_enabled('sandbox_credit_purchase')
      then coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'packCode', pack.pack_code,
            'amountMinor', price.unit_amount_minor,
            'currency', price.currency,
            'grantedUnits', pack.granted_units,
            'expiresAfterDays', pack.expires_after_days,
            'disclosureVersion', pack.disclosure_version,
            'testMode', private.economic_is_test_mode()
          ) order by price.unit_amount_minor, pack.pack_code
        )
        from private.sandbox_credit_pack_versions as pack
        join private.economic_prices as price on price.id = pack.price_id
        where pack.active = true
          and pack.test_mode = true
          and pack.approved_for_live_use = false
          and pack.retired_at is null
          and price.active = true
          and price.test_mode_only = true
          and price.retired_at is null
      ), '[]'::jsonb)
      else '[]'::jsonb
    end
  );
$$;

create or replace function public.grant_sandbox_credit_program(
  p_user_id uuid,
  p_program_code text,
  p_source_reference text,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program private.sandbox_credit_program_versions%rowtype;
  v_existing_lot private.sandbox_credit_lots%rowtype;
  v_payment_transaction_id uuid;
  v_expires_at timestamptz;
  v_source_reference text;
  v_result jsonb;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_user_id is null then
    raise exception using errcode = '23503', message = 'sandbox_credit_user_not_found';
  end if;
  select * into v_program
  from private.sandbox_credit_program_versions as program
  where program.program_code = p_program_code
    and program.active = true
    and program.test_mode = true
    and program.approved_for_live_use = false
    and program.retired_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'sandbox_credit_program_not_found';
  end if;
  if v_program.source_category='recurring_support' then raise exception using errcode='42501',message='support_to_compute_hard_off';end if;
  if v_program.source_category = 'recurring_support' then
    begin
      if coalesce(p_source_reference, '') !~
           '^payment-transaction:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using errcode = '42501', message = 'sandbox_recurring_program_verified_payment_required';
      end if;
      v_payment_transaction_id := pg_catalog.substr(
        p_source_reference, pg_catalog.char_length('payment-transaction:') + 1
      )::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '42501', message = 'sandbox_recurring_program_verified_payment_required';
    end;
    if p_idempotency_key is distinct from
         'sandbox-recurring:' || v_payment_transaction_id::text
       or not exists (
         select 1
         from private.economic_payment_transactions as payment
         join private.economic_orders as target_order on target_order.id = payment.order_id
         join private.economic_order_items as item on item.order_id = target_order.id
         join private.economic_active_legal_consent_bundles as active_bundle
           on active_bundle.bundle_key = 'support_recurring_checkout_bundle'
          and active_bundle.bundle_version = v_program.source_consent_bundle_version_snapshot
         join private.economic_legal_consent_bundle_versions as bundle
           on bundle.bundle_key = active_bundle.bundle_key
          and bundle.bundle_version = active_bundle.bundle_version
         join private.economic_active_legal_documents as active_document
           on active_document.document_key = 'sandbox_credit_terms'
          and active_document.document_version = v_program.sandbox_credit_terms_version_snapshot
         where payment.id = v_payment_transaction_id
           and payment.transaction_type = 'payment'
           and payment.status = 'succeeded'
           and payment.gross_amount_minor = v_program.source_amount_minor_snapshot
           and payment.currency = v_program.source_currency_snapshot
           and target_order.user_id = p_user_id
           and target_order.flow = 'support_recurring'
           and target_order.consent_version = v_program.source_consent_bundle_version_snapshot
           and item.product_key = 'support_recurring'
           and item.price_id = v_program.source_price_id
           and item.price_code_snapshot = v_program.source_price_code_snapshot
           and item.unit_amount_minor = v_program.source_amount_minor_snapshot
           and item.total_amount_minor = payment.gross_amount_minor
           and item.currency = payment.currency
           and item.recurring_interval_snapshot = v_program.source_recurring_interval_snapshot
           and bundle.document_manifest -> 'sandboxCreditTerms' ->> 'version'
             = v_program.sandbox_credit_terms_version_snapshot
           and bundle.document_manifest -> 'sandboxCreditTerms' ->> 'path'
             = '/legal/sandbox-credit-terms'
       ) then
      raise exception using errcode = '42501', message = 'sandbox_recurring_program_verified_payment_required';
    end if;
  end if;
  v_source_reference := case
    when v_program.one_time_per_user then 'program:' || v_program.id::text
    else nullif(p_source_reference, '')
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || v_program.id::text, 0)
  );
  select * into v_existing_lot
  from private.sandbox_credit_lots as lot
  where lot.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_lot.user_id <> p_user_id
       or v_existing_lot.granted_units <> v_program.granted_units
       or v_existing_lot.source_category <> v_program.source_category
       or v_existing_lot.source_reference is distinct from v_source_reference then
      raise exception using errcode = '23505', message = 'sandbox_credit_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'creditLotId', v_existing_lot.id,
      'grantedUnits', v_existing_lot.granted_units,
      'sourceCategory', v_existing_lot.source_category,
      'expiresAt', v_existing_lot.expires_at,
      'idempotentReplay', true,
      'programCode', v_program.program_code,
      'programVersionId', v_program.id,
      'testMode', private.economic_is_test_mode()
    );
  end if;
  if v_program.one_time_per_user and exists (
    select 1
    from private.sandbox_credit_lots as lot
    where lot.user_id = p_user_id
      and lot.source_reference = 'program:' || v_program.id::text
  ) then
    raise exception using errcode = '23505', message = 'sandbox_credit_program_already_granted';
  end if;

  v_expires_at := case
    when v_program.expires_after_days is null then null
    else pg_catalog.now() + pg_catalog.make_interval(days => v_program.expires_after_days)
  end;
  v_result := public.grant_sandbox_credit_units(
    p_user_id,
    v_program.granted_units,
    v_program.source_category,
    v_source_reference,
    v_expires_at,
    p_idempotency_key,
    p_reason
  );
  return v_result || pg_catalog.jsonb_build_object(
    'programCode', v_program.program_code,
    'programVersionId', v_program.id,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.set_sandbox_test_credit_program_status(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_program_code text,
  p_active boolean,
  p_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program private.sandbox_credit_program_versions%rowtype;
  v_price private.economic_prices%rowtype;
  v_action private.sandbox_credit_program_operator_actions%rowtype;
  v_action_name text;
  v_expected_confirmation text;
  v_result jsonb;
begin
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'sandbox_credits_adjust'
  );
  if p_client_request_id is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sandbox_test_program_status_request_invalid';
  end if;
  v_action_name := case when coalesce(p_active, false) then 'activate' else 'deactivate' end;
  v_expected_confirmation := case
    when coalesce(p_active, false) then 'ACTIVATE UNAPPROVED SANDBOX TEST PROGRAM'
    else 'DEACTIVATE UNAPPROVED SANDBOX TEST PROGRAM'
  end;
  if p_confirmation is distinct from v_expected_confirmation then
    raise exception using errcode = '22023', message = 'sandbox_test_program_status_confirmation_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sandbox-program-action:' || p_client_request_id::text, 0)
  );
  select * into v_program
  from private.sandbox_credit_program_versions as program
  where program.program_code = p_program_code
    and program.test_mode = true
    and program.approved_for_live_use = false
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'sandbox_credit_program_not_found';
  end if;

  if p_active and v_program.source_category='recurring_support' then raise exception using errcode='42501',message='support_to_compute_hard_off';end if;

  select * into v_action
  from private.sandbox_credit_program_operator_actions as action
  where action.client_request_id = p_client_request_id;
  if found then
    if v_action.actor_user_id <> p_actor_user_id
       or v_action.program_version_id <> v_program.id
       or v_action.action <> v_action_name
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'sandbox_program_action_idempotency_conflict';
    end if;
    return v_action.result_payload || pg_catalog.jsonb_build_object('idempotentReplay', true);
  end if;

  if coalesce(p_active, false) and v_program.source_category = 'recurring_support' then
    select * into v_price
    from private.economic_prices as price
    where price.id = v_program.source_price_id
      and price.price_code = v_program.source_price_code_snapshot
      and price.product_key = 'support_recurring'
      and price.unit_amount_minor = v_program.source_amount_minor_snapshot
      and price.currency = v_program.source_currency_snapshot
      and price.recurring_interval = v_program.source_recurring_interval_snapshot
      and price.recurring_interval_count = v_program.source_recurring_interval_count_snapshot
      and price.active = true
      and price.test_mode_only = true
      and price.retired_at is null;
    if not found
       or not private.economic_feature_enabled('economic_webhooks')
       or not exists (
         select 1 from private.economic_active_legal_consent_bundles as active_bundle
         join private.economic_legal_consent_bundle_versions as bundle
           on bundle.bundle_key = active_bundle.bundle_key
          and bundle.bundle_version = active_bundle.bundle_version
         where active_bundle.bundle_key = 'support_recurring_checkout_bundle'
           and active_bundle.bundle_version = v_program.source_consent_bundle_version_snapshot
           and bundle.document_manifest -> 'sandboxCreditTerms' ->> 'version'
             = v_program.sandbox_credit_terms_version_snapshot
           and bundle.document_manifest -> 'sandboxCreditTerms' ->> 'path'
             = '/legal/sandbox-credit-terms'
       )
       or not exists (
         select 1 from private.economic_active_legal_documents as active_document
         where active_document.document_key = 'sandbox_credit_terms'
           and active_document.document_version = v_program.sandbox_credit_terms_version_snapshot
       ) then
      raise exception using errcode = '55000', message = 'sandbox_recurring_program_activation_prerequisites_missing';
    end if;
  end if;

  update private.sandbox_credit_program_versions
  set
    active = coalesce(p_active, false),
    retired_at = case when coalesce(p_active, false) then null else pg_catalog.now() end
  where id = v_program.id
  returning * into v_program;

  v_result := pg_catalog.jsonb_build_object(
    'programVersionId', v_program.id,
    'programCode', v_program.program_code,
    'sourceCategory', v_program.source_category,
    'active', v_program.active,
    'approvedForLiveUse', false,
    'testMode', private.economic_is_test_mode(),
    'authorityChanged', false,
    'idempotentReplay', false
  );
  insert into private.sandbox_credit_program_operator_actions (
    client_request_id, actor_user_id, program_version_id, action,
    private_reason, result_payload
  ) values (
    p_client_request_id, p_actor_user_id, v_program.id, v_action_name,
    pg_catalog.btrim(p_reason), v_result
  );
  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator',
    'sandbox_test_credit_program_' || case when v_program.active then 'activated' else 'deactivated' end,
    'sandbox_credit_program_version', v_program.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'client_request_id', p_client_request_id,
      'source_category', v_program.source_category,
      'active', v_program.active,
      'test_mode', private.economic_is_test_mode(),
      'no_safety_or_authority_change', true
    )
  );
  return v_result;
end;
$$;

create or replace function public.operator_grant_sandbox_credit_program(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_user_id uuid,
  p_program_code text,
  p_source_reference text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program private.sandbox_credit_program_versions%rowtype;
  v_action private.sandbox_credit_program_operator_actions%rowtype;
  v_result jsonb;
begin
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'sandbox_credits_adjust'
  );
  if p_client_request_id is null
     or p_user_id is null
     or pg_catalog.char_length(coalesce(p_source_reference, '')) not between 1 and 255
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'sandbox_program_operator_grant_invalid';
  end if;
  select * into v_program
  from private.sandbox_credit_program_versions as program
  where program.program_code = p_program_code
    and program.test_mode = true
    and program.approved_for_live_use = false;
  if not found then
    raise exception using errcode = 'P0002', message = 'sandbox_credit_program_not_found';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sandbox-program-action:' || p_client_request_id::text, 0)
  );
  select * into v_action
  from private.sandbox_credit_program_operator_actions as action
  where action.client_request_id = p_client_request_id;
  if found then
    if v_action.actor_user_id <> p_actor_user_id
       or v_action.program_version_id <> v_program.id
       or v_action.action <> 'grant'
       or v_action.target_user_id <> p_user_id
       or v_action.source_reference is distinct from p_source_reference
       or v_action.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'sandbox_program_action_idempotency_conflict';
    end if;
    return v_action.result_payload || pg_catalog.jsonb_build_object('idempotentReplay', true);
  end if;

  if not v_program.active or v_program.retired_at is not null then
    raise exception using errcode = 'P0002', message = 'sandbox_credit_program_not_found';
  end if;
  if v_program.source_category = 'recurring_support' then
    raise exception using errcode = '42501', message = 'sandbox_recurring_program_requires_verified_payment';
  end if;

  v_result := public.grant_sandbox_credit_program(
    p_user_id, p_program_code, p_source_reference,
    'sandbox-program-operator:' || p_client_request_id::text,
    pg_catalog.btrim(p_reason)
  ) || pg_catalog.jsonb_build_object(
    'operatorActorId', p_actor_user_id,
    'authorityChanged', false,
    'idempotentReplay', false
  );
  insert into private.sandbox_credit_program_operator_actions (
    client_request_id, actor_user_id, program_version_id, action,
    target_user_id, source_reference, private_reason, result_payload
  ) values (
    p_client_request_id, p_actor_user_id, v_program.id, 'grant',
    p_user_id, p_source_reference, pg_catalog.btrim(p_reason), v_result
  );
  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'operator_sandbox_credit_program_grant',
    'sandbox_credit_lot', nullif(v_result ->> 'creditLotId', '')::uuid,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'client_request_id', p_client_request_id,
      'target_user_id', p_user_id,
      'program_version_id', v_program.id,
      'source_category', v_program.source_category,
      'test_mode', private.economic_is_test_mode(),
      'no_safety_or_authority_change', true
    )
  );
  return v_result;
end;
$$;

create or replace function private.fulfill_paid_sandbox_credit_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item private.economic_order_items%rowtype;
  v_pack private.sandbox_credit_pack_versions%rowtype;
  v_result jsonb;
  v_lot_id uuid;
  v_fulfillment private.sandbox_credit_order_fulfillments%rowtype;
  v_expires_at timestamptz;
begin
  if new.flow <> 'sandbox_credits'
     or new.status <> 'paid'
     or old.status = 'paid' then
    return new;
  end if;
  if new.user_id is null then
    raise exception using errcode = '55000', message = 'sandbox_credit_paid_order_account_missing';
  end if;
  select * into v_fulfillment
  from private.sandbox_credit_order_fulfillments as fulfillment
  where fulfillment.order_id = new.id;
  if found then
    return new;
  end if;

  select * into v_item
  from private.economic_order_items as item
  where item.order_id = new.id
    and item.product_key = 'sandbox_credits';
  if not found then
    raise exception using errcode = '55000', message = 'sandbox_credit_order_item_missing';
  end if;
  select * into v_pack
  from private.sandbox_credit_pack_versions as pack
  where pack.price_id = v_item.price_id;
  if not found then
    raise exception using errcode = '55000', message = 'sandbox_credit_pack_mapping_missing';
  end if;
  if v_item.total_amount_minor <> new.total_minor
     or v_item.currency <> new.currency then
    raise exception using errcode = '55000', message = 'sandbox_credit_order_snapshot_mismatch';
  end if;

  v_expires_at := case
    when v_pack.expires_after_days is null then null
    else coalesce(new.paid_at, pg_catalog.now())
      + pg_catalog.make_interval(days => v_pack.expires_after_days)
  end;
  v_result := public.grant_sandbox_credit_units(
    new.user_id,
    v_pack.granted_units,
    'purchased',
    new.id::text,
    v_expires_at,
    'sandbox-purchase:' || new.id::text,
    'Verified test-mode sandbox credit order fulfillment.'
  );
  v_lot_id := nullif(v_result ->> 'creditLotId', '')::uuid;

  insert into private.sandbox_credit_order_fulfillments (
    order_id, user_id, pack_version_id, credit_lot_id, granted_units
  ) values (
    new.id, new.user_id, v_pack.id, v_lot_id, v_pack.granted_units
  )
  on conflict (order_id) do nothing
  returning * into v_fulfillment;

  insert into private.economic_entitlements (
    user_id, entitlement_key, source_type, source_id, status,
    starts_at, ends_at
  ) values (
    new.user_id, 'sandbox_credit_lot', 'economic_order', new.id, 'active',
    coalesce(new.paid_at, pg_catalog.now()), v_expires_at
  ) on conflict do nothing;

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, metadata
  ) values (
    'provider_webhook', 'sandbox_credit_order_fulfilled',
    'sandbox_credit_order_fulfillment', v_fulfillment.id,
    pg_catalog.jsonb_build_object(
      'order_id', new.id,
      'user_id', new.user_id,
      'granted_units', v_pack.granted_units,
      'test_mode', private.economic_is_test_mode(),
      'no_safety_or_authority_change', true
    )
  );
  return new;
end;
$$;

create or replace function private.grant_recurring_sandbox_program_from_payment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Support never purchases hosted compute, in either environment.
 return new;
end;
$$;

create or replace function public.current_user_job_post_economic_status(p_job_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_condition private.job_post_economic_conditions%rowtype;
  v_post_status public.commune_post_status;
  v_price private.economic_prices%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;
  select * into v_condition
  from private.job_post_economic_conditions as condition
  where condition.job_post_id = p_job_post_id
    and condition.author_user_id = v_actor;
  if not found then
    raise exception using errcode = 'P0002', message = 'job_post_economic_status_not_found';
  end if;
  select post.status into v_post_status
  from public.commune_posts as post
  where post.id = v_condition.post_id;
  if v_condition.price_id is not null then
    select * into v_price from private.economic_prices where id = v_condition.price_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'job_post_id', v_condition.job_post_id,
    'classification', v_condition.classification,
    'economic_status', v_condition.condition_status,
    'content_approved', exists (
      select 1 from public.commune_job_posts
      where id = v_condition.job_post_id and anti_scam_review_status = 'reviewed_clear'
    ),
    'publication_status', v_post_status,
    'published', v_post_status = 'published'::public.commune_post_status,
    'amount_minor', v_price.unit_amount_minor,
    'currency', v_price.currency,
    'terms_version', v_condition.terms_version,
    'test_mode', private.economic_is_test_mode()
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', v_idempotent_replay
  );
end;
$$;

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
        'test_mode', private.economic_is_test_mode()
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
        'test_mode', private.economic_is_test_mode()
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
    'testMode', private.economic_is_test_mode(),
    'idempotentReplay', v_idempotent_replay
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
      'idempotentReplay', true, 'testMode', private.economic_is_test_mode()
    );
  end if;
  if v_seller.provider_status_updated_at is not null
     and p_provider_event_created_at < v_seller.provider_status_updated_at then
    update private.economic_seller_provider_status_requests
    set status = 'completed', completed_at = pg_catalog.now()
    where id = v_request.id;
    return pg_catalog.jsonb_build_object(
      'sellerAccountId', v_seller.id, 'status', v_seller.status,
      'ignoredOutOfOrder', true, 'idempotentReplay', false, 'testMode', private.economic_is_test_mode()
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
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode(),
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
      'test_mode', private.economic_is_test_mode()
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
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
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
      'test_mode', private.economic_is_test_mode(), 'publication_or_trust_changed', false
    )
  );
  return v_result;
end;
$$;

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
        and catalog.active = true and catalog.test_mode = private.economic_is_test_mode()
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
    'testMode', private.economic_is_test_mode(),
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
      'test_mode', private.economic_is_test_mode(),
      'publication_or_trust_changed', false
    )
  );
  return v_result;
end;
$$;

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
      'testMode', private.economic_is_test_mode()
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
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
      'installAuthorized', false, 'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
      'installAuthorized', false, 'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
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
      'installAuthorized', false, 'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
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
    'installAuthorized', false, 'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode()
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
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode()
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
    'testMode', private.economic_is_test_mode(),
    'providerIdentifiersExposed', false
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode(),
    'idempotentReplay', v_idempotent_replay
  );
end;
$$;

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
      'status', v_target_status, 'testMode', private.economic_is_test_mode(),
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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
      'test_mode', private.economic_is_test_mode()
    )
  );
  return pg_catalog.jsonb_build_object(
    'priceCode', v_price.price_code, 'productKey', v_price.product_key,
    'amountMinor', v_price.unit_amount_minor, 'currency', v_price.currency,
    'disclosureVersion', p_disclosure_version,
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
    'status', v_org.status, 'testMode', private.economic_is_test_mode(),
    'idempotentReplay', v_replay
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
      pg_catalog.jsonb_build_object('organization_id', p_organization_id, 'test_mode', private.economic_is_test_mode())
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'engagementId', v_engagement.id, 'organizationId', v_engagement.organization_id,
    'serviceCode', v_engagement.service_code, 'status', v_engagement.status,
    'serviceTermsVersion', v_engagement.service_terms_version,
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', v_replay
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
    pg_catalog.jsonb_build_object('status', v_engagement.status, 'test_mode', private.economic_is_test_mode())
  );
  return pg_catalog.jsonb_build_object(
    'engagementId', v_engagement.id, 'action', p_action,
    'status', v_engagement.status, 'testMode', private.economic_is_test_mode(),
    'idempotentReplay', false
  );
end;
$$;

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
        'test_mode', private.economic_is_test_mode()
      )
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'sponsorshipAgreementId', v_agreement.id,
    'organizationId', v_agreement.organization_id,
    'status', v_agreement.status,
    'publicRecognitionOptIn', v_agreement.public_recognition_opt_in,
    'publicRecognitionApproved', v_agreement.public_recognition_approved,
    'grantsAuthority', false, 'testMode', private.economic_is_test_mode(),
    'idempotentReplay', v_replay
  );
end;
$$;

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
      'action', v_action.action, 'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
      'test_mode', private.economic_is_test_mode()
    )
  );
  return pg_catalog.jsonb_build_object(
    'sponsorshipAgreementId', v_agreement.id, 'action', p_action,
    'status', v_agreement.status, 'grantsAuthority', false,
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', v_replay
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
      'status', v_program.status, 'test_mode', private.economic_is_test_mode()
    )
  );
  return pg_catalog.jsonb_build_object(
    'programId', v_program.id, 'programCode', v_program.program_code,
    'status', v_program.status, 'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
    'sandboxCreditResult', v_credit, 'testMode', private.economic_is_test_mode(),
    'idempotentReplay', v_replay
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
    'grantsAuthority', false, 'testMode', private.economic_is_test_mode(),
    'idempotentReplay', v_replay
  );
end;
$$;

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
      'testMode', private.economic_is_test_mode(), 'idempotentReplay', true
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
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
end;
$$;

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
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.current_user_economic_audit_events(
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_events jsonb;
begin
  if v_actor is null
     or not private.economic_operator_has_capability(v_actor, 'economic_audit_view') then
    raise exception using errcode = '42501', message = 'economic_audit_view_denied';
  end if;
  if p_limit is null or p_limit not between 1 and 200
     or ((p_after_created_at is null) <> (p_after_id is null)) then
    raise exception using errcode = '22023', message = 'economic_audit_page_invalid';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'eventId', event.id, 'action', event.action,
    'targetType', event.target_type, 'targetId', event.target_id,
    'actorKind', event.actor_kind, 'createdAt', event.created_at
  ) order by event.created_at desc, event.id desc), '[]'::jsonb)
  into v_events
  from (
    select * from private.economic_audit_events as audit
    where p_after_created_at is null
      or (audit.created_at, audit.id) < (p_after_created_at, p_after_id)
    order by audit.created_at desc, audit.id desc limit p_limit
  ) as event;
  return pg_catalog.jsonb_build_object(
    'events', v_events, 'limit', p_limit,
    'providerIdentifiersExposed', false,
    'personalContactDataExposed', false,
    'testMode', private.economic_is_test_mode()
  );
end;
$$;

create or replace function public.export_economic_accounting_events(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_after_created_at timestamptz,
  p_after_id uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_entries jsonb;
  v_result jsonb;
  v_existing private.economic_accounting_export_actions%rowtype;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'accounting_export');
  if p_client_request_id is null or p_from is null or p_to is null or p_to <= p_from
     or p_to - p_from > interval '31 days'
     or p_limit is null or p_limit not between 1 and 100
     or ((p_after_created_at is null) <> (p_after_id is null)) then
    raise exception using errcode = '22023', message = 'economic_accounting_export_bounds_invalid';
  end if;
  select * into v_existing from private.economic_accounting_export_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_existing.actor_user_id <> p_actor_user_id
       or v_existing.from_at <> p_from or v_existing.to_at <> p_to
       or v_existing.after_created_at is distinct from p_after_created_at
       or v_existing.after_id is distinct from p_after_id
       or v_existing.row_limit <> p_limit then
      raise exception using errcode = '23505', message = 'economic_accounting_export_idempotency_conflict';
    end if;
    return v_existing.result_payload || pg_catalog.jsonb_build_object('idempotentReplay', true);
  end if;
  if (
    select pg_catalog.count(*)
    from private.economic_accounting_export_actions as recent_export
    where recent_export.actor_user_id = p_actor_user_id
      and recent_export.created_at >= pg_catalog.now() - interval '1 hour'
  ) >= 60 then
    raise exception using errcode = '54000', message = 'economic_accounting_export_rate_limited';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'exportVersion', 'economic-accounting-v1',
    'eventId', entry.id, 'effectiveAt', entry.effective_at,
    'recordedAt', entry.recorded_at, 'category', entry.category,
    'economicFlow', entry.economic_flow,
    'direction', entry.direction, 'grossMinor', entry.gross_minor,
    'refundMinor', entry.refund_minor, 'disputeMinor', entry.dispute_minor,
    'processorFeeMinor', entry.processor_fee_minor,
    'platformCommissionMinor', entry.platform_commission_minor,
    'sellerPayableMinor', entry.seller_payable_minor,
    'netMinor', entry.net_minor, 'currency', entry.currency,
    'internalOrderReference', entry.public_reference,
    'provider', entry.provider, 'providerEventDate', entry.effective_at,
    'jurisdiction', null, 'taxTreatmentPendingReview', true,
    'reconciliationStatus', entry.reconciliation_status
  ) order by entry.recorded_at, entry.id), '[]'::jsonb)
  into v_entries
  from (
    select all_entries.* from (
      select transaction.id, transaction.occurred_at as effective_at,
        transaction.created_at as recorded_at,
        case when transaction.status = 'succeeded' then 'payment_received' else 'payment_state' end as category,
        economic_order.flow as economic_flow,
        case when transaction.status = 'succeeded' then 'inflow' else 'memo' end as direction,
        transaction.gross_amount_minor as gross_minor,
        null::bigint as refund_minor, null::bigint as dispute_minor,
        coalesce(transaction.processor_fee_minor,settlement.processor_fee_minor) as processor_fee_minor,
        null::bigint as platform_commission_minor,
        null::bigint as seller_payable_minor,
        case when economic_order.flow = 'marketplace_purchase' then null::bigint
          else coalesce(transaction.net_amount_minor,settlement.net_amount_minor) end as net_minor,
        transaction.currency, economic_order.public_reference,
        transaction.provider,
        case
          when transaction.status = 'succeeded'
            and coalesce(transaction.processor_fee_minor,settlement.processor_fee_minor) is not null
            and coalesce(transaction.net_amount_minor,settlement.net_amount_minor) is not null
            then 'recorded'
          when transaction.status = 'succeeded'
            then 'settlement_details_pending'
          else 'review'
        end as reconciliation_status
      from private.economic_payment_transactions as transaction
      left join lateral private.economic_payment_settlement(transaction.id) settlement on true
      join private.economic_orders as economic_order on economic_order.id = transaction.order_id
      union all
      select refund.id, coalesce(refund.provider_event_created_at, refund.created_at), refund.created_at,
        'refund', economic_order.flow,
        case when refund.status = 'succeeded' then 'outflow' else 'memo' end,
        null::bigint, refund.amount_minor, null::bigint, null::bigint,
        null::bigint, null::bigint, null::bigint, refund.currency,
        economic_order.public_reference, refund.provider,
        case when refund.status = 'succeeded' then 'recorded' else 'review' end
      from private.economic_refunds as refund
      join private.economic_orders as economic_order on economic_order.id = refund.order_id
      union all
      select dispute.id, coalesce(dispute.provider_event_created_at, dispute.created_at), dispute.created_at,
        'dispute', economic_order.flow,
        case when dispute.status = 'lost' then 'outflow' else 'memo' end,
        null::bigint, null::bigint, dispute.amount_minor, null::bigint,
        null::bigint, null::bigint, null::bigint, dispute.currency,
        economic_order.public_reference, dispute.provider,
        case when dispute.status in ('won','prevented','warning_closed') then 'recorded' else 'review' end
      from private.economic_disputes as dispute
      join private.economic_orders as economic_order on economic_order.id = dispute.order_id
      union all
      select commission.id, commission.created_at, commission.created_at,
        'marketplace_allocation', 'marketplace_purchase', 'memo', commission.gross_delta_minor,
        null::bigint, null::bigint, null::bigint,
        commission.commission_delta_minor, commission.payable_delta_minor,
        null::bigint, commission.currency, economic_order.public_reference,
        economic_order.provider, 'recorded'
      from private.marketplace_commission_events as commission
      join private.economic_orders as economic_order on economic_order.id = commission.order_id
    ) as all_entries
    where all_entries.recorded_at >= p_from and all_entries.recorded_at < p_to
      and (p_after_created_at is null
        or (all_entries.recorded_at, all_entries.id) > (p_after_created_at, p_after_id))
    order by all_entries.recorded_at, all_entries.id
    limit p_limit
  ) as entry;
  v_result := pg_catalog.jsonb_build_object(
    'exportVersion', 'economic-accounting-v1',
    'entries', v_entries, 'limit', p_limit,
    'from', p_from, 'to', p_to,
    'providerIdentifiersExposed', false,
    'personalContactDataExposed', false,
    'testMode', private.economic_is_test_mode(), 'idempotentReplay', false
  );
  insert into private.economic_accounting_export_actions(
    client_request_id, actor_user_id, from_at, to_at,
    after_created_at, after_id, row_limit, result_payload
  ) values (
    p_client_request_id, p_actor_user_id, p_from, p_to,
    p_after_created_at, p_after_id, p_limit, v_result
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'economic_accounting_export_generated',
    'economic_accounting_export', p_client_request_id,
    'Bounded versioned accounting export generated.',
    pg_catalog.jsonb_build_object(
      'client_request_id', p_client_request_id, 'from', p_from, 'to', p_to,
      'row_count', pg_catalog.jsonb_array_length(v_entries), 'export_version', 'economic-accounting-v1'
    )
  );
  return v_result;
end;
$$;
alter function private.economic_runtime_mode() owner to postgres;
alter function private.economic_is_test_mode() owner to postgres;
alter function private.guard_economic_environment() owner to postgres;
alter function private.guard_economic_record_environment() owner to postgres;
alter function private.record_economic_provider_settlement(jsonb) owner to postgres;
alter function private.economic_payment_settlement(uuid) owner to postgres;
alter table private.economic_provider_settlements owner to postgres;
-- New private helpers have no browser or service-role invocation surface.
revoke all on function private.economic_runtime_mode(),private.economic_is_test_mode(),private.guard_economic_environment(),private.guard_economic_record_environment() from public,anon,authenticated,service_role;
commit;
