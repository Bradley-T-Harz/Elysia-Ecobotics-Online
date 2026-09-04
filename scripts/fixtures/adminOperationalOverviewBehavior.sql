\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    'operational-admin@example.invalid', now(), now(), now()
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'operational-reviewer@example.invalid', now(), now(), now()
  );

insert into public.profiles(id, username, display_name, is_admin)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    'operational-admin', 'Operational Admin', true
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    'operational-reviewer', 'Operational Reviewer', false
  );

insert into public.user_roles(user_id, role, granted_by, reason)
values (
  'f1000000-0000-4000-8000-000000000001', 'administrator',
  'f1000000-0000-4000-8000-000000000001',
  'Disposable operational-overview administrator fixture.'
);

insert into private.online_abuse_decisions(
  id, actor_user_id, action, resource_domain, resource_type,
  policy_key, decided_at, expires_at, window_started_at
) values (
  'f1000000-0000-4000-8000-000000000003',
  'f1000000-0000-4000-8000-000000000002',
  'participation_request', 'work', 'work_with_requests',
  'participation_request_create', now() - interval '5 minutes',
  now() + interval '1 day', date_trunc('hour', now())
);

do $operational_overview_acl_contract$
begin
  if pg_catalog.has_function_privilege(
       'anon', 'public.current_admin_operational_overview()', 'EXECUTE'
     ) then
    raise exception 'anonymous role retained operational-overview execution';
  end if;
  if not pg_catalog.has_function_privilege(
       'authenticated', 'public.current_admin_operational_overview()', 'EXECUTE'
     ) then
    raise exception 'authenticated role lacks guarded operational-overview execution';
  end if;
end
$operational_overview_acl_contract$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-4000-8000-000000000002', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

do $ordinary_reviewer_refusal$
begin
  begin
    perform public.current_admin_operational_overview();
    raise exception 'ordinary reviewer read the administrator overview';
  exception when insufficient_privilege then
    if sqlerrm <> 'operational_overview_admin_required' then raise; end if;
  end;
end
$ordinary_reviewer_refusal$;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $administrator_aggregate_contract$
declare
  v_payload jsonb;
  v_metric jsonb;
  v_item jsonb;
begin
  v_payload := public.current_admin_operational_overview();

  if pg_catalog.jsonb_typeof(v_payload) <> 'object'
     or v_payload->>'scope' <> 'database_aggregate_only'
     or v_payload->>'administratorOnly' <> 'true'
     or pg_catalog.jsonb_typeof(v_payload->'metrics') <> 'array'
     or pg_catalog.jsonb_array_length(v_payload->'metrics') <> 12
     or pg_catalog.jsonb_typeof(v_payload->'externalBoundaries') <> 'array'
     or pg_catalog.jsonb_array_length(v_payload->'externalBoundaries') <> 5
     or v_payload->>'generatedAt' is null then
    raise exception 'operational overview envelope is incomplete';
  end if;

  if (select pg_catalog.count(distinct item->>'key')
      from pg_catalog.jsonb_array_elements(v_payload->'metrics') as item) <> 12 then
    raise exception 'operational overview metric keys are not unique';
  end if;

  for v_item in
    select item from pg_catalog.jsonb_array_elements(v_payload->'metrics') as item
  loop
    if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_item)) <> 6
       or not (v_item ?& array['key','domain','label','count','oldestAt','state'])
       or pg_catalog.jsonb_typeof(v_item->'count') <> 'number'
       or (v_item->>'count')::bigint < 0
       or v_item->>'state' not in ('clear', 'attention', 'critical')
       or pg_catalog.jsonb_typeof(v_item->'oldestAt') not in ('string', 'null') then
      raise exception 'operational overview metric shape is unsafe: %', v_item;
    end if;
  end loop;

  select item into v_metric
  from pg_catalog.jsonb_array_elements(v_payload->'metrics') as item
  where item->>'key' = 'online_abuse_unreviewed';
  if (v_metric->>'count')::integer <> 1
     or v_metric->>'state' <> 'attention'
     or v_metric->>'oldestAt' is null then
    raise exception 'operational overview did not report the synthetic abuse backlog';
  end if;

  for v_item in
    select item
    from pg_catalog.jsonb_array_elements(v_payload->'externalBoundaries') as item
  loop
    if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_item)) <> 4
       or not (v_item ?& array['key','label','state','boundary']) then
      raise exception 'operational overview external-boundary shape is unsafe: %', v_item;
    end if;
  end loop;

  if not exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_payload->'externalBoundaries') as item
       where item->>'key' = 'stripe'
         and item->>'state' = 'disabled_pending_review'
     )
     or not exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_payload->'externalBoundaries') as item
       where item->>'key' = 'sandbox_host'
         and item->>'state' = 'bounded_credential_checkpoint'
     ) then
    raise exception 'operational overview blurred an external authority boundary';
  end if;

  if v_payload::text ~* 'example[.]invalid|f1000000-|private_review_note|actor_user_id|filename|secret' then
    raise exception 'operational overview leaked record-level or private fixture data';
  end if;
end
$administrator_aggregate_contract$;

reset role;

\echo ADMIN_OPERATIONAL_OVERVIEW_BEHAVIOR_OK

rollback;
