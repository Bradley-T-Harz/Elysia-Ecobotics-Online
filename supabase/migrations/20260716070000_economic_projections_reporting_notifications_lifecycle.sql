-- Final economic boundary projections, lifecycle requests, public recognition,
-- capability-filtered queues, bounded accounting export, and best-effort Signal
-- Console notifications. Private financial records remain canonical.

begin;

create table private.economic_support_recognition_preferences (
  user_id uuid primary key references auth.users(id) on delete restrict,
  opted_in boolean not null default false,
  consent_version text not null,
  last_client_request_id uuid not null unique,
  eligibility_order_id uuid references private.economic_orders(id) on delete restrict,
  eligibility_expires_at timestamptz,
  eligibility_revoked_at timestamptz,
  eligibility_revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint economic_support_recognition_consent_check
    check (pg_catalog.char_length(consent_version) between 1 and 120),
  constraint economic_support_recognition_revocation_check check (
    (eligibility_revoked_at is null and eligibility_revocation_reason is null)
    or (eligibility_revoked_at is not null
      and pg_catalog.char_length(eligibility_revocation_reason) between 3 and 120)
  )
);

create table private.economic_support_recognition_preference_events (
  client_request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  opted_in boolean not null,
  consent_version text not null,
  eligibility_order_id uuid references private.economic_orders(id) on delete restrict,
  eligibility_expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint economic_support_recognition_event_consent_check
    check (pg_catalog.char_length(consent_version) between 1 and 120)
);

create table private.economic_service_restriction_actions (
  client_request_id uuid primary key,
  restriction_id uuid not null references private.economic_service_restrictions(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  scope text not null,
  reason_code text not null,
  expires_at timestamptz,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  private_reason text not null,
  created_at timestamptz not null default now(),
  constraint economic_service_restriction_action_check
    check (action in ('impose', 'lift', 'associate_closure')),
  constraint economic_service_restriction_action_scope_check check (
    scope in ('billing', 'recurring_support', 'sandbox', 'marketplace_buying', 'marketplace_selling', 'job_posting')
  ),
  constraint economic_service_restriction_action_reason_check
    check (reason_code ~ '^[a-z][a-z0-9_]{2,100}$'
      and pg_catalog.char_length(private_reason) between 8 and 1000)
);

create table private.economic_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  notification_type text not null,
  source_type text not null,
  source_id uuid,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error_code text,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  constraint economic_notification_outbox_delivery_key_check
    check (pg_catalog.char_length(delivery_key) between 8 and 255),
  constraint economic_notification_outbox_status_check
    check (status in ('pending', 'delivered', 'failed', 'abandoned')),
  constraint economic_notification_outbox_attempt_check
    check (attempt_count between 0 and 20),
  constraint economic_notification_outbox_delivery_check check (
    (status = 'delivered' and delivered_at is not null)
    or (status <> 'delivered' and delivered_at is null)
  )
);

create table private.economic_accounting_export_actions (
  client_request_id uuid primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  from_at timestamptz not null,
  to_at timestamptz not null,
  after_created_at timestamptz,
  after_id uuid,
  row_limit integer not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint economic_accounting_export_action_cursor_check
    check ((after_created_at is null) = (after_id is null)),
  constraint economic_accounting_export_action_limit_check
    check (row_limit between 1 and 100),
  constraint economic_accounting_export_action_payload_check
    check (pg_catalog.jsonb_typeof(result_payload) = 'object')
);

create index economic_accounting_export_actions_actor_created_idx
  on private.economic_accounting_export_actions(actor_user_id, created_at desc);

create index economic_notification_outbox_pending_idx
  on private.economic_notification_outbox(next_attempt_at, created_at)
  where status in ('pending', 'failed');

create table private.economic_account_action_requests (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  request_type text not null,
  status text not null default 'submitted',
  consent_version text not null,
  user_note text,
  financial_records_retained boolean not null default true,
  auth_profile_unchanged boolean not null default true,
  provider_cancellation_required boolean not null default false,
  fulfillment_artifact_sha256 text,
  fulfillment_expires_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  private_resolution text,
  constraint economic_account_action_type_check
    check (request_type in ('data_export', 'economic_account_closure')),
  constraint economic_account_action_status_check check (
    status in ('submitted', 'identity_verification', 'operator_review', 'processing', 'completed', 'rejected', 'canceled')
  ),
  constraint economic_account_action_consent_check
    check (pg_catalog.char_length(consent_version) between 1 and 120),
  constraint economic_account_action_note_check
    check (user_note is null or pg_catalog.char_length(user_note) <= 1000),
  constraint economic_account_action_invariants_check
    check (financial_records_retained = true and auth_profile_unchanged = true),
  constraint economic_account_action_fulfillment_check check (
    fulfillment_artifact_sha256 is null
    or (request_type = 'data_export'
      and fulfillment_artifact_sha256 ~ '^[0-9a-f]{64}$'
      and fulfillment_expires_at is not null)
  ),
  constraint economic_account_action_completion_check check (
    (status = 'completed' and completed_at is not null and resolved_by is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create unique index economic_account_action_one_open_idx
  on private.economic_account_action_requests(user_id, request_type)
  where status in ('submitted', 'identity_verification', 'operator_review', 'processing');

do $economic_final_table_hardening$
declare v_table text;
begin
  foreach v_table in array array[
    'economic_support_recognition_preferences',
    'economic_support_recognition_preference_events',
    'economic_notification_outbox',
    'economic_account_action_requests',
    'economic_service_restriction_actions',
    'economic_accounting_export_actions'
  ] loop
    execute pg_catalog.format('alter table private.%I owner to postgres', v_table);
    execute pg_catalog.format('alter table private.%I enable row level security', v_table);
    execute pg_catalog.format(
      'revoke all privileges on table private.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$economic_final_table_hardening$;

create trigger economic_support_recognition_events_are_append_only
before update or delete on private.economic_support_recognition_preference_events
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_service_restriction_actions_are_append_only
before update or delete on private.economic_service_restriction_actions
for each row execute function private.prevent_economic_history_mutation();
create trigger economic_accounting_export_actions_are_append_only
before update or delete on private.economic_accounting_export_actions
for each row execute function private.prevent_economic_history_mutation();

create or replace function private.enqueue_economic_notification(
  p_delivery_key text,
  p_user_id uuid,
  p_notification_type text,
  p_source_type text,
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or pg_catalog.char_length(coalesce(p_delivery_key, '')) not between 8 and 255
     or not private.notification_type_is_economic(p_notification_type)
     or pg_catalog.char_length(coalesce(p_source_type, '')) not between 1 and 80 then
    return;
  end if;
  insert into private.economic_notification_outbox(
    delivery_key, user_id, notification_type, source_type, source_id
  ) values (
    p_delivery_key, p_user_id, p_notification_type, p_source_type, p_source_id
  ) on conflict (delivery_key) do nothing;
end;
$$;

alter function private.enqueue_economic_notification(text, uuid, text, text, uuid)
  owner to postgres;
revoke all privileges on function private.enqueue_economic_notification(text, uuid, text, text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.try_enqueue_economic_notification(
  p_delivery_key text,
  p_user_id uuid,
  p_notification_type text,
  p_source_type text,
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_economic_notification(
    p_delivery_key, p_user_id, p_notification_type, p_source_type, p_source_id
  );
exception when others then
  -- Notification convenience must never roll back canonical money, license,
  -- assistance, or account-request state. Reconciliation monitors the outbox.
  return;
end;
$$;

alter function private.try_enqueue_economic_notification(text, uuid, text, text, uuid)
  owner to postgres;
revoke all privileges on function private.try_enqueue_economic_notification(text, uuid, text, text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.enqueue_economic_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_type text;
begin
  if new.user_id is null or (tg_op = 'UPDATE' and new.status is not distinct from old.status) then
    return new;
  end if;
  v_type := case new.flow
    when 'support_one_time' then 'economic_support_updated'
    when 'support_recurring' then 'subscription_state_updated'
    when 'sandbox_credits' then 'sandbox_credit_balance_updated'
    when 'job_post_fee' then 'job_fee_state_updated'
    when 'marketplace_purchase' then 'marketplace_purchase_state_updated'
    when 'organization_service' then 'organization_service_state_updated'
    else 'sponsorship_state_updated'
  end;
  perform private.try_enqueue_economic_notification(
    'order:' || new.id::text || ':' || new.status,
    new.user_id, v_type, 'economic_order', new.id
  );
  return new;
end;
$$;

alter function private.enqueue_economic_order_notification() owner to postgres;
revoke all privileges on function private.enqueue_economic_order_notification()
  from public, anon, authenticated, service_role;

create trigger enqueue_economic_order_notification
after insert or update of status on private.economic_orders
for each row execute function private.enqueue_economic_order_notification();

create or replace function private.enqueue_related_economic_state_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else '{}'::jsonb end;
  v_user_id uuid;
  v_source_id uuid := nullif(v_new ->> 'id', '')::uuid;
  v_state text;
  v_type text;
begin
  if tg_table_name = 'economic_subscriptions' then
    v_user_id := nullif(v_new ->> 'user_id', '')::uuid;
    v_type := 'subscription_state_updated';
    v_state := coalesce(v_new ->> 'status', '') || ':' || coalesce(v_new ->> 'current_period_end', 'none')
      || ':' || coalesce(v_new ->> 'cancel_at_period_end', 'false');
  elsif tg_table_name = 'economic_refunds' then
    select economic_order.user_id into v_user_id
    from private.economic_orders as economic_order
    where economic_order.id = nullif(v_new ->> 'order_id', '')::uuid;
    v_type := 'refund_state_updated';
  elsif tg_table_name = 'economic_disputes' then
    select economic_order.user_id into v_user_id
    from private.economic_orders as economic_order where economic_order.id = new.order_id;
    v_source_id := new.id;
    v_type := 'dispute_state_updated';
    v_state := coalesce(v_new ->> 'status', '');
  elsif tg_table_name = 'sandbox_credit_ledger_entries' then
    v_user_id := nullif(v_new ->> 'user_id', '')::uuid;
    v_type := 'sandbox_credit_balance_updated';
    v_state := coalesce(v_new ->> 'entry_type', 'ledger');
  elsif tg_table_name = 'marketplace_licenses' then
    v_user_id := nullif(v_new ->> 'buyer_user_id', '')::uuid;
    v_type := 'marketplace_purchase_state_updated';
    v_state := coalesce(v_new ->> 'economic_status', '');
  elsif tg_table_name = 'job_post_economic_conditions' then
    v_user_id := nullif(v_new ->> 'author_user_id', '')::uuid;
    v_type := 'job_fee_state_updated';
    v_state := coalesce(v_new ->> 'condition_status', '');
  elsif tg_table_name = 'economic_assistance_grants' then
    v_user_id := nullif(v_new ->> 'beneficiary_user_id', '')::uuid;
    v_type := 'assistance_state_updated';
    v_state := coalesce(v_new ->> 'status', '');
  elsif tg_table_name = 'organization_service_engagements' then
    v_user_id := nullif(v_new ->> 'authorized_signer_user_id', '')::uuid;
    v_type := 'organization_service_state_updated';
    v_state := coalesce(v_new ->> 'status', '');
  elsif tg_table_name = 'sponsorship_agreements' then
    v_user_id := nullif(v_new ->> 'authorized_signer_user_id', '')::uuid;
    v_type := 'sponsorship_state_updated';
    v_state := coalesce(v_new ->> 'status', '');
  elsif tg_table_name = 'marketplace_payout_preparations' then
    select seller.user_id into v_user_id
    from private.economic_seller_accounts as seller
    where seller.id = nullif(v_new ->> 'seller_account_id', '')::uuid;
    v_type := 'payout_state_updated';
    v_state := coalesce(v_new ->> 'status', '');
  else
    return new;
  end if;
  if v_user_id is null or (
    tg_op = 'UPDATE'
    and coalesce(v_old ->> 'status', v_old ->> 'economic_status', v_old ->> 'condition_status', '')
      = coalesce(v_new ->> 'status', v_new ->> 'economic_status', v_new ->> 'condition_status', '')
    and tg_table_name <> 'economic_subscriptions'
  ) then
    return new;
  end if;
  perform private.try_enqueue_economic_notification(
    pg_catalog.left(tg_table_name || ':' || v_source_id::text || ':' || v_state, 255),
    v_user_id, v_type, tg_table_name, v_source_id
  );
  return new;
exception when others then
  return new;
end;
$$;

alter function private.enqueue_related_economic_state_notification() owner to postgres;
revoke all privileges on function private.enqueue_related_economic_state_notification()
  from public, anon, authenticated, service_role;

create trigger enqueue_economic_subscription_notification
after insert or update of status, current_period_end, cancel_at_period_end
on private.economic_subscriptions
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_economic_refund_notification
after insert or update of status on private.economic_refunds
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_economic_dispute_notification
after insert or update of status on private.economic_disputes
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_sandbox_credit_notification
after insert on private.sandbox_credit_ledger_entries
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_marketplace_license_notification
after insert or update of economic_status on private.marketplace_licenses
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_job_fee_notification
after insert or update of condition_status on private.job_post_economic_conditions
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_assistance_notification
after insert or update of status on private.economic_assistance_grants
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_organization_service_notification
after insert or update of status on private.organization_service_engagements
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_sponsorship_notification
after insert or update of status on private.sponsorship_agreements
for each row execute function private.enqueue_related_economic_state_notification();
create trigger enqueue_marketplace_payout_notification
after insert or update of status on private.marketplace_payout_preparations
for each row execute function private.enqueue_related_economic_state_notification();

create or replace function public.deliver_economic_notification_outbox(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item private.economic_notification_outbox%rowtype;
  v_delivered integer := 0;
  v_failed integer := 0;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'economic_notification_batch_limit_invalid';
  end if;
  for v_item in
    select * from private.economic_notification_outbox as outbox
    where outbox.status in ('pending', 'failed')
      and outbox.attempt_count < 20
      and outbox.next_attempt_at <= pg_catalog.now()
    order by outbox.created_at
    for update skip locked
    limit p_limit
  loop
    begin
      perform public.create_economic_notification(
        v_item.user_id, v_item.notification_type,
        v_item.source_type, v_item.source_id, v_item.delivery_key
      );
      update private.economic_notification_outbox
      set status = 'delivered', attempt_count = attempt_count + 1,
          delivered_at = pg_catalog.now(), last_error_code = null
      where id = v_item.id;
      v_delivered := v_delivered + 1;
    exception when others then
      update private.economic_notification_outbox
      set status = case when attempt_count + 1 >= 20 then 'abandoned' else 'failed' end,
          attempt_count = attempt_count + 1,
          last_error_code = pg_catalog.left(sqlstate, 20),
          next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(
            mins => least(1440, (attempt_count + 1) * (attempt_count + 1))
          )
      where id = v_item.id;
      v_failed := v_failed + 1;
    end;
  end loop;
  return pg_catalog.jsonb_build_object(
    'delivered', v_delivered, 'failed', v_failed,
    'canonicalFinancialTruth', false
  );
end;
$$;

alter function public.deliver_economic_notification_outbox(integer) owner to postgres;

create or replace function public.set_current_user_support_recognition(
  p_client_request_id uuid,
  p_opted_in boolean,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_event private.economic_support_recognition_preference_events%rowtype;
  v_eligibility_order private.economic_orders%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;
  if p_client_request_id is null
     or pg_catalog.char_length(coalesce(p_consent_version, '')) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'support_recognition_consent_invalid';
  end if;
  perform private.require_active_economic_legal_version(
    'support_recognition_consent', p_consent_version
  );
  select * into v_event
  from private.economic_support_recognition_preference_events
  where client_request_id = p_client_request_id;
  if found then
    if v_event.user_id <> v_actor
       or v_event.opted_in <> coalesce(p_opted_in, false)
       or v_event.consent_version <> p_consent_version then
      raise exception using errcode = '23505', message = 'support_recognition_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'optedIn', v_event.opted_in,
      'eligible', v_event.eligibility_order_id is not null,
      'eligibilityExpiresAt', v_event.eligibility_expires_at,
      'publicDisplayEnabled', private.economic_feature_enabled('public_support_recognition'),
      'amountsPublic', false, 'grantsAuthority', false,
      'idempotentReplay', true
    );
  end if;
  if coalesce(p_opted_in, false) then
    select * into v_eligibility_order
    from private.economic_orders as economic_order
    where economic_order.user_id = v_actor
      and economic_order.flow in ('support_one_time', 'support_recurring')
      and economic_order.status in ('paid', 'partially_refunded')
    order by economic_order.paid_at desc nulls last, economic_order.created_at desc
    limit 1;
    if not found then
      raise exception using errcode = '55000', message = 'support_recognition_not_eligible';
    end if;
  end if;
  insert into private.economic_support_recognition_preference_events(
    client_request_id, user_id, opted_in, consent_version,
    eligibility_order_id, eligibility_expires_at
  ) values (
    p_client_request_id, v_actor, coalesce(p_opted_in, false),
    p_consent_version, v_eligibility_order.id, null
  ) returning * into v_event;
  insert into private.economic_consents(
    user_id, document_key, document_version, source_route,
    client_request_id, metadata
  ) values (
    v_actor, 'support_recognition_consent', p_consent_version,
    '/commons-circle/support-billing', p_client_request_id,
    pg_catalog.jsonb_build_object(
      'opted_in', coalesce(p_opted_in, false),
      'eligibility_order_id', v_eligibility_order.id,
      'amounts_public', false, 'grants_authority', false
    )
  );
  insert into private.economic_support_recognition_preferences(
    user_id, opted_in, consent_version, last_client_request_id,
    eligibility_order_id, eligibility_expires_at,
    eligibility_revoked_at, eligibility_revocation_reason
  ) values (
    v_actor, coalesce(p_opted_in, false), p_consent_version,
    p_client_request_id, v_eligibility_order.id, null, null, null
  ) on conflict (user_id) do update set
    opted_in = excluded.opted_in,
    consent_version = excluded.consent_version,
    last_client_request_id = excluded.last_client_request_id,
    eligibility_order_id = excluded.eligibility_order_id,
    eligibility_expires_at = excluded.eligibility_expires_at,
    eligibility_revoked_at = null,
    eligibility_revocation_reason = null,
    updated_at = pg_catalog.now();
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, metadata
  ) values (
    v_actor, 'user', 'support_recognition_preference_changed',
    'support_recognition_preference', v_actor,
    pg_catalog.jsonb_build_object(
      'client_request_id', p_client_request_id,
      'opted_in', coalesce(p_opted_in, false),
      'amounts_public', false, 'grants_authority', false
    )
  );
  perform private.try_enqueue_economic_notification(
    'support-recognition:' || p_client_request_id::text,
    v_actor, 'support_recognition_state_updated',
    'support_recognition_preference', v_actor
  );
  return pg_catalog.jsonb_build_object(
    'optedIn', coalesce(p_opted_in, false),
    'eligible', v_eligibility_order.id is not null,
    'eligibilityExpiresAt', null,
    'publicDisplayEnabled', private.economic_feature_enabled('public_support_recognition'),
    'amountsPublic', false, 'grantsAuthority', false,
    'idempotentReplay', false
  );
end;
$$;

alter function public.set_current_user_support_recognition(uuid, boolean, text)
  owner to postgres;

create or replace function public.public_support_recognition()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'enabled', private.economic_feature_enabled('public_support_recognition'),
    'supporters', case when private.economic_feature_enabled('public_support_recognition') then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'username', profile.username,
        'displayName', profile.display_name,
        'grantsAuthority', false,
        'amountPublic', false
      ) order by pg_catalog.lower(profile.display_name), pg_catalog.lower(profile.username))
      from private.economic_support_recognition_preferences as preference
      join public.profiles as profile on profile.id = preference.user_id
      left join public.profile_visibility_settings as visibility on visibility.user_id = profile.id
      where preference.opted_in = true
        and preference.eligibility_revoked_at is null
        and (preference.eligibility_expires_at is null
          or preference.eligibility_expires_at > pg_catalog.now())
        and coalesce(visibility.show_display_name, true) = true
        and pg_catalog.char_length(profile.username) between 1 and 80
        and profile.display_name is not null
        and exists (
          select 1 from private.economic_orders as economic_order
          where economic_order.user_id = preference.user_id
            and economic_order.flow in ('support_one_time', 'support_recurring')
            and economic_order.status in ('paid', 'partially_refunded')
        )
    ), '[]'::jsonb) else '[]'::jsonb end,
    'ranked', false, 'amountsPublic', false, 'paymentGrantsAuthority', false
  );
$$;

alter function public.public_support_recognition() owner to postgres;

create or replace function private.reconcile_support_recognition_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preference private.economic_support_recognition_preferences%rowtype;
  v_eligible_order_id uuid;
begin
  if new.user_id is null
     or new.flow not in ('support_one_time', 'support_recurring')
     or new.status is not distinct from old.status then
    return new;
  end if;
  select * into v_preference
  from private.economic_support_recognition_preferences
  where user_id = new.user_id for update;
  if not found or not v_preference.opted_in then
    return new;
  end if;
  select economic_order.id into v_eligible_order_id
  from private.economic_orders as economic_order
  where economic_order.user_id = new.user_id
    and economic_order.flow in ('support_one_time', 'support_recurring')
    and economic_order.status in ('paid', 'partially_refunded')
  order by economic_order.paid_at desc nulls last, economic_order.created_at desc
  limit 1;
  if v_eligible_order_id is null and v_preference.eligibility_revoked_at is null then
    update private.economic_support_recognition_preferences
    set eligibility_revoked_at = pg_catalog.now(),
        eligibility_revocation_reason = 'no_currently_eligible_support_order',
        updated_at = pg_catalog.now()
    where user_id = new.user_id;
    insert into private.economic_audit_events(
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'system', 'support_recognition_eligibility_revoked',
      'support_recognition_preference', new.user_id,
      pg_catalog.jsonb_build_object(
        'amounts_public', false, 'grants_authority', false,
        'source_order_id', new.id
      )
    );
  elsif v_eligible_order_id is not null and (
    v_preference.eligibility_revoked_at is not null
    or v_preference.eligibility_order_id is distinct from v_eligible_order_id
  ) then
    update private.economic_support_recognition_preferences
    set eligibility_order_id = v_eligible_order_id,
        eligibility_revoked_at = null,
        eligibility_revocation_reason = null,
        updated_at = pg_catalog.now()
    where user_id = new.user_id;
    insert into private.economic_audit_events(
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'system', 'support_recognition_eligibility_restored',
      'support_recognition_preference', new.user_id,
      pg_catalog.jsonb_build_object(
        'amounts_public', false, 'grants_authority', false,
        'eligibility_order_id', v_eligible_order_id
      )
    );
  end if;
  return new;
exception when others then
  return new;
end;
$$;

alter function private.reconcile_support_recognition_eligibility() owner to postgres;
revoke all privileges on function private.reconcile_support_recognition_eligibility()
  from public, anon, authenticated, service_role;

create trigger reconcile_support_recognition_eligibility
after update of status on private.economic_orders
for each row execute function private.reconcile_support_recognition_eligibility();

create or replace function private.economic_account_closure_obligations(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_subscriptions integer;
  v_scheduled_cancellations integer;
  v_orders integer;
  v_refunds integer;
  v_disputes integer;
  v_reconciliation integer;
  v_payouts integer;
  v_payables integer;
  v_marketplace integer;
  v_jobs integer;
  v_organizations integer;
  v_sponsorships integer;
  v_total integer;
begin
  select pg_catalog.count(*) into v_subscriptions from private.economic_subscriptions
    where user_id = p_user_id and (
      status in ('incomplete','active','past_due','grace_period')
      or (status = 'canceling' and cancel_at_period_end = false)
    );
  select pg_catalog.count(*) into v_scheduled_cancellations
  from private.economic_subscriptions
  where user_id = p_user_id and status = 'canceling' and cancel_at_period_end = true;
  select pg_catalog.count(*) into v_orders from private.economic_orders
    where user_id = p_user_id and status in ('pending','checkout_created','processing');
  select pg_catalog.count(*) into v_refunds
    from private.economic_refund_requests as request
    join private.economic_orders as economic_order on economic_order.id = request.order_id
    where economic_order.user_id = p_user_id
      and request.status in ('held_for_review','approved_for_provider','provider_pending');
  select v_refunds + pg_catalog.count(*) into v_refunds
    from private.economic_refunds as refund
    join private.economic_orders as economic_order on economic_order.id = refund.order_id
    where economic_order.user_id = p_user_id and refund.status = 'pending';
  select pg_catalog.count(*) into v_disputes
    from private.economic_disputes as dispute
    join private.economic_orders as economic_order on economic_order.id = dispute.order_id
    where economic_order.user_id = p_user_id
      and dispute.status in ('warning_needs_response','warning_under_review','needs_response','under_review');
  select pg_catalog.count(*) into v_reconciliation
    from private.economic_reconciliation_cases as reconciliation
    left join private.economic_orders as economic_order on economic_order.id = reconciliation.order_id
    where economic_order.user_id = p_user_id
      and reconciliation.status in ('open','investigating','waiting_for_provider');
  select pg_catalog.count(*) into v_payouts
    from private.marketplace_payout_preparations as payout
    join private.economic_seller_accounts as seller on seller.id = payout.seller_account_id
    where seller.user_id = p_user_id and payout.status in ('prepared','transfer_pending');
  select pg_catalog.count(*) into v_payables
  from private.economic_seller_accounts as seller
  where seller.user_id = p_user_id and exists (
    select 1 from (
      select event.currency
      from private.marketplace_commission_events as event
      where event.seller_account_id = seller.id
      group by event.currency
    ) as currency_row
    where private.marketplace_available_seller_payable(seller.id, currency_row.currency) > 0
  );
  select pg_catalog.count(*) into v_marketplace
    from private.marketplace_purchase_contracts
    where buyer_user_id = p_user_id
      and status = 'pending';
  select pg_catalog.count(*) into v_jobs
    from private.job_post_economic_conditions
    where author_user_id = p_user_id and classification = 'commercial'
      and condition_status in ('payment_required','payment_pending','reconciliation_required');
  select pg_catalog.count(*) into v_organizations
    from private.organization_service_engagements
    where authorized_signer_user_id = p_user_id
      and status in ('contract_pending','active','reconciliation_required');
  select pg_catalog.count(*) into v_sponsorships
    from private.sponsorship_agreements
    where authorized_signer_user_id = p_user_id
      and status in ('contract_pending','active','reconciliation_required');
  v_total := v_subscriptions + v_orders + v_refunds + v_disputes + v_reconciliation
    + v_payouts + v_payables + v_marketplace + v_jobs + v_organizations + v_sponsorships;
  return pg_catalog.jsonb_build_object(
    'canComplete', v_total = 0, 'blockingCount', v_total,
    'activeSubscriptions', v_subscriptions,
    'scheduledSubscriptionCancellations', v_scheduled_cancellations,
    'unsettledOrders', v_orders,
    'openRefunds', v_refunds, 'openDisputes', v_disputes,
    'openReconciliationCases', v_reconciliation,
    'pendingSellerPayouts', v_payouts, 'sellerPayableObligations', v_payables,
    'pendingMarketplaceFulfillment', v_marketplace,
    'pendingJobPostFulfillment', v_jobs,
    'organizationSignerDuties', v_organizations,
    'sponsorshipSignerDuties', v_sponsorships,
    'preservesEarnedLicenses', true, 'preservesRemainingSandboxCredits', true,
    'financialRecordsRetained', true, 'authProfileUnchanged', true,
    'guidance', pg_catalog.jsonb_build_array(
      'Cancel recurring support through the Customer Portal before closure.',
      'Resolve open refunds, disputes, reconciliation, fulfillment, signer, and seller obligations.',
      'Already-earned licenses, remaining credits, receipts, and financial history are retained.'
    )
  );
end;
$$;

alter function private.economic_account_closure_obligations(uuid) owner to postgres;
revoke all privileges on function private.economic_account_closure_obligations(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.current_user_economic_closure_readiness()
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
  return private.economic_account_closure_obligations(v_actor);
end;
$$;

alter function public.current_user_economic_closure_readiness() owner to postgres;

create or replace function public.request_economic_account_action(
  p_client_request_id uuid,
  p_request_type text,
  p_consent_version text,
  p_user_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request private.economic_account_action_requests%rowtype;
  v_provider_cancel boolean;
  v_idempotent_replay boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'economic_authentication_required';
  end if;
  if p_client_request_id is null
     or p_request_type not in ('data_export', 'economic_account_closure')
     or pg_catalog.char_length(coalesce(p_consent_version, '')) not between 1 and 120
     or pg_catalog.char_length(coalesce(p_user_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'economic_account_request_invalid';
  end if;
  perform private.require_active_economic_legal_version(
    case p_request_type
      when 'data_export' then 'economic_data_export_request'
      else 'economic_account_closure_request'
    end,
    p_consent_version
  );
  v_provider_cancel := p_request_type = 'economic_account_closure' and exists (
    select 1 from private.economic_subscriptions as subscription
    where subscription.user_id = v_actor
      and (
        subscription.status in ('incomplete', 'active', 'past_due', 'grace_period')
        or (subscription.status = 'canceling' and subscription.cancel_at_period_end = false)
      )
  );
  select * into v_request
  from private.economic_account_action_requests
  where client_request_id = p_client_request_id;
  v_idempotent_replay := found;
  if v_idempotent_replay then
    if v_request.user_id <> v_actor or v_request.request_type <> p_request_type
       or v_request.consent_version <> p_consent_version
       or v_request.user_note is distinct from nullif(pg_catalog.btrim(coalesce(p_user_note, '')), '') then
      raise exception using errcode = '23505', message = 'economic_account_request_idempotency_conflict';
    end if;
  else
    insert into private.economic_account_action_requests(
      client_request_id, user_id, request_type, consent_version,
      user_note, provider_cancellation_required
    ) values (
      p_client_request_id, v_actor, p_request_type, p_consent_version,
      nullif(pg_catalog.btrim(coalesce(p_user_note, '')), ''), v_provider_cancel
    ) returning * into v_request;
    insert into private.economic_consents(
      user_id, document_key, document_version, source_route,
      client_request_id, metadata
    ) values (
      v_actor,
      case p_request_type when 'data_export' then 'economic_data_export_request'
        else 'economic_account_closure_request' end,
      p_consent_version, '/commons-circle/support-billing',
      p_client_request_id,
      pg_catalog.jsonb_build_object(
        'request_type', p_request_type,
        'financial_records_retained', true,
        'auth_profile_unchanged', true
      )
    );
    insert into private.economic_audit_events(
      actor_user_id, actor_kind, action, target_type, target_id, metadata
    ) values (
      v_actor, 'user', 'economic_account_action_requested',
      'economic_account_action_request', v_request.id,
      pg_catalog.jsonb_build_object(
        'request_type', p_request_type,
        'financial_records_retained', true,
        'auth_profile_unchanged', true
      )
    );
    perform private.try_enqueue_economic_notification(
      'economic-account-request:' || v_request.id::text || ':submitted',
      v_actor, 'economic_account_request_updated',
      'economic_account_action_request', v_request.id
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'requestId', v_request.id, 'requestType', v_request.request_type,
    'status', v_request.status,
    'providerCancellationRequired', v_request.provider_cancellation_required,
    'closureReadiness', case when p_request_type = 'economic_account_closure'
      then private.economic_account_closure_obligations(v_actor) else null end,
    'financialRecordsRetained', true, 'authProfileUnchanged', true,
    'idempotentReplay', v_idempotent_replay
  );
end;
$$;

alter function public.request_economic_account_action(uuid, text, text, text)
  owner to postgres;

create or replace function public.operator_update_economic_account_action(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_status text,
  p_client_request_id uuid,
  p_artifact_sha256 text,
  p_artifact_expires_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.economic_account_action_requests%rowtype;
  v_obligations jsonb;
  v_restriction_id uuid;
begin
  perform private.require_economic_operator_capability(p_actor_user_id, 'economic_account_requests_manage');
  if p_client_request_id is null
     or p_status not in ('identity_verification', 'operator_review', 'processing', 'completed', 'rejected')
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000
     or (p_artifact_sha256 is not null and p_artifact_sha256 !~ '^[0-9a-f]{64}$') then
    raise exception using errcode = '22023', message = 'economic_account_request_update_invalid';
  end if;
  select * into v_request
  from private.economic_account_action_requests where id = p_request_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'economic_account_request_not_found';
  end if;
  if exists (
    select 1 from private.economic_audit_events
    where action = 'economic_account_action_updated'
      and metadata ->> 'client_request_id' = p_client_request_id::text
  ) then
    if v_request.status <> p_status
       or v_request.resolved_by is distinct from p_actor_user_id
       or v_request.private_resolution is distinct from pg_catalog.btrim(p_reason)
       or v_request.fulfillment_artifact_sha256 is distinct from
          (case when v_request.request_type = 'data_export' then p_artifact_sha256 else null end)
       or v_request.fulfillment_expires_at is distinct from
          (case when v_request.request_type = 'data_export' then p_artifact_expires_at else null end) then
      raise exception using errcode = '23505', message = 'economic_account_request_update_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'requestId', v_request.id, 'requestType', v_request.request_type,
      'status', v_request.status, 'financialRecordsRetained', true,
      'authProfileUnchanged', true, 'idempotentReplay', true
    );
  end if;
  if v_request.status in ('completed', 'rejected', 'canceled') then
    raise exception using errcode = '55000', message = 'economic_account_request_not_actionable';
  end if;
  if p_status = 'completed' and v_request.request_type = 'data_export'
     and (p_artifact_sha256 is null or p_artifact_expires_at is null or p_artifact_expires_at <= pg_catalog.now()) then
    raise exception using errcode = '22023', message = 'economic_export_artifact_required';
  end if;
  if p_status = 'completed' and v_request.request_type = 'economic_account_closure' then
    v_obligations := private.economic_account_closure_obligations(v_request.user_id);
    if not coalesce((v_obligations ->> 'canComplete')::boolean, false) then
      raise exception using errcode = '55000', message = 'economic_account_closure_obligations_open';
    end if;
  end if;
  update private.economic_account_action_requests
  set status = p_status, updated_at = pg_catalog.now(), resolved_by = p_actor_user_id,
      private_resolution = pg_catalog.btrim(p_reason),
      fulfillment_artifact_sha256 = case when request_type = 'data_export' then p_artifact_sha256 else null end,
      fulfillment_expires_at = case when request_type = 'data_export' then p_artifact_expires_at else null end,
      completed_at = case when p_status = 'completed' then pg_catalog.now() else null end
  where id = v_request.id returning * into v_request;
  if p_status = 'completed' and v_request.request_type = 'economic_account_closure' then
    select restriction.id into v_restriction_id
    from private.economic_service_restrictions as restriction
    where restriction.user_id = v_request.user_id and restriction.scope = 'billing'
      and restriction.lifted_at is null
      and (restriction.expires_at is null or restriction.expires_at > pg_catalog.now())
    order by restriction.imposed_at desc limit 1;
    if v_restriction_id is null then
      insert into private.economic_service_restrictions(
      user_id, scope, reason_code, private_reason, source_type, source_id, imposed_by
      ) values (
      v_request.user_id, 'billing', 'economic_account_closed',
      'User-requested economic-account closure completed; Commons account remains unchanged.',
      'economic_account_action_request', v_request.id, p_actor_user_id
      ) returning id into v_restriction_id;
    end if;
    insert into private.economic_service_restriction_actions(
      client_request_id, restriction_id, target_user_id, action, scope,
      reason_code, actor_user_id, private_reason
    ) values (
      p_client_request_id, v_restriction_id, v_request.user_id,
      'associate_closure', 'billing', 'economic_account_closed', p_actor_user_id,
      'Economic closure completion linked to acquisition restriction; identity and paid-value history retained.'
    );
  end if;
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator', 'economic_account_action_updated',
    'economic_account_action_request', v_request.id, pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'client_request_id', p_client_request_id,
      'status', p_status, 'request_type', v_request.request_type,
      'financial_records_retained', true, 'auth_profile_unchanged', true
      , 'closure_obligations', v_obligations
    )
  );
  perform private.try_enqueue_economic_notification(
    'economic-account-request:' || v_request.id::text || ':' || p_status,
    v_request.user_id, 'economic_account_request_updated',
    'economic_account_action_request', v_request.id
  );
  return pg_catalog.jsonb_build_object(
    'requestId', v_request.id, 'requestType', v_request.request_type,
    'status', v_request.status, 'financialRecordsRetained', true,
    'authProfileUnchanged', true, 'idempotentReplay', false
  );
end;
$$;

alter function public.operator_update_economic_account_action(
  uuid, uuid, text, uuid, text, timestamptz, text
) owner to postgres;

create or replace function public.operator_set_economic_service_restriction(
  p_actor_user_id uuid,
  p_client_request_id uuid,
  p_target_user_id uuid,
  p_restriction_id uuid,
  p_scope text,
  p_reason_code text,
  p_expires_at timestamptz,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restriction private.economic_service_restrictions%rowtype;
  v_action private.economic_service_restriction_actions%rowtype;
  v_action_name text := case when coalesce(p_enabled, false) then 'impose' else 'lift' end;
begin
  perform private.require_economic_operator_capability(
    p_actor_user_id, 'economic_reconciliation_manage'
  );
  if p_client_request_id is null
     or p_scope not in ('billing', 'recurring_support', 'sandbox', 'marketplace_buying', 'marketplace_selling', 'job_posting')
     or coalesce(p_reason_code, '') !~ '^[a-z][a-z0-9_]{2,100}$'
     or (coalesce(p_enabled, false) and p_restriction_id is not null)
     or (not coalesce(p_enabled, false) and p_restriction_id is null)
     or (p_expires_at is not null and p_expires_at <= pg_catalog.now())
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'economic_service_restriction_input_invalid';
  end if;
  select * into v_action
  from private.economic_service_restriction_actions
  where client_request_id = p_client_request_id;
  if found then
    if v_action.target_user_id <> p_target_user_id
       or v_action.action <> v_action_name
       or v_action.scope <> p_scope
       or v_action.reason_code <> p_reason_code
       or v_action.expires_at is distinct from p_expires_at
       or v_action.actor_user_id <> p_actor_user_id
       or v_action.private_reason <> pg_catalog.btrim(p_reason)
       or (p_restriction_id is not null and v_action.restriction_id <> p_restriction_id) then
      raise exception using errcode = '23505', message = 'economic_service_restriction_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'restrictionId', v_action.restriction_id,
      'userId', v_action.target_user_id, 'scope', v_action.scope,
      'active', v_action.action = 'impose',
      'commonsAccountAffected', false,
      'idempotentReplay', true
    );
  end if;
  if coalesce(p_enabled, false) then
    if not exists (select 1 from auth.users where id = p_target_user_id) then
      raise exception using errcode = 'P0002', message = 'economic_service_restriction_user_not_found';
    end if;
    insert into private.economic_service_restrictions(
      user_id, scope, reason_code, private_reason, source_type,
      imposed_by, expires_at
    ) values (
      p_target_user_id, p_scope, p_reason_code, pg_catalog.btrim(p_reason),
      'economic_operator_action', p_actor_user_id, p_expires_at
    ) returning * into v_restriction;
  else
    select * into v_restriction
    from private.economic_service_restrictions
    where id = p_restriction_id for update;
    if not found or v_restriction.user_id <> p_target_user_id
       or v_restriction.scope <> p_scope
       or v_restriction.reason_code <> p_reason_code
       or v_restriction.lifted_at is not null then
      raise exception using errcode = '55000', message = 'economic_service_restriction_not_active';
    end if;
    update private.economic_service_restrictions
    set lifted_by = p_actor_user_id, lifted_at = pg_catalog.now(),
        lift_reason = pg_catalog.btrim(p_reason)
    where id = v_restriction.id returning * into v_restriction;
  end if;
  insert into private.economic_service_restriction_actions(
    client_request_id, restriction_id, target_user_id, action,
    scope, reason_code, expires_at, actor_user_id, private_reason
  ) values (
    p_client_request_id, v_restriction.id, p_target_user_id,
    v_action_name, p_scope, p_reason_code, p_expires_at,
    p_actor_user_id, pg_catalog.btrim(p_reason)
  );
  insert into private.economic_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, reason, metadata
  ) values (
    p_actor_user_id, 'economic_operator',
    'economic_service_restriction_' || case when coalesce(p_enabled, false) then 'imposed' else 'lifted' end,
    'economic_service_restriction', v_restriction.id,
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'target_user_id', p_target_user_id, 'scope', p_scope,
      'reason_code', p_reason_code, 'commons_account_affected', false,
      'client_request_id', p_client_request_id
    )
  );
  return pg_catalog.jsonb_build_object(
    'restrictionId', v_restriction.id,
    'userId', v_restriction.user_id, 'scope', v_restriction.scope,
    'active', v_restriction.lifted_at is null,
    'commonsAccountAffected', false,
    'idempotentReplay', false
  );
end;
$$;

alter function public.operator_set_economic_service_restriction(
  uuid, uuid, uuid, uuid, text, text, timestamptz, boolean, text
) owner to postgres;

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
    'testMode', true,
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
      'receiptAvailable', false,
      'providerIdentifiersExposed', false
    ) order by recent_receipt.occurred_at desc, recent_receipt.id desc) from (
      select transaction.id, economic_order.public_reference, economic_order.flow,
        transaction.status, transaction.gross_amount_minor,
        transaction.currency, transaction.occurred_at
      from private.economic_payment_transactions as transaction
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

alter function public.current_user_economic_account_summary() owner to postgres;

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
          transaction.processor_fee_minor, transaction.net_amount_minor,
          transaction.currency, transaction.occurred_at
        from private.economic_payment_transactions as transaction
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
    'testMode', true
  );
end;
$$;

alter function public.current_user_economic_operator_overview() owner to postgres;

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
    'testMode', true
  );
end;
$$;

alter function public.current_user_economic_audit_events(timestamptz, uuid, integer)
  owner to postgres;

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
        transaction.processor_fee_minor,
        null::bigint as platform_commission_minor,
        null::bigint as seller_payable_minor,
        case when economic_order.flow = 'marketplace_purchase' then null::bigint
          else transaction.net_amount_minor end as net_minor,
        transaction.currency, economic_order.public_reference,
        transaction.provider,
        case
          when transaction.status = 'succeeded'
            and transaction.processor_fee_minor is not null
            and transaction.net_amount_minor is not null
            then 'recorded'
          when transaction.status = 'succeeded'
            then 'settlement_details_pending'
          else 'review'
        end as reconciliation_status
      from private.economic_payment_transactions as transaction
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
    'testMode', true, 'idempotentReplay', false
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

alter function public.export_economic_accounting_events(
  uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer
) owner to postgres;

do $economic_final_function_acl$
begin
  revoke all privileges on function public.deliver_economic_notification_outbox(integer)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.set_current_user_support_recognition(uuid, boolean, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.public_support_recognition()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.request_economic_account_action(uuid, text, text, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.current_user_economic_closure_readiness()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_update_economic_account_action(uuid, uuid, text, uuid, text, timestamptz, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.operator_set_economic_service_restriction(uuid, uuid, uuid, uuid, text, text, timestamptz, boolean, text)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.current_user_economic_account_summary()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.current_user_economic_operator_overview()
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.current_user_economic_audit_events(timestamptz, uuid, integer)
    from public, anon, authenticated, service_role;
  revoke all privileges on function public.export_economic_accounting_events(uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer)
    from public, anon, authenticated, service_role;
end
$economic_final_function_acl$;

grant execute on function public.deliver_economic_notification_outbox(integer) to service_role;
grant execute on function public.set_current_user_support_recognition(uuid, boolean, text) to authenticated;
grant execute on function public.public_support_recognition() to anon, authenticated;
grant execute on function public.request_economic_account_action(uuid, text, text, text) to authenticated;
grant execute on function public.current_user_economic_closure_readiness() to authenticated;
grant execute on function public.operator_update_economic_account_action(uuid, uuid, text, uuid, text, timestamptz, text) to service_role;
grant execute on function public.operator_set_economic_service_restriction(uuid, uuid, uuid, uuid, text, text, timestamptz, boolean, text) to service_role;
grant execute on function public.current_user_economic_account_summary() to authenticated;
grant execute on function public.current_user_economic_operator_overview() to authenticated;
grant execute on function public.current_user_economic_audit_events(timestamptz, uuid, integer) to authenticated;
grant execute on function public.export_economic_accounting_events(uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, integer) to service_role;

comment on table private.economic_account_action_requests is
  'Assisted economic export/closure workflow. It never deletes Auth/profile identity; financial records and paid-value history remain retained for lawful reconciliation.';
comment on function public.export_economic_accounting_events is
  'Service-only, capability-gated, 31-day/100-row bounded accounting projection with no provider identifiers or personal contact data.';
comment on function private.try_enqueue_economic_notification is
  'Best-effort convenience boundary: notification failure cannot roll back canonical economic state.';

commit;
