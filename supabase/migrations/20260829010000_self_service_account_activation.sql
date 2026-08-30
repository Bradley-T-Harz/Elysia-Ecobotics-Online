-- Reversible, user-owned account pause layered over the canonical participation
-- state. This deliberately does not reuse the terminal lifecycle deactivation
-- action: eligibility, restrictions, guardian state, profile configuration,
-- content, purchases, legal evidence, and deletion machinery remain unchanged.

begin;

create table private.account_activation_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activation_state text not null default 'active',
  temporarily_deactivated_at timestamptz,
  reactivated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint account_activation_state_value_check
    check (activation_state in ('active', 'temporarily_deactivated')),
  constraint account_activation_state_timestamp_check check (
    (activation_state = 'active' and temporarily_deactivated_at is null)
    or (activation_state = 'temporarily_deactivated' and temporarily_deactivated_at is not null)
  )
);

alter table private.account_activation_state owner to postgres;
alter table private.account_activation_state enable row level security;
alter table private.account_activation_state force row level security;
revoke all on private.account_activation_state from public, anon, authenticated, service_role;

create table private.account_activation_events (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  from_state text not null,
  to_state text not null,
  created_at timestamptz not null default now(),
  constraint account_activation_event_action_check check (
    action in (
      'self_deactivation_requested', 'self_deactivation_completed',
      'self_reactivation_requested', 'self_reactivation_completed'
    )
  ),
  constraint account_activation_event_from_check
    check (from_state in ('active', 'temporarily_deactivated')),
  constraint account_activation_event_to_check
    check (to_state in ('active', 'temporarily_deactivated')),
  constraint account_activation_event_self_actor_check
    check (user_id is null or actor_user_id is null or user_id = actor_user_id),
  unique (client_request_id, action)
);

alter table private.account_activation_events owner to postgres;
alter table private.account_activation_events enable row level security;
alter table private.account_activation_events force row level security;
revoke all on private.account_activation_events from public, anon, authenticated, service_role;

create trigger account_activation_events_are_append_only
before update or delete on private.account_activation_events
for each row execute function private.community_history_is_append_only();

insert into private.account_activation_state(user_id)
select account.id from auth.users as account
on conflict (user_id) do nothing;

create or replace function private.bootstrap_community_account_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.account_participation(user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into private.community_notification_preferences(user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into private.account_activation_state(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

alter function private.bootstrap_community_account_state() owner to postgres;
revoke all privileges on function private.bootstrap_community_account_state()
  from public, anon, authenticated, service_role;

create or replace function private.community_account_is_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select activation.activation_state = 'active'
    from private.account_activation_state as activation
    where activation.user_id = p_user_id
  ), false);
$$;

alter function private.community_account_is_active(uuid) owner to postgres;
revoke all privileges on function private.community_account_is_active(uuid)
  from public, anon, authenticated, service_role;

-- Every public profile projection already resolves through this canonical
-- predicate, so the stored publication preference and biography remain intact
-- while a temporarily deactivated profile disappears immediately.
create or replace function private.community_can_publish_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_active(p_user_id)
    and private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, 'commons_profile_publication')
    and not private.community_has_active_restriction(p_user_id, 'all_public_communities')
    and private.community_has_current_document(p_user_id, 'community_terms')
    and private.community_has_current_document(p_user_id, 'privacy_notice')
    and private.community_has_current_document(p_user_id, 'community_guidelines')
    and private.community_has_current_document(p_user_id, 'moderation_policy')
    and exists (
      select 1
      from private.account_participation as participation
      where participation.user_id = p_user_id
        and participation.participation_state not in (
          'restricted','suspended','blocked','deletion_pending','deactivated'
        )
        and (
          participation.assurance_expires_at is null
          or participation.assurance_expires_at > pg_catalog.now()
        )
        and case
          when participation.age_band = '18_plus' then
            participation.assurance_status in (
              'self_attested','age_estimated','age_verified'
            )
          when participation.age_band in ('13_to_15','16_to_17') then
            participation.participation_state = 'teen_eligible'
            and participation.assurance_status in ('age_verified','guardian_verified')
            and private.community_feature_enabled('artisan_teen_participation')
            and private.community_feature_enabled('artisan_teen_public_profiles')
            and private.community_has_guardian_consent(p_user_id, 'public_profile')
          when participation.age_band = 'under_13' then
            participation.participation_state = 'under13_eligible'
            and participation.assurance_status = 'guardian_verified'
            and private.community_feature_enabled('artisan_under13_participation')
            and private.community_feature_enabled('artisan_under13_public_profiles')
            and private.community_has_guardian_consent(p_user_id, 'public_profile')
          else false
        end
    ),
    false
  );
$$;

alter function private.community_can_publish_profile(uuid) owner to postgres;
revoke all privileges on function private.community_can_publish_profile(uuid)
  from public, anon, authenticated, service_role;

-- Legacy Online Commons profiles predate the shared publication card, but
-- they are still a canonical public-profile projection. Preserve the legacy
-- publication choice while applying the same reversible activation gate.
create or replace function private.community_legacy_online_profile_is_public(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_active(p_user_id)
    and private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(
      p_user_id, 'commons_profile_publication'
    )
    and not private.community_has_active_restriction(
      p_user_id, 'all_public_communities'
    )
    and exists (
      select 1
      from public.profiles as profile
      join private.account_participation as participation
        on participation.user_id = profile.id
      where profile.id = p_user_id
        and profile.commons_onboarding_completed_at is not null
        and participation.participation_state not in (
          'restricted', 'suspended', 'blocked',
          'deletion_pending', 'deactivated'
        )
    )
    and not exists (
      select 1
      from private.profile_publication_events as event
      where event.user_id = p_user_id
    ),
    false
  );
$$;

alter function private.community_legacy_online_profile_is_public(uuid)
  owner to postgres;
revoke all privileges
  on function private.community_legacy_online_profile_is_public(uuid)
  from public, anon, authenticated, service_role;

-- Artisan mutations converge on this predicate. The additional activation
-- check is orthogonal to every existing age, legal, guardian, moderation, and
-- feature requirement below it.
create or replace function private.community_can_participate(p_user_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_access private.account_participation%rowtype;
  v_restriction_scope text;
  v_guardian_scope text;
  v_media_feature text;
  v_under13_feature text;
begin
  if p_action = 'browse_public' then
    return true;
  end if;
  if p_action not in (
    'artisan_membership','artisan_post','artisan_comment','artisan_appreciate',
    'artisan_submit_challenge','artisan_upload_image','artisan_upload_audio',
    'artisan_upload_video','artisan_upload_document','artisan_upload_animation',
    'artisan_upload_3d','artisan_upload_interactive'
  ) then
    return false;
  end if;
  if not private.community_account_is_active(p_user_id)
     or not private.community_account_is_recoverable(p_user_id) then
    return false;
  end if;
  select * into v_access
  from private.account_participation
  where user_id = p_user_id;
  if not found or v_access.participation_state in ('read_only', 'restricted', 'suspended', 'blocked', 'deletion_pending', 'deactivated') then
    return false;
  end if;
  if v_access.assurance_expires_at is not null and v_access.assurance_expires_at <= pg_catalog.now() then
    return false;
  end if;

  v_restriction_scope := case
    when p_action = 'artisan_membership' then 'artisan_membership'
    when p_action = 'artisan_post' then 'artisan_posting'
    when p_action = 'artisan_comment' then 'artisan_commenting'
    when p_action = 'artisan_appreciate' then 'artisan_appreciation'
    when p_action = 'artisan_submit_challenge' then 'artisan_challenges'
    when p_action in (
      'artisan_upload_image','artisan_upload_audio','artisan_upload_video',
      'artisan_upload_document','artisan_upload_animation','artisan_upload_3d',
      'artisan_upload_interactive'
    ) then 'artisan_uploading'
  end;
  if private.community_has_active_restriction(p_user_id, v_restriction_scope) then
    return false;
  end if;

  if not private.community_has_current_document(p_user_id, 'community_terms')
     or not private.community_has_current_document(p_user_id, 'privacy_notice')
     or not private.community_has_current_document(p_user_id, 'community_guidelines')
     or not private.community_has_current_document(p_user_id, 'moderation_policy')
     or not private.community_has_current_document(p_user_id, 'artist_platform_license')
     or not private.community_has_current_document(p_user_id, 'ai_authorship_policy') then
    return false;
  end if;

  v_media_feature := case p_action
    when 'artisan_upload_audio' then 'artisan_audio_media'
    when 'artisan_upload_video' then 'artisan_short_video_media'
    when 'artisan_upload_document' then 'artisan_document_media'
    when 'artisan_upload_animation' then 'artisan_animation_media'
    when 'artisan_upload_3d' then 'artisan_3d_media'
    when 'artisan_upload_interactive' then 'artisan_interactive_media'
    else null
  end;
  if v_media_feature is not null and not private.community_feature_enabled(v_media_feature) then
    return false;
  end if;

  if v_access.age_band = '18_plus'
     and v_access.participation_state = 'adult_eligible'
     and v_access.assurance_status in ('self_attested', 'age_estimated', 'age_verified') then
    return private.community_feature_enabled('artisan_adult_closed_beta');
  end if;

  if v_access.age_band in ('13_to_15', '16_to_17')
     and v_access.participation_state = 'teen_eligible'
     and v_access.assurance_status in ('age_verified', 'guardian_verified')
     and private.community_feature_enabled('artisan_teen_participation') then
    v_guardian_scope := case p_action
      when 'artisan_membership' then 'artisan_membership'
      when 'artisan_post' then 'artisan_posting'
      when 'artisan_comment' then 'artisan_commenting'
      when 'artisan_submit_challenge' then 'artisan_challenges'
      when 'artisan_appreciate' then 'artisan_commenting'
      else 'artisan_uploading'
    end;
    return v_access.age_band = '16_to_17'
      or private.community_has_guardian_consent(p_user_id, v_guardian_scope);
  end if;

  if v_access.age_band = 'under_13'
     and v_access.participation_state = 'under13_eligible'
     and v_access.assurance_status = 'guardian_verified'
     and private.community_feature_enabled('artisan_under13_participation') then
    v_under13_feature := case
      when p_action = 'artisan_membership' then null
      when p_action = 'artisan_post' then 'artisan_under13_posting'
      when p_action = 'artisan_comment' then 'artisan_under13_commenting'
      when p_action = 'artisan_appreciate' then 'artisan_under13_appreciation'
      when p_action = 'artisan_submit_challenge' then 'artisan_under13_challenges'
      else 'artisan_under13_media'
    end;
    if v_under13_feature is not null
       and not private.community_feature_enabled(v_under13_feature) then
      return false;
    end if;
    if p_action in (
      'artisan_post','artisan_comment','artisan_submit_challenge',
      'artisan_upload_image','artisan_upload_audio','artisan_upload_video',
      'artisan_upload_document','artisan_upload_animation','artisan_upload_3d',
      'artisan_upload_interactive'
    ) and not private.community_feature_enabled('artisan_under13_content_approval') then
      return false;
    end if;
    v_guardian_scope := case p_action
      when 'artisan_membership' then 'artisan_membership'
      when 'artisan_post' then 'artisan_posting'
      when 'artisan_comment' then 'artisan_commenting'
      when 'artisan_appreciate' then 'artisan_commenting'
      when 'artisan_submit_challenge' then 'artisan_challenges'
      else 'artisan_uploading'
    end;
    return private.community_has_guardian_consent(p_user_id, v_guardian_scope);
  end if;

  return false;
end;
$$;

alter function private.community_can_participate(uuid, text) owner to postgres;
revoke all privileges on function private.community_can_participate(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.community_user_has_capability(p_user_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_active(p_user_id)
    and private.community_account_is_recoverable(p_user_id)
    and exists (
      select 1
      from private.community_capability_assignments as assignment
      join private.community_capability_catalog as catalog
        on catalog.capability = assignment.capability and catalog.active
      where assignment.user_id = p_user_id
        and assignment.capability = p_capability
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > pg_catalog.now())
    ),
    false
  );
$$;

alter function private.community_user_has_capability(uuid, text) owner to postgres;
revoke all privileges on function private.community_user_has_capability(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.community_online_action_allowed(p_user_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null
    and p_scope in (
      'commune_posting','commune_commenting',
      'marketplace_publishing','job_posting'
    )
    and private.community_account_is_active(p_user_id)
    and private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, p_scope)
    and not exists (
      select 1 from private.account_participation as participation
      where participation.user_id = p_user_id
        and participation.participation_state in (
          'restricted','suspended','blocked','deletion_pending','deactivated'
        )
    ),
    false
  );
$$;

alter function private.community_online_action_allowed(uuid, text) owner to postgres;
revoke all privileges on function private.community_online_action_allowed(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.community_online_action_allowed(uuid, text)
  to authenticated;

-- The latest messaging launch gates are the authoritative predicates used by
-- message lookup, initiation, existing-conversation writes, and staff access.
create or replace function private.account_messaging_general_availability_eligible(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.community_account_is_active(p_user_id)
    and private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, 'private_messaging')
    and not private.community_has_active_restriction(p_user_id, 'commune_commenting')
    and exists (
      select 1 from private.account_participation as participation
      where participation.user_id = p_user_id
        and participation.participation_state = 'adult_eligible'
        and participation.age_band = '18_plus'
        and participation.assurance_status not in ('restricted', 'blocked', 'verification_expired')
    ), false);
$$;

create or replace function private.account_messaging_search_allowed(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.community_account_is_active(p_user_id)
    and private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, 'private_messaging')
    and not private.community_has_active_restriction(p_user_id, 'all_public_communities'),
    false
  ) and not coalesce(exists (
    select 1 from private.account_participation as participation
    where participation.user_id = p_user_id
      and participation.participation_state in (
        'restricted', 'suspended', 'blocked', 'deletion_pending', 'deactivated'
      )
  ), false);
$$;

create or replace function private.account_messaging_existing_conversation_allowed(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.community_account_is_active(p_user_id)
    and private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, 'private_messaging')
    and not private.community_has_active_restriction(p_user_id, 'commune_commenting'),
    false
  ) and not coalesce(exists (
    select 1 from private.account_participation as participation
    where participation.user_id = p_user_id
      and participation.participation_state in (
        'restricted', 'suspended', 'blocked', 'deletion_pending', 'deactivated'
      )
  ), false);
$$;

create or replace function private.account_messaging_admin_allowed(p_actor_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.community_account_is_active(p_actor_user_id)
    and private.community_account_is_recoverable(p_actor_user_id)
    and public.has_role(p_actor_user_id, 'administrator'::public.app_role)
    and coalesce((
      select profile.is_admin from public.profiles as profile where profile.id = p_actor_user_id
    ), false), false);
$$;

create or replace function private.account_message_moderator_allowed(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    private.community_account_is_active(p_user_id)
    and p_user_id is not null and (
      public.has_role(p_user_id, 'administrator'::public.app_role)
      or public.has_role(p_user_id, 'moderator'::public.app_role)
      or public.has_role(p_user_id, 'commune_moderator'::public.app_role)
      or coalesce((select profile.is_admin from public.profiles as profile where profile.id = p_user_id), false)
    ), false);
$$;

do $activation_function_hardening$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'private.account_messaging_general_availability_eligible(uuid)',
    'private.account_messaging_search_allowed(uuid)',
    'private.account_messaging_existing_conversation_allowed(uuid)',
    'private.account_messaging_admin_allowed(uuid)',
    'private.account_message_moderator_allowed(uuid)'
  ] loop
    execute 'alter function ' || v_signature || ' owner to postgres';
    execute 'revoke all privileges on function ' || v_signature || ' from public, anon, authenticated, service_role';
  end loop;
end
$activation_function_hardening$;

create or replace function public.current_user_account_activation()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '{}'::jsonb else
    coalesce((
      select pg_catalog.jsonb_build_object(
        'state', activation.activation_state,
        'temporarilyDeactivatedAt', activation.temporarily_deactivated_at,
        'reactivatedAt', activation.reactivated_at,
        'updatedAt', activation.updated_at
      )
      from private.account_activation_state as activation
      where activation.user_id = auth.uid()
    ), '{}'::jsonb)
  end;
$$;

alter function public.current_user_account_activation() owner to postgres;
revoke all privileges on function public.current_user_account_activation()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_account_activation() to authenticated;

create or replace function public.community_self_deactivate_actor(
  p_actor_user_id uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activation private.account_activation_state%rowtype;
  v_from_state text;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_actor_user_id is null
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'community_self_deactivation_not_allowed';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'self_deactivation_completed', '{}'::jsonb
  );
  if v_replay is not null then return v_replay; end if;

  select * into strict v_activation
  from private.account_activation_state
  where user_id = p_actor_user_id
  for update;
  v_from_state := v_activation.activation_state;
  if exists (
       select 1 from private.account_lifecycle_requests as request
       where request.user_id = p_actor_user_id
         and request.action = 'account_deletion'
         and request.status in (
           'submitted','identity_verification','cooling_period','operator_review',
           'processing','storage_inventory','storage_cleanup','auth_deletion_ready',
           'auth_deletion_confirmed','blocked_by_legal_hold'
         )
     ) or exists (
       select 1 from private.account_participation as participation
       where participation.user_id = p_actor_user_id
         and participation.participation_state in ('deletion_pending','deactivated')
     ) then
    raise exception using errcode = '55000', message = 'community_deletion_pending';
  end if;

  insert into private.account_activation_events(
    client_request_id, user_id, actor_user_id, action, from_state, to_state
  ) values (
    p_client_request_id, p_actor_user_id, p_actor_user_id,
    'self_deactivation_requested', v_activation.activation_state, 'temporarily_deactivated'
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id
  ) values (
    p_actor_user_id, 'user', 'self_deactivation_requested',
    'account_activation_state', p_actor_user_id, p_client_request_id
  );

  if v_activation.activation_state = 'active' then
    update private.account_activation_state
    set activation_state = 'temporarily_deactivated',
        temporarily_deactivated_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where user_id = p_actor_user_id
    returning * into strict v_activation;
  end if;

  insert into private.account_activation_events(
    client_request_id, user_id, actor_user_id, action, from_state, to_state
  ) values (
    p_client_request_id, p_actor_user_id, p_actor_user_id,
    'self_deactivation_completed', v_from_state, v_activation.activation_state
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id,
    metadata
  ) values (
    p_actor_user_id, 'user', 'self_deactivation_completed',
    'account_activation_state', p_actor_user_id, p_client_request_id,
    pg_catalog.jsonb_build_object('participationStatePreserved', true)
  );
  v_response := pg_catalog.jsonb_build_object(
    'state', v_activation.activation_state,
    'temporarilyDeactivatedAt', v_activation.temporarily_deactivated_at,
    'reactivatedAt', v_activation.reactivated_at,
    'updatedAt', v_activation.updated_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.community_self_deactivate_actor(uuid, uuid) owner to postgres;
revoke all privileges on function public.community_self_deactivate_actor(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.community_self_deactivate_actor(uuid, uuid) to service_role;

create or replace function public.community_self_reactivate_actor(
  p_actor_user_id uuid,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activation private.account_activation_state%rowtype;
  v_replay jsonb;
  v_response jsonb;
begin
  if not private.community_caller_is_service_role()
     or p_actor_user_id is null
     or not private.community_account_is_recoverable(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'community_self_reactivation_not_allowed';
  end if;
  v_replay := private.community_idempotency_begin(
    p_client_request_id, p_actor_user_id, 'self_reactivation_completed', '{}'::jsonb
  );
  if v_replay is not null then return v_replay; end if;

  select * into strict v_activation
  from private.account_activation_state
  where user_id = p_actor_user_id
  for update;
  if exists (
       select 1 from private.account_lifecycle_requests as request
       where request.user_id = p_actor_user_id
         and request.action = 'account_deletion'
         and request.status in (
           'submitted','identity_verification','cooling_period','operator_review',
           'processing','storage_inventory','storage_cleanup','auth_deletion_ready',
           'auth_deletion_confirmed','blocked_by_legal_hold'
         )
     ) or exists (
       select 1 from private.account_participation as participation
       where participation.user_id = p_actor_user_id
         and participation.participation_state in ('deletion_pending','deactivated')
     ) then
    raise exception using errcode = '55000', message = 'community_deletion_pending';
  end if;
  if v_activation.activation_state <> 'temporarily_deactivated' then
    raise exception using errcode = '55000', message = 'community_account_not_temporarily_deactivated';
  end if;

  insert into private.account_activation_events(
    client_request_id, user_id, actor_user_id, action, from_state, to_state
  ) values (
    p_client_request_id, p_actor_user_id, p_actor_user_id,
    'self_reactivation_requested', v_activation.activation_state, 'active'
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id
  ) values (
    p_actor_user_id, 'user', 'self_reactivation_requested',
    'account_activation_state', p_actor_user_id, p_client_request_id
  );

  update private.account_activation_state
  set activation_state = 'active',
      temporarily_deactivated_at = null,
      reactivated_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where user_id = p_actor_user_id
  returning * into strict v_activation;

  insert into private.account_activation_events(
    client_request_id, user_id, actor_user_id, action, from_state, to_state
  ) values (
    p_client_request_id, p_actor_user_id, p_actor_user_id,
    'self_reactivation_completed', 'temporarily_deactivated', v_activation.activation_state
  );
  insert into private.community_audit_events(
    actor_user_id, actor_kind, action, target_type, target_id, request_id,
    metadata
  ) values (
    p_actor_user_id, 'user', 'self_reactivation_completed',
    'account_activation_state', p_actor_user_id, p_client_request_id,
    pg_catalog.jsonb_build_object('participationStatePreserved', true)
  );
  v_response := pg_catalog.jsonb_build_object(
    'state', v_activation.activation_state,
    'temporarilyDeactivatedAt', v_activation.temporarily_deactivated_at,
    'reactivatedAt', v_activation.reactivated_at,
    'updatedAt', v_activation.updated_at
  );
  return private.community_idempotency_finish(p_client_request_id, v_response);
end;
$$;

alter function public.community_self_reactivate_actor(uuid, uuid) owner to postgres;
revoke all privileges on function public.community_self_reactivate_actor(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.community_self_reactivate_actor(uuid, uuid) to service_role;

create or replace function public.current_user_artisan_bootstrap()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '{}'::jsonb else
    pg_catalog.jsonb_build_object(
      'accountActivation', public.current_user_account_activation(),
      'communityAccess', coalesce(public.current_user_community_access(), '{}'::jsonb),
      'membership', (
        select pg_catalog.jsonb_build_object(
          'status', membership.status,
          'joinedAt', membership.joined_at,
          'defaultCreditLine', membership.default_credit_line,
          'defaultCreationMethod', membership.default_creation_method,
          'defaultLicenseCode', membership.default_license_code
        )
        from artisan.memberships as membership
        where membership.user_id = auth.uid()
      ),
      'profileCard', (
        select pg_catalog.jsonb_build_object(
          'handle', card.handle,
          'displayName', card.display_name,
          'avatarUrl', card.avatar_url,
          'shortPublicBio', card.short_public_bio,
          'canonicalProfileUrl', card.canonical_profile_url,
          'publicProfileEnabled', card.public_profile_enabled,
          'updatedAt', card.updated_at
        )
        from public.profile_public_cards as card
        where card.user_id = auth.uid()
      ),
      'guardianSummary', public.current_user_guardian_summary(),
      'guardianControls', pg_catalog.jsonb_build_object(
        'under13ParticipationEnabled',
          private.community_feature_enabled('artisan_under13_participation'),
        'contentApprovalEnabled',
          private.community_feature_enabled('artisan_under13_content_approval'),
        'profileEnableEnabled',
          private.community_feature_enabled('artisan_guardian_dependent_profile_controls'),
        'profileDisableAvailable', true,
        'lifecycleRequestAvailable',
          private.community_feature_enabled('artisan_guardian_dependent_lifecycle'),
        'lifecycleHistoryAvailable', true
      ),
      'legalManifest', public.current_community_legal_manifest(),
      'notificationPreferences', (
        select pg_catalog.jsonb_build_object(
          'inAppEnabled', preference.in_app_enabled,
          'emailEnabled', preference.email_enabled,
          'mentionsEnabled', preference.mentions_enabled,
          'commentsEnabled', preference.comments_enabled,
          'challengeUpdatesEnabled', preference.challenge_updates_enabled,
          'moderationUpdatesEnabled', preference.moderation_updates_enabled,
          'guardianUpdatesEnabled', preference.guardian_updates_enabled,
          'quietHoursStart', preference.quiet_hours_start,
          'quietHoursEnd', preference.quiet_hours_end,
          'updatedAt', preference.updated_at
        )
        from private.community_notification_preferences as preference
        where preference.user_id = auth.uid()
      ),
      'featureFlags', public.current_artisan_feature_manifest()
    )
  end;
$$;

alter function public.current_user_artisan_bootstrap() owner to postgres;
revoke all privileges on function public.current_user_artisan_bootstrap()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_artisan_bootstrap() to authenticated;

comment on table private.account_activation_state is
  'Reversible user-owned account pause. Never infer or overwrite canonical participation, restriction, guardian, legal, or deletion state from this row.';
comment on function public.community_self_deactivate_actor(uuid, uuid) is
  'Service-role-only self-deactivation contract. The Worker supplies only its authenticated actor; no target account parameter exists.';
comment on function public.community_self_reactivate_actor(uuid, uuid) is
  'Service-role-only self-reactivation contract. Removes only voluntary temporary deactivation and never changes participation state.';

commit;
