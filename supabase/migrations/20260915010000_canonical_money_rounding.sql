-- Exact nonnegative minor-unit arithmetic. No historical transaction rewrite.
-- All paid third-party provider execution remains disabled.
begin;
create function private.economic_round_ratio(p_numerator numeric, p_denominator numeric)
returns bigint language plpgsql immutable strict set search_path = '' as $$
begin
  if p_numerator < 0 or p_denominator <= 0 or p_numerator <> trunc(p_numerator)
     or p_denominator <> trunc(p_denominator) then
    raise exception using errcode='22023',message='economic_money_ratio_invalid';
  end if;
  return floor((2*p_numerator+p_denominator)/(2*p_denominator))::bigint;
end;
$$;
create function private.economic_fee_minor(p_gross bigint, p_bps integer)
returns bigint language plpgsql immutable strict set search_path = '' as $$
begin
  if p_gross < 0 or p_gross > 100000000000 or p_bps < 0 or p_bps > 10000 then
    raise exception using errcode='22023',message='economic_money_amount_invalid';
  end if;
  return private.economic_round_ratio(p_gross::numeric*p_bps,10000);
end;
$$;
alter function private.economic_round_ratio(numeric,numeric) owner to postgres;
alter function private.economic_fee_minor(bigint,integer) owner to postgres;
revoke all on function private.economic_round_ratio(numeric,numeric), private.economic_fee_minor(bigint,integer) from public,anon,authenticated,service_role;
create or replace function private.fulfill_paid_marketplace_license()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract private.marketplace_purchase_contracts%rowtype;
  v_license private.marketplace_licenses%rowtype;
  v_commission bigint;
begin
  if new.flow <> 'marketplace_purchase' or new.status <> 'paid' or old.status = 'paid' then
    return new;
  end if;
  select * into v_contract
  from private.marketplace_purchase_contracts as contract
  where contract.order_id = new.id
  for update;
  if not found then
    raise exception using errcode = '55000', message = 'marketplace_purchase_contract_missing';
  end if;
  -- Once a verified settlement has been quarantined, later paid projections
  -- (for example after a dispute is won) cannot silently revive fulfillment.
  -- Only the verified full-refund path resolves the durable hold.
  if exists (
    select 1
    from private.marketplace_fulfillment_holds as hold
    where hold.order_id = new.id
      and hold.purchase_contract_id = v_contract.id
      and hold.status = 'refund_required'
  ) then
    update private.marketplace_purchase_contracts
    set status = 'reconciliation_required', updated_at = pg_catalog.now()
    where id = v_contract.id;
    return new;
  end if;
  -- Payment truth is retained, but fulfillment is quarantined if safety,
  -- seller readiness, or publication changed while hosted Checkout was open.
  -- No license, entitlement, commission, payable, approval, or install power is
  -- created; private operators must refund/reconcile the verified payment.
  if not exists (
    select 1
    from private.marketplace_commercial_offers as offer
    join private.economic_seller_accounts as seller on seller.id = offer.seller_account_id
    join public.marketplace_listings as listing on listing.id = offer.listing_id
    join public.marketplace_addon_versions as version on version.id = offer.addon_version_id
    where offer.id = v_contract.offer_id
      and offer.status = 'active' and offer.offer_kind = 'paid'
      and seller.id = v_contract.seller_account_id
      and seller.status = 'ready'
      and seller.details_submitted and seller.charges_enabled and seller.payouts_enabled
      and seller.provider = 'stripe' and seller.provider_account_reference is not null
      and seller.provider_status_updated_at >= pg_catalog.now() - interval '24 hours'
      and private.marketplace_seller_is_eligible(seller.user_id)
      and not private.economic_service_is_restricted(seller.user_id, 'marketplace_selling')
      and listing.listing_status = 'published' and listing.revoked_at is null
      and version.review_status = 'approved' and version.published_at is not null
      and version.revoked_at is null
  ) then
    insert into private.marketplace_fulfillment_holds (
      order_id, purchase_contract_id, buyer_user_id, seller_account_id, offer_id
    ) values (
      new.id, v_contract.id, v_contract.buyer_user_id,
      v_contract.seller_account_id, v_contract.offer_id
    ) on conflict (order_id) do nothing;
    update private.marketplace_purchase_contracts
    set status = 'reconciliation_required', updated_at = pg_catalog.now()
    where id = v_contract.id;
    insert into private.economic_audit_events (
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'provider_webhook', 'marketplace_paid_fulfillment_quarantined',
      'economic_order', new.id,
      pg_catalog.jsonb_build_object(
        'reason_code', 'offer_unavailable_at_payment',
        'refund_required', true,
        'license_created', false,
        'seller_payable_created', false,
        'install_authorized', false
      )
    );
    return new;
  end if;
  select * into v_license
  from private.marketplace_licenses as license
  where license.buyer_user_id = v_contract.buyer_user_id
    and license.offer_id = v_contract.offer_id
  for update;
  if found then
    if v_license.order_id = new.id then
      return new;
    end if;
    insert into private.marketplace_license_conflicts (
      order_id, buyer_user_id, offer_id, existing_license_id,
      status
    ) values (
      new.id, v_contract.buyer_user_id, v_contract.offer_id, v_license.id,
      'refund_required'
    ) on conflict (order_id) do nothing;
    update private.marketplace_purchase_contracts
    set status = 'reconciliation_required', updated_at = pg_catalog.now()
    where id = v_contract.id;
    insert into private.economic_audit_events (
      actor_kind, action, target_type, target_id, metadata
    ) values (
      'provider_webhook', 'marketplace_duplicate_license_payment_quarantined',
      'economic_order', new.id,
      pg_catalog.jsonb_build_object(
        'existing_license_id', v_license.id,
        'refund_required', true,
        'install_authorized', false
      )
    );
    return new;
  end if;
  insert into private.marketplace_licenses (
    buyer_user_id, offer_id, order_id, listing_id, addon_version_id,
    license_key, license_version, acquisition_kind
  ) values (
    v_contract.buyer_user_id, v_contract.offer_id, new.id,
    v_contract.listing_id, v_contract.addon_version_id,
    v_contract.license_key_snapshot, v_contract.license_version_snapshot,
    'paid_order'
  ) returning * into v_license;
  update private.marketplace_purchase_contracts
  set status = 'active', updated_at = pg_catalog.now()
  where id = v_contract.id;
  insert into private.marketplace_order_financial_state(order_id, license_id)
  values (new.id, v_license.id)
  on conflict (order_id) do nothing;

  v_commission := private.economic_fee_minor(v_contract.gross_amount_minor, v_contract.commission_bps_snapshot);
  insert into private.marketplace_commission_events (
    order_id, license_id, seller_account_id, event_type,
    gross_delta_minor, commission_delta_minor, payable_delta_minor,
    currency, idempotency_key
  ) values (
    new.id, v_license.id, v_contract.seller_account_id, 'sale',
    v_contract.gross_amount_minor, v_commission,
    v_contract.gross_amount_minor - v_commission,
    v_contract.currency, 'marketplace-sale:' || new.id::text
  ) on conflict (idempotency_key) do nothing;
  update private.marketplace_order_financial_state
  set sale_recorded = true, updated_at = pg_catalog.now()
  where order_id = new.id;
  insert into private.economic_entitlements (
    user_id, entitlement_key, source_type, source_id, status, starts_at
  ) values (
    v_contract.buyer_user_id, 'marketplace_version_license',
    'economic_order', new.id, 'active', coalesce(new.paid_at, pg_catalog.now())
  ) on conflict do nothing;
  return new;
end;
$$;

create or replace function private.reconcile_marketplace_order_accounting(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract private.marketplace_purchase_contracts%rowtype;
  v_license private.marketplace_licenses%rowtype;
  v_state private.marketplace_order_financial_state%rowtype;
  v_original_commission bigint;
  v_refunded bigint;
  v_lost bigint;
  v_active_dispute bigint;
  v_refund_commission bigint;
  v_lost_commission bigint;
  v_base_payable bigint;
  v_hold bigint;
  v_delta_gross bigint;
  v_delta_commission bigint;
  v_delta_payable bigint;
begin
  select * into v_contract
  from private.marketplace_purchase_contracts as contract
  where contract.order_id = p_order_id
  for update;
  if not found then return; end if;
  if exists (
    select 1 from private.marketplace_fulfillment_holds as hold
    where hold.order_id = p_order_id and hold.status = 'refund_required'
  ) then
    select least(v_contract.gross_amount_minor, coalesce(pg_catalog.sum(refund.amount_minor), 0))
    into v_refunded from private.economic_refunds as refund
    where refund.order_id = p_order_id and refund.status = 'succeeded';
    if v_refunded >= v_contract.gross_amount_minor then
      update private.marketplace_fulfillment_holds
      set status = 'resolved', resolved_at = pg_catalog.now()
      where order_id = p_order_id and status = 'refund_required';
      update private.marketplace_purchase_contracts
      set status = 'refunded', updated_at = pg_catalog.now()
      where id = v_contract.id;
      insert into private.economic_audit_events (
        actor_kind, action, target_type, target_id, metadata
      ) values (
        'provider_webhook', 'marketplace_fulfillment_hold_refunded',
        'economic_order', p_order_id,
        pg_catalog.jsonb_build_object('license_created', false, 'seller_payable_created', false)
      );
    end if;
    return;
  end if;
  select * into v_license from private.marketplace_licenses where order_id = p_order_id for update;
  select * into v_state from private.marketplace_order_financial_state where order_id = p_order_id for update;
  if not found then return; end if;

  select least(v_contract.gross_amount_minor, coalesce(pg_catalog.sum(refund.amount_minor), 0))
  into v_refunded from private.economic_refunds as refund
  where refund.order_id = p_order_id and refund.status = 'succeeded';
  select least(v_contract.gross_amount_minor - v_refunded, coalesce(pg_catalog.sum(dispute.amount_minor), 0))
  into v_lost from private.economic_disputes as dispute
  where dispute.order_id = p_order_id and dispute.status = 'lost';
  select least(
    greatest(v_contract.gross_amount_minor - v_refunded - v_lost, 0),
    coalesce(pg_catalog.sum(dispute.amount_minor), 0)
  ) into v_active_dispute
  from private.economic_disputes as dispute
  where dispute.order_id = p_order_id
    and dispute.status in (
      'warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'
    );

  -- Preserve the fee actually recorded, including older synthetic floor records.
  select commission_delta_minor into strict v_original_commission
  from private.marketplace_commission_events
  where order_id=p_order_id and event_type='sale';
  v_refund_commission := private.economic_round_ratio(v_original_commission::numeric*v_refunded, v_contract.gross_amount_minor);
  v_lost_commission := private.economic_round_ratio(v_original_commission::numeric*(v_refunded+v_lost), v_contract.gross_amount_minor)-v_refund_commission;
  v_base_payable := v_contract.gross_amount_minor-v_original_commission
    -(v_refunded-v_refund_commission)-(v_lost-v_lost_commission);
  v_hold := least(v_base_payable, v_active_dispute - (
    private.economic_round_ratio(v_original_commission::numeric*(v_refunded+v_lost+v_active_dispute),v_contract.gross_amount_minor)
    -v_refund_commission-v_lost_commission));

  if v_refunded <> v_state.refunded_gross_minor
     or v_refund_commission <> v_state.refunded_commission_minor then
    v_delta_gross := -(v_refunded - v_state.refunded_gross_minor);
    v_delta_commission := -(v_refund_commission - v_state.refunded_commission_minor);
    v_delta_payable := v_delta_gross - v_delta_commission;
    insert into private.marketplace_commission_events (
      order_id, license_id, seller_account_id, event_type,
      gross_delta_minor, commission_delta_minor, payable_delta_minor,
      currency, idempotency_key
    ) values (
      p_order_id, v_license.id, v_contract.seller_account_id,
      case when v_delta_gross < 0 then 'refund' else 'refund_reversal' end,
      v_delta_gross, v_delta_commission, v_delta_payable, v_contract.currency,
      'marketplace-refund-state:' || p_order_id::text || ':' || v_refunded::text || ':' || pg_catalog.gen_random_uuid()::text
    ) on conflict (idempotency_key) do nothing;
  end if;
  if v_lost <> v_state.lost_dispute_gross_minor
     or v_lost_commission <> v_state.lost_dispute_commission_minor then
    v_delta_gross := -(v_lost - v_state.lost_dispute_gross_minor);
    v_delta_commission := -(v_lost_commission - v_state.lost_dispute_commission_minor);
    v_delta_payable := v_delta_gross - v_delta_commission;
    insert into private.marketplace_commission_events (
      order_id, license_id, seller_account_id, event_type,
      gross_delta_minor, commission_delta_minor, payable_delta_minor,
      currency, idempotency_key
    ) values (
      p_order_id, v_license.id, v_contract.seller_account_id,
      case when v_delta_gross < 0 then 'chargeback' else 'chargeback_reversal' end,
      v_delta_gross, v_delta_commission, v_delta_payable, v_contract.currency,
      'marketplace-chargeback-state:' || p_order_id::text || ':' || v_lost::text || ':' || pg_catalog.gen_random_uuid()::text
    ) on conflict (idempotency_key) do nothing;
  end if;
  if v_hold <> v_state.dispute_held_payable_minor then
    v_delta_payable := -(v_hold - v_state.dispute_held_payable_minor);
    insert into private.marketplace_commission_events (
      order_id, license_id, seller_account_id, event_type,
      gross_delta_minor, commission_delta_minor, payable_delta_minor,
      currency, idempotency_key
    ) values (
      p_order_id, v_license.id, v_contract.seller_account_id,
      case when v_delta_payable < 0 then 'dispute_hold' else 'dispute_release' end,
      0, 0, v_delta_payable, v_contract.currency,
      'marketplace-dispute-hold-state:' || p_order_id::text || ':' || v_hold::text || ':' || pg_catalog.gen_random_uuid()::text
    ) on conflict (idempotency_key) do nothing;
  end if;

  update private.marketplace_order_financial_state
  set refunded_gross_minor = v_refunded,
      refunded_commission_minor = v_refund_commission,
      lost_dispute_gross_minor = v_lost,
      lost_dispute_commission_minor = v_lost_commission,
      dispute_held_payable_minor = v_hold,
      updated_at = pg_catalog.now()
  where order_id = p_order_id;
  update private.marketplace_purchase_contracts
  set status = case
    when v_active_dispute > 0 or v_lost > 0 then 'disputed'
    when v_refunded >= gross_amount_minor then 'refunded'
    when v_refunded > 0 then 'partially_refunded'
    else 'active'
  end, updated_at = pg_catalog.now()
  where order_id = p_order_id;
  update private.marketplace_licenses
  set economic_status = case
    when v_active_dispute > 0 or v_lost > 0 then 'disputed'
    when v_refunded >= v_contract.gross_amount_minor then 'refunded'
    when v_refunded > 0 then 'partially_refunded'
    else 'active'
  end, updated_at = pg_catalog.now()
  where id = v_license.id;
end;
$$;

create or replace function private.preparation_settlement_snapshot(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c private.marketplace_purchase_contracts%rowtype; o private.economic_orders%rowtype; s private.economic_seller_accounts%rowtype;
  gross bigint; fee bigint; creator bigint; processor bigint; refunds bigint; disputes bigint; payment_count integer; incomplete_count integer;
  b jsonb:='[]'; settlement_state text:='review_required'; evidence jsonb; source_evidence jsonb; payable bigint;
begin
  select * into c from private.marketplace_purchase_contracts where order_id=p_order;
  select * into o from private.economic_orders where id=p_order;
  if c.id is null or o.flow is distinct from 'marketplace_purchase' then raise exception using errcode='P0002', message='preparation_marketplace_order_required'; end if;
  select * into s from private.economic_seller_accounts where id=c.seller_account_id;
  select count(*),count(*) filter(where processor_fee_minor is null or net_amount_minor is null or webhook_event_id is null),coalesce(sum(gross_amount_minor),0),sum(processor_fee_minor)
    into payment_count,incomplete_count,gross,processor from private.economic_payment_transactions where order_id=p_order and transaction_type='payment' and status='succeeded';
  select coalesce(sum(amount_minor),0) into refunds from private.economic_refunds where order_id=p_order and status='succeeded';
  select coalesce(sum(amount_minor),0) into disputes from private.economic_disputes where order_id=p_order and status not in ('won','prevented','warning_closed');
  -- floor is explicit; numeric-to-integer casts otherwise round a second time.
  select commission_delta_minor into fee from private.marketplace_commission_events where order_id=p_order and event_type='sale';
  if fee is null then fee:=private.economic_fee_minor(c.gross_amount_minor,c.commission_bps_snapshot); end if;
  creator:=c.gross_amount_minor-fee;
  select coalesce(sum(payable_delta_minor),0) into payable from private.marketplace_commission_events where order_id=p_order and seller_account_id=c.seller_account_id and currency=c.currency;
  if payment_count=0 then settlement_state:='awaiting_payment'; b:=b||'"verified_payment_required"'::jsonb;
  elsif payment_count<>1 or gross<>c.gross_amount_minor or o.currency<>c.currency or refunds>gross
    or exists(select 1 from private.economic_payment_transactions where order_id=p_order and currency<>c.currency)
    or exists(select 1 from private.marketplace_commission_events where order_id=p_order and (currency<>c.currency or seller_account_id<>c.seller_account_id)) then settlement_state:='reconciliation_required'; b:=b||'"payment_contract_mismatch"'::jsonb;
  end if;
  if incomplete_count>0 or payment_count=0 then processor:=null; b:=b||'"processor_evidence_incomplete"'::jsonb; end if;
  if not exists(select 1 from private.marketplace_order_financial_state f where f.order_id=p_order and f.sale_recorded) then b:=b||'"creator_ledger_not_reconciled"'::jsonb; if payment_count>0 then settlement_state:='reconciliation_required'; end if; end if;
  if (refunds>0 and not exists(select 1 from private.marketplace_order_financial_state f where f.order_id=p_order and f.refunded_gross_minor=refunds)) or exists(select 1 from private.economic_refunds where order_id=p_order and status='pending') then settlement_state:='refund_hold'; b:=b||'"refund_reconciliation_required"'::jsonb; end if;
  if disputes>0 then settlement_state:='dispute_hold'; b:=b||'"dispute_reconciliation_required"'::jsonb; end if;
  if s.status in ('restricted','closed') or not private.marketplace_seller_is_eligible(s.user_id) then b:=b||'"seller_restricted"'::jsonb; end if;
  if exists(select 1 from private.marketplace_payout_preparations p where p.seller_account_id=c.seller_account_id and p.currency=c.currency and p.status not in ('canceled','failed','reversed')) then b:=b||'"existing_payout_allocation_requires_reconciliation"'::jsonb; end if;
  if exists(select 1 from private.economic_owned_fee_waivers w where w.order_id=p_order and w.status='approved_preparation') then b:=b||'"owned_fee_waiver_requires_qualified_adapter"'::jsonb; end if;
  if payable<=0 then b:=b||'"no_positive_creator_payable"'::jsonb; end if;
  b:=b||'["fee_liability_and_tax_policy_pending","provider_account_evidence_not_qualified","provider_payout_execution_disabled"]'::jsonb;
  evidence:=jsonb_build_object('orderId',p_order,'sellerId',c.seller_account_id,'currency',c.currency,'grossMinor',c.gross_amount_minor,'platformFeeMinor',fee,'creatorShareMinor',creator,'processorFeeMinor',processor,'refundedMinor',refunds,'disputeExposureMinor',disputes,'creatorPayableMinor',payable,'status',settlement_state,'blockers',b);
  source_evidence:=jsonb_build_object(
    'payments',(select coalesce(jsonb_agg(jsonb_build_array(id,status,currency,gross_amount_minor,processor_fee_minor,net_amount_minor,webhook_event_id) order by id),'[]') from private.economic_payment_transactions where order_id=p_order),
    'refunds',(select coalesce(jsonb_agg(jsonb_build_array(id,status,amount_minor,updated_at) order by id),'[]') from private.economic_refunds where order_id=p_order),
    'disputes',(select coalesce(jsonb_agg(jsonb_build_array(id,status,amount_minor,updated_at) order by id),'[]') from private.economic_disputes where order_id=p_order),
    'ledger',(select coalesce(jsonb_agg(jsonb_build_array(id,gross_delta_minor,commission_delta_minor,payable_delta_minor) order by id),'[]') from private.marketplace_commission_events where order_id=p_order));
  return evidence||jsonb_build_object('evidenceSha256',encode(sha256(convert_to((evidence||source_evidence)::text,'UTF8')),'hex'));
end;
$$;

create or replace function public.command_economic_preparation(p_actor_user_id uuid, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<preparation_command>>
declare
  a text:=p_command->>'action'; request_id uuid; expected integer; target uuid; rev integer:=1; command_hash text; result jsonb;
  event private.economic_preparation_events%rowtype; seller private.economic_seller_accounts%rowtype;
  prep private.economic_seller_preparations%rowtype; offer private.economic_offer_preparations%rowtype;
  settlement private.economic_settlement_preparations%rowtype; waiver private.economic_owned_fee_waivers%rowtype;
  support_case private.economic_support_preparation_cases%rowtype; order_row private.economic_orders%rowtype;
  contract private.marketplace_purchase_contracts%rowtype; snapshot jsonb; state text; reason text:=p_command->>'reason';
  amount bigint; owned bigint; prior bigint; document_hash text; lane text; capability text;
begin
  perform private.require_economic_preparation_actor(p_actor_user_id);
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>16384 or a is null then raise exception using errcode='22023',message='preparation_input_invalid'; end if;
  if a in ('seller_save','seller_terms','seller_link','seller_submit','seller_withdraw','offer_save') then lane:='sellers';
  elsif a in ('seller_review','offer_review') then lane:='sellers'; capability:='marketplace_payout_manage';
  elsif a in ('settlement_refresh','settlement_review') then lane:='settlements'; capability:='marketplace_payout_manage';
  elsif a in ('waiver_approve','waiver_revoke') then lane:='waivers'; capability:='economic_assistance_manage';
  elsif a='support_request' then lane:='support';
  elsif a='support_review' then lane:='support'; capability:='economic_refunds_manage';
  elsif a='policy_propose' then capability:='economic_feature_flags_manage';
  else raise exception using errcode='22023',message='preparation_action_invalid'; end if;
  perform private.require_economic_preparation_actor(p_actor_user_id,lane);
  if capability is not null then perform private.require_economic_operator_capability(p_actor_user_id,capability); end if;
  if a in ('seller_save','seller_terms','seller_link','seller_submit','seller_withdraw','offer_save') and
    (not private.marketplace_seller_is_eligible(p_actor_user_id) or private.economic_service_is_restricted(p_actor_user_id,'marketplace_selling')) then raise exception using errcode='42501',message='preparation_seller_not_eligible'; end if;
  if reason is not null and (char_length(btrim(reason)) not between 8 and 500 or reason ~ '[[:cntrl:]]|[0-9]{9,}|(sk|rk)_(live|test)_|[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}') then raise exception using errcode='22023',message='preparation_reason_invalid'; end if;
  if a not in ('seller_save','seller_terms','seller_submit','offer_save') and reason is null then raise exception using errcode='22023',message='preparation_reason_required'; end if;
  request_id:=(p_command->>'requestId')::uuid;
  if request_id is null then raise exception using errcode='22023',message='preparation_request_required'; end if;
  command_hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('economic_preparation_request:'||request_id::text,0));
  select * into event from private.economic_preparation_events where economic_preparation_events.request_id=preparation_command.request_id;
  if found then
    if event.actor_user_id<>p_actor_user_id or event.request_sha256<>command_hash then raise exception using errcode='23505',message='preparation_idempotency_conflict'; end if;
    return event.result||jsonb_build_object('idempotentReplay',true);
  end if;
  if a not in ('policy_propose','waiver_approve','support_request') then
    expected:=private.preparation_minor(p_command->'expectedRevision')::integer;
    if expected>1000000 then raise exception using errcode='22023',message='preparation_revision_invalid'; end if;
  end if;
  if a in ('seller_save','seller_terms','seller_link','seller_submit','seller_withdraw','offer_save') then
    perform pg_advisory_xact_lock(hashtextextended('economic_preparation_seller:'||p_actor_user_id::text,0));
    select * into seller from private.economic_seller_accounts where user_id=p_actor_user_id for update;
    if seller.id is not null and seller.status in ('restricted','closed') then raise exception using errcode='42501',message='preparation_seller_restricted'; end if;
    if a='seller_save' and seller.id is null then
      insert into private.economic_seller_accounts(user_id,developer_profile_id) select p_actor_user_id,id from public.developer_profiles where user_id=p_actor_user_id returning * into seller;
    end if;
    if seller.id is null then raise exception using errcode='P0002',message='preparation_seller_required'; end if;
    select * into prep from private.economic_seller_preparations where seller_id=seller.id for update;
    if a<>'offer_save' and coalesce(prep.revision,0)<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    if a<>'seller_save' and prep.seller_id is null then raise exception using errcode='P0002',message='preparation_application_required'; end if;
    target:=seller.id; rev:=coalesce(prep.revision,0)+1;
  end if;

  case a
  when 'seller_save' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','displayName','supportUrl','intent']);
    if char_length(coalesce(p_command->>'displayName','')) not between 2 and 80 or p_command->>'displayName' ~ '[[:cntrl:]]|[0-9]{9,}'
      or char_length(coalesce(p_command->>'supportUrl',''))>300 or (p_command->>'supportUrl'<>'' and p_command->>'supportUrl' !~ '^https://[^/@?#[:space:]]+(/[^?#[:space:]]*)?$')
      or coalesce(p_command->>'intent','') not in ('free','commercial','both') or prep.status in ('submitted','suspended') then raise exception using errcode='22023',message='preparation_application_invalid'; end if;
    insert into private.economic_seller_preparations(seller_id,display_name,support_url,intent,revision) values(seller.id,p_command->>'displayName',p_command->>'supportUrl',p_command->>'intent',rev)
    on conflict(seller_id) do update set display_name=excluded.display_name,support_url=excluded.support_url,intent=excluded.intent,status='draft',revision=excluded.revision,updated_at=now();
  when 'seller_terms' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','documentVersion','accept']);
    if p_command->'accept' is distinct from 'true'::jsonb or p_command->>'documentVersion' is distinct from '2026-09-08-readiness' or prep.status in ('submitted','suspended') then raise exception using errcode='22023',message='preparation_terms_invalid'; end if;
    select content_sha256 into document_hash from private.economic_legal_document_versions where document_key='marketplace_seller_agreement' and document_version=p_command->>'documentVersion';
    if document_hash is null then raise exception using errcode='55000',message='preparation_terms_unavailable'; end if;
    insert into private.economic_consents(user_id,document_key,document_version,source_route,client_request_id,metadata)
      values(p_actor_user_id,'marketplace_seller_agreement',p_command->>'documentVersion','/marketplace/account',request_id,jsonb_build_object('preparation_only',true,'content_sha256',document_hash,'provider_onboarding_consent',false,'commercial_policy_adopted',false));
    update private.economic_seller_preparations set terms_version=p_command->>'documentVersion',terms_sha256=document_hash,status='draft',revision=rev,updated_at=now() where seller_id=seller.id;
  when 'seller_link' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','publisherId','reason']);
    if prep.status in ('submitted','suspended') then raise exception using errcode='55000',message='preparation_application_locked'; end if;
    perform public.link_economic_seller_publisher(p_actor_user_id,(p_command->>'publisherId')::uuid,request_id,reason);
    update private.economic_seller_preparations set publisher_id=(p_command->>'publisherId')::uuid,status='draft',revision=rev,updated_at=now() where seller_id=seller.id;
  when 'seller_submit' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision']);
    if prep.status not in ('draft','changes_requested','withdrawn','rejected') or prep.terms_version is distinct from '2026-09-08-readiness'
      or not exists(select 1 from public.publishers p where p.id=prep.publisher_id and p.owner_id=p_actor_user_id and p.verified) then raise exception using errcode='55000',message='preparation_application_blocked'; end if;
    update private.economic_seller_preparations set status='submitted',review_reason=null,revision=rev,updated_at=now() where seller_id=seller.id;
  when 'seller_withdraw' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','reason']);
    if prep.status in ('suspended','withdrawn') then raise exception using errcode='55000',message='preparation_transition_invalid'; end if;
    update private.economic_seller_preparations set status='withdrawn',revision=rev,updated_at=now() where seller_id=seller.id;
  when 'seller_review' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','sellerId','decision','reason']);
    target:=(p_command->>'sellerId')::uuid;
    select * into prep from private.economic_seller_preparations where seller_id=target for update;
    select * into seller from private.economic_seller_accounts where id=target;
    if prep.seller_id is null or seller.user_id=p_actor_user_id then raise exception using errcode='42501',message='preparation_independent_review_required'; end if;
    if prep.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    state:=p_command->>'decision';
    if state not in ('approved','changes_requested','rejected','suspended') or not ((prep.status='submitted' and state in ('approved','changes_requested','rejected')) or (prep.status='approved' and state='suspended') or (prep.status='suspended' and state='changes_requested')) then raise exception using errcode='55000',message='preparation_transition_invalid'; end if;
    if state='approved' and (not private.marketplace_seller_is_eligible(seller.user_id) or seller.status in ('restricted','closed') or prep.terms_version is distinct from '2026-09-08-readiness' or not exists(select 1 from public.publishers p where p.id=prep.publisher_id and p.owner_id=seller.user_id and p.verified)) then raise exception using errcode='55000',message='preparation_application_blocked'; end if;
    rev:=prep.revision+1;
    update private.economic_seller_preparations set status=state,review_reason=reason,revision=rev,updated_at=now() where seller_id=target;
  when 'offer_save' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','offerId','addonVersionId','kind','amountMinor','currency','licenseKey','licenseVersion','feeProposalId']);
    target:=(p_command->>'offerId')::uuid;
    select * into offer from private.economic_offer_preparations where id=target for update;
    if (offer.id is not null and offer.seller_id<>seller.id) or prep.status in ('suspended','withdrawn','rejected') then raise exception using errcode='42501',message='preparation_offer_owner_required'; end if;
    if coalesce(offer.revision,0)<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    if offer.status='retired' then raise exception using errcode='55000',message='preparation_offer_retired'; end if;
    if not exists(select 1 from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id join public.developer_profiles d on d.id=l.developer_profile_id where v.id=(p_command->>'addonVersionId')::uuid and d.user_id=p_actor_user_id and l.listing_status='published' and l.revoked_at is null and v.review_status='approved' and v.published_at is not null and v.revoked_at is null) then raise exception using errcode='42501',message='preparation_reviewed_version_required'; end if;
    amount:=private.preparation_minor(p_command->'amountMinor');
    if p_command->>'currency' is distinct from 'usd' or coalesce(p_command->>'kind','') not in ('free','commercial') or char_length(coalesce(p_command->>'licenseKey','')) not between 2 and 100 or char_length(coalesce(p_command->>'licenseVersion','')) not between 1 and 120 then raise exception using errcode='22023',message='preparation_offer_invalid'; end if;
    if (p_command->>'kind'='free' and (amount<>0 or p_command->'feeProposalId'<>'null'::jsonb)) or (p_command->>'kind'='commercial' and (amount=0 or not exists(select 1 from private.economic_preparation_proposals where id=(p_command->>'feeProposalId')::uuid and kind='marketplace_fee_bps' and value=500 and not adopted))) then raise exception using errcode='22023',message='preparation_fee_proposal_required'; end if;
    rev:=coalesce(offer.revision,0)+1;
    insert into private.economic_offer_preparations(id,seller_id,addon_version_id,kind,amount_minor,currency,license_key,license_version,fee_proposal_id,revision)
    values(target,seller.id,(p_command->>'addonVersionId')::uuid,p_command->>'kind',amount,'usd',p_command->>'licenseKey',p_command->>'licenseVersion',(p_command->>'feeProposalId')::uuid,rev)
    on conflict(id) do update set addon_version_id=excluded.addon_version_id,kind=excluded.kind,amount_minor=excluded.amount_minor,license_key=excluded.license_key,license_version=excluded.license_version,fee_proposal_id=excluded.fee_proposal_id,status='draft',revision=excluded.revision,updated_at=now();
  when 'offer_review' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','offerId','decision','reason']);
    target:=(p_command->>'offerId')::uuid;
    select * into offer from private.economic_offer_preparations where id=target for update;
    if offer.id is null then raise exception using errcode='P0002',message='preparation_offer_required'; end if;
    if offer.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    state:=p_command->>'decision';
    if offer.status='retired' or coalesce(state,'') not in ('prepared','changes_requested','retired') or (state='prepared' and not exists(select 1 from private.economic_seller_preparations where seller_id=offer.seller_id and status='approved')) then raise exception using errcode='55000',message='preparation_offer_blocked'; end if;
    if exists(select 1 from private.economic_seller_accounts where id=offer.seller_id and user_id=p_actor_user_id) then raise exception using errcode='42501',message='preparation_independent_review_required'; end if;
    if state='prepared' and (exists(select 1 from jsonb_array_elements_text(private.preparation_seller_blockers(offer.seller_id)) b where b not in ('commercial_policy_pending','provider_onboarding_disabled','payouts_disabled')) or not exists(select 1 from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id join public.developer_profiles d on d.id=l.developer_profile_id join private.economic_seller_accounts a on a.user_id=d.user_id where a.id=offer.seller_id and v.id=offer.addon_version_id and l.listing_status='published' and l.revoked_at is null and v.review_status='approved' and v.published_at is not null and v.revoked_at is null)) then raise exception using errcode='55000',message='preparation_reviewed_version_required'; end if;
    rev:=offer.revision+1; update private.economic_offer_preparations set status=state,revision=rev,updated_at=now() where id=target;
  when 'policy_propose' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','kind','value','reason']);
    amount:=private.preparation_minor(p_command->'value');
    insert into private.economic_preparation_proposals(kind,value,actor_user_id,reason) values(p_command->>'kind',amount::integer,p_actor_user_id,reason) returning id into target;
  when 'settlement_refresh' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','orderId','reason']);
    target:=(p_command->>'orderId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('economic_preparation_settlement:'||target::text,0));
    select * into settlement from private.economic_settlement_preparations where order_id=target for update;
    if coalesce(settlement.revision,0)<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    snapshot:=private.preparation_settlement_snapshot(target);rev:=coalesce(settlement.revision,0)+1;
    insert into private.economic_settlement_preparations(order_id,status,revision,evidence_sha256,snapshot) values(target,snapshot->>'status',rev,snapshot->>'evidenceSha256',snapshot)
      on conflict(order_id) do update set status=excluded.status,revision=excluded.revision,evidence_sha256=excluded.evidence_sha256,snapshot=excluded.snapshot,updated_at=now();
  when 'settlement_review' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','orderId','decision','evidenceSha256','reason']);
    target:=(p_command->>'orderId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('economic_preparation_settlement:'||target::text,0));
    select * into settlement from private.economic_settlement_preparations where order_id=target for update;
    if settlement.order_id is null then raise exception using errcode='P0002',message='preparation_settlement_required'; end if;
    if settlement.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    snapshot:=private.preparation_settlement_snapshot(target);
    if p_command->>'evidenceSha256' is distinct from snapshot->>'evidenceSha256' or settlement.evidence_sha256<>snapshot->>'evidenceSha256' then raise exception using errcode='40001',message='preparation_stale_evidence'; end if;
    state:=case p_command->>'decision' when 'hold' then 'held' when 'prepare_handoff' then 'handoff_prepared' when 'cancel' then 'canceled' else null end;
    if state is null or settlement.status='canceled' or (state='handoff_prepared' and (settlement.status not in ('review_required','held') or snapshot->>'status'<>'review_required' or jsonb_array_length(snapshot->'blockers')<>3)) then raise exception using errcode='55000',message='preparation_settlement_blocked'; end if;
    rev:=settlement.revision+1; update private.economic_settlement_preparations set status=state,revision=rev,updated_at=now() where order_id=target;
  when 'waiver_approve' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','orderId','component','amountMinor','reason','confirmation']);
    if p_command->>'confirmation' is distinct from 'WAIVE ECOSYNEVA OWNED AMOUNT ONLY' then raise exception using errcode='22023',message='preparation_waiver_confirmation_required'; end if;
    select * into order_row from private.economic_orders where id=(p_command->>'orderId')::uuid for update;
    if order_row.id is null or order_row.status<>'pending' or order_row.provider_session_reference is not null then raise exception using errcode='55000',message='preparation_uncommitted_charge_required'; end if;
    if p_command->>'component'='ecosyneva_platform_fee' and order_row.flow='marketplace_purchase' then
      select * into contract from private.marketplace_purchase_contracts where order_id=order_row.id;
      if contract.id is null then raise exception using errcode='55000',message='preparation_charge_ownership_unverified'; end if;
      owned:=private.economic_fee_minor(contract.gross_amount_minor,contract.commission_bps_snapshot);
    elsif p_command->>'component'='ecosyneva_job_fee' and order_row.flow='job_post_fee' then owned:=order_row.total_minor;
    elsif p_command->>'component'='ecosyneva_service_fee' and order_row.flow='organization_service' then owned:=order_row.total_minor;
    else raise exception using errcode='42501',message='preparation_third_party_waiver_forbidden'; end if;
    amount:=private.preparation_minor(p_command->'amountMinor');
    select coalesce(sum(amount_minor),0) into prior from private.economic_owned_fee_waivers where order_id=order_row.id and status='approved_preparation';
    if amount<=0 or owned<=0 or amount+prior>owned then raise exception using errcode='22023',message='preparation_waiver_exceeds_owned_amount'; end if;
    insert into private.economic_owned_fee_waivers(order_id,component,amount_minor,original_owned_minor,currency,actor_user_id,reason) values(order_row.id,p_command->>'component',amount,owned,order_row.currency,p_actor_user_id,reason) returning id into target;
  when 'waiver_revoke' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','waiverId','reason']);target:=(p_command->>'waiverId')::uuid;
    select * into waiver from private.economic_owned_fee_waivers where id=target for update;
    if waiver.id is null then raise exception using errcode='P0002',message='preparation_waiver_required'; end if;
    if waiver.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    if waiver.status<>'approved_preparation' then raise exception using errcode='55000',message='preparation_transition_invalid'; end if;
    rev:=waiver.revision+1;update private.economic_owned_fee_waivers set status='revoked',revision=rev where id=target;
  when 'support_request' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','kind','targetId','amountMinor','reason']);
    target:=(p_command->>'targetId')::uuid;
    if p_command->>'kind'='support_cancellation' then
      if not exists(select 1 from private.economic_subscriptions s join private.economic_orders o on o.id=s.originating_order_id where s.id=target and s.user_id=p_actor_user_id and o.flow='support_recurring' and s.status not in ('canceled','ended')) then raise exception using errcode='42501',message='preparation_owned_support_subscription_required'; end if;
    elsif p_command->>'kind' in ('support_refund','acknowledgment_delivery') then
      select * into order_row from private.economic_orders where id=target;
      if order_row.user_id is distinct from p_actor_user_id or order_row.flow not in ('support_one_time','support_recurring') or not exists(select 1 from private.economic_payment_transactions where order_id=target and transaction_type='payment' and status='succeeded') then raise exception using errcode='42501',message='preparation_owned_support_payment_required'; end if;
      if p_command->>'kind'='support_refund' then
        amount:=private.preparation_minor(p_command->'amountMinor');
        select coalesce(sum(amount_minor),0) into prior from private.economic_refunds where order_id=target and status in ('pending','succeeded');
        if amount<=0 or amount>order_row.total_minor-prior then raise exception using errcode='22023',message='preparation_refund_amount_invalid'; end if;
      end if;
    else raise exception using errcode='22023',message='preparation_support_kind_invalid'; end if;
    if p_command->>'kind'<>'support_refund' and p_command->'amountMinor'<>'null'::jsonb then raise exception using errcode='22023',message='preparation_amount_not_applicable'; end if;
    insert into private.economic_support_preparation_cases(user_id,kind,target_id,amount_minor,reason) values(p_actor_user_id,p_command->>'kind',target,amount,reason) returning id into target;
  when 'support_review' then
    perform private.preparation_exact_keys(p_command,array['action','requestId','expectedRevision','caseId','decision','reason']);target:=(p_command->>'caseId')::uuid;
    select * into support_case from private.economic_support_preparation_cases where id=target for update;
    if support_case.id is null then raise exception using errcode='P0002',message='preparation_support_case_required'; end if;
    if support_case.revision<>expected then raise exception using errcode='40001',message='preparation_revision_conflict'; end if;
    state:=p_command->>'decision';
    if state not in ('reviewing','awaiting_provider','declined') or support_case.status='declined' or (support_case.status='requested' and state='awaiting_provider') or state=support_case.status then raise exception using errcode='55000',message='preparation_transition_invalid'; end if;
    rev:=support_case.revision+1;update private.economic_support_preparation_cases set status=state,revision=rev where id=target;
  else raise exception using errcode='22023',message='preparation_action_invalid';
  end case;
  result:=jsonb_build_object('mode','pre_provider','providerActionsAvailable',false,'requestId',request_id,'targetId',target,'revision',rev,'idempotentReplay',false);
  insert into private.economic_preparation_events(request_id,actor_user_id,action,target_id,request_sha256,reason,result) values(request_id,p_actor_user_id,a,target,command_hash,reason,result);
  insert into private.economic_audit_events(actor_user_id,actor_kind,action,target_type,target_id,reason,metadata) values(p_actor_user_id,case when capability is null then 'user' else 'economic_operator' end,'preparation_'||a,'economic_preparation',target,reason,jsonb_build_object('provider_action_performed',false,'revision',rev));
  return result;
end;
$$;
commit;
