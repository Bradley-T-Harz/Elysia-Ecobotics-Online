-- Signal Console notifications are convenience summaries, never payment truth.
-- Reserved economic notification types cannot be fabricated through the broad
-- authenticated self-insert policies retained for ordinary community signals.

begin;

create table private.economic_notification_deliveries (
  delivery_key text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  notification_id uuid not null unique references public.user_notifications(id) on delete restrict,
  notification_type text not null,
  created_at timestamptz not null default now(),
  constraint economic_notification_delivery_key_check
    check (pg_catalog.char_length(delivery_key) between 8 and 255)
);

alter table private.economic_notification_deliveries owner to postgres;
alter table private.economic_notification_deliveries enable row level security;
revoke all privileges on table private.economic_notification_deliveries
  from public, anon, authenticated, service_role;

create or replace function private.notification_type_is_economic(p_notification_type text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select lower(coalesce(p_notification_type, '')) ~
    '^(economic_|billing_|payment_|support_payment_|support_recognition_|subscription_|refund_|dispute_|payout_|sandbox_credit_|job_fee_|marketplace_purchase_|organization_|sponsorship_|waiver_|subsidy_|assistance_)';
$$;

alter function private.notification_type_is_economic(text) owner to postgres;
revoke all privileges on function private.notification_type_is_economic(text)
  from public, anon, authenticated, service_role;

create or replace function private.prevent_untrusted_economic_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.notification_type_is_economic(new.notification_type)
     and not (
       coalesce(auth.role(), '') = 'service_role'
       or coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') = 'service_role'
     ) then
    raise exception using errcode = '42501', message = 'economic_notification_service_role_required';
  end if;
  return new;
end;
$$;

alter function private.prevent_untrusted_economic_notification() owner to postgres;
revoke all privileges on function private.prevent_untrusted_economic_notification()
  from public, anon, authenticated, service_role;

create trigger prevent_untrusted_economic_notification
before insert or update of notification_type on public.user_notifications
for each row execute function private.prevent_untrusted_economic_notification();

drop policy if exists "users create own notifications" on public.user_notifications;
drop policy if exists "users manage own notifications" on public.user_notifications;
drop policy if exists "commune trigger creates own notifications" on public.user_notifications;

create policy "users create own non-economic notifications"
  on public.user_notifications for insert to authenticated
  with check (
    user_id = auth.uid()
    and lower(coalesce(notification_type, '')) !~
      '^(economic_|billing_|payment_|support_payment_|support_recognition_|subscription_|refund_|dispute_|payout_|sandbox_credit_|job_fee_|marketplace_purchase_|organization_|sponsorship_|waiver_|subsidy_|assistance_)'
  );
create policy "users delete own notifications"
  on public.user_notifications for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.create_economic_notification(
  p_user_id uuid,
  p_notification_type text,
  p_source_type text,
  p_source_id uuid,
  p_delivery_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
  v_title text;
  v_body text;
begin
  if not (
    coalesce(auth.role(), '') = 'service_role'
    or coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') = 'service_role'
  ) then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '23503', message = 'economic_notification_user_not_found';
  end if;
  if p_notification_type not in (
    'economic_support_updated', 'subscription_state_updated',
    'refund_state_updated', 'dispute_state_updated', 'sandbox_credit_balance_updated',
    'job_fee_state_updated', 'marketplace_purchase_state_updated',
    'payout_state_updated', 'organization_service_state_updated',
    'sponsorship_state_updated', 'assistance_state_updated',
    'support_recognition_state_updated', 'economic_account_request_updated'
  ) then
    raise exception using errcode = '22023', message = 'economic_notification_type_invalid';
  end if;
  if pg_catalog.char_length(coalesce(p_delivery_key, '')) not between 8 and 255 then
    raise exception using errcode = '22023', message = 'economic_notification_delivery_key_invalid';
  end if;

  select delivery.notification_id into v_notification_id
  from private.economic_notification_deliveries as delivery
  where delivery.delivery_key = p_delivery_key;
  if found then
    return pg_catalog.jsonb_build_object(
      'notificationId', v_notification_id,
      'idempotentReplay', true,
      'canonicalFinancialTruth', false
    );
  end if;

  v_title := case p_notification_type
    when 'economic_support_updated' then 'Support history updated'
    when 'subscription_state_updated' then 'Recurring support updated'
    when 'refund_state_updated' then 'Refund status updated'
    when 'dispute_state_updated' then 'Dispute status updated'
    when 'sandbox_credit_balance_updated' then 'Sandbox credit balance updated'
    when 'job_fee_state_updated' then 'Job Post billing status updated'
    when 'marketplace_purchase_state_updated' then 'Marketplace purchase status updated'
    when 'payout_state_updated' then 'Seller transfer status updated'
    when 'organization_service_state_updated' then 'Organization service status updated'
    when 'sponsorship_state_updated' then 'Sponsorship status updated'
    when 'assistance_state_updated' then 'Access assistance status updated'
    when 'support_recognition_state_updated' then 'Support recognition preference updated'
    else 'Economic account request updated'
  end;
  v_body := 'Open Support & Billing for the current private status. This notification is not a receipt or payment record.';

  insert into public.user_notifications (
    user_id, notification_type, title, body,
    source_type, source_id, action_url, metadata
  ) values (
    p_user_id, p_notification_type, v_title, v_body,
    nullif(p_source_type, ''), p_source_id,
    '/commons-circle/support-billing',
    pg_catalog.jsonb_build_object(
      'summary_only', true,
      'canonical_financial_truth', false
    )
  ) returning id into v_notification_id;

  insert into private.economic_notification_deliveries (
    delivery_key, user_id, notification_id, notification_type
  ) values (
    p_delivery_key, p_user_id, v_notification_id, p_notification_type
  );

  return pg_catalog.jsonb_build_object(
    'notificationId', v_notification_id,
    'idempotentReplay', false,
    'canonicalFinancialTruth', false
  );
end;
$$;

alter function public.create_economic_notification(uuid, text, text, uuid, text)
  owner to postgres;
revoke all privileges on function public.create_economic_notification(uuid, text, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_economic_notification(uuid, text, text, uuid, text)
  to service_role;

comment on function public.create_economic_notification is
  'Service-only idempotent safe summary. It never accepts arbitrary financial copy, amounts, provider IDs, balances, waiver reasons, or payout details.';

commit;
