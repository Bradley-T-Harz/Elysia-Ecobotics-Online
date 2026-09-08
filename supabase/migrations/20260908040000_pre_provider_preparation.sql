-- Internal preparation only. No provider actions, active legal pointers, payment
-- truth, community roles, credits or public listing state are changed here.
begin;

create table private.economic_preparation_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  sellers_enabled boolean not null default false,
  settlements_enabled boolean not null default false,
  waivers_enabled boolean not null default false,
  support_enabled boolean not null default false,
  mode text not null default 'pre_provider' check (mode = 'pre_provider'),
  provider_execution_enabled boolean not null default false check (not provider_execution_enabled)
);
insert into private.economic_preparation_settings(singleton) values (true);

create table private.economic_preparation_proposals (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('marketplace_fee_bps', 'proof_retention_days')),
  value integer not null,
  adopted boolean not null default false check (not adopted),
  actor_user_id uuid references auth.users(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  check ((kind = 'marketplace_fee_bps' and value between 0 and 5000)
    or (kind = 'proof_retention_days' and value between 1 and 365))
);
insert into private.economic_preparation_proposals(id, kind, value, reason) values
  ('e9090800-0000-4000-8000-000000000005', 'marketplace_fee_bps', 500, 'Owner decision pending; illustrative 5 percent proposal only.'),
  ('e9090800-0000-4000-8000-000000000030', 'proof_retention_days', 30, 'Owner decision pending; no retention scheduler or deletion authority.');

create table private.economic_seller_preparations (
  seller_id uuid primary key references private.economic_seller_accounts(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 2 and 80),
  support_url text not null default '' check (char_length(support_url) <= 300),
  intent text not null check (intent in ('free', 'commercial', 'both')),
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved','rejected','suspended','withdrawn')),
  revision integer not null default 1 check (revision > 0),
  terms_version text,
  terms_sha256 text check (terms_sha256 is null or terms_sha256 ~ '^[a-f0-9]{64}$'),
  publisher_id uuid references public.publishers(id) on delete restrict,
  review_reason text,
  updated_at timestamptz not null default now()
);
create table private.economic_offer_preparations (
  id uuid primary key,
  seller_id uuid not null references private.economic_seller_preparations(seller_id) on delete restrict,
  addon_version_id uuid not null references public.marketplace_addon_versions(id) on delete restrict,
  kind text not null check (kind in ('free','commercial')),
  amount_minor bigint not null check (amount_minor between 0 and 100000000000),
  currency text not null check (currency = 'usd'),
  license_key text not null check (char_length(license_key) between 2 and 100),
  license_version text not null check (char_length(license_version) between 1 and 120),
  fee_proposal_id uuid references private.economic_preparation_proposals(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','prepared','changes_requested','retired')),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  unique (seller_id, addon_version_id),
  check ((kind = 'free' and amount_minor = 0 and fee_proposal_id is null)
    or (kind = 'commercial' and amount_minor > 0 and fee_proposal_id is not null))
);
create table private.economic_settlement_preparations (
  order_id uuid primary key references private.marketplace_purchase_contracts(order_id) on delete restrict,
  status text not null check (status in ('awaiting_payment','reconciliation_required','refund_hold','dispute_hold','review_required','held','handoff_prepared','canceled')),
  revision integer not null default 1 check (revision > 0),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  provider_payout_status text not null default 'not_verified' check (provider_payout_status = 'not_verified'),
  updated_at timestamptz not null default now()
);
create table private.economic_owned_fee_waivers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.economic_orders(id) on delete restrict,
  component text not null check (component in ('ecosyneva_platform_fee','ecosyneva_job_fee','ecosyneva_service_fee')),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 100000000000),
  original_owned_minor bigint not null check (original_owned_minor > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 8 and 500),
  status text not null default 'approved_preparation' check (status in ('approved_preparation','revoked')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  check (amount_minor <= original_owned_minor)
);
create table private.economic_support_preparation_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('support_cancellation','support_refund','acknowledgment_delivery')),
  target_id uuid not null,
  amount_minor bigint check (amount_minor > 0 and amount_minor <= 100000000000),
  status text not null default 'requested' check (status in ('requested','reviewing','awaiting_provider','declined')),
  revision integer not null default 1 check (revision > 0),
  reason text not null check (char_length(reason) between 8 and 500),
  created_at timestamptz not null default now(),
  check ((kind = 'support_refund') = (amount_minor is not null))
);
create unique index economic_support_preparation_open_case on private.economic_support_preparation_cases(user_id,kind,target_id) where status <> 'declined';
create table private.economic_preparation_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  reason text,
  result jsonb not null,
  created_at timestamptz not null default now()
);

do $hardening$
declare t text;
begin
  foreach t in array array['economic_preparation_settings','economic_preparation_proposals','economic_seller_preparations','economic_offer_preparations','economic_settlement_preparations','economic_owned_fee_waivers','economic_support_preparation_cases','economic_preparation_events'] loop
    execute format('alter table private.%I owner to postgres',t);
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on table private.%I from public, anon, authenticated, service_role',t);
  end loop;
end;
$hardening$;
create trigger preparation_events_append_only before update or delete on private.economic_preparation_events for each row execute function private.prevent_economic_history_mutation();
create trigger preparation_proposals_append_only before update or delete on private.economic_preparation_proposals for each row execute function private.prevent_economic_history_mutation();

create function private.require_economic_preparation_actor(p_actor uuid, p_lane text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s private.economic_preparation_settings%rowtype;
begin
  if not private.economic_caller_is_service_role() then raise exception using errcode='42501', message='preparation_service_role_required'; end if;
  if not exists(select 1 from auth.users u where u.id=p_actor and u.deleted_at is null and u.is_anonymous is false and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until <= now())) then
    raise exception using errcode='42501', message='preparation_account_required';
  end if;
  select * into s from private.economic_preparation_settings where singleton;
  if s.enabled is distinct from true or s.mode is distinct from 'pre_provider' or s.provider_execution_enabled is distinct from false
    or (p_lane='sellers' and not s.sellers_enabled) or (p_lane='settlements' and not s.settlements_enabled)
    or (p_lane='waivers' and not s.waivers_enabled) or (p_lane='support' and not s.support_enabled)
    or (p_lane is not null and p_lane not in ('sellers','settlements','waivers','support')) then
    raise exception using errcode='55000', message='preparation_disabled';
  end if;
end;
$$;
create function private.preparation_exact_keys(p jsonb, keys text[])
returns void language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(p) is distinct from 'object' or (select array_agg(k order by k) from jsonb_object_keys(p) k) is distinct from (select array_agg(k order by k) from unnest(keys) k) then
    raise exception using errcode='22023', message='preparation_input_invalid';
  end if;
end;
$$;
create function private.preparation_minor(p jsonb)
returns bigint language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p) is distinct from 'number' or p::text !~ '^[0-9]{1,12}$' or p::text::numeric > 100000000000 then
    raise exception using errcode='22023', message='preparation_amount_invalid';
  end if;
  return p::text::bigint;
end;
$$;
create function private.preparation_seller_blockers(p_seller uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s private.economic_seller_preparations%rowtype; a private.economic_seller_accounts%rowtype; b jsonb := '[]';
begin
  select * into s from private.economic_seller_preparations where seller_id=p_seller;
  select * into a from private.economic_seller_accounts where id=p_seller;
  if not private.marketplace_seller_is_eligible(a.user_id) or a.status in ('restricted','closed') or private.economic_service_is_restricted(a.user_id,'marketplace_selling') then b:=b||'"creator_identity_not_eligible"'::jsonb; end if;
  if s.terms_version is distinct from '2026-09-08-readiness' then b:=b||'"terms_acknowledgment_required"'::jsonb; end if;
  if s.publisher_id is null or not exists(select 1 from public.publishers p join private.economic_seller_publisher_links l on l.publisher_id=p.id and l.seller_account_id=p_seller and l.unlinked_at is null where p.id=s.publisher_id and p.owner_id=a.user_id and p.verified) then b:=b||'"verified_publisher_link_required"'::jsonb; end if;
  if s.status is distinct from 'approved' then b:=b||'"internal_review_required"'::jsonb; end if;
  if s.intent in ('commercial','both') then b:=b||'["commercial_policy_pending","provider_onboarding_disabled","payouts_disabled"]'::jsonb; end if;
  return b;
end;
$$;
create function private.preparation_settlement_snapshot(p_order uuid)
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
  fee:=floor((c.gross_amount_minor::numeric*c.commission_bps_snapshot+5000)/10000)::bigint;
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

-- A prepared waiver must never be silently ignored by an old checkout adapter.
-- This guard does not apply a refund, edit an order price, or transfer a fee.
create function private.guard_prepared_waiver_provider_attachment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.provider_session_reference is not null and new.provider_session_reference is distinct from old.provider_session_reference
    and exists(select 1 from private.economic_owned_fee_waivers w where w.order_id=new.id and w.status='approved_preparation') then
    raise exception using errcode='55000', message='owned_fee_waiver_adapter_unqualified';
  end if;
  return new;
end;
$$;
create trigger prepared_waiver_blocks_unqualified_checkout before update of provider_session_reference on private.economic_orders for each row execute function private.guard_prepared_waiver_provider_attachment();

-- Workflow functions and narrowly projected reads follow below.
create function public.command_economic_preparation(p_actor_user_id uuid, p_command jsonb)
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
    if (p_command->>'kind'='free' and (amount<>0 or p_command->'feeProposalId'<>'null'::jsonb)) or (p_command->>'kind'='commercial' and (amount=0 or not exists(select 1 from private.economic_preparation_proposals where id=(p_command->>'feeProposalId')::uuid and kind='marketplace_fee_bps' and not adopted))) then raise exception using errcode='22023',message='preparation_fee_proposal_required'; end if;
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
      owned:=floor((contract.gross_amount_minor::numeric*contract.commission_bps_snapshot+5000)/10000)::bigint;
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
create function public.get_economic_preparation(p_actor_user_id uuid, p_audience text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  settings_record private.economic_preparation_settings%rowtype; caps jsonb; result jsonb; collection jsonb; key text;
  can_sellers boolean; can_settlement boolean; can_waivers boolean; can_support boolean; can_records boolean; can_audit boolean;
begin
  perform private.require_economic_preparation_actor(p_actor_user_id);
  if p_audience not in ('seller','operator','account') or p_audience is null then raise exception using errcode='22023',message='preparation_audience_invalid'; end if;
  select * into settings_record from private.economic_preparation_settings where singleton;
  select coalesce(jsonb_agg(capability order by capability),'[]') into caps from (select distinct a.capability from private.economic_operator_assignments a where a.user_id=p_actor_user_id and private.economic_operator_has_capability(p_actor_user_id,a.capability)) c;
  if p_audience='operator' and jsonb_array_length(caps)=0 then raise exception using errcode='42501',message='preparation_operator_required'; end if;
  can_sellers:=p_audience='operator' and private.economic_operator_has_capability(p_actor_user_id,'marketplace_payout_manage');
  can_settlement:=can_sellers;
  can_waivers:=p_audience='operator' and private.economic_operator_has_capability(p_actor_user_id,'economic_assistance_manage');
  can_support:=p_audience='operator' and (private.economic_operator_has_capability(p_actor_user_id,'economic_refunds_manage') or private.economic_operator_has_capability(p_actor_user_id,'recurring_support_manage'));
  can_records:=p_audience='operator' and private.economic_operator_has_capability(p_actor_user_id,'economic_payments_view');
  can_audit:=p_audience='operator' and private.economic_operator_has_capability(p_actor_user_id,'economic_audit_view');
  result:=jsonb_build_object('mode','pre_provider','providerActionsAvailable',false,'enabled',settings_record.enabled,'lanes',jsonb_build_object('sellers',settings_record.sellers_enabled,'settlements',settings_record.settlements_enabled,'waivers',settings_record.waivers_enabled,'support',settings_record.support_enabled),'capabilities',caps,'sellerEligible',private.marketplace_seller_is_eligible(p_actor_user_id),'termsVersion','2026-09-08-readiness','termsPath','/legal/marketplace-commerce-terms','bounded',true,'truncated',false);

  select coalesce(jsonb_agg(row order by updated_at desc,seller_id),'[]') into collection from (
    select p.seller_id,p.updated_at,jsonb_build_object('sellerId',p.seller_id,'displayName',p.display_name,'supportUrl',p.support_url,'intent',p.intent,'status',p.status,'revision',p.revision,'termsVersion',p.terms_version,'publisherId',p.publisher_id,'reviewReason',p.review_reason,'blockers',private.preparation_seller_blockers(p.seller_id),'updatedAt',p.updated_at) row
    from private.economic_seller_preparations p join private.economic_seller_accounts a on a.id=p.seller_id where can_sellers or (p_audience='seller' and a.user_id=p_actor_user_id) order by p.updated_at desc,p.seller_id limit 50
  ) q; result:=result||jsonb_build_object('sellers',collection);
  select coalesce(jsonb_agg(row order by updated_at desc,id),'[]') into collection from (
    select o.id,o.updated_at,jsonb_build_object('offerId',o.id,'sellerId',o.seller_id,'addonVersionId',o.addon_version_id,'kind',o.kind,'amountMinor',o.amount_minor,'currency',o.currency,'licenseKey',o.license_key,'licenseVersion',o.license_version,'feeProposalId',o.fee_proposal_id,'status',o.status,'revision',o.revision,'blockers',private.preparation_seller_blockers(o.seller_id)||case when exists(select 1 from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id join public.developer_profiles d on d.id=l.developer_profile_id where v.id=o.addon_version_id and d.user_id=a.user_id and l.listing_status='published' and l.revoked_at is null and v.review_status='approved' and v.published_at is not null and v.revoked_at is null) then '[]'::jsonb else '["reviewed_version_no_longer_eligible"]'::jsonb end||case when o.kind='commercial' then '["fee_proposal_not_adopted","paid_offer_activation_disabled"]'::jsonb else '[]'::jsonb end,'updatedAt',o.updated_at) row
    from private.economic_offer_preparations o join private.economic_seller_accounts a on a.id=o.seller_id where can_sellers or (p_audience='seller' and a.user_id=p_actor_user_id) order by o.updated_at desc,o.id limit 50
  ) q; result:=result||jsonb_build_object('offers',collection);
  select coalesce(jsonb_agg(row order by id),'[]') into collection from (select p.id,jsonb_build_object('publisherId',p.id,'name',left(p.name,300),'verified',p.verified) row from public.publishers p where p.owner_id=p_actor_user_id and p_audience='seller' order by p.id limit 100) q;
  result:=result||jsonb_build_object('publisherOptions',collection);
  select coalesce(jsonb_agg(row order by id),'[]') into collection from (select v.id,jsonb_build_object('addonVersionId',v.id,'name',left(l.name,300),'version',left(v.version,120)) row from public.marketplace_addon_versions v join public.marketplace_listings l on l.id=v.listing_id join public.developer_profiles d on d.id=l.developer_profile_id where p_audience='seller' and d.user_id=p_actor_user_id and l.listing_status='published' and l.revoked_at is null and v.review_status='approved' and v.published_at is not null and v.revoked_at is null order by v.id limit 100) q;
  result:=result||jsonb_build_object('versionOptions',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (select p.id,p.created_at,jsonb_build_object('proposalId',p.id,'kind',p.kind,'value',p.value,'adopted',false,'createdAt',p.created_at) row from private.economic_preparation_proposals p order by p.created_at desc,p.id limit 50) q;
  result:=result||jsonb_build_object('proposals',collection);
  select coalesce(jsonb_agg(row order by updated_at desc,order_id),'[]') into collection from (
    select p.order_id,p.updated_at,fresh.current_snapshot||jsonb_build_object('status',case when p.evidence_sha256=fresh.current_snapshot->>'evidenceSha256' then p.status else 'reconciliation_required' end,'blockers',(fresh.current_snapshot->'blockers')||case when p.evidence_sha256=fresh.current_snapshot->>'evidenceSha256' then '[]'::jsonb else '["snapshot_stale_refresh_required"]'::jsonb end,'revision',p.revision,'providerPayoutStatus','not_verified','updatedAt',p.updated_at) row
    from private.economic_settlement_preparations p join private.marketplace_purchase_contracts c on c.order_id=p.order_id join private.economic_seller_accounts a on a.id=c.seller_account_id
    cross join lateral (select private.preparation_settlement_snapshot(p.order_id) current_snapshot) fresh
    where can_settlement or (p_audience='seller' and a.user_id=p_actor_user_id) order by p.updated_at desc,p.order_id limit 50
  ) q; result:=result||jsonb_build_object('settlements',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (select w.id,w.created_at,jsonb_build_object('waiverId',w.id,'orderId',w.order_id,'component',w.component,'amountMinor',w.amount_minor,'currency',w.currency,'status',w.status,'revision',w.revision,'actorId',w.actor_user_id,'reason',w.reason,'createdAt',w.created_at) row from private.economic_owned_fee_waivers w where can_waivers order by w.created_at desc,w.id limit 50) q;
  result:=result||jsonb_build_object('waivers',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (select c.id,c.created_at,jsonb_build_object('caseId',c.id,'targetId',c.target_id,'kind',c.kind,'amountMinor',c.amount_minor,'status',c.status,'revision',c.revision,'reason',c.reason,'createdAt',c.created_at) row from private.economic_support_preparation_cases c where can_support or (p_audience='account' and c.user_id=p_actor_user_id) order by c.created_at desc,c.id limit 50) q;
  result:=result||jsonb_build_object('supportCases',collection);
  select coalesce(jsonb_agg(row order by updated_at desc,id),'[]') into collection from (select s.id,s.updated_at,jsonb_build_object('subscriptionId',s.id,'status',s.status,'cancelAtPeriodEnd',s.cancel_at_period_end,'currentPeriodEnd',s.current_period_end) row from private.economic_subscriptions s join private.economic_orders o on o.id=s.originating_order_id where o.flow='support_recurring' and (can_support or (p_audience='account' and s.user_id=p_actor_user_id)) order by s.updated_at desc,s.id limit 50) q;
  result:=result||jsonb_build_object('subscriptions',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (
    select id,created_at,jsonb_build_object('recordId',id,'orderId',order_id,'kind',kind,'amountMinor',amount_minor,'currency',currency,'status',status,'deliveryStatus','not_established','evidence',evidence,'createdAt',created_at) row from (
      select t.id,t.order_id,case when o.flow='marketplace_purchase' then 'marketplace_payment' else 'support_acknowledgment' end kind,t.gross_amount_minor amount_minor,t.currency,t.status,'verified_internal_record' evidence,t.created_at
      from private.economic_payment_transactions t join private.economic_orders o on o.id=t.order_id where t.transaction_type='payment' and t.status='succeeded' and o.flow in ('support_one_time','support_recurring','marketplace_purchase') and (can_records or (p_audience='account' and o.user_id=p_actor_user_id))
      union all
      select f.id,f.order_id,'refund_record',f.amount_minor,f.currency,f.status,'verified_internal_record',f.created_at from private.economic_refunds f join private.economic_orders o on o.id=f.order_id where can_records or (p_audience='account' and o.user_id=p_actor_user_id)
      union all
      select pp.id,null::uuid,'payout_preparation',pp.amount_minor,pp.currency,pp.status,'preparation_only',pp.created_at from private.marketplace_payout_preparations pp join private.economic_seller_accounts a on a.id=pp.seller_account_id where can_settlement or (p_audience='seller' and a.user_id=p_actor_user_id)
    ) records order by created_at desc,id limit 50
  ) q; result:=result||jsonb_build_object('records',collection);
  select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into collection from (select e.id,e.created_at,jsonb_build_object('eventId',e.id,'action',e.action,'targetId',e.target_id,'actorId',e.actor_user_id,'reason',e.reason,'createdAt',e.created_at) row from private.economic_preparation_events e where can_audit order by e.created_at desc,e.id limit 50) q;
  result:=result||jsonb_build_object('audit',collection);
  foreach key in array array['sellers','offers','proposals','settlements','waivers','supportCases','subscriptions','records','audit'] loop
    if jsonb_array_length(result->key)>=50 then result:=result||'{"truncated":true}'::jsonb; end if;
  end loop;
  if jsonb_array_length(result->'publisherOptions')>=100 or jsonb_array_length(result->'versionOptions')>=100 then result:=result||'{"truncated":true}'::jsonb; end if;
  return result;
end;
$$;

do $function_hardening$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
    (n.nspname='private' and p.proname in ('require_economic_preparation_actor','preparation_exact_keys','preparation_minor','preparation_seller_blockers','preparation_settlement_snapshot','guard_prepared_waiver_provider_attachment'))
    or (n.nspname='public' and p.proname in ('get_economic_preparation','command_economic_preparation')) loop
    execute format('alter function %s owner to postgres',f);
    execute format('revoke all on function %s from public, anon, authenticated, service_role',f);
  end loop;
end;
$function_hardening$;
grant execute on function public.get_economic_preparation(uuid,text) to service_role;
grant execute on function public.command_economic_preparation(uuid,jsonb) to service_role;
comment on table private.economic_owned_fee_waivers is 'Audited EcoSyneva-owned fee preparation only. Never creator principal, processor fees, taxes, a refund, or a completed provider action.';
comment on table private.economic_settlement_preparations is 'Derived internal reconciliation and handoff preparation. No state represents a completed creator bank payout.';
commit;
