\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, email_confirmed_at, created_at, updated_at)
values
  ('ad000000-0000-4000-8000-000000000001', 'activation-owner-a@example.invalid', now(), now(), now()),
  ('ad000000-0000-4000-8000-000000000002', 'activation-owner-b@example.invalid', now(), now(), now());

insert into public.profiles(
  id, username, display_name, bio, commons_onboarding_completed_at
)
values
  (
    'ad000000-0000-4000-8000-000000000001', 'activation-owner-a',
    'Activation Owner A', 'Preserved owner biography.', now()
  ),
  (
    'ad000000-0000-4000-8000-000000000002', 'activation-owner-b',
    'Activation Owner B', 'Unaffected comparison biography.', now()
  );

update private.account_participation
set participation_state = 'adult_eligible',
    age_band = '18_plus',
    assurance_status = 'self_attested',
    updated_at = now()
where user_id in (
  'ad000000-0000-4000-8000-000000000001',
  'ad000000-0000-4000-8000-000000000002'
);

update public.profile_public_cards
set public_profile_enabled = false,
    short_public_bio = case user_id
      when 'ad000000-0000-4000-8000-000000000001'::uuid
        then 'Preserved public biography.'
      else 'Unaffected comparison public biography.'
    end,
    updated_at = now()
where user_id in (
  'ad000000-0000-4000-8000-000000000001',
  'ad000000-0000-4000-8000-000000000002'
);

do $activation_bootstrap_contract$
begin
  if (select activation_state from private.account_activation_state
      where user_id = 'ad000000-0000-4000-8000-000000000001') <> 'active'
     or (select activation_state from private.account_activation_state
         where user_id = 'ad000000-0000-4000-8000-000000000002') <> 'active' then
    raise exception 'new Auth identities were not bootstrapped active';
  end if;
  if public.get_public_commons_profile_presentation('activation-owner-a') = '{}'::jsonb then
    raise exception 'active legacy Online profile was not initially rendered';
  end if;
end
$activation_bootstrap_contract$;

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

select public.community_self_deactivate_actor(
  'ad000000-0000-4000-8000-000000000001',
  'ad100000-0000-4000-8000-000000000001'
);

do $deactivation_preservation_contract$
begin
  if (select response ->> 'state' from private.community_idempotency_keys
      where client_request_id = 'ad100000-0000-4000-8000-000000000001')
       <> 'temporarily_deactivated' then
    raise exception 'self-deactivation did not return the authoritative state';
  end if;
  if (select participation_state from private.account_participation
      where user_id = 'ad000000-0000-4000-8000-000000000001') <> 'adult_eligible' then
    raise exception 'temporary deactivation rewrote participation state';
  end if;
  if (select short_public_bio from public.profile_public_cards
      where user_id = 'ad000000-0000-4000-8000-000000000001')
       <> 'Preserved public biography.' then
    raise exception 'temporary deactivation erased public profile configuration';
  end if;
  if (select bio from public.profiles
      where id = 'ad000000-0000-4000-8000-000000000001')
       <> 'Preserved owner biography.' then
    raise exception 'temporary deactivation erased the Online biography';
  end if;
  if private.community_account_is_active('ad000000-0000-4000-8000-000000000001')
     or private.community_online_action_allowed(
       'ad000000-0000-4000-8000-000000000001', 'commune_posting'
     )
     or private.account_messaging_search_allowed(
       'ad000000-0000-4000-8000-000000000001'
     ) then
    raise exception 'temporarily deactivated account retained ordinary participation authority';
  end if;
  if not private.community_account_is_active('ad000000-0000-4000-8000-000000000002')
     or (select participation_state from private.account_participation
         where user_id = 'ad000000-0000-4000-8000-000000000002') <> 'adult_eligible' then
    raise exception 'User A deactivation changed User B';
  end if;
  if public.get_public_commons_profile_presentation('activation-owner-a') <> '{}'::jsonb then
    raise exception 'temporarily deactivated legacy Online profile remained public';
  end if;
  if (select count(*) from private.account_activation_events
      where user_id = 'ad000000-0000-4000-8000-000000000001'
        and actor_user_id = user_id
        and client_request_id = 'ad100000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'self-deactivation audit history is incomplete';
  end if;
end
$deactivation_preservation_contract$;

-- Exact replay returns the same response and cannot duplicate audit history.
do $deactivation_replay_contract$
declare
  v_stored jsonb;
  v_replayed jsonb;
begin
  select response into strict v_stored
  from private.community_idempotency_keys
  where client_request_id = 'ad100000-0000-4000-8000-000000000001';
  v_replayed := public.community_self_deactivate_actor(
    'ad000000-0000-4000-8000-000000000001',
    'ad100000-0000-4000-8000-000000000001'
  );
  if v_replayed <> v_stored or (select count(*) from private.account_activation_events
         where client_request_id = 'ad100000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'self-deactivation replay was not exactly idempotent';
  end if;
end
$deactivation_replay_contract$;

select public.community_self_reactivate_actor(
  'ad000000-0000-4000-8000-000000000001',
  'ad200000-0000-4000-8000-000000000001'
);

do $reactivation_preservation_contract$
begin
  if (select response ->> 'state' from private.community_idempotency_keys
      where client_request_id = 'ad200000-0000-4000-8000-000000000001') <> 'active'
     or (select participation_state from private.account_participation
         where user_id = 'ad000000-0000-4000-8000-000000000001') <> 'adult_eligible' then
    raise exception 'reactivation did not remove only the voluntary pause';
  end if;
  if public.get_public_commons_profile_presentation('activation-owner-a') = '{}'::jsonb then
    raise exception 'reactivation did not restore the preserved public projection';
  end if;
  if (select count(*) from private.account_activation_events
      where user_id = 'ad000000-0000-4000-8000-000000000001'
        and actor_user_id = user_id
        and client_request_id = 'ad200000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'self-reactivation audit history is incomplete';
  end if;
end
$reactivation_preservation_contract$;

-- Reactivation never upgrades or guesses the underlying governance state.
update private.account_participation
set participation_state = 'restricted', updated_at = now()
where user_id = 'ad000000-0000-4000-8000-000000000001';

select public.community_self_deactivate_actor(
  'ad000000-0000-4000-8000-000000000001',
  'ad100000-0000-4000-8000-000000000002'
);
select public.community_self_reactivate_actor(
  'ad000000-0000-4000-8000-000000000001',
  'ad200000-0000-4000-8000-000000000002'
);

do $restricted_reactivation_contract$
begin
  if (select participation_state from private.account_participation
      where user_id = 'ad000000-0000-4000-8000-000000000001') <> 'restricted'
     or private.community_online_action_allowed(
       'ad000000-0000-4000-8000-000000000001', 'commune_posting'
     ) then
    raise exception 'reactivation bypassed an underlying restriction';
  end if;
end
$restricted_reactivation_contract$;

-- A pending terminal deletion lifecycle cannot be bypassed by either RPC.
update private.account_participation
set participation_state = 'deletion_pending', updated_at = now()
where user_id = 'ad000000-0000-4000-8000-000000000001';

do $deletion_pending_contract$
begin
  begin
    perform public.community_self_deactivate_actor(
      'ad000000-0000-4000-8000-000000000001',
      'ad100000-0000-4000-8000-000000000003'
    );
    raise exception 'deletion-pending account was temporarily deactivated';
  exception when sqlstate '55000' then
    if sqlerrm <> 'community_deletion_pending' then raise; end if;
  end;
  if (select activation_state from private.account_activation_state
      where user_id = 'ad000000-0000-4000-8000-000000000001') <> 'active' then
    raise exception 'failed deletion-pending mutation changed activation state';
  end if;
end
$deletion_pending_contract$;

-- Browser-authenticated callers can read only their bounded self projection.
-- They cannot execute either server actor RPC, inspect private state, update it,
-- or submit User B as a target in a direct RPC attempt.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claim.sub', 'ad000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"ad000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

do $authenticated_isolation_contract$
declare
  v_projection jsonb;
begin
  v_projection := public.current_user_account_activation();
  if v_projection ->> 'state' <> 'active' then
    raise exception 'authenticated owner could not read bounded self activation projection';
  end if;
  begin
    perform public.community_self_deactivate_actor(
      'ad000000-0000-4000-8000-000000000002',
      'ad100000-0000-4000-8000-000000000004'
    );
    raise exception 'User A deactivated User B by direct RPC';
  exception when insufficient_privilege then
    null;
  end;
end
$authenticated_isolation_contract$;

reset role;

do $cross_account_final_contract$
begin
  if has_function_privilege(
       'authenticated', 'public.community_self_deactivate_actor(uuid,uuid)', 'execute'
     ) or has_function_privilege(
       'authenticated', 'public.community_self_reactivate_actor(uuid,uuid)', 'execute'
     ) or has_table_privilege(
       'authenticated', 'private.account_activation_state', 'select'
     ) or has_table_privilege(
       'authenticated', 'private.account_activation_state', 'update'
     ) then
    raise exception 'authenticated role inherited cross-account activation authority';
  end if;
  if (select activation_state from private.account_activation_state
      where user_id = 'ad000000-0000-4000-8000-000000000002') <> 'active'
     or (select participation_state from private.account_participation
         where user_id = 'ad000000-0000-4000-8000-000000000002') <> 'adult_eligible'
     or (select short_public_bio from public.profile_public_cards
         where user_id = 'ad000000-0000-4000-8000-000000000002')
          <> 'Unaffected comparison public biography.' then
    raise exception 'cross-account isolation failed for User B';
  end if;
end
$cross_account_final_contract$;

rollback;

\echo 'account_activation_behavior_ok'
