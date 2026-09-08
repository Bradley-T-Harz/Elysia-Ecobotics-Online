-- Forward-only preparation. Historical payments, credits and consent are retained.
begin;
-- Retain the historical trigger and implementation, disabled prospectively.
-- Payment must not mint a personal Support-funded execution entitlement.
alter table private.economic_payment_transactions disable trigger economic_payments_grant_recurring_sandbox_program;

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
      'recordVersion', 'payment-record-v1',
      'payee', case when recent_receipt.flow = 'marketplace_purchase' then null else 'EcoSyneva Commons LLC' end,
      'orderStatus', recent_receipt.order_status,
      'refundedAmountMinor', recent_receipt.refunded_amount_minor,
      'receiptAvailable', false,
      'providerIdentifiersExposed', false
    ) order by recent_receipt.occurred_at desc, recent_receipt.id desc) from (
      select transaction.id, economic_order.public_reference, economic_order.flow,
        transaction.status, transaction.gross_amount_minor,
        transaction.currency, transaction.occurred_at, economic_order.status as order_status,
        (select coalesce(sum(refund.amount_minor), 0) from private.economic_refunds refund
          where refund.payment_transaction_id = transaction.id and refund.order_id = economic_order.id
            and refund.currency = transaction.currency and refund.status = 'succeeded') as refunded_amount_minor
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
revoke all on function public.current_user_economic_account_summary() from public, anon, authenticated, service_role;
grant execute on function public.current_user_economic_account_summary() to authenticated;
commit;
