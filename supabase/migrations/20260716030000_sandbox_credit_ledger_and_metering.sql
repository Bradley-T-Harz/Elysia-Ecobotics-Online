-- Private, test-only sandbox credit accounting. Existing operational quotas,
-- isolation, language policy, and reviewer/admin limits remain authoritative.
-- Economic enforcement is disabled by default in economic_feature_flags.

begin;

create table private.sandbox_credit_rate_versions (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null unique,
  unit_scale integer not null default 1,
  base_units integer not null,
  input_kib_units integer not null,
  output_kib_units integer not null,
  cpu_second_units integer not null,
  memory_gib_second_units integer not null,
  maximum_run_units integer not null,
  test_mode boolean not null default true,
  approved_for_live_use boolean not null default false,
  active boolean not null default false,
  effective_at timestamptz not null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sandbox_credit_rate_key_check
    check (rate_key ~ '^[a-z][a-z0-9_]{2,100}$'),
  constraint sandbox_credit_rate_values_check check (
    unit_scale > 0
    and base_units >= 0
    and input_kib_units >= 0
    and output_kib_units >= 0
    and cpu_second_units >= 0
    and memory_gib_second_units >= 0
    and maximum_run_units > 0
  ),
  constraint sandbox_credit_rate_test_only_check check (
    test_mode = true and approved_for_live_use = false
  ),
  constraint sandbox_credit_rate_retirement_check check (
    (active and retired_at is null) or (not active)
  )
);

create unique index sandbox_credit_rate_one_active_idx
  on private.sandbox_credit_rate_versions((active))
  where active = true;

insert into private.sandbox_credit_rate_versions (
  rate_key, unit_scale, base_units, input_kib_units, output_kib_units,
  cpu_second_units, memory_gib_second_units, maximum_run_units,
  test_mode, approved_for_live_use, active, effective_at
) values (
  'sandbox_test_v1_unapproved',
  1, 10, 1, 1, 5, 2, 100,
  true, false, true, now()
)
on conflict (rate_key) do nothing;

create table private.sandbox_credit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  source_category text not null,
  source_reference text,
  granted_units bigint not null,
  consumed_units bigint not null default 0,
  reserved_units bigint not null default 0,
  expired_units bigint not null default 0,
  adjusted_units bigint not null default 0,
  idempotency_key text not null unique,
  private_reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint sandbox_credit_lots_source_check check (
    source_category in (
      'starter', 'recurring_support', 'purchased', 'sponsored',
      'waiver', 'waived', 'operational', 'operator', 'test'
    )
  ),
  constraint sandbox_credit_lots_units_check check (
    granted_units > 0
    and consumed_units >= 0
    and reserved_units >= 0
    and expired_units >= 0
    and adjusted_units >= 0
    and consumed_units + reserved_units + expired_units + adjusted_units <= granted_units
  ),
  constraint sandbox_credit_lots_idempotency_check
    check (pg_catalog.char_length(idempotency_key) between 8 and 255),
  constraint sandbox_credit_lots_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000)
);

create index sandbox_credit_lots_available_idx
  on private.sandbox_credit_lots(user_id, expires_at, created_at)
  where consumed_units + reserved_units + expired_units + adjusted_units < granted_units;

create table private.sandbox_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.commune_sandbox_runs(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  rate_version_id uuid not null references private.sandbox_credit_rate_versions(id) on delete restrict,
  reserved_units bigint not null,
  settled_units bigint,
  status text not null default 'held',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  settled_at timestamptz,
  released_at timestamptz,
  constraint sandbox_credit_reservations_units_check check (
    reserved_units > 0
    and (settled_units is null or settled_units between 0 and reserved_units)
  ),
  constraint sandbox_credit_reservations_status_check check (
    status in ('held', 'settled', 'released', 'expired')
  ),
  constraint sandbox_credit_reservations_terminal_check check (
    (status = 'held' and settled_at is null and released_at is null)
    or (status = 'settled' and settled_at is not null and released_at is not null)
    or (status in ('released', 'expired') and settled_at is null and released_at is not null)
  )
);

create index sandbox_credit_reservations_active_idx
  on private.sandbox_credit_reservations(user_id, expires_at)
  where status = 'held';

create table private.sandbox_credit_reservation_allocations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references private.sandbox_credit_reservations(id) on delete restrict,
  credit_lot_id uuid not null references private.sandbox_credit_lots(id) on delete restrict,
  reserved_units bigint not null,
  consumed_units bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (reservation_id, credit_lot_id),
  constraint sandbox_credit_allocations_units_check check (
    reserved_units > 0 and consumed_units between 0 and reserved_units
  )
);

create table private.sandbox_credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  credit_lot_id uuid references private.sandbox_credit_lots(id) on delete restrict,
  reservation_id uuid references private.sandbox_credit_reservations(id) on delete restrict,
  run_id uuid references public.commune_sandbox_runs(id) on delete restrict,
  entry_type text not null,
  units_delta bigint not null,
  balance_delta_units bigint not null,
  reserved_delta_units bigint not null default 0,
  source_category text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint sandbox_credit_ledger_entry_type_check check (
    entry_type in (
      'grant', 'reserve', 'consume', 'release', 'expire',
      'refund_adjustment', 'dispute_hold', 'admin_correction',
      'compensating_credit', 'compensating_debit'
    )
  ),
  constraint sandbox_credit_ledger_units_check check (units_delta <> 0),
  constraint sandbox_credit_ledger_effect_check check (
    balance_delta_units <> 0 or reserved_delta_units <> 0
  ),
  constraint sandbox_credit_ledger_direction_check check (
    (entry_type in ('grant', 'compensating_credit')
      and units_delta > 0 and balance_delta_units > 0 and reserved_delta_units = 0)
    or (entry_type = 'reserve'
      and units_delta < 0 and balance_delta_units = 0 and reserved_delta_units > 0)
    or (entry_type = 'consume'
      and units_delta < 0 and balance_delta_units < 0 and reserved_delta_units <= 0)
    or (entry_type = 'release'
      and units_delta > 0 and balance_delta_units = 0 and reserved_delta_units < 0)
    or (entry_type = 'expire'
      and (
        (units_delta < 0 and balance_delta_units < 0 and reserved_delta_units = 0)
        or (units_delta > 0 and balance_delta_units = 0 and reserved_delta_units < 0)
      ))
    or (entry_type = 'dispute_hold'
      and balance_delta_units = 0 and reserved_delta_units <> 0)
    or (entry_type in ('refund_adjustment', 'admin_correction', 'compensating_debit')
      and balance_delta_units <> 0)
  ),
  constraint sandbox_credit_ledger_source_check check (
    source_category in (
      'starter', 'recurring_support', 'purchased', 'sponsored',
      'waiver', 'waived', 'operational', 'operator', 'test',
      'sandbox_run', 'refund', 'dispute'
    )
  )
);

create index sandbox_credit_ledger_user_idx
  on private.sandbox_credit_ledger_entries(user_id, created_at desc);

create table private.sandbox_run_economic_measurements (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.commune_sandbox_runs(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  rate_version_id uuid not null references private.sandbox_credit_rate_versions(id) on delete restrict,
  input_bytes integer not null,
  output_bytes integer not null,
  configured_cpu_millis integer not null,
  configured_memory_bytes bigint not null,
  actual_cpu_time_ms integer,
  peak_memory_bytes bigint,
  storage_bytes bigint,
  duration_ms integer not null,
  cleanup_duration_ms integer,
  network_access boolean not null,
  failure_class text,
  runner_accepted_at timestamptz,
  execution_started_at timestamptz,
  execution_finished_at timestamptz,
  finalized_at timestamptz,
  provider_cost_configuration_version text,
  metering_configuration_snapshot jsonb not null,
  economic_enforcement boolean not null,
  calculated_units bigint not null,
  charged_units bigint not null,
  measured_at timestamptz not null default now(),
  constraint sandbox_run_measurements_bytes_check check (
    input_bytes between 0 and 1048576
    and output_bytes between 0 and 1048576
  ),
  constraint sandbox_run_measurements_limits_check check (
    configured_cpu_millis between 1 and 600000
    and configured_memory_bytes between 1048576 and 17179869184
    and (actual_cpu_time_ms is null or actual_cpu_time_ms between 0 and 600000)
    and (peak_memory_bytes is null or peak_memory_bytes between 0 and 17179869184)
    and (storage_bytes is null or storage_bytes between 0 and 17179869184)
    and duration_ms between 0 and 600000
    and (cleanup_duration_ms is null or cleanup_duration_ms between 0 and 600000)
  ),
  constraint sandbox_run_measurements_network_check check (network_access = false),
  constraint sandbox_run_measurements_failure_check check (
    failure_class is null or failure_class in (
      'policy_blocked', 'runner_unavailable', 'runtime_error', 'timeout',
      'output_overflow', 'cancelled', 'cleanup_failed', 'denied'
    )
  ),
  constraint sandbox_run_measurements_units_check check (
    calculated_units >= 0 and charged_units between 0 and calculated_units
  ),
  constraint sandbox_run_measurements_config_check
    check (pg_catalog.jsonb_typeof(metering_configuration_snapshot) = 'object')
);

do $sandbox_economic_table_hardening$
declare
  v_table text;
begin
  foreach v_table in array array[
    'sandbox_credit_rate_versions', 'sandbox_credit_lots',
    'sandbox_credit_reservations', 'sandbox_credit_reservation_allocations',
    'sandbox_credit_ledger_entries', 'sandbox_run_economic_measurements'
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
$sandbox_economic_table_hardening$;

create trigger sandbox_credit_ledger_is_append_only
before update or delete on private.sandbox_credit_ledger_entries
for each row execute function private.prevent_economic_history_mutation();

create trigger sandbox_run_measurements_are_append_only
before update or delete on private.sandbox_run_economic_measurements
for each row execute function private.prevent_economic_history_mutation();

-- Retain the proven operational functions as non-API helpers. The public
-- wrappers below preserve the existing signatures while adding economics.
alter function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) set schema private;
alter function private.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) rename to reserve_commune_sandbox_run_operational;

alter function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) set schema private;
alter function private.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) rename to finalize_commune_sandbox_run_operational;

revoke all privileges on function private.reserve_commune_sandbox_run_operational(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) from public, anon, authenticated, service_role;
revoke all privileges on function private.finalize_commune_sandbox_run_operational(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) from public, anon, authenticated, service_role;

create or replace function private.release_expired_sandbox_credit_reservations(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation record;
  v_released integer := 0;
begin
  for v_reservation in
    select reservation.id, reservation.run_id, reservation.reserved_units
    from private.sandbox_credit_reservations as reservation
    where reservation.user_id = p_user_id
      and reservation.status = 'held'
      and reservation.expires_at < pg_catalog.now()
    for update
  loop
    update private.sandbox_credit_lots as lot
    set reserved_units = lot.reserved_units - allocation.reserved_units
    from private.sandbox_credit_reservation_allocations as allocation
    where allocation.reservation_id = v_reservation.id
      and allocation.credit_lot_id = lot.id;

    update private.sandbox_credit_reservations
    set status = 'expired', released_at = pg_catalog.now()
    where id = v_reservation.id;

    insert into private.sandbox_credit_ledger_entries (
      user_id, reservation_id, run_id, entry_type, units_delta,
      balance_delta_units, reserved_delta_units,
      source_category, idempotency_key
    ) values (
      p_user_id, v_reservation.id, v_reservation.run_id,
      'expire', v_reservation.reserved_units,
      0, -v_reservation.reserved_units,
      'sandbox_run', 'sandbox-reservation-expire:' || v_reservation.id::text
    ) on conflict (idempotency_key) do nothing;
    v_released := v_released + 1;
  end loop;
  return v_released;
end;
$$;

alter function private.release_expired_sandbox_credit_reservations(uuid) owner to postgres;
revoke all privileges on function private.release_expired_sandbox_credit_reservations(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.expire_sandbox_credit_lots(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot record;
  v_expired bigint := 0;
begin
  for v_lot in
    select
      lot.id,
      lot.source_category,
      lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units as remaining_units
    from private.sandbox_credit_lots as lot
    where lot.user_id = p_user_id
      and lot.expires_at is not null
      and lot.expires_at <= pg_catalog.now()
      and lot.reserved_units = 0
      and lot.granted_units - lot.consumed_units - lot.expired_units - lot.adjusted_units > 0
    for update
  loop
    update private.sandbox_credit_lots
    set expired_units = expired_units + v_lot.remaining_units
    where id = v_lot.id;

    insert into private.sandbox_credit_ledger_entries (
      user_id, credit_lot_id, entry_type, units_delta,
      balance_delta_units, reserved_delta_units,
      source_category, idempotency_key
    ) values (
      p_user_id, v_lot.id, 'expire', -v_lot.remaining_units,
      -v_lot.remaining_units, 0,
      v_lot.source_category, 'sandbox-lot-expire:' || v_lot.id::text
    ) on conflict (idempotency_key) do nothing;

    v_expired := v_expired + v_lot.remaining_units;
  end loop;
  return v_expired;
end;
$$;

alter function private.expire_sandbox_credit_lots(uuid) owner to postgres;
revoke all privileges on function private.expire_sandbox_credit_lots(uuid)
  from public, anon, authenticated, service_role;

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
    'testMode', true
  );
end;
$$;

alter function public.reconcile_sandbox_credit_expirations(uuid) owner to postgres;

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
      'testMode', true
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
      'test_mode', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'creditLotId', v_lot.id,
    'grantedUnits', v_lot.granted_units,
    'sourceCategory', v_lot.source_category,
    'expiresAt', v_lot.expires_at,
    'idempotentReplay', false,
    'testMode', true
  );
end;
$$;

alter function public.grant_sandbox_credit_units(uuid, bigint, text, text, timestamptz, text, text)
  owner to postgres;

create or replace function public.reserve_commune_sandbox_run(
  p_client_request_id uuid,
  p_snapshot_id text,
  p_source_type text,
  p_source_id text,
  p_post_id uuid,
  p_code_document_id uuid,
  p_code_version_id uuid,
  p_language text,
  p_file_name text,
  p_code_sha256 text,
  p_code_bytes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_enforcement boolean := private.economic_feature_enabled('sandbox_credit_enforcement');
  v_rate private.sandbox_credit_rate_versions%rowtype;
  v_result jsonb;
  v_run_id uuid;
  v_reservation private.sandbox_credit_reservations%rowtype;
  v_lot record;
  v_needed bigint;
  v_take bigint;
  v_available bigint;
  v_shortage boolean := false;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'sandbox_authentication_required';
  end if;
  if private.economic_service_is_restricted(v_actor, 'sandbox') then
    raise exception using errcode = '42501', message = 'sandbox_economic_service_restricted';
  end if;

  if not v_enforcement then
    v_result := private.reserve_commune_sandbox_run_operational(
      p_client_request_id, p_snapshot_id, p_source_type, p_source_id,
      p_post_id, p_code_document_id, p_code_version_id, p_language,
      p_file_name, p_code_sha256, p_code_bytes
    );
    return v_result || pg_catalog.jsonb_build_object(
      'economicEnforcement', false,
      'testMode', true
    );
  end if;

  -- Run the existing operational authorization, source checks, account checks,
  -- quotas, and exact idempotency lookup first. For a genuinely new run with
  -- insufficient credits, a controlled subtransaction rollback removes the
  -- just-created operational row before a narrow 402-style result is returned.
  begin
    v_result := private.reserve_commune_sandbox_run_operational(
      p_client_request_id, p_snapshot_id, p_source_type, p_source_id,
      p_post_id, p_code_document_id, p_code_version_id, p_language,
      p_file_name, p_code_sha256, p_code_bytes
    );

    if not coalesce((v_result ->> 'accepted')::boolean, false) then
      return v_result || pg_catalog.jsonb_build_object(
        'economicEnforcement', true,
        'testMode', true
      );
    end if;

    v_run_id := (v_result ->> 'runId')::uuid;
    select * into v_reservation
    from private.sandbox_credit_reservations as reservation
    where reservation.run_id = v_run_id;

    if coalesce((v_result ->> 'idempotentReplay')::boolean, false) then
      if v_reservation.id is null then
        return v_result || pg_catalog.jsonb_build_object(
          'economicEnforcement', true,
          'economicReservationStatus', 'not_applicable_existing_run',
          'testMode', true
        );
      end if;
      select * into v_rate
      from private.sandbox_credit_rate_versions
      where id = v_reservation.rate_version_id;
      return v_result || pg_catalog.jsonb_build_object(
        'economicEnforcement', true,
        'economicReservationStatus', v_reservation.status,
        'reservedUnits', v_reservation.reserved_units,
        'rateKey', v_rate.rate_key,
        'testMode', true
      );
    end if;

    select * into v_rate
    from private.sandbox_credit_rate_versions as rate
    where rate.active = true
      and rate.test_mode = true
      and rate.approved_for_live_use = false
      and rate.effective_at <= pg_catalog.now()
    order by rate.effective_at desc
    limit 1;
    if not found then
      raise exception using errcode = '55000', message = 'sandbox_credit_rate_unavailable';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text, 0));
    perform private.release_expired_sandbox_credit_reservations(v_actor);
    perform private.expire_sandbox_credit_lots(v_actor);

    select coalesce(pg_catalog.sum(
      lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units
    ), 0) into v_available
    from private.sandbox_credit_lots as lot
    where lot.user_id = v_actor
      and (lot.expires_at is null or lot.expires_at > pg_catalog.now() + interval '5 minutes');

    if v_available < v_rate.maximum_run_units then
      raise exception using errcode = 'P0402', message = 'sandbox_credits_required';
    end if;

    insert into private.sandbox_credit_reservations (
      run_id, user_id, rate_version_id, reserved_units, expires_at
    ) values (
      v_run_id,
      v_actor,
      v_rate.id,
      v_rate.maximum_run_units,
      coalesce((v_result ->> 'leaseExpiresAt')::timestamptz, pg_catalog.now() + interval '60 seconds')
    ) returning * into v_reservation;

    v_needed := v_rate.maximum_run_units;
    for v_lot in
      select
        lot.id,
        lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units as remaining_units
      from private.sandbox_credit_lots as lot
      where lot.user_id = v_actor
        and (lot.expires_at is null or lot.expires_at > pg_catalog.now() + interval '5 minutes')
        and lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units > 0
      order by lot.expires_at asc nulls last, lot.created_at asc
      for update
    loop
      exit when v_needed <= 0;
      v_take := least(v_needed, v_lot.remaining_units);
      update private.sandbox_credit_lots
      set reserved_units = reserved_units + v_take
      where id = v_lot.id;
      insert into private.sandbox_credit_reservation_allocations (
        reservation_id, credit_lot_id, reserved_units
      ) values (v_reservation.id, v_lot.id, v_take);
      v_needed := v_needed - v_take;
    end loop;

    if v_needed <> 0 then
      raise exception using errcode = 'P0402', message = 'sandbox_credits_expire_too_soon';
    end if;

    insert into private.sandbox_credit_ledger_entries (
      user_id, reservation_id, run_id, entry_type, units_delta,
      balance_delta_units, reserved_delta_units,
      source_category, idempotency_key
    ) values (
      v_actor, v_reservation.id, v_run_id, 'reserve', -v_reservation.reserved_units,
      0, v_reservation.reserved_units,
      'sandbox_run', 'sandbox-reserve:' || v_run_id::text
    );
  exception when sqlstate 'P0402' then
    v_shortage := true;
  end;

  if v_shortage then
    return pg_catalog.jsonb_build_object(
      'accepted', false,
      'reason', 'sandbox_credits_required',
      'economicEnforcement', true,
      'requiredUnits', v_rate.maximum_run_units,
      'availableUnits', coalesce(v_available, 0),
      'testMode', true
    );
  end if;

  return v_result || pg_catalog.jsonb_build_object(
    'economicEnforcement', true,
    'economicReservationStatus', v_reservation.status,
    'reservedUnits', v_reservation.reserved_units,
    'rateKey', v_rate.rate_key,
    'testMode', true
  );
end;
$$;

alter function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) owner to postgres;

create or replace function public.finalize_commune_sandbox_run(
  p_run_id uuid,
  p_client_request_id uuid,
  p_finalizer_token text,
  p_status text,
  p_ok boolean,
  p_message text,
  p_stdout_preview text,
  p_stderr_preview text,
  p_exit_code integer,
  p_duration_ms integer,
  p_output_truncated boolean,
  p_diagnostics jsonb,
  p_input_bytes integer,
  p_output_bytes integer,
  p_configured_cpu_millis integer,
  p_configured_memory_bytes bigint,
  p_actual_cpu_time_ms integer,
  p_peak_memory_bytes bigint,
  p_network_access boolean,
  p_failure_class text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
  v_rate private.sandbox_credit_rate_versions%rowtype;
  v_reservation private.sandbox_credit_reservations%rowtype;
  v_measurement private.sandbox_run_economic_measurements%rowtype;
  v_allocation record;
  v_remaining bigint;
  v_consume bigint;
  v_calculated bigint;
  v_charged bigint := 0;
  v_released bigint := 0;
  v_effective_cpu_ms bigint;
  v_effective_memory_bytes bigint;
  v_no_charge boolean := false;
  v_run public.commune_sandbox_runs%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'sandbox_authentication_required';
  end if;
  if p_input_bytes is null or p_input_bytes not between 0 and 1048576
     or p_output_bytes is null or p_output_bytes not between 0 and 1048576
     or p_configured_cpu_millis is null or p_configured_cpu_millis not between 1 and 600000
     or p_configured_memory_bytes is null or p_configured_memory_bytes not between 1048576 and 17179869184
     or p_actual_cpu_time_ms is not null and p_actual_cpu_time_ms not between 0 and 600000
     or p_peak_memory_bytes is not null and p_peak_memory_bytes not between 0 and 17179869184
     or p_duration_ms is null or p_duration_ms not between 0 and 600000 then
    raise exception using errcode = '22023', message = 'sandbox_measurement_invalid';
  end if;
  if coalesce(p_network_access, false) then
    raise exception using errcode = '42501', message = 'sandbox_network_access_violation';
  end if;
  if coalesce(p_ok, false) and p_failure_class is not null then
    raise exception using errcode = '22023', message = 'sandbox_failure_class_inconsistent';
  end if;
  if p_failure_class is not null and p_failure_class not in (
    'policy_blocked', 'runner_unavailable', 'runtime_error', 'timeout',
    'output_overflow', 'cancelled', 'cleanup_failed', 'denied'
  ) then
    raise exception using errcode = '22023', message = 'sandbox_failure_class_invalid';
  end if;

  select * into v_measurement
  from private.sandbox_run_economic_measurements as measurement
  where measurement.run_id = p_run_id;
  if found then
    v_result := private.finalize_commune_sandbox_run_operational(
      p_run_id, p_client_request_id, p_finalizer_token, p_status, p_ok,
      p_message, p_stdout_preview, p_stderr_preview, p_exit_code,
      p_duration_ms, p_output_truncated, p_diagnostics
    );
    return v_result || pg_catalog.jsonb_build_object(
      'economicEnforcement', v_measurement.economic_enforcement,
      'calculatedUnits', v_measurement.calculated_units,
      'chargedUnits', v_measurement.charged_units,
      'testMode', true
    );
  end if;

  select reservation.* into v_reservation
  from private.sandbox_credit_reservations as reservation
  where reservation.run_id = p_run_id
    and reservation.user_id = v_actor
  for update;

  if found then
    select * into v_rate
    from private.sandbox_credit_rate_versions
    where id = v_reservation.rate_version_id;
  else
    select * into v_rate
    from private.sandbox_credit_rate_versions as rate
    where rate.active = true and rate.test_mode = true
    order by rate.effective_at desc
    limit 1;
  end if;
  if v_rate.id is null then
    raise exception using errcode = '55000', message = 'sandbox_credit_rate_unavailable';
  end if;

  -- configured_cpu_millis is the legacy transport name for configured CPU
  -- millicores, not observed CPU-time. When the runner cannot report actual
  -- CPU-time, derive an explicit allocation upper bound from millicores × wall
  -- duration. Never persist that estimate as actual_cpu_time_ms.
  v_effective_cpu_ms := coalesce(
    p_actual_cpu_time_ms::bigint,
    pg_catalog.ceil(
      p_configured_cpu_millis::numeric * p_duration_ms::numeric / 1000::numeric
    )::bigint
  );
  v_effective_memory_bytes := coalesce(p_peak_memory_bytes, p_configured_memory_bytes);
  v_calculated := least(v_rate.maximum_run_units::bigint,
    v_rate.base_units::bigint
    + pg_catalog.ceil(p_input_bytes::numeric / 1024)::bigint * v_rate.input_kib_units
    + pg_catalog.ceil(p_output_bytes::numeric / 1024)::bigint * v_rate.output_kib_units
    + pg_catalog.ceil(v_effective_cpu_ms::numeric / 1000)::bigint * v_rate.cpu_second_units
    + pg_catalog.ceil(
        (v_effective_memory_bytes::numeric * greatest(p_duration_ms, 1)::numeric)
        / (1073741824::numeric * 1000::numeric)
      )::bigint * v_rate.memory_gib_second_units
  );

  if p_failure_class in ('policy_blocked', 'runner_unavailable', 'cancelled', 'cleanup_failed', 'denied') then
    v_no_charge := true;
  end if;

  v_result := private.finalize_commune_sandbox_run_operational(
    p_run_id, p_client_request_id, p_finalizer_token, p_status, p_ok,
    p_message, p_stdout_preview, p_stderr_preview, p_exit_code,
    p_duration_ms, p_output_truncated, p_diagnostics
  );

  select * into v_run
  from public.commune_sandbox_runs
  where id = p_run_id and requester_user_id = v_actor;

  if v_reservation.id is not null and v_reservation.status = 'held' then
    v_charged := case
      when v_no_charge then 0
      else least(v_calculated, v_reservation.reserved_units)
    end;
    v_remaining := v_charged;

    for v_allocation in
      select allocation.*
      from private.sandbox_credit_reservation_allocations as allocation
      where allocation.reservation_id = v_reservation.id
      order by allocation.created_at, allocation.id
      for update
    loop
      v_consume := least(v_remaining, v_allocation.reserved_units);
      update private.sandbox_credit_lots
      set
        reserved_units = reserved_units - v_allocation.reserved_units,
        consumed_units = consumed_units + v_consume
      where id = v_allocation.credit_lot_id;
      update private.sandbox_credit_reservation_allocations
      set consumed_units = v_consume
      where id = v_allocation.id;
      v_remaining := v_remaining - v_consume;
    end loop;

    if v_remaining <> 0 then
      raise exception using errcode = '55000', message = 'sandbox_credit_settlement_invariant_failed';
    end if;

    v_released := v_reservation.reserved_units - v_charged;

    update private.sandbox_credit_reservations
    set
      status = 'settled',
      settled_units = v_charged,
      settled_at = pg_catalog.now(),
      released_at = pg_catalog.now()
    where id = v_reservation.id;

    if v_charged > 0 then
      insert into private.sandbox_credit_ledger_entries (
        user_id, reservation_id, run_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units,
        source_category, idempotency_key
      ) values (
        v_actor, v_reservation.id, p_run_id, 'consume', -v_charged,
        -v_charged, -v_charged,
        'sandbox_run', 'sandbox-run:' || p_run_id::text
      );
    end if;

    if v_released > 0 then
      insert into private.sandbox_credit_ledger_entries (
        user_id, reservation_id, run_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units,
        source_category, idempotency_key
      ) values (
        v_actor, v_reservation.id, p_run_id, 'release', v_released,
        0, -v_released,
        'sandbox_run', 'sandbox-release:' || p_run_id::text
      );
    end if;
  end if;

  insert into private.sandbox_run_economic_measurements (
    run_id, user_id, rate_version_id, input_bytes, output_bytes,
    configured_cpu_millis, configured_memory_bytes,
    actual_cpu_time_ms, peak_memory_bytes, storage_bytes, duration_ms,
    cleanup_duration_ms, network_access, failure_class,
    runner_accepted_at, execution_started_at, execution_finished_at, finalized_at,
    provider_cost_configuration_version, metering_configuration_snapshot,
    economic_enforcement,
    calculated_units, charged_units
  ) values (
    p_run_id, v_actor, v_rate.id, p_input_bytes, p_output_bytes,
    p_configured_cpu_millis, p_configured_memory_bytes,
    p_actual_cpu_time_ms, p_peak_memory_bytes, null, p_duration_ms,
    null, false, p_failure_class,
    null, v_run.started_at, v_run.completed_at, v_run.finalized_at,
    null,
    pg_catalog.jsonb_build_object(
      'rate_key', v_rate.rate_key,
      'unit_scale', v_rate.unit_scale,
      'base_units', v_rate.base_units,
      'input_kib_units', v_rate.input_kib_units,
      'output_kib_units', v_rate.output_kib_units,
      'cpu_second_units', v_rate.cpu_second_units,
      'configured_cpu_field_semantics', 'millicores',
      'cpu_charge_measurement_source', case
        when p_actual_cpu_time_ms is null then 'configured_allocation_upper_bound'
        else 'runner_observed_cpu_time'
      end,
      'effective_cpu_time_ms_for_charge', v_effective_cpu_ms,
      'memory_gib_second_units', v_rate.memory_gib_second_units,
      'maximum_run_units', v_rate.maximum_run_units,
      'storage_measurement_available', false,
      'cleanup_measurement_available', false,
      'provider_cost_configuration_available', false
    ),
    v_reservation.id is not null,
    v_calculated, v_charged
  ) returning * into v_measurement;

  return v_result || pg_catalog.jsonb_build_object(
    'economicEnforcement', v_reservation.id is not null,
    'calculatedUnits', v_measurement.calculated_units,
    'chargedUnits', v_measurement.charged_units,
    'testMode', true
  );
end;
$$;

alter function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb,
  integer, integer, integer, bigint, integer, bigint, boolean, text
) owner to postgres;

create or replace function public.current_user_sandbox_credit_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_rate private.sandbox_credit_rate_versions%rowtype;
  v_balance bigint;
  v_reserved bigint;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;

  select * into v_rate
  from private.sandbox_credit_rate_versions as rate
  where rate.active = true and rate.test_mode = true
  order by rate.effective_at desc
  limit 1;

  select coalesce(pg_catalog.sum(
    lot.granted_units - lot.consumed_units - lot.expired_units - lot.adjusted_units
  ), 0), coalesce(pg_catalog.sum(lot.reserved_units), 0)
  into v_balance, v_reserved
  from private.sandbox_credit_lots as lot
  where lot.user_id = v_actor
    and (lot.expires_at is null or lot.expires_at > pg_catalog.now());

  return pg_catalog.jsonb_build_object(
    'available', true,
    'mode', 'test',
    'display_enabled', private.economic_feature_enabled('sandbox_credit_display'),
    'enforcement_enabled', private.economic_feature_enabled('sandbox_credit_enforcement'),
    'test_mode', true,
    'unit_scale', coalesce(v_rate.unit_scale, 1),
    'balance_units', v_balance,
    'reserved_units', v_reserved,
    'available_units', greatest(v_balance - v_reserved, 0),
    'available_credits', greatest(v_balance - v_reserved, 0)::numeric / coalesce(nullif(v_rate.unit_scale, 0), 1),
    'purchased_credits', coalesce((
      select pg_catalog.sum(lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units)
      from private.sandbox_credit_lots as lot
      where lot.user_id = v_actor and lot.source_category = 'purchased'
        and (lot.expires_at is null or lot.expires_at > pg_catalog.now())
    ), 0)::numeric / coalesce(nullif(v_rate.unit_scale, 0), 1),
    'sponsored_credits', coalesce((
      select pg_catalog.sum(lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units)
      from private.sandbox_credit_lots as lot
      where lot.user_id = v_actor and lot.source_category in ('sponsored', 'recurring_support')
        and (lot.expires_at is null or lot.expires_at > pg_catalog.now())
    ), 0)::numeric / coalesce(nullif(v_rate.unit_scale, 0), 1),
    'waived_credits', coalesce((
      select pg_catalog.sum(lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units)
      from private.sandbox_credit_lots as lot
      where lot.user_id = v_actor and lot.source_category in ('waiver', 'waived')
        and (lot.expires_at is null or lot.expires_at > pg_catalog.now())
    ), 0)::numeric / coalesce(nullif(v_rate.unit_scale, 0), 1),
    'operator_granted_credits', coalesce((
      select pg_catalog.sum(lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units)
      from private.sandbox_credit_lots as lot
      where lot.user_id = v_actor and lot.source_category in ('starter', 'operational', 'operator', 'test')
        and (lot.expires_at is null or lot.expires_at > pg_catalog.now())
    ), 0)::numeric / coalesce(nullif(v_rate.unit_scale, 0), 1),
    'active_rate', case when v_rate.id is null then null else pg_catalog.jsonb_build_object(
      'rate_key', v_rate.rate_key,
      'base_units', v_rate.base_units,
      'input_kib_units', v_rate.input_kib_units,
      'output_kib_units', v_rate.output_kib_units,
      'cpu_second_units', v_rate.cpu_second_units,
      'memory_gib_second_units', v_rate.memory_gib_second_units,
      'maximum_run_units', v_rate.maximum_run_units,
      'approved_for_live_use', false
    ) end,
    'source_categories', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'category', category.source_category,
        'available_units', category.available_units
      ) order by category.source_category)
      from (
        select lot.source_category,
          pg_catalog.sum(lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units) as available_units
        from private.sandbox_credit_lots as lot
        where lot.user_id = v_actor
          and (lot.expires_at is null or lot.expires_at > pg_catalog.now())
        group by lot.source_category
      ) as category
    ), '[]'::jsonb),
    'active_reservations', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'run_id', reservation.run_id,
        'reserved_units', reservation.reserved_units,
        'expires_at', reservation.expires_at
      ) order by reservation.created_at desc)
      from private.sandbox_credit_reservations as reservation
      where reservation.user_id = v_actor
        and reservation.status = 'held'
        and reservation.expires_at > pg_catalog.now()
    ), '[]'::jsonb),
    'recent_receipts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', receipt.id,
        'entry_type', receipt.entry_type,
        'units_delta', receipt.units_delta,
        'balance_delta_units', receipt.balance_delta_units,
        'reserved_delta_units', receipt.reserved_delta_units,
        'source_category', receipt.source_category,
        'run_id', receipt.run_id,
        'created_at', receipt.created_at
      ) order by receipt.created_at desc)
      from (
        select * from private.sandbox_credit_ledger_entries as entry
        where entry.user_id = v_actor
        order by entry.created_at desc
        limit 50
      ) as receipt
    ), '[]'::jsonb),
    'warnings', pg_catalog.jsonb_build_array(
      'Sandbox rates are provisional test values and are not approved for live sale.',
      'Credits never change safety limits, network policy, reviewer status, or governance authority.'
    )
  );
end;
$$;

alter function public.current_user_sandbox_credit_summary() owner to postgres;

revoke all privileges on function public.grant_sandbox_credit_units(uuid, bigint, text, text, timestamptz, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.reconcile_sandbox_credit_expirations(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) from public, anon, authenticated, service_role;
revoke all privileges on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb,
  integer, integer, integer, bigint, integer, bigint, boolean, text
) from public, anon, authenticated, service_role;
revoke all privileges on function public.current_user_sandbox_credit_summary()
  from public, anon, authenticated, service_role;

grant execute on function public.grant_sandbox_credit_units(uuid, bigint, text, text, timestamptz, text, text)
  to service_role;
grant execute on function public.reconcile_sandbox_credit_expirations(uuid)
  to service_role;
grant execute on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) to authenticated;
grant execute on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb,
  integer, integer, integer, bigint, integer, bigint, boolean, text
) to authenticated;
grant execute on function public.current_user_sandbox_credit_summary()
  to authenticated;

comment on table private.sandbox_credit_lots is
  'Private expiring credit lots. Purchased, sponsored, waived, and operator sources stay distinct and never affect authority.';
comment on table private.sandbox_run_economic_measurements is
  'Immutable measured sandbox usage. Source code, stdout, stderr, and payment identifiers are deliberately absent.';
comment on function public.reserve_commune_sandbox_run is
  'Preserves operational sandbox authorization and quotas, with optional atomic private credit reservation behind a disabled test flag.';
comment on function public.current_user_sandbox_credit_summary is
  'Authenticated self-only safe credit projection with category totals; omits provider, sponsor, waiver-reason, operator, and audit metadata.';

commit;
