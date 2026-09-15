-- Preserve free allowances independently of Stripe and forbid monetary credit sources.
begin;
create function private.reject_paid_compute_credit_insert() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.source_category in ('purchased','recurring_support') then
  raise exception using errcode='42501',message='paid_compute_and_support_to_compute_hard_off';
 end if;
 return new;
end;$$;
alter function private.reject_paid_compute_credit_insert() owner to postgres;
revoke all on function private.reject_paid_compute_credit_insert() from public,anon,authenticated,service_role;
create trigger reject_paid_compute_credit_insert before insert on private.sandbox_credit_lots
for each row execute function private.reject_paid_compute_credit_insert();

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
  if not (coalesce(auth.role()='service_role',false) or coalesce(current_setting('request.jwt.claim.role',true),'')='service_role') then
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
  if p_source_type in ('purchased','recurring_support') then raise exception using errcode='42501',message='paid_compute_and_support_to_compute_hard_off';end if;
  if not (coalesce(auth.role()='service_role',false) or coalesce(current_setting('request.jwt.claim.role',true),'')='service_role') then
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
commit;
