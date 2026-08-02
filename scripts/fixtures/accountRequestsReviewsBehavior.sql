\set ON_ERROR_STOP on

-- Runs after the full active migration chain in a disposable database. All
-- identities and request contents below are synthetic and rolled back.
begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('af000000-0000-4000-8000-000000000001', 'request-owner@example.invalid', now(), now(), now()),
  ('af000000-0000-4000-8000-000000000002', 'request-unrelated@example.invalid', now(), now(), now());

insert into public.work_with_requests(
  id, user_id, name, preferred_contact, request_type, message, status
) values
  (
    'af100000-0000-4000-8000-000000000001',
    'af000000-0000-4000-8000-000000000001',
    'Synthetic Owner', 'private-contact@example.invalid', 'project_collaboration',
    'PRIVATE_WORK_WITH_BODY_MUST_NOT_PROJECT', 'pending_review'
  ),
  (
    'af100000-0000-4000-8000-000000000002',
    'af000000-0000-4000-8000-000000000001',
    'Synthetic Owner', 'private-contact@example.invalid', 'general',
    'SECOND_PRIVATE_BODY_MUST_NOT_PROJECT', 'approved'
  );

do $request_projection_grants$
begin
  if pg_catalog.has_function_privilege(
    'authenticated', 'private.current_user_request_review_rows(uuid)', 'EXECUTE'
  ) then
    raise exception 'request_projection_private_helper_is_browser_callable';
  end if;
  if not pg_catalog.has_function_privilege(
    'authenticated', 'public.current_user_request_counts()', 'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'authenticated',
    'public.current_user_requests_and_reviews(text,text,integer,timestamp with time zone,text)',
    'EXECUTE'
  ) then
    raise exception 'request_projection_public_rpc_grant_missing';
  end if;
end
$request_projection_grants$;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', 'af000000-0000-4000-8000-000000000001', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"af000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

do $request_projection_owner$
declare
  v_counts jsonb;
  v_pending jsonb;
  v_resolved jsonb;
begin
  v_counts := public.current_user_request_counts();
  if (v_counts->>'total')::integer <> 2
     or (v_counts->>'pending')::integer <> 1
     or (v_counts #>> '{byDomain,work_with,total}')::integer <> 2
     or (v_counts #>> '{byDomain,work_with,pending}')::integer <> 1 then
    raise exception 'request_projection_exact_counts_incorrect';
  end if;

  v_pending := public.current_user_requests_and_reviews(
    'pending', 'work_with', 40, null, null
  );
  if pg_catalog.jsonb_array_length(v_pending->'items') <> 1
     or (v_pending #>> '{items,0,status}') <> 'pending_review'
     or (v_pending #>> '{items,0,deepLink}') <> '/commons-circle/requests-reviews?domain=work_with'
     or v_pending::text like '%PRIVATE_WORK_WITH_BODY_MUST_NOT_PROJECT%'
     or v_pending::text like '%private-contact@example.invalid%'
     or v_pending::text like '%Synthetic Owner%' then
    raise exception 'request_projection_safe_pending_contract_failed';
  end if;

  v_resolved := public.current_user_requests_and_reviews(
    'resolved', 'work_with', 40, null, null
  );
  if pg_catalog.jsonb_array_length(v_resolved->'items') <> 1
     or (v_resolved #>> '{items,0,status}') <> 'approved' then
    raise exception 'request_projection_resolved_filter_failed';
  end if;

  begin
    perform public.current_user_requests_and_reviews('all', 'review_center', 40, null, null);
    raise exception 'request_projection_invalid_domain_accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'account_request_domain_invalid' then raise; end if;
  end;
end
$request_projection_owner$;

select pg_catalog.set_config('request.jwt.claim.sub', 'af000000-0000-4000-8000-000000000002', false);
select pg_catalog.set_config('request.jwt.claims', '{"sub":"af000000-0000-4000-8000-000000000002","role":"authenticated"}', false);

do $request_projection_unrelated$
declare
  v_counts jsonb;
  v_items jsonb;
begin
  v_counts := public.current_user_request_counts();
  v_items := public.current_user_requests_and_reviews('all', null, 40, null, null);
  if (v_counts->>'total')::integer <> 0
     or (v_counts->>'pending')::integer <> 0
     or pg_catalog.jsonb_array_length(v_items->'items') <> 0 then
    raise exception 'request_projection_exposed_another_account';
  end if;
end
$request_projection_unrelated$;

reset role;
rollback;

select 'account_requests_reviews_behavior_ok' as result;
