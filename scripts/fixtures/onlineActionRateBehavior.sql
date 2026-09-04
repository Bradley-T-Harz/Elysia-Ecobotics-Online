\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  (
    'd3000000-0000-4000-8000-000000000001',
    'rate-new@example.invalid', now(), now(), now()
  ),
  (
    'd3000000-0000-4000-8000-000000000002',
    'rate-established@example.invalid', now(),
    now() - interval '30 days', now()
  ),
  (
    'd3000000-0000-4000-8000-000000000003',
    'rate-admin@example.invalid', now(),
    now() - interval '30 days', now()
  );

insert into public.profiles(id, username, display_name, commons_onboarding_completed_at)
values
  (
    'd3000000-0000-4000-8000-000000000001',
    'rate-new', 'Rate New', now()
  ),
  (
    'd3000000-0000-4000-8000-000000000002',
    'rate-established', 'Rate Established', now()
  ),
  (
    'd3000000-0000-4000-8000-000000000003',
    'rate-admin', 'Rate Admin', now()
  );

insert into public.user_roles(user_id, role, granted_by, reason)
values (
  'd3000000-0000-4000-8000-000000000003', 'administrator',
  'd3000000-0000-4000-8000-000000000003',
  'Disposable action-rate Admin fixture'
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd3000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.work_with_requests(id, user_id, request_type, status)
values
  ('d3100000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'Volunteer', 'pending_review'),
  ('d3100000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000001', 'Contributor', 'pending_review'),
  ('d3100000-0000-4000-8000-000000000003', 'd3000000-0000-4000-8000-000000000001', 'Research help', 'pending_review'),
  ('d3100000-0000-4000-8000-000000000004', 'd3000000-0000-4000-8000-000000000001', 'Documentation help', 'pending_review'),
  ('d3100000-0000-4000-8000-000000000005', 'd3000000-0000-4000-8000-000000000001', 'Product testing', 'pending_review');

do $new_account_rate_contract$
begin
  begin
    insert into public.work_with_requests(id, user_id, request_type, status)
    values (
      'd3100000-0000-4000-8000-000000000006',
      'd3000000-0000-4000-8000-000000000001',
      'Other', 'pending_review'
    );
    raise exception 'new-account participation request rate was not enforced';
  exception when program_limit_exceeded then
    if sqlerrm <> 'online_action_rate_limited' then raise; end if;
  end;
end;
$new_account_rate_contract$;

reset role;

do $minimized_decision_contract$
begin
  if (select pg_catalog.count(*) from private.online_action_rate_policies) <> 17 then
    raise exception 'online action policy catalog is incomplete';
  end if;
  if (select pg_catalog.count(*) from private.online_abuse_decisions
      where actor_user_id = 'd3000000-0000-4000-8000-000000000001'
        and policy_key = 'participation_request_create'
        and action = 'participation_request'
        and resource_domain = 'work'
        and resource_type = 'work_with_requests'
        and decision = 'restricted'
        and reason_class = 'velocity_limit_reached'
        and expires_at > decided_at
        and review_state = 'unreviewed') <> 1 then
    raise exception 'content-minimized rate decision was not armed at the boundary';
  end if;
  if (select attempt_count from private.online_action_rate_counters
      where actor_user_id = 'd3000000-0000-4000-8000-000000000001'
        and policy_key = 'participation_request_create') <> 5 then
    raise exception 'refused attempt incorrectly changed the committed rate counter';
  end if;
end;
$minimized_decision_contract$;

-- An established email-verified account receives the documented, higher
-- velocity ceiling without reference to payment, role, badge, or social rank.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd3000000-0000-4000-8000-000000000002', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
insert into public.work_with_requests(id, user_id, request_type, status)
values
  ('d3200000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002', 'Volunteer', 'pending_review'),
  ('d3200000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000002', 'Contributor', 'pending_review'),
  ('d3200000-0000-4000-8000-000000000003', 'd3000000-0000-4000-8000-000000000002', 'Research help', 'pending_review'),
  ('d3200000-0000-4000-8000-000000000004', 'd3000000-0000-4000-8000-000000000002', 'Documentation help', 'pending_review'),
  ('d3200000-0000-4000-8000-000000000005', 'd3000000-0000-4000-8000-000000000002', 'Product testing', 'pending_review'),
  ('d3200000-0000-4000-8000-000000000006', 'd3000000-0000-4000-8000-000000000002', 'Other', 'pending_review');
reset role;

do $transparent_tier_contract$
begin
  if (select attempt_count from private.online_action_rate_counters
      where actor_user_id = 'd3000000-0000-4000-8000-000000000002'
        and policy_key = 'participation_request_create') <> 6
     or exists (
       select 1 from private.online_abuse_decisions
       where actor_user_id = 'd3000000-0000-4000-8000-000000000002'
         and policy_key = 'participation_request_create'
     ) then
    raise exception 'established verified velocity tier was not applied transparently';
  end if;
end;
$transparent_tier_contract$;

-- Storage has a distinct action policy; ten current profile upload paths are
-- accepted, the boundary decision persists, and the eleventh is refused.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd3000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
insert into storage.objects(id, bucket_id, name, owner_id)
select
  ('d3300000-0000-4000-8000-' || pg_catalog.lpad(series::text, 12, '0'))::uuid,
  'profile-avatars',
  'd3000000-0000-4000-8000-000000000001/avatars/'
    || pg_catalog.lpad(series::text, 36, '0') || '-fixture.webp',
  'd3000000-0000-4000-8000-000000000001'::uuid
from pg_catalog.generate_series(1, 10) as series;

do $upload_rate_contract$
begin
  begin
    insert into storage.objects(id, bucket_id, name, owner_id)
    values (
      'd3300000-0000-4000-8000-000000000011', 'profile-avatars',
      'd3000000-0000-4000-8000-000000000001/avatars/d3310000-0000-4000-8000-000000000011-fixture.webp',
      'd3000000-0000-4000-8000-000000000001'
    );
    raise exception 'new-account profile upload rate was not enforced';
  exception when program_limit_exceeded then
    if sqlerrm <> 'online_action_rate_limited' then raise; end if;
  end;
end;
$upload_rate_contract$;
reset role;

do $upload_decision_contract$
begin
  if (select attempt_count from private.online_action_rate_counters
      where actor_user_id = 'd3000000-0000-4000-8000-000000000001'
        and policy_key = 'profile_upload') <> 10
     or (select pg_catalog.count(*) from private.online_abuse_decisions
         where actor_user_id = 'd3000000-0000-4000-8000-000000000001'
           and policy_key = 'profile_upload') <> 1 then
    raise exception 'profile upload rate decision/counter contract failed';
  end if;
end;
$upload_decision_contract$;

-- Voluntary deactivation is a separate authority refusal and cannot be
-- converted into a velocity decision or bypassed through the old request RLS.
update private.account_activation_state
set activation_state = 'temporarily_deactivated',
    temporarily_deactivated_at = now(),
    reactivated_at = null,
    updated_at = now()
where user_id = 'd3000000-0000-4000-8000-000000000002';

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd3000000-0000-4000-8000-000000000002', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
do $deactivated_request_contract$
begin
  begin
    insert into public.work_with_requests(id, user_id, request_type, status)
    values (
      'd3200000-0000-4000-8000-000000000007',
      'd3000000-0000-4000-8000-000000000002',
      'Other', 'pending_review'
    );
    raise exception 'deactivated account created a Work With request';
  exception when insufficient_privilege then null;
  end;
end;
$deactivated_request_contract$;
reset role;

do $trigger_catalog_contract$
begin
  if (select pg_catalog.count(*)
      from pg_catalog.pg_trigger
      where not tgisinternal
        and tgname like 'online_rate_%') <> 20 then
    raise exception 'online action rate trigger catalog is incomplete';
  end if;
end;
$trigger_catalog_contract$;

-- Decision evidence is administrator-only, and review records human triage
-- without altering the velocity policy or the account's authority.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd3000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
do $ordinary_account_admin_refusal$
begin
  begin
    perform public.online_abuse_decision_summary(100);
    raise exception 'ordinary account read private abuse decisions';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.review_online_abuse_decision(
      (select id from private.online_abuse_decisions limit 1),
      'acknowledged', 'unauthorized'
    );
    raise exception 'ordinary account reviewed private abuse decision';
  exception when insufficient_privilege then null;
  end;
end;
$ordinary_account_admin_refusal$;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd3000000-0000-4000-8000-000000000003', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"d3000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
do $administrator_decision_review_contract$
declare
  v_decision_id uuid;
  v_result jsonb;
begin
  if (select pg_catalog.count(*) from public.online_abuse_decision_summary(100)) <> 2 then
    raise exception 'administrator decision summary did not return both minimized records';
  end if;
  select decision_id into v_decision_id
  from public.online_abuse_decision_summary(100)
  where policy_key = 'participation_request_create';
  v_result := public.review_online_abuse_decision(
    v_decision_id, 'acknowledged', 'Reviewed disposable velocity evidence.'
  );
  if v_result ->> 'reviewState' <> 'acknowledged'
     or not exists (
       select 1 from public.online_abuse_decision_summary(100)
       where decision_id = v_decision_id
         and review_state = 'acknowledged'
         and reviewed_by = 'd3000000-0000-4000-8000-000000000003'
         and private_review_note = 'Reviewed disposable velocity evidence.'
     ) then
    raise exception 'administrator restriction review was not audited';
  end if;
end;
$administrator_decision_review_contract$;
reset role;

-- Retention deletion is service-only and bounded. Backdate one disposable
-- record; do not use application data or relax the review function.
update private.online_abuse_decisions
set decided_at = now() - interval '31 days',
    expires_at = now() - interval '1 second'
where policy_key = 'profile_upload';

set local role service_role;
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"role":"service_role"}', true
);
do $service_retention_contract$
begin
  if public.expire_online_abuse_decisions(10) <> 1 then
    raise exception 'service retention did not delete exactly one expired decision';
  end if;
end;
$service_retention_contract$;
reset role;

do $post_review_retention_contract$
begin
  if (select pg_catalog.count(*) from private.online_abuse_decisions) <> 1
     or not exists (
       select 1 from private.online_abuse_decisions
       where policy_key = 'participation_request_create'
         and review_state = 'acknowledged'
     ) then
    raise exception 'reviewed restriction history or retention boundary drifted';
  end if;
end;
$post_review_retention_contract$;

\echo online_action_rate_behavior_ok

rollback;
