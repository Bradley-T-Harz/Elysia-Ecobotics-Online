-- Launch governed account messaging through an explicit messaging-only policy.
-- This does not enable Artisan participation or weaken age, restriction, block,
-- cooldown, rate-limit, moderation, or participant-RLS contracts.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '3min';

create table private.account_messaging_launch_control (
  singleton boolean primary key default true check (singleton),
  launch_mode text not null check (
    launch_mode in ('disabled', 'controlled_beta', 'general_availability')
  ),
  policy_version integer not null default 1 check (policy_version > 0),
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table private.account_messaging_beta_enrollments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enrolled_at timestamptz not null default pg_catalog.now(),
  enrolled_by uuid references auth.users(id) on delete set null,
  enrollment_category text not null check (
    enrollment_category in (
      'operator_controlled_adult_test',
      'production_acceptance',
      'staff_operations'
    )
  ),
  private_reason text not null check (pg_catalog.char_length(private_reason) between 12 and 1000),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_category text check (
    revocation_category is null or revocation_category in (
      'operator_revoked',
      'safety_review',
      'acceptance_complete'
    )
  ),
  revocation_reason text check (
    revocation_reason is null or pg_catalog.char_length(revocation_reason) between 12 and 1000
  ),
  updated_at timestamptz not null default pg_catalog.now(),
  check (
    (revoked_at is null and revoked_by is null and revocation_category is null and revocation_reason is null)
    or
    (revoked_at is not null and revocation_category is not null and revocation_reason is not null)
  )
);

create table private.account_messaging_beta_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  client_request_id uuid not null unique,
  actor_user_id uuid not null,
  actor_aal text not null check (actor_aal in ('aal1', 'aal2')),
  target_user_id uuid,
  action text not null check (action in ('enrolled', 'revoked', 'launch_mode_changed')),
  category text not null check (pg_catalog.char_length(category) between 3 and 80),
  launch_mode text check (
    launch_mode is null or launch_mode in ('disabled', 'controlled_beta', 'general_availability')
  ),
  private_reason text not null check (pg_catalog.char_length(private_reason) between 12 and 1000),
  created_at timestamptz not null default pg_catalog.now(),
  check (
    (action = 'launch_mode_changed' and target_user_id is null and launch_mode is not null)
    or
    (action in ('enrolled', 'revoked') and target_user_id is not null and launch_mode is null)
  )
);

create index account_messaging_beta_active_idx
  on private.account_messaging_beta_enrollments(user_id)
  where revoked_at is null;
create index account_messaging_beta_actions_target_idx
  on private.account_messaging_beta_actions(target_user_id, created_at desc)
  where target_user_id is not null;

alter table private.account_messaging_launch_control enable row level security;
alter table private.account_messaging_launch_control force row level security;
alter table private.account_messaging_beta_enrollments enable row level security;
alter table private.account_messaging_beta_enrollments force row level security;
alter table private.account_messaging_beta_actions enable row level security;
alter table private.account_messaging_beta_actions force row level security;

revoke all privileges on table private.account_messaging_launch_control
  from public, anon, authenticated, service_role;
revoke all privileges on table private.account_messaging_beta_enrollments
  from public, anon, authenticated, service_role;
revoke all privileges on table private.account_messaging_beta_actions
  from public, anon, authenticated, service_role;

insert into private.account_messaging_launch_control(singleton, launch_mode)
values (true, 'controlled_beta')
on conflict (singleton) do nothing;

create or replace function private.account_messaging_audit_is_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'account_messaging_audit_is_immutable';
end;
$$;

create trigger account_messaging_beta_actions_are_append_only
before update or delete on private.account_messaging_beta_actions
for each row execute function private.account_messaging_audit_is_immutable();

create or replace function private.account_messaging_launch_mode()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select control.launch_mode
    from private.account_messaging_launch_control as control
    where control.singleton
  ), 'disabled');
$$;

create or replace function private.account_messaging_beta_enrolled(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from private.account_messaging_beta_enrollments as enrollment
    where enrollment.user_id = p_user_id
      and enrollment.revoked_at is null
  ), false);
$$;

create or replace function private.account_messaging_general_availability_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_user_id)
    and not private.community_has_active_restriction(p_user_id, 'private_messaging')
    and not private.community_has_active_restriction(p_user_id, 'commune_commenting')
    and exists (
      select 1
      from private.account_participation as participation
      where participation.user_id = p_user_id
        and participation.participation_state = 'adult_eligible'
        and participation.age_band = '18_plus'
        and participation.assurance_status not in ('restricted', 'blocked', 'verification_expired')
    ),
    false
  );
$$;

create or replace function private.account_messaging_search_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_user_id)
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
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_user_id)
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

create or replace function private.account_messaging_initiation_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.account_messaging_launch_mode()
    when 'controlled_beta' then
      private.account_messaging_existing_conversation_allowed(p_user_id)
      and private.account_messaging_beta_enrolled(p_user_id)
    when 'general_availability' then
      private.account_messaging_general_availability_eligible(p_user_id)
    else false
  end;
$$;

-- Compatibility helper: existing participant use is deliberately independent
-- of incoming-request opt-in, controlled-beta enrollment, and the new-initiation
-- kill switch. New conversation creation is enforced by the dedicated trigger.
create or replace function private.account_private_messaging_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.account_messaging_existing_conversation_allowed(p_user_id);
$$;

create or replace function private.enforce_account_messaging_launch_on_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.conversation_type in ('direct', 'source_linked')
     and not private.account_messaging_initiation_allowed(new.created_by_user_id) then
    raise exception using
      errcode = '42501',
      message = case when new.conversation_type = 'direct'
        then 'account_private_messaging_not_allowed'
        else 'account_source_conversation_not_allowed' end;
  end if;
  return new;
end;
$$;

create trigger enforce_account_messaging_launch_on_conversation
before insert on private.account_conversations
for each row execute function private.enforce_account_messaging_launch_on_conversation();

create or replace function private.enforce_account_messaging_launch_on_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation private.account_conversations%rowtype;
begin
  select conversation.* into strict v_conversation
  from private.account_conversations as conversation
  where conversation.id = new.conversation_id;
  if v_conversation.conversation_type in ('direct', 'source_linked')
     and not private.account_messaging_initiation_allowed(new.user_id) then
    raise exception using
      errcode = case when v_conversation.conversation_type = 'direct' then 'P0002' else '42501' end,
      message = case when v_conversation.conversation_type = 'direct'
        then 'account_messaging_recipient_unavailable'
        else 'account_source_conversation_not_allowed' end;
  end if;
  return new;
end;
$$;

create trigger enforce_account_messaging_launch_on_participant
before insert on private.account_conversation_participants
for each row execute function private.enforce_account_messaging_launch_on_participant();

create or replace function public.current_user_messaging_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_preference public.account_messaging_preferences%rowtype;
  v_launch_mode text;
  v_beta_enrolled boolean;
  v_can_search boolean;
  v_can_initiate boolean;
  v_can_use_existing boolean;
  v_public_handle text;
  v_owner_status text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  select preference.* into v_preference
  from public.account_messaging_preferences as preference
  where preference.user_id = v_actor;
  v_launch_mode := private.account_messaging_launch_mode();
  v_beta_enrolled := private.account_messaging_beta_enrolled(v_actor);
  v_can_search := private.account_messaging_search_allowed(v_actor);
  v_can_initiate := private.account_messaging_initiation_allowed(v_actor);
  v_can_use_existing := private.account_messaging_existing_conversation_allowed(v_actor);
  select card.handle into v_public_handle
  from private.community_safe_online_public_profile_cards as card
  where card.user_id = v_actor limit 1;
  v_owner_status := case
    when v_launch_mode = 'disabled' then 'temporarily_unavailable'
    when v_can_initiate then 'enabled'
    when v_launch_mode = 'controlled_beta' and v_can_search and not v_beta_enrolled
      then 'beta_access_required'
    when not private.community_account_is_recoverable(v_actor)
      then 'account_attention_required'
    else 'restricted_or_unavailable'
  end;
  return pg_catalog.jsonb_build_object(
    'preferenceVersion', coalesce(v_preference.preference_version, 0),
    'receiveDirectRequests', coalesce(v_preference.receive_direct_requests, false),
    'receiveOptionalAnnouncements', coalesce(v_preference.receive_optional_announcements, false),
    'allowSourceLinkedMessages', coalesce(v_preference.allow_source_linked_messages, true),
    'ordinaryMessagingEligible', v_can_initiate,
    'broadMessagingEligibility', v_can_initiate,
    'canSearchPublishedProfiles', v_can_search,
    'canInitiateDirectConversation', v_can_initiate,
    'acceptsIncomingDirectRequests', coalesce(v_preference.receive_direct_requests, false),
    'canUseExistingConversations', v_can_use_existing,
    'messagingLaunchMode', v_launch_mode,
    'betaEnrolled', v_beta_enrolled,
    'ownerMessagingStatus', v_owner_status,
    'currentPublicHandle', v_public_handle,
    'storedInSupabase', true,
    'endToEndEncrypted', false
  );
end;
$$;

create or replace function public.update_current_user_messaging_preferences(
  p_receive_direct_requests boolean,
  p_receive_optional_announcements boolean,
  p_allow_source_linked_messages boolean,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_preference public.account_messaging_preferences%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  if coalesce(p_receive_direct_requests, false)
     and not private.account_messaging_initiation_allowed(v_actor) then
    raise exception using errcode = '42501', message = 'account_private_messaging_not_allowed';
  end if;
  select preference.* into v_preference
  from public.account_messaging_preferences as preference
  where preference.user_id = v_actor for update;
  if found then
    if p_expected_version is not null and p_expected_version <> v_preference.preference_version then
      raise exception using errcode = '40001', message = 'account_messaging_preference_version_conflict';
    end if;
    update public.account_messaging_preferences
    set receive_direct_requests = coalesce(p_receive_direct_requests, receive_direct_requests),
        receive_optional_announcements = coalesce(p_receive_optional_announcements, receive_optional_announcements),
        allow_source_linked_messages = coalesce(p_allow_source_linked_messages, allow_source_linked_messages),
        preference_version = preference_version + 1,
        updated_at = pg_catalog.now()
    where user_id = v_actor returning * into v_preference;
  else
    if p_expected_version is not null and p_expected_version <> 0 then
      raise exception using errcode = '40001', message = 'account_messaging_preference_version_conflict';
    end if;
    insert into public.account_messaging_preferences(
      user_id, receive_direct_requests, receive_optional_announcements, allow_source_linked_messages
    ) values (
      v_actor, coalesce(p_receive_direct_requests, false),
      coalesce(p_receive_optional_announcements, false), coalesce(p_allow_source_linked_messages, true)
    ) returning * into v_preference;
  end if;
  return public.current_user_messaging_preferences();
end;
$$;

create or replace function public.search_public_commons_message_profiles_for_actor(
  p_actor_user_id uuid,
  p_query text,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_query, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 8);
  v_items jsonb := '[]'::jsonb;
begin
  if p_actor_user_id is null
     or pg_catalog.char_length(v_query) < 3
     or pg_catalog.char_length(v_query) > 80
     or not private.account_messaging_search_allowed(p_actor_user_id) then
    return pg_catalog.jsonb_build_object('items', v_items, 'minimumQueryLength', 3, 'resultLimit', v_limit);
  end if;
  v_query := pg_catalog.lower(pg_catalog.ltrim(v_query, '@'));
  if pg_catalog.char_length(v_query) < 3 or v_query ~ '[[:cntrl:]]' then
    return pg_catalog.jsonb_build_object('items', v_items, 'minimumQueryLength', 3, 'resultLimit', v_limit);
  end if;
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'handle', result.handle,
      'displayName', result.display_name,
      'avatarUrl', result.avatar_url,
      'shortPublicBio', result.short_public_bio
    ) order by result.rank_order, result.handle
  ), '[]'::jsonb)
  into v_items
  from (
    select card.handle, card.display_name, card.avatar_url, card.short_public_bio,
      case
        when pg_catalog.lower(card.handle) = v_query then 0
        when pg_catalog.strpos(pg_catalog.lower(card.handle), v_query) = 1 then 1
        when card.display_name is not null and pg_catalog.strpos(pg_catalog.lower(card.display_name), v_query) = 1 then 2
        when pg_catalog.strpos(pg_catalog.lower(card.handle), v_query) > 0 then 3
        else 4
      end as rank_order
    from private.community_safe_online_public_profile_cards as card
    where card.user_id <> p_actor_user_id
      and (
        pg_catalog.strpos(pg_catalog.lower(card.handle), v_query) > 0
        or (card.display_name is not null and pg_catalog.strpos(pg_catalog.lower(card.display_name), v_query) > 0)
      )
    order by rank_order, card.handle
    limit v_limit
  ) as result;
  return pg_catalog.jsonb_build_object('items', v_items, 'minimumQueryLength', 3, 'resultLimit', v_limit);
end;
$$;

create or replace function public.resolve_account_messaging_destination(p_public_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_handle text := pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_public_handle, '')), '@'));
  v_recipient uuid;
  v_card record;
  v_pair_key text;
  v_conversation private.account_conversations%rowtype;
  v_actor_participant private.account_conversation_participants%rowtype;
  v_target_opted_in boolean := false;
  v_state text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'account_messaging_authentication_required';
  end if;
  if v_handle !~ '^[a-z0-9][a-z0-9._-]{1,79}$'
     or not private.account_messaging_search_allowed(v_actor) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;
  select card.user_id, card.handle, card.display_name, card.avatar_url, card.short_public_bio
  into v_card
  from private.community_safe_online_public_profile_cards as card
  where card.handle = v_handle limit 1;
  if not found or v_card.user_id = v_actor then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;
  v_recipient := v_card.user_id;
  if private.account_conversation_pair_blocked(v_actor, v_recipient) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;
  v_pair_key := least(v_actor::text, v_recipient::text) || ':' || greatest(v_actor::text, v_recipient::text);
  select conversation.* into v_conversation
  from private.account_conversations as conversation
  where conversation.conversation_type = 'direct'
    and conversation.direct_pair_key = v_pair_key
    and conversation.state in ('requested', 'active')
  order by conversation.created_at desc, conversation.id desc limit 1;
  if found and private.account_messaging_existing_conversation_allowed(v_actor) then
    select participant.* into v_actor_participant
    from private.account_conversation_participants as participant
    where participant.conversation_id = v_conversation.id
      and participant.user_id = v_actor
      and participant.participation_state <> 'removed';
    if found then
      v_state := case
        when v_conversation.state = 'active' then 'existing_active'
        when v_actor_participant.participant_role = 'requester' then 'existing_pending_outbound'
        else 'existing_pending_inbound' end;
      return pg_catalog.jsonb_build_object(
        'state', v_state,
        'profile', pg_catalog.jsonb_build_object(
          'handle', v_card.handle, 'displayName', v_card.display_name,
          'avatarUrl', v_card.avatar_url, 'shortPublicBio', v_card.short_public_bio
        ),
        'deepLink', '/commons-circle/signals/inbox/conversations/' || v_conversation.id::text
      );
    end if;
  end if;
  if not private.account_messaging_initiation_allowed(v_actor)
     or not private.account_messaging_initiation_allowed(v_recipient) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;
  select coalesce(preference.receive_direct_requests, false) into v_target_opted_in
  from public.account_messaging_preferences as preference
  where preference.user_id = v_recipient;
  if not coalesce(v_target_opted_in, false)
     or private.account_direct_request_decline_cooldown_active(v_actor, v_pair_key) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;
  return pg_catalog.jsonb_build_object(
    'state', 'can_request',
    'profile', pg_catalog.jsonb_build_object(
      'handle', v_card.handle, 'displayName', v_card.display_name,
      'avatarUrl', v_card.avatar_url, 'shortPublicBio', v_card.short_public_bio
    )
  );
end;
$$;

create or replace function private.account_messaging_admin_allowed(p_actor_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.community_account_is_recoverable(p_actor_user_id)
    and public.has_role(p_actor_user_id, 'administrator'::public.app_role)
    and coalesce((
      select profile.is_admin from public.profiles as profile where profile.id = p_actor_user_id
    ), false),
    false
  );
$$;

create or replace function public.current_account_messaging_admin_status(
  p_actor_user_id uuid,
  p_target_handle text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_handle text := pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_target_handle, '')), '@'));
  v_card record;
  v_target_state text;
  v_target_found boolean := false;
  v_target jsonb := null;
begin
  if not private.community_caller_is_service_role()
     or not private.account_messaging_admin_allowed(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'account_messaging_admin_required';
  end if;
  if v_handle <> '' and v_handle !~ '^[a-z0-9][a-z0-9._-]{1,79}$' then
    raise exception using errcode = '22023', message = 'account_messaging_admin_target_invalid';
  end if;
  if v_handle <> '' then
    select base.user_id, base.handle,
           safe.display_name, safe.avatar_url, safe.short_public_bio,
           safe.user_id is not null as published
    into v_card
    from public.profile_public_cards as base
    left join private.community_safe_online_public_profile_cards as safe
      on safe.user_id = base.user_id
    where base.handle = v_handle
    limit 1;
    v_target_found := found;
  end if;
  if v_target_found then
    v_target_state := case
      when not v_card.published then 'unpublished'
      when private.account_messaging_initiation_allowed(v_card.user_id) then 'enabled'
      when private.account_messaging_beta_enrolled(v_card.user_id) then 'restricted_or_unavailable'
      when private.account_messaging_existing_conversation_allowed(v_card.user_id) then 'eligible_for_enrollment'
      else 'restricted_or_unavailable' end;
    v_target := pg_catalog.jsonb_build_object(
      'handle', v_card.handle, 'displayName', v_card.display_name,
      'avatarUrl', v_card.avatar_url, 'shortPublicBio', v_card.short_public_bio,
      'published', v_card.published,
      'betaEnrolled', private.account_messaging_beta_enrolled(v_card.user_id),
      'status', v_target_state
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'authorized', true,
    'launchMode', private.account_messaging_launch_mode(),
    'generalAvailabilityReady', false,
    'target', v_target
  );
end;
$$;

create or replace function public.set_account_messaging_beta_enrollment(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_target_handle text,
  p_enabled boolean,
  p_category text,
  p_confirmation text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_target_handle, '')), '@'));
  v_target_user_id uuid;
  v_target_published boolean := false;
  v_expected_confirmation text;
  v_existing private.account_messaging_beta_actions%rowtype;
begin
  if not private.community_caller_is_service_role()
     or not private.account_messaging_admin_allowed(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'account_messaging_admin_required';
  end if;
  if p_actor_aal not in ('aal1', 'aal2')
     or p_client_request_id is null
     or v_handle !~ '^[a-z0-9][a-z0-9._-]{1,79}$'
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 12 and 1000 then
    raise exception using errcode = '22023', message = 'account_messaging_enrollment_invalid';
  end if;
  if p_enabled and p_category not in ('operator_controlled_adult_test', 'production_acceptance', 'staff_operations') then
    raise exception using errcode = '22023', message = 'account_messaging_enrollment_invalid';
  end if;
  if not p_enabled and p_category not in ('operator_revoked', 'safety_review', 'acceptance_complete') then
    raise exception using errcode = '22023', message = 'account_messaging_enrollment_invalid';
  end if;
  v_expected_confirmation := case when p_enabled then 'ENABLE @' else 'REVOKE @' end || v_handle;
  if p_confirmation is distinct from v_expected_confirmation then
    raise exception using errcode = '22023', message = 'account_messaging_enrollment_confirmation_required';
  end if;
  select base.user_id,
         exists (
           select 1 from private.community_safe_online_public_profile_cards as safe
           where safe.user_id = base.user_id
         )
  into v_target_user_id, v_target_published
  from public.profile_public_cards as base
  where base.handle = v_handle limit 1;
  if v_target_user_id is null
     or (p_enabled and not v_target_published)
     or (p_enabled and not private.community_account_is_recoverable(v_target_user_id))
     or (p_enabled and private.community_has_active_restriction(v_target_user_id, 'private_messaging'))
     or (p_enabled and private.community_has_active_restriction(v_target_user_id, 'commune_commenting')) then
    raise exception using errcode = 'P0002', message = 'account_messaging_admin_target_unavailable';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-messaging-beta-action:' || p_client_request_id::text, 0)
  );
  select action.* into v_existing
  from private.account_messaging_beta_actions as action
  where action.client_request_id = p_client_request_id;
  if found then
    if v_existing.actor_user_id <> p_actor_user_id
       or v_existing.target_user_id <> v_target_user_id
       or v_existing.action <> (case when p_enabled then 'enrolled' else 'revoked' end) then
      raise exception using errcode = '23505', message = 'account_messaging_enrollment_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object('handle', v_handle, 'betaEnrolled', p_enabled, 'launchMode', private.account_messaging_launch_mode());
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account-messaging-beta:' || v_target_user_id::text, 0));
  if p_enabled then
    insert into private.account_messaging_beta_enrollments(
      user_id, enrolled_by, enrollment_category, private_reason,
      revoked_at, revoked_by, revocation_category, revocation_reason, updated_at
    ) values (
      v_target_user_id, p_actor_user_id, p_category, pg_catalog.btrim(p_private_reason),
      null, null, null, null, pg_catalog.now()
    ) on conflict (user_id) do update set
      enrolled_at = pg_catalog.now(), enrolled_by = excluded.enrolled_by,
      enrollment_category = excluded.enrollment_category, private_reason = excluded.private_reason,
      revoked_at = null, revoked_by = null, revocation_category = null,
      revocation_reason = null, updated_at = pg_catalog.now();
  else
    update private.account_messaging_beta_enrollments
    set revoked_at = pg_catalog.now(), revoked_by = p_actor_user_id,
        revocation_category = p_category, revocation_reason = pg_catalog.btrim(p_private_reason),
        updated_at = pg_catalog.now()
    where user_id = v_target_user_id and revoked_at is null;
    if not found then
      raise exception using errcode = '55000', message = 'account_messaging_enrollment_not_active';
    end if;
  end if;
  insert into private.account_messaging_beta_actions(
    client_request_id, actor_user_id, actor_aal, target_user_id,
    action, category, private_reason
  ) values (
    p_client_request_id, p_actor_user_id, p_actor_aal, v_target_user_id,
    case when p_enabled then 'enrolled' else 'revoked' end,
    p_category, pg_catalog.btrim(p_private_reason)
  );
  return pg_catalog.jsonb_build_object(
    'handle', v_handle, 'betaEnrolled', p_enabled,
    'launchMode', private.account_messaging_launch_mode()
  );
end;
$$;

create or replace function public.set_account_messaging_launch_mode(
  p_actor_user_id uuid,
  p_actor_aal text,
  p_client_request_id uuid,
  p_launch_mode text,
  p_confirmation text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing private.account_messaging_beta_actions%rowtype;
begin
  if not private.community_caller_is_service_role()
     or not private.account_messaging_admin_allowed(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'account_messaging_admin_required';
  end if;
  if p_actor_aal not in ('aal1', 'aal2') or p_client_request_id is null
     or p_launch_mode not in ('disabled', 'controlled_beta')
     or p_confirmation is distinct from 'SET ' || p_launch_mode
     or pg_catalog.char_length(coalesce(p_private_reason, '')) not between 12 and 1000 then
    raise exception using errcode = '22023', message = 'account_messaging_launch_mode_invalid';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-messaging-launch-action:' || p_client_request_id::text, 0)
  );
  select action.* into v_existing
  from private.account_messaging_beta_actions as action
  where action.client_request_id = p_client_request_id;
  if found then
    if v_existing.actor_user_id <> p_actor_user_id
       or v_existing.action <> 'launch_mode_changed'
       or v_existing.launch_mode <> p_launch_mode then
      raise exception using errcode = '23505', message = 'account_messaging_launch_idempotency_conflict';
    end if;
    return pg_catalog.jsonb_build_object('launchMode', p_launch_mode);
  end if;
  update private.account_messaging_launch_control
  set launch_mode = p_launch_mode, policy_version = policy_version + 1,
      updated_at = pg_catalog.now(), updated_by = p_actor_user_id
  where singleton;
  insert into private.account_messaging_beta_actions(
    client_request_id, actor_user_id, actor_aal, action, category, launch_mode, private_reason
  ) values (
    p_client_request_id, p_actor_user_id, p_actor_aal,
    'launch_mode_changed', 'operator_launch_control', p_launch_mode,
    pg_catalog.btrim(p_private_reason)
  );
  return pg_catalog.jsonb_build_object('launchMode', p_launch_mode);
end;
$$;

alter table private.account_messaging_launch_control owner to postgres;
alter table private.account_messaging_beta_enrollments owner to postgres;
alter table private.account_messaging_beta_actions owner to postgres;

alter function private.account_messaging_audit_is_immutable() owner to postgres;
alter function private.account_messaging_launch_mode() owner to postgres;
alter function private.account_messaging_beta_enrolled(uuid) owner to postgres;
alter function private.account_messaging_general_availability_eligible(uuid) owner to postgres;
alter function private.account_messaging_search_allowed(uuid) owner to postgres;
alter function private.account_messaging_existing_conversation_allowed(uuid) owner to postgres;
alter function private.account_messaging_initiation_allowed(uuid) owner to postgres;
alter function private.account_private_messaging_allowed(uuid) owner to postgres;
alter function private.enforce_account_messaging_launch_on_conversation() owner to postgres;
alter function private.enforce_account_messaging_launch_on_participant() owner to postgres;
alter function private.account_messaging_admin_allowed(uuid) owner to postgres;
alter function public.current_user_messaging_preferences() owner to postgres;
alter function public.update_current_user_messaging_preferences(boolean, boolean, boolean, integer) owner to postgres;
alter function public.search_public_commons_message_profiles_for_actor(uuid, text, integer) owner to postgres;
alter function public.resolve_account_messaging_destination(text) owner to postgres;
alter function public.current_account_messaging_admin_status(uuid, text) owner to postgres;
alter function public.set_account_messaging_beta_enrollment(uuid, text, uuid, text, boolean, text, text, text) owner to postgres;
alter function public.set_account_messaging_launch_mode(uuid, text, uuid, text, text, text) owner to postgres;

revoke all privileges on function private.account_messaging_audit_is_immutable() from public, anon, authenticated, service_role;
revoke all privileges on function private.account_messaging_launch_mode() from public, anon, authenticated, service_role;
revoke all privileges on function private.account_messaging_beta_enrolled(uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.account_messaging_general_availability_eligible(uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.account_messaging_search_allowed(uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.account_messaging_existing_conversation_allowed(uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.account_messaging_initiation_allowed(uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.account_private_messaging_allowed(uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_account_messaging_launch_on_conversation() from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_account_messaging_launch_on_participant() from public, anon, authenticated, service_role;
revoke all privileges on function private.account_messaging_admin_allowed(uuid) from public, anon, authenticated, service_role;

revoke all privileges on function public.current_user_messaging_preferences() from public, anon, authenticated, service_role;
grant execute on function public.current_user_messaging_preferences() to authenticated, service_role;
revoke all privileges on function public.update_current_user_messaging_preferences(boolean, boolean, boolean, integer) from public, anon, authenticated, service_role;
grant execute on function public.update_current_user_messaging_preferences(boolean, boolean, boolean, integer) to authenticated, service_role;
revoke all privileges on function public.search_public_commons_message_profiles_for_actor(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.search_public_commons_message_profiles_for_actor(uuid, text, integer) to service_role;
revoke all privileges on function public.resolve_account_messaging_destination(text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_account_messaging_destination(text) to authenticated, service_role;
revoke all privileges on function public.current_account_messaging_admin_status(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.current_account_messaging_admin_status(uuid, text) to service_role;
revoke all privileges on function public.set_account_messaging_beta_enrollment(uuid, text, uuid, text, boolean, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_account_messaging_beta_enrollment(uuid, text, uuid, text, boolean, text, text, text) to service_role;
revoke all privileges on function public.set_account_messaging_launch_mode(uuid, text, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_account_messaging_launch_mode(uuid, text, uuid, text, text, text) to service_role;

comment on table private.account_messaging_launch_control is
  'Single messaging-only launch policy. Controlled beta is independent from Artisan participation flags; general availability remains unavailable until a reviewed adult-participation provider is operational.';
comment on table private.account_messaging_beta_enrollments is
  'Current explicit controlled-beta enrollment state. Enrollment never grants source, staff, review, moderation, or Artisan authority and never bypasses messaging restrictions.';
comment on table private.account_messaging_beta_actions is
  'Append-only audit evidence for controlled-beta enrollment and messaging launch-mode changes.';
comment on function private.account_messaging_search_allowed(uuid) is
  'Authenticated public-profile discovery capability, independent of enrollment and incoming-request opt-in, while retaining recoverability and strong safety restrictions.';
comment on function private.account_messaging_initiation_allowed(uuid) is
  'New direct/source-linked conversation capability derived from one launch mode, explicit controlled-beta enrollment or reviewed general-availability eligibility, and existing safety restrictions.';
comment on function private.account_private_messaging_allowed(uuid) is
  'Compatibility helper for participant use of existing direct/source-linked conversations. New creation is separately enforced and user preferences never grant authority.';
comment on function public.current_account_messaging_admin_status(uuid, text) is
  'Service-only, dual-administrator-authority status using an exact public handle and public-safe target fields; no private IDs or restriction reasons are returned.';
comment on function public.set_account_messaging_beta_enrollment(uuid, text, uuid, text, boolean, text, text, text) is
  'Service-only, explicit, confirmed, idempotent, audited controlled-beta enrollment. It does not enable Artisan or bypass blocks, restrictions, cooldowns, rate limits, or participant RLS.';
comment on function public.set_account_messaging_launch_mode(uuid, text, uuid, text, text, text) is
  'Service-only audited kill switch for disabled or controlled-beta messaging launch modes. General availability cannot be activated until a later reviewed provider-readiness migration.';

commit;
