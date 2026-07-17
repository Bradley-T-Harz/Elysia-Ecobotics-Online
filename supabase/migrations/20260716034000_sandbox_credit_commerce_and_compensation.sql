-- Test-only sandbox credit commerce. No price or grant quantity is invented by
-- this migration: pack and program versions require explicit, audited service
-- configuration. Credit purchases remain disabled by default, and credits never
-- alter operational quotas, network policy, review status, or authority.

begin;

insert into private.economic_legal_document_versions (
  document_key, document_version, public_path, content_sha256
) values (
  'sandbox_credit_terms', '2026-07-16', '/legal/sandbox-credit-terms',
  '0935b5242ee9079dd0246b8e051b371839bf08ebd43c59480305e542553fc8d6'
) on conflict (document_key, document_version) do nothing;
insert into private.economic_active_legal_documents (
  document_key, document_version
)
select 'sandbox_credit_terms', '2026-07-16'
where not exists (
  select 1 from private.economic_active_legal_documents
  where document_key = 'sandbox_credit_terms'
);

create table private.sandbox_credit_pack_versions (
  id uuid primary key default gen_random_uuid(),
  pack_code text not null unique,
  price_id uuid not null unique references private.economic_prices(id) on delete restrict,
  granted_units bigint not null,
  expires_after_days integer,
  disclosure_version text not null,
  active boolean not null default true,
  test_mode boolean not null default true,
  approved_for_live_use boolean not null default false,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint sandbox_credit_pack_code_check
    check (pack_code ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint sandbox_credit_pack_units_check
    check (granted_units between 1 and 1000000000),
  constraint sandbox_credit_pack_expiry_check
    check (expires_after_days is null or expires_after_days between 1 and 3650),
  constraint sandbox_credit_pack_disclosure_check
    check (pg_catalog.char_length(disclosure_version) between 1 and 120),
  constraint sandbox_credit_pack_test_only_check
    check (test_mode = true and approved_for_live_use = false),
  constraint sandbox_credit_pack_retirement_check check (
    (active and retired_at is null) or (not active and retired_at is not null)
  )
);

create table private.sandbox_credit_program_versions (
  id uuid primary key default gen_random_uuid(),
  program_code text not null unique,
  source_category text not null,
  source_price_id uuid references private.economic_prices(id) on delete restrict,
  source_price_code_snapshot text,
  source_amount_minor_snapshot bigint,
  source_currency_snapshot text,
  source_recurring_interval_snapshot text,
  source_recurring_interval_count_snapshot integer,
  source_consent_bundle_version_snapshot text,
  sandbox_credit_terms_version_snapshot text,
  granted_units bigint not null,
  expires_after_days integer,
  one_time_per_user boolean not null default false,
  active boolean not null default false,
  test_mode boolean not null default true,
  approved_for_live_use boolean not null default false,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint sandbox_credit_program_code_check
    check (program_code ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint sandbox_credit_program_source_check check (
    source_category in (
      'starter', 'recurring_support', 'sponsored', 'waiver', 'waived',
      'operational', 'test'
    )
  ),
  constraint sandbox_credit_program_price_check check (
    (
      source_category = 'recurring_support'
      and source_price_id is not null
      and source_price_code_snapshot is not null
      and source_amount_minor_snapshot is not null
      and source_currency_snapshot is not null
      and source_recurring_interval_snapshot is not null
      and source_recurring_interval_count_snapshot is not null
      and source_consent_bundle_version_snapshot is not null
      and sandbox_credit_terms_version_snapshot is not null
    ) or (
      source_category <> 'recurring_support'
      and source_price_id is null
      and source_price_code_snapshot is null
      and source_amount_minor_snapshot is null
      and source_currency_snapshot is null
      and source_recurring_interval_snapshot is null
      and source_recurring_interval_count_snapshot is null
      and source_consent_bundle_version_snapshot is null
      and sandbox_credit_terms_version_snapshot is null
    )
  ),
  constraint sandbox_credit_program_units_check
    check (granted_units between 1 and 1000000000),
  constraint sandbox_credit_program_expiry_check
    check (expires_after_days is null or expires_after_days between 1 and 3650),
  constraint sandbox_credit_program_test_only_check
    check (test_mode = true and approved_for_live_use = false),
  constraint sandbox_credit_program_retirement_check check (
    (active and retired_at is null) or (not active and retired_at is not null)
  )
);

create unique index sandbox_credit_program_active_price_idx
  on private.sandbox_credit_program_versions(source_price_id)
  where source_price_id is not null and active = true;

create table private.sandbox_credit_order_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references private.economic_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  pack_version_id uuid not null references private.sandbox_credit_pack_versions(id) on delete restrict,
  credit_lot_id uuid not null unique references private.sandbox_credit_lots(id) on delete restrict,
  granted_units bigint not null,
  permanent_adjusted_units bigint not null default 0,
  dispute_held_units bigint not null default 0,
  status text not null default 'active',
  fulfilled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sandbox_credit_fulfillment_units_check check (
    granted_units > 0
    and permanent_adjusted_units >= 0
    and dispute_held_units >= 0
    and permanent_adjusted_units + dispute_held_units <= granted_units
  ),
  constraint sandbox_credit_fulfillment_status_check check (
    status in ('active', 'partially_adjusted', 'fully_adjusted', 'dispute_held', 'reconciliation_required')
  )
);

create table private.sandbox_credit_adjustment_shortfalls (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null references private.sandbox_credit_order_fulfillments(id) on delete restrict,
  adjustment_kind text not null,
  target_units bigint not null,
  applied_units bigint not null,
  missing_units bigint not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (fulfillment_id, adjustment_kind, target_units),
  constraint sandbox_credit_shortfall_kind_check
    check (adjustment_kind in ('refund_or_lost_dispute', 'active_dispute_hold')),
  constraint sandbox_credit_shortfall_units_check check (
    target_units > 0 and applied_units >= 0 and missing_units > 0
    and applied_units + missing_units = target_units
  ),
  constraint sandbox_credit_shortfall_status_check
    check (status in ('open', 'reviewed', 'resolved')),
  constraint sandbox_credit_shortfall_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create table private.sandbox_credit_recurring_payment_fulfillments (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null unique
    references private.economic_payment_transactions(id) on delete restrict,
  order_id uuid not null references private.economic_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  program_version_id uuid not null
    references private.sandbox_credit_program_versions(id) on delete restrict,
  credit_lot_id uuid not null unique references private.sandbox_credit_lots(id) on delete restrict,
  granted_units bigint not null,
  permanent_adjusted_units bigint not null default 0,
  dispute_held_units bigint not null default 0,
  status text not null default 'active',
  fulfilled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sandbox_credit_recurring_fulfillment_units_check check (
    granted_units > 0
    and permanent_adjusted_units >= 0
    and dispute_held_units >= 0
    and permanent_adjusted_units + dispute_held_units <= granted_units
  ),
  constraint sandbox_credit_recurring_fulfillment_status_check check (
    status in ('active', 'partially_adjusted', 'fully_adjusted', 'dispute_held', 'reconciliation_required')
  )
);

create table private.sandbox_credit_recurring_adjustment_shortfalls (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null
    references private.sandbox_credit_recurring_payment_fulfillments(id) on delete restrict,
  adjustment_kind text not null,
  target_units bigint not null,
  applied_units bigint not null,
  missing_units bigint not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (fulfillment_id, adjustment_kind, target_units),
  constraint sandbox_credit_recurring_shortfall_kind_check
    check (adjustment_kind in ('refund_or_lost_dispute', 'active_dispute_hold')),
  constraint sandbox_credit_recurring_shortfall_units_check check (
    target_units > 0 and applied_units >= 0 and missing_units > 0
    and applied_units + missing_units = target_units
  ),
  constraint sandbox_credit_recurring_shortfall_status_check
    check (status in ('open', 'reviewed', 'resolved')),
  constraint sandbox_credit_recurring_shortfall_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create table private.sandbox_credit_program_operator_actions (
  client_request_id uuid primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  program_version_id uuid not null
    references private.sandbox_credit_program_versions(id) on delete restrict,
  action text not null,
  target_user_id uuid references auth.users(id) on delete restrict,
  source_reference text,
  private_reason text not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint sandbox_credit_program_action_check
    check (action in ('activate', 'deactivate', 'grant')),
  constraint sandbox_credit_program_action_target_check check (
    (action = 'grant' and target_user_id is not null)
    or (action <> 'grant' and target_user_id is null and source_reference is null)
  ),
  constraint sandbox_credit_program_action_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint sandbox_credit_program_action_result_check
    check (pg_catalog.jsonb_typeof(result_payload) = 'object')
);

do $sandbox_credit_commerce_table_hardening$
declare
  v_table text;
begin
  foreach v_table in array array[
    'sandbox_credit_pack_versions', 'sandbox_credit_program_versions',
    'sandbox_credit_order_fulfillments', 'sandbox_credit_adjustment_shortfalls',
    'sandbox_credit_recurring_payment_fulfillments',
    'sandbox_credit_recurring_adjustment_shortfalls',
    'sandbox_credit_program_operator_actions'
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
$sandbox_credit_commerce_table_hardening$;

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
      'test_mode', true
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
    'testMode', true
  );
end;
$$;

alter function public.configure_sandbox_test_credit_pack(
  text, text, bigint, text, bigint, integer, text, text, text
) owner to postgres;

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
      'test_mode', true
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
    'testMode', true
  );
end;
$$;

alter function public.configure_sandbox_test_credit_program(
  text, text, text, bigint, integer, boolean, boolean, text, text
) owner to postgres;

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
    'testMode', true
  );
end;
$$;

alter function public.prepare_sandbox_credit_checkout(uuid, uuid, text, text, text)
  owner to postgres;

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
    'testMode', true,
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
            'testMode', true
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

alter function public.sandbox_credit_pack_catalog() owner to postgres;

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
      'testMode', true
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
    'testMode', true
  );
end;
$$;

alter function public.grant_sandbox_credit_program(uuid, text, text, text, text)
  owner to postgres;

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
    'testMode', true,
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
      'test_mode', true,
      'no_safety_or_authority_change', true
    )
  );
  return v_result;
end;
$$;

alter function public.set_sandbox_test_credit_program_status(
  uuid, uuid, text, boolean, text, text
) owner to postgres;

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
      'test_mode', true,
      'no_safety_or_authority_change', true
    )
  );
  return v_result;
end;
$$;

alter function public.operator_grant_sandbox_credit_program(
  uuid, uuid, uuid, text, text, text
) owner to postgres;

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
      'test_mode', true,
      'no_safety_or_authority_change', true
    )
  );
  return new;
end;
$$;

alter function private.fulfill_paid_sandbox_credit_order() owner to postgres;
revoke all privileges on function private.fulfill_paid_sandbox_credit_order()
  from public, anon, authenticated, service_role;

create trigger economic_orders_fulfill_sandbox_credit_purchase
after update of status on private.economic_orders
for each row execute function private.fulfill_paid_sandbox_credit_order();

create or replace function private.grant_recurring_sandbox_program_from_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_item private.economic_order_items%rowtype;
  v_price private.economic_prices%rowtype;
  v_program private.sandbox_credit_program_versions%rowtype;
  v_fulfillment private.sandbox_credit_recurring_payment_fulfillments%rowtype;
  v_result jsonb;
  v_lot_id uuid;
  v_item_count integer;
begin
  if new.transaction_type <> 'payment' or new.status <> 'succeeded' then
    return new;
  end if;
  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = new.order_id;
  if not found or v_order.flow <> 'support_recurring' or v_order.user_id is null then
    return new;
  end if;
  select pg_catalog.count(*) into v_item_count
  from private.economic_order_items as item
  where item.order_id = v_order.id
    and item.product_key = 'support_recurring';
  if v_item_count <> 1 then
    return new;
  end if;
  select * into v_item
  from private.economic_order_items as item
  where item.order_id = v_order.id
    and item.product_key = 'support_recurring';
  select * into v_program
  from private.sandbox_credit_program_versions as program
  where program.source_category = 'recurring_support'
    and program.source_price_id = v_item.price_id
    and program.active = true
    and program.test_mode = true
    and program.approved_for_live_use = false
    and program.retired_at is null;
  if not found then
    return new;
  end if;
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
     or v_item.price_code_snapshot <> v_program.source_price_code_snapshot
     or v_item.unit_amount_minor <> v_program.source_amount_minor_snapshot
     or v_item.total_amount_minor <> new.gross_amount_minor
     or v_item.currency <> v_program.source_currency_snapshot
     or v_item.currency <> new.currency
     or v_item.recurring_interval_snapshot <> v_program.source_recurring_interval_snapshot
     or v_order.consent_version <> v_program.source_consent_bundle_version_snapshot
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
    return new;
  end if;

  select * into v_fulfillment
  from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
  where fulfillment.payment_transaction_id = new.id;
  if found then
    return new;
  end if;

  v_result := public.grant_sandbox_credit_program(
    v_order.user_id,
    v_program.program_code,
    'payment-transaction:' || new.id::text,
    'sandbox-recurring:' || new.id::text,
    'Configured recurring-support sandbox credit grant.'
  );
  v_lot_id := nullif(v_result ->> 'creditLotId', '')::uuid;

  insert into private.sandbox_credit_recurring_payment_fulfillments (
    payment_transaction_id, order_id, user_id, program_version_id,
    credit_lot_id, granted_units, fulfilled_at
  ) values (
    new.id, v_order.id, v_order.user_id, v_program.id,
    v_lot_id, v_program.granted_units, coalesce(new.occurred_at, pg_catalog.now())
  )
  on conflict (payment_transaction_id) do nothing
  returning * into v_fulfillment;
  if not found then
    return new;
  end if;

  insert into private.economic_entitlements (
    user_id, entitlement_key, source_type, source_id, status,
    starts_at, ends_at
  ) values (
    v_order.user_id, 'sandbox_credit_lot', 'payment_transaction', new.id, 'active',
    coalesce(new.occurred_at, pg_catalog.now()), nullif(v_result ->> 'expiresAt', '')::timestamptz
  );
  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    'provider_webhook', 'sandbox_recurring_payment_credit_fulfilled',
    'sandbox_credit_recurring_payment_fulfillment', v_fulfillment.id,
    'Active reviewed test program matched one verified recurring payment.',
    pg_catalog.jsonb_build_object(
      'payment_transaction_id', new.id,
      'order_id', v_order.id,
      'program_version_id', v_program.id,
      'granted_units', v_program.granted_units,
      'test_mode', true,
      'no_safety_or_authority_change', true
    )
  );
  return new;
end;
$$;

alter function private.grant_recurring_sandbox_program_from_payment() owner to postgres;
revoke all privileges on function private.grant_recurring_sandbox_program_from_payment()
  from public, anon, authenticated, service_role;

create trigger economic_payments_grant_recurring_sandbox_program
after insert or update of status on private.economic_payment_transactions
for each row execute function private.grant_recurring_sandbox_program_from_payment();

create or replace function private.reconcile_sandbox_credit_order_adjustments(
  p_order_id uuid,
  p_trigger_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_fulfillment private.sandbox_credit_order_fulfillments%rowtype;
  v_lot private.sandbox_credit_lots%rowtype;
  v_refunded_amount bigint;
  v_lost_dispute_amount bigint;
  v_active_dispute_amount bigint;
  v_target_permanent bigint;
  v_target_hold bigint;
  v_delta bigint;
  v_take bigint;
  v_available bigint;
  v_missing bigint;
begin
  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = p_order_id
  for update;
  if not found or v_order.flow <> 'sandbox_credits' then
    return;
  end if;
  select * into v_fulfillment
  from private.sandbox_credit_order_fulfillments as fulfillment
  where fulfillment.order_id = p_order_id
  for update;
  if not found then
    return;
  end if;
  select * into v_lot
  from private.sandbox_credit_lots as lot
  where lot.id = v_fulfillment.credit_lot_id
  for update;

  select coalesce(pg_catalog.sum(refund.amount_minor), 0)
  into v_refunded_amount
  from private.economic_refunds as refund
  where refund.order_id = p_order_id and refund.status = 'succeeded';
  select coalesce(pg_catalog.sum(dispute.amount_minor), 0)
  into v_lost_dispute_amount
  from private.economic_disputes as dispute
  where dispute.order_id = p_order_id and dispute.status = 'lost';
  select coalesce(pg_catalog.sum(dispute.amount_minor), 0)
  into v_active_dispute_amount
  from private.economic_disputes as dispute
  where dispute.order_id = p_order_id
    and dispute.status in (
      'warning_needs_response', 'warning_under_review',
      'needs_response', 'under_review'
    );

  v_target_permanent := pg_catalog.floor(
    v_fulfillment.granted_units::numeric
    * least(v_order.total_minor, v_refunded_amount + v_lost_dispute_amount)::numeric
    / v_order.total_minor::numeric
  )::bigint;
  v_target_hold := pg_catalog.floor(
    v_fulfillment.granted_units::numeric
    * least(
        greatest(v_order.total_minor - v_refunded_amount - v_lost_dispute_amount, 0),
        v_active_dispute_amount
      )::numeric
    / v_order.total_minor::numeric
  )::bigint;
  v_target_hold := least(
    v_target_hold,
    v_fulfillment.granted_units - v_target_permanent
  );

  -- A provider reversal restores only this order's own permanent adjustment.
  -- It cannot create a negative balance or touch unrelated credit lots.
  if v_target_permanent < v_fulfillment.permanent_adjusted_units then
    v_delta := v_fulfillment.permanent_adjusted_units - v_target_permanent;
    update private.sandbox_credit_lots
    set adjusted_units = adjusted_units - v_delta
    where id = v_lot.id;
    update private.sandbox_credit_order_fulfillments
    set permanent_adjusted_units = permanent_adjusted_units - v_delta
    where id = v_fulfillment.id;
    insert into private.sandbox_credit_ledger_entries (
      user_id, credit_lot_id, entry_type, units_delta,
      balance_delta_units, reserved_delta_units, source_category,
      idempotency_key
    ) values (
      v_fulfillment.user_id, v_lot.id, 'compensating_credit', v_delta,
      v_delta, 0, case when p_trigger_kind = 'dispute' then 'dispute' else 'refund' end,
      'sandbox-adjust-restore:' || v_fulfillment.id::text || ':' || v_target_permanent::text
    ) on conflict (idempotency_key) do nothing;
    v_fulfillment.permanent_adjusted_units := v_target_permanent;
    v_lot.adjusted_units := v_lot.adjusted_units - v_delta;
  end if;

  if v_target_permanent > v_fulfillment.permanent_adjusted_units then
    v_delta := v_target_permanent - v_fulfillment.permanent_adjusted_units;

    -- Convert this order's active dispute hold before touching free units.
    v_take := least(v_delta, v_fulfillment.dispute_held_units);
    if v_take > 0 then
      update private.sandbox_credit_lots
      set reserved_units = reserved_units - v_take,
          adjusted_units = adjusted_units + v_take
      where id = v_lot.id;
      update private.sandbox_credit_order_fulfillments
      set dispute_held_units = dispute_held_units - v_take,
          permanent_adjusted_units = permanent_adjusted_units + v_take
      where id = v_fulfillment.id;
      insert into private.sandbox_credit_ledger_entries (
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category,
        idempotency_key
      ) values (
        v_fulfillment.user_id, v_lot.id, 'dispute_hold', v_take,
        0, -v_take, 'dispute',
        'sandbox-adjust-convert-release:' || v_fulfillment.id::text || ':' || v_target_permanent::text
      ) on conflict (idempotency_key) do nothing;
      insert into private.sandbox_credit_ledger_entries (
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category,
        idempotency_key
      ) values (
        v_fulfillment.user_id, v_lot.id, 'refund_adjustment', -v_take,
        -v_take, 0, case when p_trigger_kind = 'dispute' then 'dispute' else 'refund' end,
        'sandbox-adjust-convert-debit:' || v_fulfillment.id::text || ':' || v_target_permanent::text
      ) on conflict (idempotency_key) do nothing;
      v_delta := v_delta - v_take;
      v_fulfillment.dispute_held_units := v_fulfillment.dispute_held_units - v_take;
      v_fulfillment.permanent_adjusted_units := v_fulfillment.permanent_adjusted_units + v_take;
      v_lot.reserved_units := v_lot.reserved_units - v_take;
      v_lot.adjusted_units := v_lot.adjusted_units + v_take;
    end if;

    v_available := greatest(
      v_lot.granted_units - v_lot.consumed_units - v_lot.reserved_units
      - v_lot.expired_units - v_lot.adjusted_units,
      0
    );
    v_take := least(v_delta, v_available);
    if v_take > 0 then
      update private.sandbox_credit_lots
      set adjusted_units = adjusted_units + v_take
      where id = v_lot.id;
      update private.sandbox_credit_order_fulfillments
      set permanent_adjusted_units = permanent_adjusted_units + v_take
      where id = v_fulfillment.id;
      insert into private.sandbox_credit_ledger_entries (
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category,
        idempotency_key
      ) values (
        v_fulfillment.user_id, v_lot.id, 'refund_adjustment', -v_take,
        -v_take, 0, case when p_trigger_kind = 'dispute' then 'dispute' else 'refund' end,
        'sandbox-adjust-debit:' || v_fulfillment.id::text || ':' || v_target_permanent::text
      ) on conflict (idempotency_key) do nothing;
      v_delta := v_delta - v_take;
      v_fulfillment.permanent_adjusted_units := v_fulfillment.permanent_adjusted_units + v_take;
      v_lot.adjusted_units := v_lot.adjusted_units + v_take;
    end if;

    if v_delta > 0 then
      insert into private.sandbox_credit_adjustment_shortfalls (
        fulfillment_id, adjustment_kind, target_units, applied_units, missing_units
      ) values (
        v_fulfillment.id, 'refund_or_lost_dispute', v_target_permanent,
        v_target_permanent - v_delta, v_delta
      ) on conflict (fulfillment_id, adjustment_kind, target_units) do nothing;
    end if;
  end if;

  -- Re-read after permanent adjustments before placing/releasing a temporary
  -- provider-dispute hold.
  select * into v_lot
  from private.sandbox_credit_lots as lot
  where lot.id = v_fulfillment.credit_lot_id
  for update;
  select * into v_fulfillment
  from private.sandbox_credit_order_fulfillments as fulfillment
  where fulfillment.id = v_fulfillment.id
  for update;

  if v_target_hold < v_fulfillment.dispute_held_units then
    v_delta := v_fulfillment.dispute_held_units - v_target_hold;
    update private.sandbox_credit_lots
    set reserved_units = reserved_units - v_delta
    where id = v_lot.id;
    update private.sandbox_credit_order_fulfillments
    set dispute_held_units = dispute_held_units - v_delta
    where id = v_fulfillment.id;
    insert into private.sandbox_credit_ledger_entries (
      user_id, credit_lot_id, entry_type, units_delta,
      balance_delta_units, reserved_delta_units, source_category,
      idempotency_key
    ) values (
      v_fulfillment.user_id, v_lot.id, 'dispute_hold', v_delta,
      0, -v_delta, 'dispute',
      'sandbox-dispute-release:' || v_fulfillment.id::text || ':' || v_target_hold::text
    ) on conflict (idempotency_key) do nothing;
    v_fulfillment.dispute_held_units := v_target_hold;
    v_lot.reserved_units := v_lot.reserved_units - v_delta;
  elsif v_target_hold > v_fulfillment.dispute_held_units then
    v_delta := v_target_hold - v_fulfillment.dispute_held_units;
    v_available := greatest(
      v_lot.granted_units - v_lot.consumed_units - v_lot.reserved_units
      - v_lot.expired_units - v_lot.adjusted_units,
      0
    );
    v_take := least(v_delta, v_available);
    if v_take > 0 then
      update private.sandbox_credit_lots
      set reserved_units = reserved_units + v_take
      where id = v_lot.id;
      update private.sandbox_credit_order_fulfillments
      set dispute_held_units = dispute_held_units + v_take
      where id = v_fulfillment.id;
      insert into private.sandbox_credit_ledger_entries (
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category,
        idempotency_key
      ) values (
        v_fulfillment.user_id, v_lot.id, 'dispute_hold', -v_take,
        0, v_take, 'dispute',
        'sandbox-dispute-hold:' || v_fulfillment.id::text || ':' || v_target_hold::text
      ) on conflict (idempotency_key) do nothing;
    end if;
    v_missing := v_delta - v_take;
    if v_missing > 0 then
      insert into private.sandbox_credit_adjustment_shortfalls (
        fulfillment_id, adjustment_kind, target_units, applied_units, missing_units
      ) values (
        v_fulfillment.id, 'active_dispute_hold', v_target_hold,
        v_target_hold - v_missing, v_missing
      ) on conflict (fulfillment_id, adjustment_kind, target_units) do nothing;
    end if;
  end if;

  -- A later provider state or newly available compensating units can close a
  -- previously recorded shortfall; preserve the row as durable history.
  update private.sandbox_credit_adjustment_shortfalls
  set status = 'resolved', resolved_at = pg_catalog.now()
  where fulfillment_id = v_fulfillment.id
    and status <> 'resolved'
    and (
      (adjustment_kind = 'refund_or_lost_dispute' and (
        select fulfillment.permanent_adjusted_units
        from private.sandbox_credit_order_fulfillments as fulfillment
        where fulfillment.id = v_fulfillment.id
      ) >= target_units)
      or
      (adjustment_kind = 'active_dispute_hold' and (
        select fulfillment.dispute_held_units
        from private.sandbox_credit_order_fulfillments as fulfillment
        where fulfillment.id = v_fulfillment.id
      ) >= target_units)
    );

  update private.sandbox_credit_order_fulfillments
  set
    status = case
      when exists (
        select 1 from private.sandbox_credit_adjustment_shortfalls as shortfall
        where shortfall.fulfillment_id = v_fulfillment.id and shortfall.status = 'open'
      ) then 'reconciliation_required'
      when permanent_adjusted_units >= granted_units then 'fully_adjusted'
      when dispute_held_units > 0 then 'dispute_held'
      when permanent_adjusted_units > 0 then 'partially_adjusted'
      else 'active'
    end,
    updated_at = pg_catalog.now()
  where id = v_fulfillment.id;

  update private.economic_entitlements
  set
    status = case
      when v_target_permanent >= v_fulfillment.granted_units then 'revoked'
      when v_target_hold > 0 then 'suspended'
      else 'active'
    end,
    revoked_at = case
      when v_target_permanent >= v_fulfillment.granted_units then coalesce(revoked_at, pg_catalog.now())
      else null
    end,
    revoked_reason = case
      when v_target_permanent >= v_fulfillment.granted_units then 'economic_order_reversed'
      else null
    end
  where source_type = 'economic_order'
    and source_id = p_order_id
    and entitlement_key = 'sandbox_credit_lot';
end;
$$;

alter function private.reconcile_sandbox_credit_order_adjustments(uuid, text)
  owner to postgres;
revoke all privileges on function private.reconcile_sandbox_credit_order_adjustments(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.reconcile_recurring_sandbox_payment_adjustments(
  p_payment_transaction_id uuid,
  p_trigger_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment private.economic_payment_transactions%rowtype;
  v_fulfillment private.sandbox_credit_recurring_payment_fulfillments%rowtype;
  v_lot private.sandbox_credit_lots%rowtype;
  v_final private.sandbox_credit_recurring_payment_fulfillments%rowtype;
  v_refunded_amount bigint;
  v_lost_dispute_amount bigint;
  v_active_dispute_amount bigint;
  v_target_permanent bigint;
  v_target_hold bigint;
  v_delta bigint;
  v_take bigint;
  v_available bigint;
  v_missing bigint;
  v_has_open_shortfall boolean;
begin
  select * into v_payment
  from private.economic_payment_transactions as payment
  where payment.id = p_payment_transaction_id
    and payment.transaction_type = 'payment'
    and payment.status in ('succeeded', 'refunded', 'disputed')
  for update;
  if not found or v_payment.gross_amount_minor <= 0 then
    return;
  end if;
  select * into v_fulfillment
  from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
  where fulfillment.payment_transaction_id = p_payment_transaction_id
  for update;
  if not found then
    return;
  end if;
  select * into v_lot
  from private.sandbox_credit_lots as lot
  where lot.id = v_fulfillment.credit_lot_id
  for update;

  select coalesce(pg_catalog.sum(refund.amount_minor), 0)
  into v_refunded_amount
  from private.economic_refunds as refund
  where refund.payment_transaction_id = p_payment_transaction_id
    and refund.status = 'succeeded';
  select coalesce(pg_catalog.sum(dispute.amount_minor), 0)
  into v_lost_dispute_amount
  from private.economic_disputes as dispute
  where dispute.payment_transaction_id = p_payment_transaction_id
    and dispute.status = 'lost';
  select coalesce(pg_catalog.sum(dispute.amount_minor), 0)
  into v_active_dispute_amount
  from private.economic_disputes as dispute
  where dispute.payment_transaction_id = p_payment_transaction_id
    and dispute.status in (
      'warning_needs_response', 'warning_under_review',
      'needs_response', 'under_review'
    );

  v_target_permanent := pg_catalog.floor(
    v_fulfillment.granted_units::numeric
    * least(v_payment.gross_amount_minor, v_refunded_amount + v_lost_dispute_amount)::numeric
    / v_payment.gross_amount_minor::numeric
  )::bigint;
  v_target_hold := pg_catalog.floor(
    v_fulfillment.granted_units::numeric
    * least(
        greatest(v_payment.gross_amount_minor - v_refunded_amount - v_lost_dispute_amount, 0),
        v_active_dispute_amount
      )::numeric
    / v_payment.gross_amount_minor::numeric
  )::bigint;
  v_target_hold := least(
    v_target_hold,
    v_fulfillment.granted_units - v_target_permanent
  );

  if v_target_permanent < v_fulfillment.permanent_adjusted_units then
    v_delta := v_fulfillment.permanent_adjusted_units - v_target_permanent;
    update private.sandbox_credit_lots
    set adjusted_units = adjusted_units - v_delta
    where id = v_lot.id;
    update private.sandbox_credit_recurring_payment_fulfillments
    set permanent_adjusted_units = permanent_adjusted_units - v_delta
    where id = v_fulfillment.id;
    insert into private.sandbox_credit_ledger_entries (
      user_id, credit_lot_id, entry_type, units_delta,
      balance_delta_units, reserved_delta_units, source_category,
      idempotency_key
    ) values (
      v_fulfillment.user_id, v_lot.id, 'compensating_credit', v_delta,
      v_delta, 0, case when p_trigger_kind = 'dispute' then 'dispute' else 'refund' end,
      'sandbox-recurring-adjust-restore:' || v_fulfillment.id::text || ':' || v_target_permanent::text
    ) on conflict (idempotency_key) do nothing;
    v_fulfillment.permanent_adjusted_units := v_target_permanent;
    v_lot.adjusted_units := v_lot.adjusted_units - v_delta;
  end if;

  if v_target_permanent > v_fulfillment.permanent_adjusted_units then
    v_delta := v_target_permanent - v_fulfillment.permanent_adjusted_units;
    v_take := least(v_delta, v_fulfillment.dispute_held_units);
    if v_take > 0 then
      update private.sandbox_credit_lots
      set reserved_units = reserved_units - v_take,
          adjusted_units = adjusted_units + v_take
      where id = v_lot.id;
      update private.sandbox_credit_recurring_payment_fulfillments
      set dispute_held_units = dispute_held_units - v_take,
          permanent_adjusted_units = permanent_adjusted_units + v_take
      where id = v_fulfillment.id;
      insert into private.sandbox_credit_ledger_entries (
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category,
        idempotency_key
      ) values (
        v_fulfillment.user_id, v_lot.id, 'dispute_hold', v_take,
        0, -v_take, 'dispute',
        'sandbox-recurring-adjust-convert-release:' || v_fulfillment.id::text || ':' || v_target_permanent::text
      ) on conflict (idempotency_key) do nothing;
      insert into private.sandbox_credit_ledger_entries (
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category,
        idempotency_key
      ) values (
        v_fulfillment.user_id, v_lot.id, 'refund_adjustment', -v_take,
        -v_take, 0, case when p_trigger_kind = 'dispute' then 'dispute' else 'refund' end,
        'sandbox-recurring-adjust-convert-debit:' || v_fulfillment.id::text || ':' || v_target_permanent::text
      ) on conflict (idempotency_key) do nothing;
      v_delta := v_delta - v_take;
      v_fulfillment.dispute_held_units := v_fulfillment.dispute_held_units - v_take;
      v_fulfillment.permanent_adjusted_units := v_fulfillment.permanent_adjusted_units + v_take;
      v_lot.reserved_units := v_lot.reserved_units - v_take;
      v_lot.adjusted_units := v_lot.adjusted_units + v_take;
    end if;

    v_available := greatest(
      v_lot.granted_units - v_lot.consumed_units - v_lot.reserved_units
      - v_lot.expired_units - v_lot.adjusted_units,
      0
    );
    v_take := least(v_delta, v_available);
    if v_take > 0 then
      update private.sandbox_credit_lots
      set adjusted_units = adjusted_units + v_take
      where id = v_lot.id;
      update private.sandbox_credit_recurring_payment_fulfillments
      set permanent_adjusted_units = permanent_adjusted_units + v_take
      where id = v_fulfillment.id;
      insert into private.sandbox_credit_ledger_entries (
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category,
        idempotency_key
      ) values (
        v_fulfillment.user_id, v_lot.id, 'refund_adjustment', -v_take,
        -v_take, 0, case when p_trigger_kind = 'dispute' then 'dispute' else 'refund' end,
        'sandbox-recurring-adjust-debit:' || v_fulfillment.id::text || ':' || v_target_permanent::text
      ) on conflict (idempotency_key) do nothing;
      v_delta := v_delta - v_take;
      v_fulfillment.permanent_adjusted_units := v_fulfillment.permanent_adjusted_units + v_take;
      v_lot.adjusted_units := v_lot.adjusted_units + v_take;
    end if;
    if v_delta > 0 then
      insert into private.sandbox_credit_recurring_adjustment_shortfalls (
        fulfillment_id, adjustment_kind, target_units, applied_units, missing_units
      ) values (
        v_fulfillment.id, 'refund_or_lost_dispute', v_target_permanent,
        v_target_permanent - v_delta, v_delta
      ) on conflict (fulfillment_id, adjustment_kind, target_units) do update
      set applied_units = excluded.applied_units,
          missing_units = excluded.missing_units,
          status = 'open', resolved_at = null;
    end if;
  end if;

  select * into v_lot
  from private.sandbox_credit_lots as lot
  where lot.id = v_fulfillment.credit_lot_id
  for update;
  select * into v_fulfillment
  from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
  where fulfillment.id = v_fulfillment.id
  for update;

  if v_target_hold < v_fulfillment.dispute_held_units then
    v_delta := v_fulfillment.dispute_held_units - v_target_hold;
    update private.sandbox_credit_lots
    set reserved_units = reserved_units - v_delta
    where id = v_lot.id;
    update private.sandbox_credit_recurring_payment_fulfillments
    set dispute_held_units = dispute_held_units - v_delta
    where id = v_fulfillment.id;
    insert into private.sandbox_credit_ledger_entries (
      user_id, credit_lot_id, entry_type, units_delta,
      balance_delta_units, reserved_delta_units, source_category,
      idempotency_key
    ) values (
      v_fulfillment.user_id, v_lot.id, 'dispute_hold', v_delta,
      0, -v_delta, 'dispute',
      'sandbox-recurring-dispute-release:' || v_fulfillment.id::text || ':' || v_target_hold::text
    ) on conflict (idempotency_key) do nothing;
  elsif v_target_hold > v_fulfillment.dispute_held_units then
    v_delta := v_target_hold - v_fulfillment.dispute_held_units;
    v_available := greatest(
      v_lot.granted_units - v_lot.consumed_units - v_lot.reserved_units
      - v_lot.expired_units - v_lot.adjusted_units,
      0
    );
    v_take := least(v_delta, v_available);
    if v_take > 0 then
      update private.sandbox_credit_lots
      set reserved_units = reserved_units + v_take
      where id = v_lot.id;
      update private.sandbox_credit_recurring_payment_fulfillments
      set dispute_held_units = dispute_held_units + v_take
      where id = v_fulfillment.id;
      insert into private.sandbox_credit_ledger_entries (
        user_id, credit_lot_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units, source_category,
        idempotency_key
      ) values (
        v_fulfillment.user_id, v_lot.id, 'dispute_hold', -v_take,
        0, v_take, 'dispute',
        'sandbox-recurring-dispute-hold:' || v_fulfillment.id::text || ':' || v_target_hold::text
      ) on conflict (idempotency_key) do nothing;
    end if;
    v_missing := v_delta - v_take;
    if v_missing > 0 then
      insert into private.sandbox_credit_recurring_adjustment_shortfalls (
        fulfillment_id, adjustment_kind, target_units, applied_units, missing_units
      ) values (
        v_fulfillment.id, 'active_dispute_hold', v_target_hold,
        v_target_hold - v_missing, v_missing
      ) on conflict (fulfillment_id, adjustment_kind, target_units) do update
      set applied_units = excluded.applied_units,
          missing_units = excluded.missing_units,
          status = 'open', resolved_at = null;
    end if;
  end if;

  update private.sandbox_credit_recurring_adjustment_shortfalls as shortfall
  set status = 'resolved', resolved_at = pg_catalog.now()
  where shortfall.fulfillment_id = v_fulfillment.id
    and shortfall.status <> 'resolved'
    and (
      (shortfall.adjustment_kind = 'refund_or_lost_dispute' and (
        shortfall.target_units > v_target_permanent
        or (select fulfillment.permanent_adjusted_units
            from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
            where fulfillment.id = v_fulfillment.id) >= shortfall.target_units
      ))
      or
      (shortfall.adjustment_kind = 'active_dispute_hold' and (
        shortfall.target_units > v_target_hold
        or (select fulfillment.dispute_held_units
            from private.sandbox_credit_recurring_payment_fulfillments as fulfillment
            where fulfillment.id = v_fulfillment.id) >= shortfall.target_units
      ))
    );

  select exists (
    select 1
    from private.sandbox_credit_recurring_adjustment_shortfalls as shortfall
    where shortfall.fulfillment_id = v_fulfillment.id
      and shortfall.status = 'open'
  ) into v_has_open_shortfall;
  update private.sandbox_credit_recurring_payment_fulfillments
  set
    status = case
      when v_has_open_shortfall then 'reconciliation_required'
      when permanent_adjusted_units >= granted_units then 'fully_adjusted'
      when dispute_held_units > 0 then 'dispute_held'
      when permanent_adjusted_units > 0 then 'partially_adjusted'
      else 'active'
    end,
    updated_at = pg_catalog.now()
  where id = v_fulfillment.id
  returning * into v_final;

  update private.economic_entitlements
  set
    status = case
      when v_target_permanent >= v_fulfillment.granted_units then 'revoked'
      when v_target_hold > 0 then 'suspended'
      else 'active'
    end,
    revoked_at = case
      when v_target_permanent >= v_fulfillment.granted_units
      then coalesce(revoked_at, pg_catalog.now()) else null
    end,
    revoked_reason = case
      when v_target_permanent >= v_fulfillment.granted_units
      then 'recurring_payment_reversed' else null
    end
  where source_type = 'payment_transaction'
    and source_id = p_payment_transaction_id
    and entitlement_key = 'sandbox_credit_lot';

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    'provider_webhook', 'sandbox_recurring_payment_credit_reconciled',
    'sandbox_credit_recurring_payment_fulfillment', v_final.id,
    'Payment-scoped recurring sandbox credit compensation reconciled.',
    pg_catalog.jsonb_build_object(
      'payment_transaction_id', p_payment_transaction_id,
      'trigger_kind', p_trigger_kind,
      'target_permanent_units', v_target_permanent,
      'target_dispute_hold_units', v_target_hold,
      'applied_permanent_units', v_final.permanent_adjusted_units,
      'applied_dispute_hold_units', v_final.dispute_held_units,
      'status', v_final.status,
      'shortfall_open', v_has_open_shortfall,
      'no_safety_or_authority_change', true
    )
  );
end;
$$;

alter function private.reconcile_recurring_sandbox_payment_adjustments(uuid, text)
  owner to postgres;
revoke all privileges on function private.reconcile_recurring_sandbox_payment_adjustments(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.sandbox_credit_refund_adjustment_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.reconcile_sandbox_credit_order_adjustments(new.order_id, 'refund');
  perform private.reconcile_recurring_sandbox_payment_adjustments(
    new.payment_transaction_id, 'refund'
  );
  return new;
end;
$$;

create or replace function private.sandbox_credit_dispute_adjustment_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.reconcile_sandbox_credit_order_adjustments(new.order_id, 'dispute');
  perform private.reconcile_recurring_sandbox_payment_adjustments(
    new.payment_transaction_id, 'dispute'
  );
  return new;
end;
$$;

alter function private.sandbox_credit_refund_adjustment_trigger() owner to postgres;
alter function private.sandbox_credit_dispute_adjustment_trigger() owner to postgres;
revoke all privileges on function private.sandbox_credit_refund_adjustment_trigger()
  from public, anon, authenticated, service_role;
revoke all privileges on function private.sandbox_credit_dispute_adjustment_trigger()
  from public, anon, authenticated, service_role;

create trigger economic_refunds_adjust_sandbox_credit_order
after insert or update of status on private.economic_refunds
for each row execute function private.sandbox_credit_refund_adjustment_trigger();

create trigger economic_disputes_adjust_sandbox_credit_order
after insert or update of status on private.economic_disputes
for each row execute function private.sandbox_credit_dispute_adjustment_trigger();

do $sandbox_credit_commerce_function_acl$
begin
  revoke all privileges on function public.configure_sandbox_test_credit_pack(
    text, text, bigint, text, bigint, integer, text, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.configure_sandbox_test_credit_program(
    text, text, text, bigint, integer, boolean, boolean, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.prepare_sandbox_credit_checkout(
    uuid, uuid, text, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.sandbox_credit_pack_catalog()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.grant_sandbox_credit_program(
    uuid, text, text, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.set_sandbox_test_credit_program_status(
    uuid, uuid, text, boolean, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_grant_sandbox_credit_program(
    uuid, uuid, uuid, text, text, text
  ) from public, anon, authenticated, service_role;
end
$sandbox_credit_commerce_function_acl$;

grant execute on function public.configure_sandbox_test_credit_pack(
  text, text, bigint, text, bigint, integer, text, text, text
) to service_role;
grant execute on function public.configure_sandbox_test_credit_program(
  text, text, text, bigint, integer, boolean, boolean, text, text
) to service_role;
grant execute on function public.prepare_sandbox_credit_checkout(
  uuid, uuid, text, text, text
) to service_role;
grant execute on function public.sandbox_credit_pack_catalog()
  to anon, authenticated;
grant execute on function public.grant_sandbox_credit_program(
  uuid, text, text, text, text
) to service_role;
grant execute on function public.set_sandbox_test_credit_program_status(
  uuid, uuid, text, boolean, text, text
) to service_role;
grant execute on function public.operator_grant_sandbox_credit_program(
  uuid, uuid, uuid, text, text, text
) to service_role;

comment on table private.sandbox_credit_pack_versions is
  'Explicitly configured test-only prepaid credit packs. No migration-defined price or credit quantity is treated as approved.';
comment on table private.sandbox_credit_order_fulfillments is
  'Idempotent link from verified paid sandbox orders to one private credit lot, with proportional refund/dispute compensation.';
comment on table private.sandbox_credit_recurring_payment_fulfillments is
  'One private test-mode sandbox credit lot per verified recurring-support payment transaction; no payment grants authority or changes sandbox safety policy.';
comment on table private.sandbox_credit_program_operator_actions is
  'Idempotent attributed review actions for activating, deactivating, or granting explicitly configured test sandbox credit programs.';
comment on function public.prepare_sandbox_credit_checkout is
  'Service-only authenticated test checkout preparation. It never buys automatically and never changes sandbox safety privileges.';

commit;
