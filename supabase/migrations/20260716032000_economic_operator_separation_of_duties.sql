-- Economic operations are capability-based and remain separate from community
-- roles, moderation authority, profiles, badges, and recognition. Mutations are
-- service-role-only and require an explicitly attributed active operator.

begin;

create table private.economic_refund_requests (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  order_id uuid not null references private.economic_orders(id) on delete restrict,
  payment_transaction_id uuid not null references private.economic_payment_transactions(id) on delete restrict,
  amount_minor bigint not null,
  currency text not null,
  status text not null default 'held_for_review',
  requested_by uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  approval_client_request_id uuid unique,
  approved_by uuid references auth.users(id) on delete restrict,
  approval_reason text,
  approval_confirmation_version text,
  approved_at timestamptz,
  provider_attach_client_request_id uuid unique,
  provider_refund_reference text,
  provider_response_sha256 text,
  provider_attached_by uuid references auth.users(id) on delete restrict,
  provider_attached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint economic_refund_requests_amount_check check (amount_minor > 0),
  constraint economic_refund_requests_currency_check check (currency ~ '^[a-z]{3}$'),
  constraint economic_refund_requests_status_check check (
    status in (
      'held_for_review', 'approved_for_provider', 'provider_pending',
      'completed', 'rejected', 'canceled'
    )
  ),
  constraint economic_refund_requests_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint economic_refund_requests_approval_check check (
    (
      approval_client_request_id is null and approved_by is null
      and approval_reason is null and approval_confirmation_version is null
      and approved_at is null
    ) or (
      approval_client_request_id is not null and approved_by is not null
      and pg_catalog.char_length(approval_reason) between 8 and 1000
      and approval_confirmation_version = 'test-refund-v1'
      and approved_at is not null
    )
  ),
  constraint economic_refund_requests_provider_attachment_check check (
    (
      provider_attach_client_request_id is null
      and provider_refund_reference is null
      and provider_response_sha256 is null
      and provider_attached_by is null
      and provider_attached_at is null
    ) or (
      provider_attach_client_request_id is not null
      and provider_refund_reference is not null
      and provider_response_sha256 ~ '^[0-9a-f]{64}$'
      and provider_attached_by is not null
      and provider_attached_at is not null
    )
  ),
  constraint economic_refund_requests_separation_check check (
    approved_by is null or approved_by <> requested_by
  )
);

create index economic_refund_requests_open_idx
  on private.economic_refund_requests(status, created_at)
  where status in ('held_for_review', 'approved_for_provider', 'provider_pending');
create index economic_refund_requests_payment_transaction_idx
  on private.economic_refund_requests(payment_transaction_id, status, created_at);

create table private.economic_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  order_id uuid references private.economic_orders(id) on delete restrict,
  webhook_event_id uuid references private.economic_webhook_events(id) on delete restrict,
  status text not null default 'open',
  opened_by uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  resolution text,
  resolved_by uuid references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint economic_reconciliation_target_check
    check (order_id is not null or webhook_event_id is not null),
  constraint economic_reconciliation_status_check check (
    status in ('open', 'investigating', 'waiting_for_provider', 'resolved', 'closed_no_change')
  ),
  constraint economic_reconciliation_reason_check
    check (pg_catalog.char_length(private_reason) between 8 and 1000),
  constraint economic_reconciliation_resolution_check check (
    (status in ('resolved', 'closed_no_change') and resolved_at is not null and resolution is not null)
    or (status not in ('resolved', 'closed_no_change') and resolved_at is null)
  )
);

create index economic_reconciliation_cases_open_idx
  on private.economic_reconciliation_cases(status, opened_at)
  where status in ('open', 'investigating', 'waiting_for_provider');

do $economic_operator_table_hardening$
declare
  v_table text;
begin
  foreach v_table in array array['economic_refund_requests', 'economic_reconciliation_cases']
  loop
    execute pg_catalog.format('alter table private.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table private.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table private.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$economic_operator_table_hardening$;

create or replace function private.economic_operator_has_capability(
  p_user_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from private.economic_operator_assignments as assignment
    join auth.users as account on account.id = assignment.user_id
    where assignment.user_id = p_user_id
      and assignment.capability = p_capability
      and assignment.revoked_at is null
      and (assignment.expires_at is null or assignment.expires_at > pg_catalog.now())
      and account.deleted_at is null
      and account.is_anonymous is false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
  ), false);
$$;

alter function private.economic_operator_has_capability(uuid, text) owner to postgres;
revoke all privileges on function private.economic_operator_has_capability(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.require_economic_operator_capability(
  p_actor_user_id uuid,
  p_capability text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_actor_user_id is null
     or not private.economic_operator_has_capability(p_actor_user_id, p_capability) then
    raise exception using errcode = '42501', message = 'economic_operator_capability_required';
  end if;
end;
$$;

alter function private.require_economic_operator_capability(uuid, text) owner to postgres;
revoke all privileges on function private.require_economic_operator_capability(uuid, text)
  from public, anon, authenticated, service_role;

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
        'test_mode', true
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
    pg_catalog.jsonb_build_object('capability', v_assignment.capability, 'test_mode', true)
  );

  return pg_catalog.jsonb_build_object(
    'assignmentId', v_assignment.id,
    'userId', v_assignment.user_id,
    'capability', v_assignment.capability,
    'active', true,
    'testMode', true
  );
end;
$$;

alter function public.bootstrap_economic_operator(uuid, text) owner to postgres;

create or replace function public.set_economic_operator_assignment(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_capability text,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.economic_operator_assignments%rowtype;
begin
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'economic_operator_assignments_manage'
  );
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '23503', message = 'economic_operator_user_not_found';
  end if;
  if p_capability not in (
    'economic_orders_view', 'economic_payments_view',
    'economic_operator_assignments_manage',
    'economic_refunds_manage', 'economic_reconciliation_manage',
    'recurring_support_manage', 'sandbox_credits_adjust',
    'job_fee_assess', 'marketplace_payout_manage',
    'organization_billing_manage', 'sponsorship_manage',
    'economic_assistance_manage', 'economic_account_requests_manage',
    'economic_audit_view', 'accounting_export',
    'economic_feature_flags_manage'
  ) then
    raise exception using errcode = '22023', message = 'economic_operator_capability_invalid';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_operator_reason_required';
  end if;

  -- Revocation remains available for a dormant or restricted target. A new
  -- grant must never sit dormant and silently activate after account changes.
  if coalesce(p_enabled, false) and not exists (
    select 1
    from auth.users as account
    where account.id = p_user_id
      and account.deleted_at is null
      and account.is_anonymous is false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
  ) then
    raise exception using errcode = '42501', message = 'economic_operator_target_account_ineligible';
  end if;

  if coalesce(p_enabled, false) then
    update private.economic_operator_assignments
    set revoked_at = pg_catalog.now(), revoked_by = p_actor_user_id,
        revocation_reason = 'Expired assignment closed before a deliberate re-grant: '
          || pg_catalog.btrim(p_reason)
    where user_id = p_user_id
      and capability = p_capability
      and revoked_at is null
      and expires_at is not null and expires_at <= pg_catalog.now()
    returning * into v_assignment;
    if found then
      insert into private.economic_audit_events (
        actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
      ) values (
        p_actor_user_id, 'economic_operator',
        'economic_operator_expired_assignment_closed',
        'economic_operator_assignment', v_assignment.id,
        pg_catalog.btrim(p_reason),
        pg_catalog.jsonb_build_object(
          'target_user_id', p_user_id, 'capability', p_capability,
          'regrant_requested', true
        )
      );
    end if;
  end if;

  select * into v_assignment
  from private.economic_operator_assignments as assignment
  where assignment.user_id = p_user_id
    and assignment.capability = p_capability
    and assignment.revoked_at is null
  for update;

  if coalesce(p_enabled, false) then
    if found then
      return pg_catalog.jsonb_build_object(
        'assignmentId', v_assignment.id,
        'userId', p_user_id,
        'capability', p_capability,
        'active', true,
        'idempotentReplay', true
      );
    end if;
    insert into private.economic_operator_assignments (
      user_id, capability, granted_by, reason
    ) values (
      p_user_id, p_capability, p_actor_user_id, pg_catalog.btrim(p_reason)
    ) returning * into v_assignment;
  else
    if not found then
      return pg_catalog.jsonb_build_object(
        'assignmentId', null,
        'userId', p_user_id,
        'capability', p_capability,
        'active', false,
        'idempotentReplay', true
      );
    end if;
    if p_user_id = p_actor_user_id
       and p_capability = 'economic_operator_assignments_manage'
       and not exists (
         select 1 from private.economic_operator_assignments as other_assignment
         where other_assignment.capability = 'economic_operator_assignments_manage'
           and other_assignment.user_id <> p_user_id
           and private.economic_operator_has_capability(
             other_assignment.user_id, 'economic_operator_assignments_manage'
           )
       ) then
      raise exception using errcode = '55000', message = 'economic_operator_last_manager_cannot_self_revoke';
    end if;
    update private.economic_operator_assignments
    set
      revoked_at = pg_catalog.now(),
      revoked_by = p_actor_user_id,
      revocation_reason = pg_catalog.btrim(p_reason)
    where id = v_assignment.id;
  end if;

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator',
    case when coalesce(p_enabled, false) then 'economic_operator_capability_granted' else 'economic_operator_capability_revoked' end,
    'economic_operator_assignment', v_assignment.id,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'target_user_id', p_user_id,
      'capability', p_capability,
      'active', coalesce(p_enabled, false)
    )
  );

  return pg_catalog.jsonb_build_object(
    'assignmentId', v_assignment.id,
    'userId', p_user_id,
    'capability', p_capability,
    'active', coalesce(p_enabled, false),
    'idempotentReplay', false
  );
end;
$$;

alter function public.set_economic_operator_assignment(uuid, uuid, text, boolean, text)
  owner to postgres;

create or replace function public.operator_grant_sandbox_credit_units(
  p_actor_user_id uuid,
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
  v_result jsonb;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'sandbox_credits_adjust');
  if p_source_type not in ('starter', 'sponsored', 'waiver', 'waived', 'operational', 'operator', 'test') then
    raise exception using errcode = '22023', message = 'sandbox_operator_credit_source_invalid';
  end if;

  v_result := public.grant_sandbox_credit_units(
    p_user_id, p_units, p_source_type, p_source_reference,
    p_expires_at, p_idempotency_key, p_reason
  );

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'operator_sandbox_credit_grant',
    'sandbox_credit_lot', nullif(v_result ->> 'creditLotId', '')::uuid,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'target_user_id', p_user_id,
      'units', p_units,
      'source_category', p_source_type,
      'idempotent_replay', coalesce((v_result ->> 'idempotentReplay')::boolean, false)
    )
  );
  return v_result || pg_catalog.jsonb_build_object('operatorActorId', p_actor_user_id);
end;
$$;

alter function public.operator_grant_sandbox_credit_units(
  uuid, uuid, bigint, text, text, timestamptz, text, text
) owner to postgres;

create or replace function public.operator_place_refund_hold(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_payment_transaction_id uuid,
  p_amount_minor bigint,
  p_client_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order private.economic_orders%rowtype;
  v_payment private.economic_payment_transactions%rowtype;
  v_request private.economic_refund_requests%rowtype;
  v_refunded bigint;
  v_held bigint;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_refunds_manage');
  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'economic_client_request_id_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_refund_reason_required';
  end if;

  select * into v_request
  from private.economic_refund_requests
  where client_request_id = p_client_request_id;
  if found then
    if v_request.order_id <> p_order_id
       or v_request.payment_transaction_id <> p_payment_transaction_id
       or v_request.amount_minor <> p_amount_minor
       or v_request.requested_by <> p_actor_user_id
       or v_request.private_reason <> pg_catalog.btrim(p_reason) then
      raise exception using errcode = '23505', message = 'economic_refund_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'refundRequestId', v_request.id,
      'orderId', v_request.order_id,
      'paymentTransactionId', v_request.payment_transaction_id,
      'amountMinor', v_request.amount_minor,
      'currency', v_request.currency,
      'status', v_request.status,
      'idempotentReplay', true
    );
  end if;

  select * into v_order
  from private.economic_orders as target_order
  where target_order.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_order_not_found';
  end if;
  if v_order.status not in ('paid', 'partially_refunded', 'disputed') then
    raise exception using errcode = '55000', message = 'economic_order_not_refundable';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'economic_refund_amount_invalid';
  end if;
  select * into v_payment
  from private.economic_payment_transactions as transaction
  where transaction.id = p_payment_transaction_id
    and transaction.order_id = p_order_id
    and transaction.transaction_type = 'payment'
    and transaction.status in ('succeeded', 'refunded', 'disputed')
  for update;
  if not found or v_payment.provider_transaction_reference is null
     or v_payment.currency <> v_order.currency then
    raise exception using errcode = '55000', message = 'economic_refund_payment_not_refundable';
  end if;

  select coalesce(pg_catalog.sum(refund.amount_minor), 0) into v_refunded
  from private.economic_refunds as refund
  where refund.payment_transaction_id = p_payment_transaction_id
    and refund.status in ('pending', 'succeeded');
  select coalesce(pg_catalog.sum(request.amount_minor), 0) into v_held
  from private.economic_refund_requests as request
  where request.payment_transaction_id = p_payment_transaction_id
    and request.status in ('held_for_review', 'approved_for_provider', 'provider_pending');
  if p_amount_minor > v_payment.gross_amount_minor - v_refunded - v_held then
    raise exception using errcode = '22023', message = 'economic_refund_amount_exceeds_remaining';
  end if;

  insert into private.economic_refund_requests (
    client_request_id, order_id, payment_transaction_id, amount_minor, currency,
    requested_by, private_reason
  ) values (
    p_client_request_id, p_order_id, p_payment_transaction_id, p_amount_minor, v_order.currency,
    p_actor_user_id, pg_catalog.btrim(p_reason)
  ) returning * into v_request;

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'refund_held_for_review',
    'economic_refund_request', v_request.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'order_id', p_order_id,
      'payment_transaction_id', p_payment_transaction_id,
      'amount_minor', p_amount_minor,
      'currency', v_order.currency
    )
  );

  return pg_catalog.jsonb_build_object(
    'refundRequestId', v_request.id,
    'orderId', v_request.order_id,
    'paymentTransactionId', v_request.payment_transaction_id,
    'amountMinor', v_request.amount_minor,
    'currency', v_request.currency,
    'status', v_request.status,
    'idempotentReplay', false
  );
end;
$$;

alter function public.operator_place_refund_hold(uuid, uuid, uuid, bigint, uuid, text)
  owner to postgres;

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
      'testMode', true,
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
      'test_mode', true
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
    'testMode', true,
    'idempotentReplay', false
  );
end;
$$;

alter function public.operator_prepare_test_refund(uuid, uuid, uuid, text, text)
  owner to postgres;

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
      'testMode', true,
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
      'test_mode', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'refundRequestId', v_request.id,
    'orderId', v_request.order_id,
    'paymentTransactionId', v_request.payment_transaction_id,
    'economicRefundId', v_refund.id,
    'status', v_request.status,
    'providerStatus', p_provider_status,
    'testMode', true,
    'idempotentReplay', false
  );
end;
$$;

alter function public.attach_economic_test_refund_result(
  uuid, uuid, uuid, text, text, timestamptz, text, text
) owner to postgres;

create or replace function private.synchronize_economic_refund_request_from_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.economic_refund_requests
  set
    status = case new.status
      when 'succeeded' then 'completed'
      when 'failed' then 'rejected'
      when 'canceled' then 'canceled'
      else 'provider_pending'
    end,
    completed_at = case when new.status = 'succeeded' then coalesce(completed_at, pg_catalog.now()) else null end,
    updated_at = pg_catalog.now()
  where provider_refund_reference = new.provider_refund_reference
    and status in ('approved_for_provider', 'provider_pending', 'completed');
  return new;
end;
$$;

alter function private.synchronize_economic_refund_request_from_refund() owner to postgres;
revoke all privileges on function private.synchronize_economic_refund_request_from_refund()
  from public, anon, authenticated, service_role;

create trigger economic_refunds_sync_operator_request
after insert or update of status, provider_event_created_at
on private.economic_refunds
for each row execute function private.synchronize_economic_refund_request_from_refund();

create or replace function public.operator_mark_reconciliation_needed(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_client_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case private.economic_reconciliation_cases%rowtype;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_reconciliation_manage');
  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'economic_client_request_id_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_reconciliation_reason_required';
  end if;
  if p_order_id is null or not exists (select 1 from private.economic_orders where id = p_order_id) then
    raise exception using errcode = 'P0002', message = 'economic_order_not_found';
  end if;

  select * into v_case
  from private.economic_reconciliation_cases
  where client_request_id = p_client_request_id;
  if found then
    if v_case.order_id <> p_order_id or v_case.opened_by <> p_actor_user_id then
      raise exception using errcode = '23505', message = 'economic_reconciliation_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'reconciliationCaseId', v_case.id,
      'orderId', v_case.order_id,
      'status', v_case.status,
      'idempotentReplay', true
    );
  end if;

  insert into private.economic_reconciliation_cases (
    client_request_id, order_id, opened_by, private_reason
  ) values (
    p_client_request_id, p_order_id, p_actor_user_id, pg_catalog.btrim(p_reason)
  ) returning * into v_case;

  insert into private.economic_audit_events (
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'reconciliation_case_opened',
    'economic_reconciliation_case', v_case.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object('order_id', p_order_id)
  );

  return pg_catalog.jsonb_build_object(
    'reconciliationCaseId', v_case.id,
    'orderId', v_case.order_id,
    'status', v_case.status,
    'idempotentReplay', false
  );
end;
$$;

alter function public.operator_mark_reconciliation_needed(uuid, uuid, uuid, text)
  owner to postgres;

create or replace function public.current_user_economic_operator_overview()
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
    'authorized', exists (
      select 1 from private.economic_operator_assignments as assignment
      join auth.users as account on account.id = assignment.user_id
      where assignment.user_id = v_actor
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > pg_catalog.now())
        and account.deleted_at is null
        and account.is_anonymous is false
        and (account.banned_until is null or account.banned_until <= pg_catalog.now())
    ),
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(assignment.capability order by assignment.capability)
      from private.economic_operator_assignments as assignment
      join auth.users as account on account.id = assignment.user_id
      where assignment.user_id = v_actor
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > pg_catalog.now())
        and account.deleted_at is null
        and account.is_anonymous is false
        and (account.banned_until is null or account.banned_until <= pg_catalog.now())
    ), '[]'::jsonb),
    'open_refund_holds', case
      when private.economic_operator_has_capability(v_actor, 'economic_refunds_manage') then (
        select pg_catalog.count(*) from private.economic_refund_requests
        where status in ('held_for_review', 'approved_for_provider', 'provider_pending')
      )
      else null
    end,
    'open_reconciliation_cases', case
      when private.economic_operator_has_capability(v_actor, 'economic_reconciliation_manage') then (
        select pg_catalog.count(*) from private.economic_reconciliation_cases
        where status in ('open', 'investigating', 'waiting_for_provider')
      )
      else null
    end,
    'test_mode', true
  );
end;
$$;

alter function public.current_user_economic_operator_overview() owner to postgres;

do $economic_operator_function_acl$
begin
  revoke all privileges on function public.bootstrap_economic_operator(uuid, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.set_economic_operator_assignment(uuid, uuid, text, boolean, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_grant_sandbox_credit_units(
    uuid, uuid, bigint, text, text, timestamptz, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_place_refund_hold(uuid, uuid, uuid, bigint, uuid, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_prepare_test_refund(uuid, uuid, uuid, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.attach_economic_test_refund_result(
    uuid, uuid, uuid, text, text, timestamptz, text, text
  ) from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_mark_reconciliation_needed(uuid, uuid, uuid, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.current_user_economic_operator_overview()
    from public, anon, authenticated, service_role;
end
$economic_operator_function_acl$;

grant execute on function public.bootstrap_economic_operator(uuid, text) to service_role;
grant execute on function public.set_economic_operator_assignment(uuid, uuid, text, boolean, text)
  to service_role;
grant execute on function public.operator_grant_sandbox_credit_units(
  uuid, uuid, bigint, text, text, timestamptz, text, text
) to service_role;
grant execute on function public.operator_place_refund_hold(uuid, uuid, uuid, bigint, uuid, text)
  to service_role;
grant execute on function public.operator_prepare_test_refund(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.attach_economic_test_refund_result(
  uuid, uuid, uuid, text, text, timestamptz, text, text
) to service_role;
grant execute on function public.operator_mark_reconciliation_needed(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.current_user_economic_operator_overview()
  to authenticated;

comment on table private.economic_operator_assignments is
  'Private economic capabilities only. They grant no community, governance, moderation, review, badge, or publication authority.';
comment on function public.bootstrap_economic_operator is
  'Service-only first-manager and break-glass continuity bootstrap. It requires an eligible account recognized as administrator by both unresolved repository authority sources, audits closure of expired/ineligible rows, and closes while any eligible assignment manager exists.';
comment on function public.current_user_economic_operator_overview is
  'Authenticated self-only operator capability projection; financial records and provider identifiers are not returned.';

commit;
