-- Owner-approved non-depleting administrative operational allowance.
-- Administrator runs remain measured, isolated, quota-bound, and audited;
-- this migration changes accounting depletion only. It enables no payment,
-- badge, trust, reviewer, moderator, developer, or governance entitlement.

begin;

alter table private.sandbox_credit_reservations
  add column accounting_mode text not null default 'finite';

alter table private.sandbox_credit_reservations
  add constraint sandbox_credit_reservations_accounting_mode_check check (
    accounting_mode in ('finite', 'admin_operational')
  );

alter table private.sandbox_run_economic_measurements
  add column accounting_mode text not null default 'finite';

alter table private.sandbox_run_economic_measurements
  add constraint sandbox_run_measurements_accounting_mode_check check (
    accounting_mode in ('finite', 'admin_operational')
  );

-- Preserve the already-qualified finite allowance functions verbatim as
-- private implementation helpers. The public wrappers below select the
-- accounting mode from current server authority at reservation time.
alter function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) rename to reserve_commune_sandbox_run_finite_v1;
alter function public.reserve_commune_sandbox_run_finite_v1(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) set schema private;
revoke all privileges on function private.reserve_commune_sandbox_run_finite_v1(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) from public, anon, authenticated, service_role;

alter function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb,
  integer, integer, integer, bigint, integer, bigint, boolean, text
) rename to finalize_commune_sandbox_run_finite_v1;
alter function public.finalize_commune_sandbox_run_finite_v1(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb,
  integer, integer, integer, bigint, integer, bigint, boolean, text
) set schema private;
revoke all privileges on function private.finalize_commune_sandbox_run_finite_v1(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb,
  integer, integer, integer, bigint, integer, bigint, boolean, text
) from public, anon, authenticated, service_role;

alter function public.current_user_sandbox_credit_summary()
  rename to current_user_sandbox_credit_summary_finite_v1;
alter function public.current_user_sandbox_credit_summary_finite_v1()
  set schema private;
revoke all privileges on function private.current_user_sandbox_credit_summary_finite_v1()
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
  v_admin boolean;
  v_rate private.sandbox_credit_rate_versions%rowtype;
  v_result jsonb;
  v_run_id uuid;
  v_reservation private.sandbox_credit_reservations%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'sandbox_authentication_required';
  end if;

  -- This is the established server-authoritative administrator predicate.
  -- No request body, client claim, badge, payment, or adjacent role participates.
  v_admin := public.current_user_is_admin();
  if not v_admin then
    return private.reserve_commune_sandbox_run_finite_v1(
      p_client_request_id, p_snapshot_id, p_source_type, p_source_id,
      p_post_id, p_code_document_id, p_code_version_id, p_language,
      p_file_name, p_code_sha256, p_code_bytes
    ) || pg_catalog.jsonb_build_object(
      'accountingMode', 'finite',
      'administrativeOperationalAccess', false
    );
  end if;

  if private.economic_service_is_restricted(v_actor, 'sandbox') then
    raise exception using errcode = '42501', message = 'sandbox_economic_service_restricted';
  end if;
  if not private.economic_feature_enabled('sandbox_credit_enforcement') then
    raise exception using errcode = '55000', message = 'hosted_execution_allowance_unavailable';
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

  -- Operational authorization, eligibility, one-slot concurrency, and rate
  -- controls remain exactly the same as every other hosted execution.
  v_result := private.reserve_commune_sandbox_run_operational(
    p_client_request_id, p_snapshot_id, p_source_type, p_source_id,
    p_post_id, p_code_document_id, p_code_version_id, p_language,
    p_file_name, p_code_sha256, p_code_bytes
  );

  if not coalesce((v_result ->> 'accepted')::boolean, false) then
    return v_result || pg_catalog.jsonb_build_object(
      'economicEnforcement', true,
      'accountingMode', 'admin_operational',
      'administrativeOperationalAccess', true,
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
        'accountingMode', 'admin_operational',
        'administrativeOperationalAccess', true,
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
      'accountingMode', v_reservation.accounting_mode,
      'administrativeOperationalAccess', v_reservation.accounting_mode = 'admin_operational',
      'testMode', v_rate.test_mode
    );
  end if;

  -- The ordinary starter grant is preserved independently. It is neither
  -- reserved nor consumed by this administrative operation.
  perform private.ensure_hosted_execution_starter_allowance(v_actor);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text, 0));
  perform private.release_expired_sandbox_credit_reservations(v_actor);
  perform private.expire_sandbox_credit_lots(v_actor);

  insert into private.sandbox_credit_reservations (
    run_id, user_id, rate_version_id, reserved_units, expires_at, accounting_mode
  ) values (
    v_run_id, v_actor, v_rate.id, v_rate.maximum_run_units,
    coalesce((v_result ->> 'leaseExpiresAt')::timestamptz, pg_catalog.now() + interval '60 seconds'),
    'admin_operational'
  ) returning * into v_reservation;

  insert into private.sandbox_credit_ledger_entries (
    user_id, reservation_id, run_id, entry_type, units_delta,
    balance_delta_units, reserved_delta_units,
    source_category, idempotency_key, test_mode
  ) values (
    v_actor, v_reservation.id, v_run_id, 'reserve', -v_reservation.reserved_units,
    0, v_reservation.reserved_units,
    'operational', 'sandbox-admin-operational-reserve:' || v_run_id::text, false
  );

  return v_result || pg_catalog.jsonb_build_object(
    'economicEnforcement', true,
    'economicReservationStatus', v_reservation.status,
    'creditReservationId', v_reservation.id,
    'reservedCreditUnits', v_reservation.reserved_units,
    'creditUnitScale', v_rate.unit_scale,
    'rateKey', v_rate.rate_key,
    'accountingMode', 'admin_operational',
    'administrativeOperationalAccess', true,
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
  v_run public.commune_sandbox_runs%rowtype;
  v_calculated bigint;
  v_effective_cpu_ms bigint;
  v_effective_memory_bytes bigint;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'sandbox_authentication_required';
  end if;

  select reservation.* into v_reservation
  from private.sandbox_credit_reservations as reservation
  where reservation.run_id = p_run_id
    and reservation.user_id = v_actor;

  -- Finite reservations retain the exact qualified v1 settlement behavior.
  -- Accounting mode is immutable per reservation, so a later role change
  -- neither grants a retroactive exemption nor retroactively charges an
  -- already-authorized administrative operation.
  if v_reservation.id is null or v_reservation.accounting_mode <> 'admin_operational' then
    return private.finalize_commune_sandbox_run_finite_v1(
      p_run_id, p_client_request_id, p_finalizer_token, p_status, p_ok,
      p_message, p_stdout_preview, p_stderr_preview, p_exit_code,
      p_duration_ms, p_output_truncated, p_diagnostics,
      p_input_bytes, p_output_bytes, p_configured_cpu_millis,
      p_configured_memory_bytes, p_actual_cpu_time_ms, p_peak_memory_bytes,
      p_network_access, p_failure_class
    ) || pg_catalog.jsonb_build_object(
      'accountingMode', 'finite',
      'administrativeOperationalAccess', false
    );
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
      'accountingMode', v_measurement.accounting_mode,
      'administrativeOperationalAccess', v_measurement.accounting_mode = 'admin_operational',
      'testMode', v_rate.test_mode
    );
  end if;

  select * into v_rate
  from private.sandbox_credit_rate_versions
  where id = v_reservation.rate_version_id;
  if not found then
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

  v_result := private.finalize_commune_sandbox_run_operational(
    p_run_id, p_client_request_id, p_finalizer_token, p_status, p_ok,
    p_message, p_stdout_preview, p_stderr_preview, p_exit_code,
    p_duration_ms, p_output_truncated, p_diagnostics
  );

  select * into v_run
  from public.commune_sandbox_runs
  where id = p_run_id and requester_user_id = v_actor;

  if v_reservation.status = 'held' then
    update private.sandbox_credit_reservations
    set
      status = 'settled',
      settled_units = 0,
      settled_at = pg_catalog.now(),
      released_at = pg_catalog.now()
    where id = v_reservation.id;

    insert into private.sandbox_credit_ledger_entries (
      user_id, reservation_id, run_id, entry_type, units_delta,
      balance_delta_units, reserved_delta_units,
      source_category, idempotency_key, test_mode
    ) values (
      v_actor, v_reservation.id, p_run_id, 'release', v_reservation.reserved_units,
      0, -v_reservation.reserved_units,
      'operational', 'sandbox-admin-operational-release:' || p_run_id::text, false
    );
  end if;

  insert into private.sandbox_run_economic_measurements (
    run_id, user_id, rate_version_id, input_bytes, output_bytes,
    configured_cpu_millis, configured_memory_bytes,
    actual_cpu_time_ms, peak_memory_bytes, storage_bytes, duration_ms,
    cleanup_duration_ms, network_access, failure_class,
    runner_accepted_at, execution_started_at, execution_finished_at, finalized_at,
    provider_cost_configuration_version, metering_configuration_snapshot,
    economic_enforcement, calculated_units, charged_units, accounting_mode
  ) values (
    p_run_id, v_actor, v_rate.id, p_input_bytes, p_output_bytes,
    p_configured_cpu_millis, p_configured_memory_bytes,
    p_actual_cpu_time_ms, p_peak_memory_bytes, null, p_duration_ms,
    null, false, p_failure_class,
    null, v_run.started_at, v_run.completed_at, v_run.finalized_at,
    null,
    pg_catalog.jsonb_build_object(
      'policy_version', 'admin_operational_allowance_v1',
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
      'effective_cpu_time_ms_for_measurement', v_effective_cpu_ms,
      'memory_gib_second_units', v_rate.memory_gib_second_units,
      'maximum_run_units', v_rate.maximum_run_units,
      'approved_for_live_use', v_rate.approved_for_live_use,
      'accounting_mode', 'admin_operational',
      'non_depleting_accounting', true,
      'safety_limits_unchanged', true,
      'storage_measurement_available', false,
      'cleanup_measurement_available', false,
      'provider_cost_configuration_available', false
    ),
    true, v_calculated, 0, 'admin_operational'
  ) returning * into v_measurement;

  return v_result || pg_catalog.jsonb_build_object(
    'economicEnforcement', true,
    'calculatedUnits', v_measurement.calculated_units,
    'chargedUnits', 0,
    'accountingMode', 'admin_operational',
    'administrativeOperationalAccess', true,
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
  v_admin boolean;
  v_summary jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;
  v_admin := public.current_user_is_admin();
  v_summary := private.current_user_sandbox_credit_summary_finite_v1();

  return v_summary || pg_catalog.jsonb_build_object(
    'accounting_mode', case when v_admin then 'admin_operational' else 'finite' end,
    'accounting_policy_version', case when v_admin then 'admin_operational_allowance_v1' else 'hosted_execution_allowance_v1' end,
    'administrative_operational_access', v_admin,
    'operational_reserved_units', case when v_admin then coalesce((
      select pg_catalog.sum(reservation.reserved_units)
      from private.sandbox_credit_reservations as reservation
      join private.sandbox_credit_rate_versions as rate on rate.id = reservation.rate_version_id
      where reservation.user_id = v_actor
        and reservation.accounting_mode = 'admin_operational'
        and reservation.status = 'held'
        and reservation.expires_at > pg_catalog.now()
        and rate.test_mode = false
    ), 0) else 0 end,
    'recent_operational_usage', case when v_admin then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'run_id', usage.run_id,
        'calculated_units', usage.calculated_units,
        'charged_units', usage.charged_units,
        'failure_class', usage.failure_class,
        'measured_at', usage.measured_at
      ) order by usage.measured_at desc)
      from (
        select measurement.run_id, measurement.calculated_units,
          measurement.charged_units, measurement.failure_class, measurement.measured_at
        from private.sandbox_run_economic_measurements as measurement
        where measurement.user_id = v_actor
          and measurement.accounting_mode = 'admin_operational'
        order by measurement.measured_at desc
        limit 50
      ) as usage
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

alter function public.current_user_sandbox_credit_summary() owner to postgres;

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

comment on column private.sandbox_credit_reservations.accounting_mode is
  'Immutable per-run accounting authority: finite user allowance or non-depleting administrator operation. It never changes sandbox safety limits.';
comment on column private.sandbox_run_economic_measurements.accounting_mode is
  'Immutable accounting provenance captured at reservation time. Administrative operations remain fully measured with charged_units zero.';
comment on function public.reserve_commune_sandbox_run is
  'Preserves operational sandbox authorization, safety, concurrency, and quotas while selecting finite or administrator-operational accounting from current server authority.';
comment on function public.current_user_sandbox_credit_summary is
  'Authenticated self-only allowance projection. Administrator operational access is reported separately from the preserved ordinary starter balance.';

insert into private.economic_audit_events (
  actor_kind, action, target_type, reason, metadata
) values (
  'system', 'admin_operational_allowance_v1_activated', 'sandbox_credit_policy',
  'Owner-approved non-depleting accounting for authoritative administrator operations; all sandbox safety and measurement boundaries remain unchanged.',
  pg_catalog.jsonb_build_object(
    'policy_version', 'admin_operational_allowance_v1',
    'authority_predicate', 'current_user_is_admin',
    'non_depleting_accounting', true,
    'measurement_required', true,
    'starter_allowance_preserved', true,
    'reviewer_included', false,
    'moderator_included', false,
    'developer_included', false,
    'badge_or_payment_trigger', false,
    'safety_limits_changed', false,
    'paid_allowance_available', false,
    'stripe_activated', false
  )
);

commit;
