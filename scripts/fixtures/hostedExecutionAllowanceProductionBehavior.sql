\set ON_ERROR_STOP on

-- Disposable production-policy behavior proof. The surrounding migration
-- harness destroys its database after this run; no production identity or
-- credential is represented here.

begin;

do $policy_catalog$
declare
  v_existing uuid := 'a6000000-0000-4000-8000-000000000001';
  v_ineligible uuid := 'a6000000-0000-4000-8000-000000000002';
begin
  if not exists (
    select 1 from private.sandbox_credit_rate_versions
    where rate_key = 'hosted_execution_allowance_v1'
      and unit_scale = 100
      and base_units = 10
      and input_kib_units = 1
      and output_kib_units = 1
      and cpu_second_units = 5
      and memory_gib_second_units = 2
      and maximum_run_units = 100
      and test_mode = false
      and approved_for_live_use = true
      and active = true
      and retired_at is null
  ) then
    raise exception 'approved live hosted-execution rate is missing or drifted';
  end if;
  if not exists (
    select 1 from private.sandbox_credit_program_versions
    where program_code = 'hosted_execution_starter_v1'
      and source_category = 'starter'
      and granted_units = 1000
      and expires_after_days is null
      and one_time_per_user = true
      and active = true
      and test_mode = false
      and approved_for_live_use = true
      and retired_at is null
  ) then
    raise exception 'approved live hosted-execution starter is missing or drifted';
  end if;
  if (
    select count(*) from private.economic_feature_flags
    where feature_key in ('sandbox_credit_display', 'sandbox_credit_enforcement')
      and enabled = true and test_mode_only = false
  ) <> 2 then
    raise exception 'live hosted-execution feature flags are not active';
  end if;
  if exists (
    select 1 from private.economic_feature_flags
    where feature_key in (
      'live_stripe', 'sandbox_credit_purchase', 'support_checkout',
      'recurring_support', 'marketplace_paid_offers', 'marketplace_payouts'
    ) and enabled = true
  ) then
    raise exception 'a forbidden payment or commerce flag became active';
  end if;
  if (
    select count(*) from private.sandbox_credit_lots
    where user_id = v_existing
      and test_mode = false
      and source_category = 'starter'
      and granted_units = 1000
      and consumed_units = 0
      and reserved_units = 0
      and expires_at is null
      and program_version_id = (
        select id from private.sandbox_credit_program_versions
        where program_code = 'hosted_execution_starter_v1'
      )
  ) <> 1 then
    raise exception 'existing eligible user did not receive exactly one live starter grant';
  end if;
  if exists (
    select 1 from private.sandbox_credit_lots
    where user_id = v_ineligible and test_mode = false
  ) then
    raise exception 'profileless user received a hosted-execution starter grant';
  end if;
end
$policy_catalog$;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  (
    'a6000000-0000-4000-8000-000000000003',
    'hosted-allowance-new-user@example.invalid',
    pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
  ),
  (
    'a6000000-0000-4000-8000-000000000004',
    'hosted-allowance-exhausted@example.invalid',
    pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
  ),
  (
    'a6000000-0000-4000-8000-000000000005',
    'hosted-allowance-admin@example.invalid',
    pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
  );

insert into public.profiles(id, username, display_name, commons_onboarding_completed_at)
values
  (
    'a6000000-0000-4000-8000-000000000003',
    'hosted-allowance-new-user', 'Hosted Allowance New User', pg_catalog.now()
  ),
  (
    'a6000000-0000-4000-8000-000000000004',
    'hosted-allowance-exhausted', 'Hosted Allowance Exhausted', pg_catalog.now()
  ),
  (
    'a6000000-0000-4000-8000-000000000005',
    'hosted-allowance-admin', 'Hosted Allowance Administrator', pg_catalog.now()
  );

insert into public.user_roles(user_id, role, reason)
values (
  'a6000000-0000-4000-8000-000000000005', 'administrator',
  'Disposable authoritative administrator allowance fixture.'
);

do $new_eligible_grant$
declare
  v_user uuid := 'a6000000-0000-4000-8000-000000000003';
  v_first uuid;
  v_second uuid;
  v_roles_before integer;
  v_badges_before integer;
begin
  select count(*) into v_roles_before from public.user_roles where user_id = v_user;
  select count(*) into v_badges_before from public.user_badges where user_id = v_user;
  select private.ensure_hosted_execution_starter_allowance(v_user) into v_first;
  select private.ensure_hosted_execution_starter_allowance(v_user) into v_second;
  if v_first is null or v_second is distinct from v_first then
    raise exception 'new-user starter grant was not idempotent';
  end if;
  if (select count(*) from private.sandbox_credit_lots where user_id = v_user and test_mode = false) <> 1
     or (select count(*) from private.sandbox_credit_ledger_entries where user_id = v_user and test_mode = false and entry_type = 'grant') <> 1
     or (select count(*) from private.economic_audit_events where action = 'hosted_execution_starter_granted' and target_id = v_first) <> 1 then
    raise exception 'new-user starter grant or audit history duplicated';
  end if;
  if coalesce((select is_admin from public.profiles where id = v_user), true)
     or (select count(*) from public.user_roles where user_id = v_user) <> v_roles_before
     or (select count(*) from public.user_badges where user_id = v_user) <> v_badges_before then
    raise exception 'hosted allowance changed badge, role, or administrative authority';
  end if;
  if private.ensure_hosted_execution_starter_allowance(
    'a6000000-0000-4000-8000-000000000004'
  ) is null then
    raise exception 'eligible low-balance fixture user did not receive a starter grant';
  end if;
end
$new_eligible_grant$;

-- A large test-mode lot must never enter the live balance.
insert into private.sandbox_credit_lots (
  user_id, source_category, granted_units, idempotency_key,
  private_reason, test_mode
) values (
  'a6000000-0000-4000-8000-000000000003', 'test', 999999,
  'fixture-test-mode-isolation', 'Disposable test-mode isolation grant.', true
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000003', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"a6000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

do $live_summary_and_success$
declare
  v_summary jsonb;
  v_reserved jsonb;
  v_replay jsonb;
  v_started jsonb;
  v_final jsonb;
  v_run uuid;
begin
  v_summary := public.current_user_sandbox_credit_summary();
  if v_summary ->> 'mode' <> 'live'
     or v_summary ->> 'test_mode' <> 'false'
     or v_summary ->> 'display_enabled' <> 'true'
     or v_summary ->> 'enforcement_enabled' <> 'true'
     or (v_summary ->> 'unit_scale')::integer <> 100
     or (v_summary ->> 'allowance_total_units')::bigint <> 1000
     or (v_summary ->> 'used_units')::bigint <> 0
     or (v_summary ->> 'balance_units')::bigint <> 1000
     or (v_summary ->> 'reserved_units')::bigint <> 0
     or (v_summary ->> 'available_units')::bigint <> 1000
     or (v_summary ->> 'remaining_percent')::integer <> 100
     or v_summary ->> 'allowance_type' <> 'one_time_starter'
     or v_summary -> 'renews_at' <> 'null'::jsonb
     or v_summary ->> 'paid_allowance_available' <> 'false'
     or v_summary #>> '{active_rate,rate_key}' <> 'hosted_execution_allowance_v1'
     or v_summary #>> '{active_rate,approved_for_live_use}' <> 'true' then
    raise exception 'live allowance summary is malformed or mode-contaminated: %', v_summary;
  end if;

  v_reserved := public.reserve_commune_sandbox_run(
    'a6100000-0000-4000-8000-000000000001', 'allowance-success',
    'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('1', 64), 16
  );
  if v_reserved ->> 'accepted' <> 'true'
     or v_reserved ->> 'economicEnforcement' <> 'true'
     or v_reserved ->> 'economicReservationStatus' <> 'held'
     or (v_reserved ->> 'reservedCreditUnits')::integer <> 100
     or (v_reserved ->> 'creditUnitScale')::integer <> 100
     or v_reserved ->> 'rateKey' <> 'hosted_execution_allowance_v1'
     or v_reserved ->> 'testMode' <> 'false' then
    raise exception 'live reservation did not hold the approved maximum: %', v_reserved;
  end if;
  v_run := (v_reserved ->> 'runId')::uuid;

  v_replay := public.reserve_commune_sandbox_run(
    'a6100000-0000-4000-8000-000000000001', 'allowance-success',
    'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('1', 64), 16
  );
  if v_replay ->> 'idempotentReplay' <> 'true'
     or (v_replay ->> 'runId')::uuid is distinct from v_run
     or (v_replay ->> 'creditReservationId')::uuid is distinct from (v_reserved ->> 'creditReservationId')::uuid then
    raise exception 'live reservation replay was not exactly-once: %', v_replay;
  end if;

  v_started := public.start_commune_sandbox_run(
    v_run, 'a6100000-0000-4000-8000-000000000001',
    'disposable-finalizer-token-0123456789abcdef'
  );
  if v_started ->> 'status' <> 'running' then
    raise exception 'live reservation did not start: %', v_started;
  end if;

  v_final := public.finalize_commune_sandbox_run(
    v_run, 'a6100000-0000-4000-8000-000000000001',
    'disposable-finalizer-token-0123456789abcdef',
    'completed', true, 'Completed.', 'ok', '', 0, 25, false, '[]'::jsonb,
    16, 3, 500, 268435456, 20, 8388608, false, null
  );
  if v_final ->> 'economicEnforcement' <> 'true'
     or (v_final ->> 'calculatedUnits')::integer <> 19
     or (v_final ->> 'chargedUnits')::integer <> 19
     or v_final ->> 'testMode' <> 'false' then
    raise exception 'measured success did not settle at 19 raw units: %', v_final;
  end if;

  v_final := public.finalize_commune_sandbox_run(
    v_run, 'a6100000-0000-4000-8000-000000000001',
    'disposable-finalizer-token-0123456789abcdef',
    'completed', true, 'Completed.', 'ok', '', 0, 25, false, '[]'::jsonb,
    16, 3, 500, 268435456, 20, 8388608, false, null
  );
  if (v_final ->> 'chargedUnits')::integer <> 19 then
    raise exception 'finalization replay changed the settled charge';
  end if;

  v_summary := public.current_user_sandbox_credit_summary();
  if (v_summary ->> 'allowance_total_units')::integer <> 1000
     or (v_summary ->> 'used_units')::integer <> 19
     or (v_summary ->> 'balance_units')::integer <> 981
     or (v_summary ->> 'reserved_units')::integer <> 0
     or (v_summary ->> 'available_units')::integer <> 981
     or (v_summary ->> 'remaining_percent')::integer <> 98 then
    raise exception 'settled balance or released reservation is incorrect: %', v_summary;
  end if;
end
$live_summary_and_success$;

do $failure_semantics$
declare
  v_failure text;
  v_request uuid;
  v_reserved jsonb;
  v_final jsonb;
  v_run uuid;
  v_status text;
  v_should_charge boolean;
begin
  foreach v_failure in array array[
    'runtime_error', 'timeout', 'memory_exceeded', 'cancelled',
    'runner_unavailable', 'cleanup_failed', 'policy_blocked', 'denied'
  ]
  loop
    v_request := pg_catalog.gen_random_uuid();
    v_reserved := public.reserve_commune_sandbox_run(
      v_request, 'failure-' || v_failure,
      'manual_snapshot', null, null, null, null,
      'python', 'main.py', repeat('2', 64), 16
    );
    if v_reserved ->> 'accepted' <> 'true' then
      raise exception 'failure fixture reservation was refused for %: %', v_failure, v_reserved;
    end if;
    v_run := (v_reserved ->> 'runId')::uuid;
    perform public.start_commune_sandbox_run(
      v_run, v_request, 'disposable-finalizer-token-0123456789abcdef'
    );
    v_status := case
      when v_failure = 'runner_unavailable' or v_failure = 'cleanup_failed' then 'sandbox_unavailable'
      when v_failure = 'policy_blocked' then 'policy_blocked'
      when v_failure = 'denied' then 'denied'
      else 'failed'
    end;
    v_final := public.finalize_commune_sandbox_run(
      v_run, v_request, 'disposable-finalizer-token-0123456789abcdef',
      v_status, false, 'Synthetic failure.', '', 'failure', 1, 100, false, '[]'::jsonb,
      16, 7, 500, 268435456, 40, 10485760, false, v_failure
    );
    v_should_charge := v_failure in ('runtime_error', 'timeout', 'memory_exceeded');
    if ((v_final ->> 'chargedUnits')::integer > 0) is distinct from v_should_charge then
      raise exception 'failure charging semantics drifted for %: %', v_failure, v_final;
    end if;
  end loop;
end
$failure_semantics$;

do $double_run$
declare
  v_request uuid;
  v_reserved jsonb;
  v_busy jsonb;
  v_final jsonb;
  v_run uuid;
begin
  -- An active held reservation blocks a second independent request while an
  -- exact retry remains idempotent (the latter is proven above).
  v_request := pg_catalog.gen_random_uuid();
  v_reserved := public.reserve_commune_sandbox_run(
    v_request, 'double-run-first', 'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('3', 64), 16
  );
  v_busy := public.reserve_commune_sandbox_run(
    pg_catalog.gen_random_uuid(), 'double-run-second', 'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('4', 64), 16
  );
  if v_reserved ->> 'accepted' <> 'true'
     or v_busy ->> 'accepted' <> 'false'
     or v_busy ->> 'reason' <> 'active_reservation' then
    raise exception 'double-run protection did not serialize requests: %, %', v_reserved, v_busy;
  end if;
  v_run := (v_reserved ->> 'runId')::uuid;
  perform public.start_commune_sandbox_run(v_run, v_request, 'disposable-finalizer-token-0123456789abcdef');
  v_final := public.finalize_commune_sandbox_run(
    v_run, v_request, 'disposable-finalizer-token-0123456789abcdef',
    'failed', false, 'Cancelled.', '', '', null, 1, false, '[]'::jsonb,
    16, 0, 500, 268435456, 0, 1048576, false, 'cancelled'
  );
  if (v_final ->> 'chargedUnits')::integer <> 0 then
    raise exception 'cancelled double-run reservation consumed allowance';
  end if;
end
$double_run$;

reset role;

-- Prepare a separate internally consistent low-balance account so the
-- allowance refusal is proven independently of the operational 10/hour quota.
update private.sandbox_credit_lots
set consumed_units = 901
where user_id = 'a6000000-0000-4000-8000-000000000004'
  and test_mode = false;
insert into private.sandbox_credit_ledger_entries (
  user_id, credit_lot_id, entry_type, units_delta,
  balance_delta_units, reserved_delta_units,
  source_category, idempotency_key, test_mode
)
select
  lot.user_id, lot.id, 'admin_correction', -901,
  -901, 0, 'operator', 'fixture-low-balance:' || lot.id::text, false
from private.sandbox_credit_lots as lot
where lot.user_id = 'a6000000-0000-4000-8000-000000000004'
  and lot.test_mode = false;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000004', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"a6000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

do $exhaustion_refusal$
declare
  v_result jsonb;
  v_request uuid := 'a6100000-0000-4000-8000-000000000099';
begin
  v_result := public.reserve_commune_sandbox_run(
    v_request, 'exhaustion-refusal',
    'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('6', 64), 16
  );
  if v_result ->> 'accepted' <> 'false'
     or v_result ->> 'reason' <> 'sandbox_credits_required'
     or v_result ->> 'economicEnforcement' <> 'true'
     or v_result ->> 'testMode' <> 'false'
     or (v_result ->> 'availableUnits')::integer <> 99 then
    raise exception 'exhaustion did not fail closed at the approved reservation boundary: %', v_result;
  end if;
  if exists (
    select 1 from public.commune_sandbox_runs
    where requester_user_id = auth.uid() and client_request_id = v_request
  ) then
    raise exception 'refused exhausted run left an operational run row';
  end if;
end
$exhaustion_refusal$;

reset role;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000005', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"a6000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);

do $admin_operational_allowance$
declare
  v_admin uuid := 'a6000000-0000-4000-8000-000000000005';
  v_summary jsonb;
  v_reserved jsonb;
  v_replay jsonb;
  v_busy jsonb;
  v_final jsonb;
  v_run uuid;
  v_request uuid := 'a6100000-0000-4000-8000-000000000201';
begin
  v_summary := public.current_user_sandbox_credit_summary();
  if v_summary ->> 'accounting_mode' <> 'admin_operational'
     or v_summary ->> 'accounting_policy_version' <> 'admin_operational_allowance_v1'
     or v_summary ->> 'administrative_operational_access' <> 'true'
     or (v_summary ->> 'allowance_total_units')::integer <> 1000
     or (v_summary ->> 'balance_units')::integer <> 1000
     or (v_summary ->> 'used_units')::integer <> 0
     or (v_summary ->> 'operational_reserved_units')::integer <> 0 then
    raise exception 'administrator summary did not separate operational access from the preserved starter allowance: %', v_summary;
  end if;

  v_reserved := public.reserve_commune_sandbox_run(
    v_request, 'admin-operational-success',
    'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('7', 64), 16
  );
  if v_reserved ->> 'accepted' <> 'true'
     or v_reserved ->> 'accountingMode' <> 'admin_operational'
     or v_reserved ->> 'administrativeOperationalAccess' <> 'true'
     or (v_reserved ->> 'reservedCreditUnits')::integer <> 100 then
    raise exception 'administrator operation did not receive a governed operational reservation: %', v_reserved;
  end if;
  v_run := (v_reserved ->> 'runId')::uuid;

  v_replay := public.reserve_commune_sandbox_run(
    v_request, 'admin-operational-success',
    'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('7', 64), 16
  );
  if v_replay ->> 'idempotentReplay' <> 'true'
     or (v_replay ->> 'runId')::uuid is distinct from v_run
     or v_replay ->> 'accountingMode' <> 'admin_operational' then
    raise exception 'administrator operational reservation replay was not exactly-once: %', v_replay;
  end if;

  v_busy := public.reserve_commune_sandbox_run(
    'a6100000-0000-4000-8000-000000000202', 'admin-operational-concurrent',
    'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('8', 64), 16
  );
  if v_busy ->> 'accepted' <> 'false' or v_busy ->> 'reason' <> 'active_reservation' then
    raise exception 'administrator accounting exemption bypassed one-slot concurrency: %', v_busy;
  end if;

  perform public.start_commune_sandbox_run(
    v_run, v_request, 'disposable-finalizer-token-0123456789abcdef'
  );

  begin
    perform public.finalize_commune_sandbox_run(
      v_run, v_request, 'disposable-finalizer-token-0123456789abcdef',
      'completed', true, 'Completed.', 'ok', '', 0, 25, false, '[]'::jsonb,
      16, 3, 600001, 268435456, 20, 8388608, false, null
    );
    raise exception 'administrator exceeded the measured runtime/resource contract';
  exception when sqlstate '22023' then
    if sqlerrm <> 'sandbox_measurement_invalid' then raise; end if;
  end;

  begin
    perform public.finalize_commune_sandbox_run(
      v_run, v_request, 'disposable-finalizer-token-0123456789abcdef',
      'completed', true, 'Completed.', 'ok', '', 0, 25, false, '[]'::jsonb,
      16, 3, 500, 268435456, 20, 8388608, true, null
    );
    raise exception 'administrator bypassed the sandbox network prohibition';
  exception when insufficient_privilege then
    if sqlerrm <> 'sandbox_network_access_violation' then raise; end if;
  end;

  v_final := public.finalize_commune_sandbox_run(
    v_run, v_request, 'disposable-finalizer-token-0123456789abcdef',
    'completed', true, 'Completed.', 'ok', '', 0, 25, false, '[]'::jsonb,
    16, 3, 500, 268435456, 20, 8388608, false, null
  );
  if v_final ->> 'economicEnforcement' <> 'true'
     or (v_final ->> 'calculatedUnits')::integer <> 19
     or (v_final ->> 'chargedUnits')::integer <> 0
     or v_final ->> 'accountingMode' <> 'admin_operational'
     or v_final ->> 'administrativeOperationalAccess' <> 'true' then
    raise exception 'administrator operation was not measured without depletion: %', v_final;
  end if;

  v_final := public.finalize_commune_sandbox_run(
    v_run, v_request, 'disposable-finalizer-token-0123456789abcdef',
    'completed', true, 'Completed.', 'ok', '', 0, 25, false, '[]'::jsonb,
    16, 3, 500, 268435456, 20, 8388608, false, null
  );
  if (v_final ->> 'calculatedUnits')::integer <> 19
     or (v_final ->> 'chargedUnits')::integer <> 0 then
    raise exception 'administrator finalization replay changed measured operational accounting';
  end if;

  v_summary := public.current_user_sandbox_credit_summary();
  if (v_summary ->> 'balance_units')::integer <> 1000
     or (v_summary ->> 'used_units')::integer <> 0
     or (v_summary ->> 'reserved_units')::integer <> 0
     or (v_summary ->> 'operational_reserved_units')::integer <> 0
     or pg_catalog.jsonb_array_length(v_summary -> 'recent_operational_usage') <> 1
     or (v_summary #>> '{recent_operational_usage,0,calculated_units}')::integer <> 19
     or (v_summary #>> '{recent_operational_usage,0,charged_units}')::integer <> 0 then
    raise exception 'administrator operation depleted the starter allowance or lost its private usage receipt: %', v_summary;
  end if;

  if pg_catalog.strpos(pg_catalog.pg_get_functiondef(
    'public.reserve_commune_sandbox_run(uuid,text,text,text,uuid,uuid,uuid,text,text,text,integer)'::regprocedure
  ), 'public.current_user_is_admin()') = 0 then
    raise exception 'administrator operational accounting lost its canonical server authority predicate';
  end if;
end
$admin_operational_allowance$;

reset role;

do $admin_private_accounting_evidence$
declare
  v_admin uuid := 'a6000000-0000-4000-8000-000000000005';
  v_run uuid;
begin
  select id into v_run
  from public.commune_sandbox_runs
  where requester_user_id = v_admin
    and client_request_id = 'a6100000-0000-4000-8000-000000000201';
  if v_run is null then
    raise exception 'administrator operational run evidence is missing';
  end if;
  if exists (
    select 1 from private.sandbox_credit_reservation_allocations as allocation
    join private.sandbox_credit_reservations as reservation on reservation.id = allocation.reservation_id
    where reservation.run_id = v_run
  ) or exists (
    select 1 from private.sandbox_credit_lots
    where user_id = v_admin and test_mode = false and (reserved_units <> 0 or consumed_units <> 0)
  ) then
    raise exception 'administrator operation reserved or consumed the ordinary starter allowance';
  end if;
  if (
    select count(*) from private.sandbox_credit_ledger_entries
    where run_id = v_run and source_category = 'operational' and entry_type = 'reserve'
  ) <> 1 or (
    select count(*) from private.sandbox_credit_ledger_entries
    where run_id = v_run and source_category = 'operational' and entry_type = 'release'
  ) <> 1 or (
    select count(*) from private.sandbox_run_economic_measurements
    where run_id = v_run and accounting_mode = 'admin_operational'
      and calculated_units = 19 and charged_units = 0 and network_access = false
  ) <> 1 then
    raise exception 'administrator operational reservation, receipt, or measurement history is incomplete';
  end if;
end
$admin_private_accounting_evidence$;

-- Removing administrator authority ends future non-depleting operations.
-- A reviewer role is added deliberately to prove adjacent authority does not
-- inherit the exemption, while the untouched starter allowance remains.
update public.user_roles
set revoked_at = pg_catalog.now(), reason = 'Disposable administrator removal fixture.'
where user_id = 'a6000000-0000-4000-8000-000000000005'
  and role = 'administrator' and revoked_at is null;
insert into public.user_roles(user_id, role, reason)
values (
  'a6000000-0000-4000-8000-000000000005', 'reviewer',
  'Disposable adjacent-role non-exemption fixture.'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000005', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"a6000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);

do $removed_admin_returns_to_finite_allowance$
declare
  v_summary jsonb;
  v_reserved jsonb;
  v_final jsonb;
  v_run uuid;
  v_request uuid := 'a6100000-0000-4000-8000-000000000203';
begin
  v_summary := public.current_user_sandbox_credit_summary();
  if v_summary ->> 'accounting_mode' <> 'finite'
     or v_summary ->> 'administrative_operational_access' <> 'false'
     or (v_summary ->> 'balance_units')::integer <> 1000 then
    raise exception 'removed administrator did not return to the preserved finite starter allowance: %', v_summary;
  end if;

  v_reserved := public.reserve_commune_sandbox_run(
    v_request, 'removed-admin-finite-success',
    'manual_snapshot', null, null, null, null,
    'python', 'main.py', repeat('9', 64), 16
  );
  if v_reserved ->> 'accepted' <> 'true'
     or v_reserved ->> 'accountingMode' <> 'finite'
     or v_reserved ->> 'administrativeOperationalAccess' <> 'false' then
    raise exception 'removed administrator or reviewer retained the accounting exemption: %', v_reserved;
  end if;
  v_run := (v_reserved ->> 'runId')::uuid;
  perform public.start_commune_sandbox_run(
    v_run, v_request, 'disposable-finalizer-token-0123456789abcdef'
  );
  v_final := public.finalize_commune_sandbox_run(
    v_run, v_request, 'disposable-finalizer-token-0123456789abcdef',
    'completed', true, 'Completed.', 'ok', '', 0, 25, false, '[]'::jsonb,
    16, 3, 500, 268435456, 20, 8388608, false, null
  );
  if (v_final ->> 'chargedUnits')::integer <> 19
     or v_final ->> 'accountingMode' <> 'finite' then
    raise exception 'removed administrator did not resume measured finite depletion: %', v_final;
  end if;
  v_summary := public.current_user_sandbox_credit_summary();
  if (v_summary ->> 'balance_units')::integer <> 981
     or (v_summary ->> 'used_units')::integer <> 19 then
    raise exception 'removed administrator ordinary allowance did not decrease normally: %', v_summary;
  end if;
end
$removed_admin_returns_to_finite_allowance$;

reset role;

do $final_invariants$
declare
  v_user uuid := 'a6000000-0000-4000-8000-000000000003';
begin
  if exists (
    select 1 from private.sandbox_credit_lots
    where user_id = v_user
      and (
        consumed_units < 0
        or reserved_units < 0
        or consumed_units + reserved_units + expired_units + adjusted_units > granted_units
      )
  ) then
    raise exception 'exhaustion produced a negative or overdrawn balance';
  end if;
  if exists (
    select 1 from private.sandbox_credit_reservations
    where user_id = v_user and status = 'held'
  ) then
    raise exception 'qualification left an orphan reservation';
  end if;
  if exists (
    select run_id
    from private.sandbox_run_economic_measurements
    where user_id = v_user
    group by run_id having count(*) <> 1
  ) then
    raise exception 'a run has duplicate economic measurements';
  end if;
  if exists (
    select reservation_id
    from private.sandbox_credit_ledger_entries
    where user_id = v_user and reservation_id is not null and entry_type = 'consume'
    group by reservation_id having count(*) > 1
  ) then
    raise exception 'a reservation has duplicate settlement entries';
  end if;
  if exists (
    select 1
    from private.sandbox_credit_reservations as reservation
    where reservation.user_id = v_user
      and (
        reservation.status <> 'settled'
        or reservation.settled_units is null
        or reservation.settled_at is null
        or reservation.released_at is null
        or (
          select count(*) from private.sandbox_credit_ledger_entries as entry
          where entry.reservation_id = reservation.id and entry.entry_type = 'reserve'
        ) <> 1
        or (
          select count(*) from private.sandbox_credit_ledger_entries as entry
          where entry.reservation_id = reservation.id and entry.entry_type = 'consume'
        ) > 1
        or (
          select count(*) from private.sandbox_credit_ledger_entries as entry
          where entry.reservation_id = reservation.id and entry.entry_type = 'release'
        ) > 1
      )
  ) then
    raise exception 'a run left incomplete or duplicate reservation history';
  end if;
  if exists (
    select 1
    from private.sandbox_run_economic_measurements as measurement
    where measurement.user_id = v_user
      and measurement.failure_class in ('cancelled', 'runner_unavailable', 'cleanup_failed', 'policy_blocked', 'denied')
      and measurement.charged_units <> 0
  ) then
    raise exception 'platform/policy/cancellation failure consumed allowance';
  end if;
  if exists (
    select 1
    from private.sandbox_run_economic_measurements as measurement
    where measurement.user_id = v_user
      and measurement.failure_class in ('runtime_error', 'timeout', 'memory_exceeded')
      and measurement.charged_units <= 0
  ) then
    raise exception 'measured user-code/resource failure did not consume measured allowance';
  end if;
  if exists (
    select 1
    from private.sandbox_credit_reservation_allocations as allocation
    join private.sandbox_credit_reservations as reservation on reservation.id = allocation.reservation_id
    where reservation.user_id = v_user
      and allocation.consumed_units > allocation.reserved_units
  ) then
    raise exception 'settlement consumed more than its allocation';
  end if;
  if exists (
    select 1 from private.sandbox_run_economic_measurements as measurement
    join private.sandbox_credit_rate_versions as rate on rate.id = measurement.rate_version_id
    where measurement.user_id = v_user
      and (
        rate.rate_key <> 'hosted_execution_allowance_v1'
        or rate.approved_for_live_use is not true
        or measurement.metering_configuration_snapshot ->> 'policy_version' <> 'hosted_execution_allowance_v1'
      )
  ) then
    raise exception 'production measurement lost its immutable rate/policy provenance';
  end if;
end
$final_invariants$;

select 'hosted_execution_allowance_production_behavior_ok' as result;

rollback;
