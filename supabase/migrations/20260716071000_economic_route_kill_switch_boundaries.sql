-- Keep economic account mutations and public recognition projections behind the
-- billing Worker so deployment kill switches cannot be bypassed through the
-- Supabase Data API. This is a forward-only hardening migration; owner-scoped
-- read projections remain authenticated and unchanged.

begin;

revoke all privileges on function public.request_economic_account_action(uuid, text, text, text)
  from public, anon, authenticated, service_role;
drop function public.request_economic_account_action(uuid, text, text, text);

create or replace function public.request_economic_account_action(
  p_actor_user_id uuid,
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
  v_actor uuid := p_actor_user_id;
  v_request private.economic_account_action_requests%rowtype;
  v_provider_cancel boolean;
  v_idempotent_replay boolean;
begin
  if not private.economic_caller_is_service_role() then
    raise exception using errcode = '42501', message = 'economic_service_role_required';
  end if;
  if v_actor is null or not exists (
    select 1
    from auth.users as account
    where account.id = v_actor
      and account.deleted_at is null
      and account.is_anonymous is false
  ) then
    raise exception using errcode = '42501', message = 'economic_account_actor_ineligible';
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

alter function public.request_economic_account_action(uuid, uuid, text, text, text)
  owner to postgres;
revoke all privileges on function public.request_economic_account_action(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_economic_account_action(uuid, uuid, text, text, text)
  to service_role;

revoke all privileges on function public.public_support_recognition()
  from public, anon, authenticated, service_role;
grant execute on function public.public_support_recognition()
  to service_role;

revoke all privileges on function public.public_sponsorship_recognition()
  from public, anon, authenticated, service_role;
grant execute on function public.public_sponsorship_recognition()
  to service_role;

comment on function public.request_economic_account_action(uuid, uuid, text, text, text) is
  'Billing-Worker-only economic export/closure request. The verified Auth actor is supplied by the Worker; direct authenticated Data API mutation is forbidden.';
comment on function public.public_support_recognition() is
  'Minimal unranked support recognition projection. Only the environment-gated billing Worker may execute it; public clients consume the bounded HTTP endpoint.';
comment on function public.public_sponsorship_recognition() is
  'Minimal reviewed sponsorship recognition projection. Only the environment-gated billing Worker may execute it; public clients consume the bounded HTTP endpoint.';

commit;
