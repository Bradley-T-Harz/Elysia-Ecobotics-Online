-- Owner-approved production activation of the free hosted-execution allowance.
-- This migration does not enable purchases, payments, support-linked compute,
-- Stripe, Marketplace commerce, or any badge/role/authority relationship.

begin;

-- Preserve the original test lane while admitting only coherently approved
-- live rate/program versions. The two modes retain independent active rows.
alter table private.sandbox_credit_rate_versions
  drop constraint sandbox_credit_rate_test_only_check;
alter table private.sandbox_credit_rate_versions
  add constraint sandbox_credit_rate_mode_check check (
    (test_mode = true and approved_for_live_use = false)
    or (test_mode = false and approved_for_live_use = true)
  );

drop index private.sandbox_credit_rate_one_active_idx;
create unique index sandbox_credit_rate_one_active_mode_idx
  on private.sandbox_credit_rate_versions(test_mode)
  where active = true;

alter table private.sandbox_credit_program_versions
  drop constraint sandbox_credit_program_test_only_check;
alter table private.sandbox_credit_program_versions
  add constraint sandbox_credit_program_mode_check check (
    (test_mode = true and approved_for_live_use = false)
    or (test_mode = false and approved_for_live_use = true)
  );

-- Existing rows predate production activation and are therefore explicitly
-- classified as test-mode history. Live lots are bound to their immutable
-- program version; a default can never accidentally mint a live grant.
alter table private.sandbox_credit_lots
  add column test_mode boolean not null default true,
  add column program_version_id uuid
    references private.sandbox_credit_program_versions(id) on delete restrict;

alter table private.sandbox_credit_lots
  add constraint sandbox_credit_lots_live_program_check check (
    test_mode = true
    or (
      test_mode = false
      and program_version_id is not null
      and source_category = 'starter'
      and expires_at is null
    )
  );

create unique index sandbox_credit_lots_user_program_idx
  on private.sandbox_credit_lots(user_id, program_version_id)
  where program_version_id is not null;

create index sandbox_credit_lots_mode_available_idx
  on private.sandbox_credit_lots(user_id, test_mode, expires_at, created_at)
  where consumed_units + reserved_units + expired_units + adjusted_units < granted_units;

alter table private.sandbox_credit_ledger_entries
  add column test_mode boolean not null default true;

alter table private.sandbox_run_economic_measurements
  drop constraint if exists sandbox_run_measurements_failure_check;
alter table private.sandbox_run_economic_measurements
  add constraint sandbox_run_measurements_failure_check check (
    failure_class is null or failure_class in (
      'policy_blocked', 'runner_unavailable', 'runtime_error', 'timeout',
      'output_overflow', 'cancelled', 'cleanup_failed', 'memory_exceeded', 'denied'
    )
  );

insert into private.sandbox_credit_rate_versions (
  rate_key, unit_scale, base_units, input_kib_units, output_kib_units,
  cpu_second_units, memory_gib_second_units, maximum_run_units,
  test_mode, approved_for_live_use, active, effective_at
) values (
  'hosted_execution_allowance_v1',
  100, 10, 1, 1, 5, 2, 100,
  false, true, true, pg_catalog.now()
);

insert into private.sandbox_credit_program_versions (
  program_code, source_category, granted_units, expires_after_days,
  one_time_per_user, active, test_mode, approved_for_live_use, created_at
) values (
  'hosted_execution_starter_v1', 'starter', 1000, null,
  true, true, false, true, pg_catalog.now()
);

create unique index sandbox_credit_program_one_live_starter_idx
  on private.sandbox_credit_program_versions(source_category)
  where source_category = 'starter'
    and active = true
    and test_mode = false
    and approved_for_live_use = true
    and retired_at is null;

-- Live policy parameters and historical grants may be retired through a later
-- additive version, but their defining bytes cannot be rewritten in place.
create or replace function private.protect_approved_sandbox_allowance_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.approved_for_live_use then
      raise exception using errcode = '55000', message = 'approved_sandbox_allowance_version_immutable';
    end if;
    return old;
  end if;
  if tg_table_name = 'sandbox_credit_rate_versions'
     and old.approved_for_live_use
     and (
       new.rate_key is distinct from old.rate_key
       or new.unit_scale is distinct from old.unit_scale
       or new.base_units is distinct from old.base_units
       or new.input_kib_units is distinct from old.input_kib_units
       or new.output_kib_units is distinct from old.output_kib_units
       or new.cpu_second_units is distinct from old.cpu_second_units
       or new.memory_gib_second_units is distinct from old.memory_gib_second_units
       or new.maximum_run_units is distinct from old.maximum_run_units
       or new.test_mode is distinct from old.test_mode
       or new.approved_for_live_use is distinct from old.approved_for_live_use
       or new.effective_at is distinct from old.effective_at
       or new.created_at is distinct from old.created_at
     ) then
    raise exception using errcode = '55000', message = 'approved_sandbox_allowance_version_immutable';
  end if;
  if tg_table_name = 'sandbox_credit_program_versions'
     and old.approved_for_live_use
     and (
       new.program_code is distinct from old.program_code
       or new.source_category is distinct from old.source_category
       or new.source_price_id is distinct from old.source_price_id
       or new.source_price_code_snapshot is distinct from old.source_price_code_snapshot
       or new.source_amount_minor_snapshot is distinct from old.source_amount_minor_snapshot
       or new.source_currency_snapshot is distinct from old.source_currency_snapshot
       or new.source_recurring_interval_snapshot is distinct from old.source_recurring_interval_snapshot
       or new.source_recurring_interval_count_snapshot is distinct from old.source_recurring_interval_count_snapshot
       or new.source_consent_bundle_version_snapshot is distinct from old.source_consent_bundle_version_snapshot
       or new.sandbox_credit_terms_version_snapshot is distinct from old.sandbox_credit_terms_version_snapshot
       or new.granted_units is distinct from old.granted_units
       or new.expires_after_days is distinct from old.expires_after_days
       or new.one_time_per_user is distinct from old.one_time_per_user
       or new.test_mode is distinct from old.test_mode
       or new.approved_for_live_use is distinct from old.approved_for_live_use
       or new.created_at is distinct from old.created_at
     ) then
    raise exception using errcode = '55000', message = 'approved_sandbox_allowance_version_immutable';
  end if;
  return new;
end;
$$;

alter function private.protect_approved_sandbox_allowance_version() owner to postgres;
revoke all privileges on function private.protect_approved_sandbox_allowance_version()
  from public, anon, authenticated, service_role;

create trigger protect_approved_sandbox_credit_rate_version
before update or delete on private.sandbox_credit_rate_versions
for each row execute function private.protect_approved_sandbox_allowance_version();

create trigger protect_approved_sandbox_credit_program_version
before update or delete on private.sandbox_credit_program_versions
for each row execute function private.protect_approved_sandbox_allowance_version();

create or replace function private.validate_sandbox_credit_lot_program()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_program private.sandbox_credit_program_versions%rowtype;
begin
  if new.program_version_id is null then
    if new.test_mode = false then
      raise exception using errcode = '23514', message = 'live_sandbox_credit_program_required';
    end if;
    return new;
  end if;

  select * into v_program
  from private.sandbox_credit_program_versions
  where id = new.program_version_id;
  if not found
     or v_program.test_mode is distinct from new.test_mode
     or v_program.source_category is distinct from new.source_category
     or v_program.granted_units is distinct from new.granted_units
     or (v_program.expires_after_days is null) is distinct from (new.expires_at is null) then
    raise exception using errcode = '23514', message = 'sandbox_credit_lot_program_mismatch';
  end if;
  if new.test_mode = false and (
    v_program.approved_for_live_use is not true
    or v_program.program_code <> 'hosted_execution_starter_v1'
    or v_program.one_time_per_user is not true
    or v_program.expires_after_days is not null
  ) then
    raise exception using errcode = '23514', message = 'sandbox_credit_live_program_not_approved';
  end if;
  return new;
end;
$$;

alter function private.validate_sandbox_credit_lot_program() owner to postgres;
revoke all privileges on function private.validate_sandbox_credit_lot_program()
  from public, anon, authenticated, service_role;

create trigger validate_sandbox_credit_lot_program
before insert or update of program_version_id, test_mode, source_category, granted_units, expires_at
on private.sandbox_credit_lots
for each row execute function private.validate_sandbox_credit_lot_program();

-- The existing helper remains fail-closed for every live economic capability
-- except the two owner-approved, non-payment hosted-allowance flags.
create or replace function private.economic_feature_enabled(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select flag.enabled and (
      flag.test_mode_only
      or (
        flag.test_mode_only = false
        and flag.feature_key in ('sandbox_credit_display', 'sandbox_credit_enforcement')
      )
    )
    from private.economic_feature_flags as flag
    where flag.feature_key = p_feature_key
  ), false);
$$;

alter function private.economic_feature_enabled(text) owner to postgres;
revoke all privileges on function private.economic_feature_enabled(text)
  from public, anon, authenticated, service_role;

create or replace function private.ensure_hosted_execution_starter_allowance(p_user_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_program private.sandbox_credit_program_versions%rowtype;
  v_lot private.sandbox_credit_lots%rowtype;
  v_key text;
begin
  if p_user_id is null or not private.sandbox_actor_is_active(p_user_id) then
    return null;
  end if;

  select * into v_program
  from private.sandbox_credit_program_versions as program
  where program.program_code = 'hosted_execution_starter_v1'
    and program.source_category = 'starter'
    and program.granted_units = 1000
    and program.expires_after_days is null
    and program.one_time_per_user = true
    and program.active = true
    and program.test_mode = false
    and program.approved_for_live_use = true
    and program.retired_at is null;
  if not found then
    raise exception using errcode = '55000', message = 'hosted_execution_starter_policy_unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || v_program.id::text, 0)
  );

  select * into v_lot
  from private.sandbox_credit_lots as lot
  where lot.user_id = p_user_id
    and lot.program_version_id = v_program.id;
  if found then
    if v_lot.test_mode is not false
       or v_lot.source_category <> 'starter'
       or v_lot.granted_units <> 1000
       or v_lot.expires_at is not null then
      raise exception using errcode = '23505', message = 'hosted_execution_starter_idempotency_conflict';
    end if;
    return v_lot.id;
  end if;

  v_key := 'hosted-starter:' || v_program.program_code || ':' || p_user_id::text;
  insert into private.sandbox_credit_lots (
    user_id, source_category, source_reference, granted_units,
    idempotency_key, private_reason, expires_at, created_by,
    test_mode, program_version_id
  ) values (
    p_user_id, 'starter', 'program:' || v_program.id::text, v_program.granted_units,
    v_key, 'Owner-approved one-time hosted execution starter allowance.', null, null,
    false, v_program.id
  ) returning * into v_lot;

  insert into private.sandbox_credit_ledger_entries (
    user_id, credit_lot_id, entry_type, units_delta,
    balance_delta_units, reserved_delta_units,
    source_category, idempotency_key, test_mode
  ) values (
    p_user_id, v_lot.id, 'grant', v_program.granted_units,
    v_program.granted_units, 0,
    'starter', 'ledger:' || v_key, false
  );

  insert into private.economic_audit_events (
    actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    'system', 'hosted_execution_starter_granted', 'sandbox_credit_lot', v_lot.id,
    'Owner-approved one-time hosted execution starter allowance.',
    pg_catalog.jsonb_build_object(
      'user_id', p_user_id,
      'program_code', v_program.program_code,
      'program_version_id', v_program.id,
      'granted_raw_units', v_program.granted_units,
      'display_unit_scale', 100,
      'one_time', true,
      'expires_at', null,
      'paid', false,
      'authority_changed', false
    )
  );

  return v_lot.id;
end;
$$;

alter function private.ensure_hosted_execution_starter_allowance(uuid) owner to postgres;
revoke all privileges on function private.ensure_hosted_execution_starter_allowance(uuid)
  from public, anon, authenticated, service_role;

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
    select reservation.id, reservation.run_id, reservation.reserved_units, rate.test_mode
    from private.sandbox_credit_reservations as reservation
    join private.sandbox_credit_rate_versions as rate on rate.id = reservation.rate_version_id
    where reservation.user_id = p_user_id
      and reservation.status = 'held'
      and reservation.expires_at < pg_catalog.now()
    for update of reservation
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
      source_category, idempotency_key, test_mode
    ) values (
      p_user_id, v_reservation.id, v_reservation.run_id,
      'expire', v_reservation.reserved_units,
      0, -v_reservation.reserved_units,
      'sandbox_run', 'sandbox-reservation-expire:' || v_reservation.id::text,
      v_reservation.test_mode
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
      lot.id, lot.source_category, lot.test_mode,
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
      source_category, idempotency_key, test_mode
    ) values (
      p_user_id, v_lot.id, 'expire', -v_lot.remaining_units,
      -v_lot.remaining_units, 0,
      v_lot.source_category, 'sandbox-lot-expire:' || v_lot.id::text,
      v_lot.test_mode
    ) on conflict (idempotency_key) do nothing;

    v_expired := v_expired + v_lot.remaining_units;
  end loop;
  return v_expired;
end;
$$;

alter function private.expire_sandbox_credit_lots(uuid) owner to postgres;
revoke all privileges on function private.expire_sandbox_credit_lots(uuid)
  from public, anon, authenticated, service_role;

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
  v_available bigint := 0;
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

  select * into v_rate
  from private.sandbox_credit_rate_versions as rate
  where rate.active = true
    and rate.test_mode = false
    and rate.approved_for_live_use = true
    and rate.effective_at <= pg_catalog.now()
    and rate.retired_at is null
  order by rate.effective_at desc
  limit 1;
  if not found then
    raise exception using errcode = '55000', message = 'sandbox_credit_rate_unavailable';
  end if;

  begin
    v_result := private.reserve_commune_sandbox_run_operational(
      p_client_request_id, p_snapshot_id, p_source_type, p_source_id,
      p_post_id, p_code_document_id, p_code_version_id, p_language,
      p_file_name, p_code_sha256, p_code_bytes
    );

    if not coalesce((v_result ->> 'accepted')::boolean, false) then
      return v_result || pg_catalog.jsonb_build_object(
        'economicEnforcement', true,
        'testMode', false
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
          'testMode', false
        );
      end if;
      select * into v_rate
      from private.sandbox_credit_rate_versions
      where id = v_reservation.rate_version_id;
      return v_result || pg_catalog.jsonb_build_object(
        'economicEnforcement', true,
        'economicReservationStatus', v_reservation.status,
        'creditReservationId', v_reservation.id,
        'reservedCreditUnits', v_reservation.reserved_units,
        'creditUnitScale', v_rate.unit_scale,
        'rateKey', v_rate.rate_key,
        'testMode', v_rate.test_mode
      );
    end if;

    perform private.ensure_hosted_execution_starter_allowance(v_actor);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text, 0));
    perform private.release_expired_sandbox_credit_reservations(v_actor);
    perform private.expire_sandbox_credit_lots(v_actor);

    select coalesce(pg_catalog.sum(
      lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units
    ), 0) into v_available
    from private.sandbox_credit_lots as lot
    where lot.user_id = v_actor
      and lot.test_mode = false
      and (lot.expires_at is null or lot.expires_at > pg_catalog.now() + interval '5 minutes');

    if v_available < v_rate.maximum_run_units then
      raise exception using errcode = 'P0402', message = 'sandbox_credits_required';
    end if;

    insert into private.sandbox_credit_reservations (
      run_id, user_id, rate_version_id, reserved_units, expires_at
    ) values (
      v_run_id, v_actor, v_rate.id, v_rate.maximum_run_units,
      coalesce((v_result ->> 'leaseExpiresAt')::timestamptz, pg_catalog.now() + interval '60 seconds')
    ) returning * into v_reservation;

    v_needed := v_rate.maximum_run_units;
    for v_lot in
      select
        lot.id,
        lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units as remaining_units
      from private.sandbox_credit_lots as lot
      where lot.user_id = v_actor
        and lot.test_mode = false
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
      source_category, idempotency_key, test_mode
    ) values (
      v_actor, v_reservation.id, v_run_id, 'reserve', -v_reservation.reserved_units,
      0, v_reservation.reserved_units,
      'sandbox_run', 'sandbox-reserve:' || v_run_id::text, false
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
      'testMode', false
    );
  end if;

  return v_result || pg_catalog.jsonb_build_object(
    'economicEnforcement', true,
    'economicReservationStatus', v_reservation.status,
    'creditReservationId', v_reservation.id,
    'reservedCreditUnits', v_reservation.reserved_units,
    'creditUnitScale', v_rate.unit_scale,
    'rateKey', v_rate.rate_key,
    'testMode', false
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
    'output_overflow', 'cancelled', 'cleanup_failed', 'memory_exceeded', 'denied'
  ) then
    raise exception using errcode = '22023', message = 'sandbox_failure_class_invalid';
  end if;

  select * into v_measurement
  from private.sandbox_run_economic_measurements as measurement
  where measurement.run_id = p_run_id;
  if found then
    select * into v_rate
    from private.sandbox_credit_rate_versions
    where id = v_measurement.rate_version_id;
    v_result := private.finalize_commune_sandbox_run_operational(
      p_run_id, p_client_request_id, p_finalizer_token, p_status, p_ok,
      p_message, p_stdout_preview, p_stderr_preview, p_exit_code,
      p_duration_ms, p_output_truncated, p_diagnostics
    );
    return v_result || pg_catalog.jsonb_build_object(
      'economicEnforcement', v_measurement.economic_enforcement,
      'calculatedUnits', v_measurement.calculated_units,
      'chargedUnits', v_measurement.charged_units,
      'testMode', v_rate.test_mode
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
    where rate.active = true
      and rate.test_mode = false
      and rate.approved_for_live_use = true
      and rate.effective_at <= pg_catalog.now()
      and rate.retired_at is null
    order by rate.effective_at desc
    limit 1;
  end if;
  if v_rate.id is null then
    raise exception using errcode = '55000', message = 'sandbox_credit_rate_unavailable';
  end if;

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
        source_category, idempotency_key, test_mode
      ) values (
        v_actor, v_reservation.id, p_run_id, 'consume', -v_charged,
        -v_charged, -v_charged,
        'sandbox_run', 'sandbox-run:' || p_run_id::text, v_rate.test_mode
      );
    end if;

    if v_released > 0 then
      insert into private.sandbox_credit_ledger_entries (
        user_id, reservation_id, run_id, entry_type, units_delta,
        balance_delta_units, reserved_delta_units,
        source_category, idempotency_key, test_mode
      ) values (
        v_actor, v_reservation.id, p_run_id, 'release', v_released,
        0, -v_released,
        'sandbox_run', 'sandbox-release:' || p_run_id::text, v_rate.test_mode
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
    economic_enforcement, calculated_units, charged_units
  ) values (
    p_run_id, v_actor, v_rate.id, p_input_bytes, p_output_bytes,
    p_configured_cpu_millis, p_configured_memory_bytes,
    p_actual_cpu_time_ms, p_peak_memory_bytes, null, p_duration_ms,
    null, false, p_failure_class,
    null, v_run.started_at, v_run.completed_at, v_run.finalized_at,
    null,
    pg_catalog.jsonb_build_object(
      'policy_version', 'hosted_execution_allowance_v1',
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
      'approved_for_live_use', v_rate.approved_for_live_use,
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
    'testMode', v_rate.test_mode
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
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_rate private.sandbox_credit_rate_versions%rowtype;
  v_balance bigint;
  v_reserved bigint;
  v_total bigint;
  v_used bigint;
  v_available bigint;
  v_display boolean := private.economic_feature_enabled('sandbox_credit_display');
  v_enforcement boolean := private.economic_feature_enabled('sandbox_credit_enforcement');
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;

  perform private.ensure_hosted_execution_starter_allowance(v_actor);
  perform private.release_expired_sandbox_credit_reservations(v_actor);
  perform private.expire_sandbox_credit_lots(v_actor);

  select * into v_rate
  from private.sandbox_credit_rate_versions as rate
  where rate.active = true
    and rate.test_mode = false
    and rate.approved_for_live_use = true
    and rate.effective_at <= pg_catalog.now()
    and rate.retired_at is null
  order by rate.effective_at desc
  limit 1;
  if not found or not v_display or not v_enforcement then
    raise exception using errcode = '55000', message = 'hosted_execution_allowance_unavailable';
  end if;

  select
    coalesce(pg_catalog.sum(lot.granted_units - lot.consumed_units - lot.expired_units - lot.adjusted_units), 0),
    coalesce(pg_catalog.sum(lot.reserved_units), 0),
    coalesce(pg_catalog.sum(lot.granted_units), 0),
    coalesce(pg_catalog.sum(lot.consumed_units + lot.expired_units + lot.adjusted_units), 0)
  into v_balance, v_reserved, v_total, v_used
  from private.sandbox_credit_lots as lot
  where lot.user_id = v_actor
    and lot.test_mode = false;
  v_available := greatest(v_balance - v_reserved, 0);

  if v_total <= 0 or v_total <> v_balance + v_used then
    raise exception using errcode = '55000', message = 'hosted_execution_allowance_invariant_failed';
  end if;

  return pg_catalog.jsonb_build_object(
    'available', true,
    'mode', 'live',
    'display_enabled', v_display,
    'enforcement_enabled', v_enforcement,
    'test_mode', false,
    'unit_scale', v_rate.unit_scale,
    'allowance_total_units', v_total,
    'used_units', v_used,
    'balance_units', v_balance,
    'reserved_units', v_reserved,
    'available_units', v_available,
    'remaining_percent', pg_catalog.round(v_available::numeric * 100 / v_total)::integer,
    'allowance_type', 'one_time_starter',
    'renews_at', null,
    'paid_allowance_available', false,
    'available_credits', v_available::numeric / v_rate.unit_scale,
    'purchased_credits', 0,
    'sponsored_credits', 0,
    'waived_credits', 0,
    'operator_granted_credits', v_available::numeric / v_rate.unit_scale,
    'active_rate', pg_catalog.jsonb_build_object(
      'rate_key', v_rate.rate_key,
      'base_units', v_rate.base_units,
      'input_kib_units', v_rate.input_kib_units,
      'output_kib_units', v_rate.output_kib_units,
      'cpu_second_units', v_rate.cpu_second_units,
      'memory_gib_second_units', v_rate.memory_gib_second_units,
      'maximum_run_units', v_rate.maximum_run_units,
      'approved_for_live_use', v_rate.approved_for_live_use
    ),
    'source_categories', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'category', category.source_category,
        'available_units', category.available_units
      ) order by category.source_category)
      from (
        select lot.source_category,
          pg_catalog.sum(lot.granted_units - lot.consumed_units - lot.reserved_units - lot.expired_units - lot.adjusted_units) as available_units
        from private.sandbox_credit_lots as lot
        where lot.user_id = v_actor and lot.test_mode = false
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
      join private.sandbox_credit_rate_versions as rate on rate.id = reservation.rate_version_id
      where reservation.user_id = v_actor
        and rate.test_mode = false
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
        where entry.user_id = v_actor and entry.test_mode = false
        order by entry.created_at desc
        limit 50
      ) as receipt
    ), '[]'::jsonb),
    'warnings', pg_catalog.jsonb_build_array(
      'Local Elysia computation is not metered by EcoSyneva.',
      'Hosted allowance never changes safety limits, network policy, reviewer status, or governance authority.'
    )
  );
end;
$$;

alter function public.current_user_sandbox_credit_summary() owner to postgres;

-- Exact grants for all accounts that satisfy the same current server-side
-- sandbox eligibility predicate. The helper is idempotent and per-user locked.
do $backfill_hosted_execution_starter_allowance$
declare
  v_user record;
begin
  for v_user in
    select account.id
    from auth.users as account
    join public.profiles as profile on profile.id = account.id
    where private.sandbox_actor_is_active(account.id)
    order by account.id
  loop
    perform private.ensure_hosted_execution_starter_allowance(v_user.id);
  end loop;
end
$backfill_hosted_execution_starter_allowance$;

update private.economic_feature_flags
set
  enabled = true,
  test_mode_only = false,
  reason = 'Owner-approved free hosted-execution allowance v1; no payment or paid top-up is active.',
  updated_by = null,
  updated_at = pg_catalog.now()
where feature_key in ('sandbox_credit_display', 'sandbox_credit_enforcement');

do $verify_hosted_execution_feature_activation$
begin
  if (
    select pg_catalog.count(*)
    from private.economic_feature_flags
    where feature_key in ('sandbox_credit_display', 'sandbox_credit_enforcement')
      and enabled = true
      and test_mode_only = false
  ) <> 2 then
    raise exception using errcode = '55000', message = 'hosted_execution_feature_activation_incomplete';
  end if;
  if exists (
    select 1 from private.economic_feature_flags
    where feature_key not in ('sandbox_credit_display', 'sandbox_credit_enforcement')
      and test_mode_only = false
      and enabled = true
  ) then
    raise exception using errcode = '55000', message = 'unapproved_live_economic_feature_enabled';
  end if;
end
$verify_hosted_execution_feature_activation$;

insert into private.economic_audit_events (
  actor_kind, action, target_type, reason, metadata
) values (
  'system', 'hosted_execution_allowance_v1_activated', 'sandbox_credit_policy',
  'Owner-approved production activation of the free hosted-execution allowance.',
  pg_catalog.jsonb_build_object(
    'policy_version', 'hosted_execution_allowance_v1',
    'rate_key', 'hosted_execution_allowance_v1',
    'program_code', 'hosted_execution_starter_v1',
    'display_unit_scale', 100,
    'starter_raw_units', 1000,
    'starter_display_units', 10,
    'cadence', 'one_time',
    'expires', false,
    'paid_allowance_available', false,
    'stripe_activated', false,
    'authority_changed', false
  )
);

revoke all privileges on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) to authenticated;

revoke all privileges on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb,
  integer, integer, integer, bigint, integer, bigint, boolean, text
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb,
  integer, integer, integer, bigint, integer, bigint, boolean, text
) to authenticated;

revoke all privileges on function public.current_user_sandbox_credit_summary()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_sandbox_credit_summary()
  to authenticated;

comment on function private.ensure_hosted_execution_starter_allowance(uuid) is
  'Idempotently grants the owner-approved one-time free hosted-execution starter allowance to accounts satisfying the canonical sandbox-active predicate. Existing eligible accounts are backfilled at activation; future accounts receive it on their first allowance view or hosted run so an untouched community profile does not acquire an economic-retention footprint.';
comment on function public.reserve_commune_sandbox_run is
  'Preserves operational sandbox authorization and quotas while atomically reserving the single live hosted-execution allowance.';
comment on function public.current_user_sandbox_credit_summary is
  'Authenticated self-only live hosted-execution allowance projection. It excludes test lots and all private provider/operator metadata.';

commit;
