-- Privacy-safe exact-handle destination resolution for governed account
-- conversations. Existing conversation records and participant RLS remain
-- authoritative; this migration adds no directory or identity exposure.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '3min';

create or replace function private.account_direct_request_decline_cooldown()
returns interval
language sql
immutable
security definer
set search_path = ''
as $$
  select interval '30 days';
$$;

comment on function private.account_direct_request_decline_cooldown() is
  'Single policy point for the conservative post-decline direct-request cooldown. Change only through a reviewed additive migration.';

create or replace function private.account_direct_request_decline_cooldown_active(
  p_sender_user_id uuid,
  p_direct_pair_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists (
    select 1
    from private.account_conversations as conversation
    where conversation.conversation_type = 'direct'
      and conversation.direct_pair_key = p_direct_pair_key
      and conversation.created_by_user_id = p_sender_user_id
      and conversation.state = 'declined'
      and conversation.closed_at > pg_catalog.now()
        - private.account_direct_request_decline_cooldown()
  ), false);
$$;

comment on function private.account_direct_request_decline_cooldown_active(uuid, text) is
  'Returns only internal enforcement truth for whether a former sender remains inside the post-decline cooldown.';

create index if not exists account_conversations_declined_pair_cooldown_idx
  on private.account_conversations(
    direct_pair_key,
    created_by_user_id,
    closed_at desc
  )
  where conversation_type = 'direct' and state = 'declined';

create or replace function private.enforce_account_direct_request_decline_cooldown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.conversation_type = 'direct'
     and private.account_direct_request_decline_cooldown_active(
       new.created_by_user_id,
       new.direct_pair_key
     ) then
    raise exception using
      errcode = 'P0002',
      message = 'account_messaging_recipient_unavailable';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_account_direct_request_decline_cooldown
  on private.account_conversations;
create trigger enforce_account_direct_request_decline_cooldown
before insert on private.account_conversations
for each row
when (new.conversation_type = 'direct')
execute function private.enforce_account_direct_request_decline_cooldown();

comment on trigger enforce_account_direct_request_decline_cooldown
  on private.account_conversations is
  'Prevents a declined direct-request sender from recreating the pair during the governed cooldown; callers receive the same generic unavailable contract.';

create or replace function public.resolve_account_messaging_destination(
  p_public_handle text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_handle text := pg_catalog.lower(
    pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_public_handle, '')), '@')
  );
  v_recipient uuid;
  v_card record;
  v_pair_key text;
  v_conversation private.account_conversations%rowtype;
  v_actor_participant private.account_conversation_participants%rowtype;
  v_target_opted_in boolean := false;
  v_state text;
begin
  if v_actor is null then
    raise exception using
      errcode = '42501',
      message = 'account_messaging_authentication_required';
  end if;

  if v_handle !~ '^[a-z0-9][a-z0-9._-]{1,79}$'
     or not private.account_private_messaging_allowed(v_actor) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  select card.user_id, card.handle, card.display_name, card.avatar_url,
         card.short_public_bio
  into v_card
  from private.community_safe_online_public_profile_cards as card
  where card.handle = v_handle
  limit 1;

  if not found or v_card.user_id = v_actor then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;
  v_recipient := v_card.user_id;

  if private.account_conversation_pair_blocked(v_actor, v_recipient) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  if not private.account_private_messaging_allowed(v_recipient) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  v_pair_key := least(v_actor::text, v_recipient::text)
    || ':' || greatest(v_actor::text, v_recipient::text);

  select conversation.*
  into v_conversation
  from private.account_conversations as conversation
  where conversation.conversation_type = 'direct'
    and conversation.direct_pair_key = v_pair_key
    and conversation.state in ('requested', 'active')
  order by conversation.created_at desc, conversation.id desc
  limit 1;

  if found then
    select participant.*
    into v_actor_participant
    from private.account_conversation_participants as participant
    where participant.conversation_id = v_conversation.id
      and participant.user_id = v_actor
      and participant.participation_state <> 'removed';

    if found then
      v_state := case
        when v_conversation.state = 'active' then 'existing_active'
        when v_actor_participant.participant_role = 'requester'
          then 'existing_pending_outbound'
        else 'existing_pending_inbound'
      end;
      return pg_catalog.jsonb_build_object(
        'state', v_state,
        'profile', pg_catalog.jsonb_build_object(
          'handle', v_card.handle,
          'displayName', v_card.display_name,
          'avatarUrl', v_card.avatar_url,
          'shortPublicBio', v_card.short_public_bio
        ),
        'deepLink', '/commons-circle/signals/inbox/conversations/'
          || v_conversation.id::text
      );
    end if;
  end if;

  select coalesce(preference.receive_direct_requests, false)
  into v_target_opted_in
  from public.account_messaging_preferences as preference
  where preference.user_id = v_recipient;

  if not coalesce(v_target_opted_in, false)
     or private.account_direct_request_decline_cooldown_active(
       v_actor,
       v_pair_key
     ) then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;

  return pg_catalog.jsonb_build_object(
    'state', 'can_request',
    'profile', pg_catalog.jsonb_build_object(
      'handle', v_card.handle,
      'displayName', v_card.display_name,
      'avatarUrl', v_card.avatar_url,
      'shortPublicBio', v_card.short_public_bio
    )
  );
end;
$$;

alter function private.account_direct_request_decline_cooldown()
  owner to postgres;
alter function private.account_direct_request_decline_cooldown_active(uuid, text)
  owner to postgres;
alter function private.enforce_account_direct_request_decline_cooldown()
  owner to postgres;
alter function public.resolve_account_messaging_destination(text)
  owner to postgres;

revoke all privileges on function
  private.account_direct_request_decline_cooldown()
  from public, anon, authenticated, service_role;
revoke all privileges on function
  private.account_direct_request_decline_cooldown_active(uuid, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function
  private.enforce_account_direct_request_decline_cooldown()
  from public, anon, authenticated, service_role;
revoke all privileges on function
  public.resolve_account_messaging_destination(text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.resolve_account_messaging_destination(text)
  to authenticated;

comment on function public.resolve_account_messaging_destination(text) is
  'Read-only exact-public-handle resolver. Returns only a coarse governed destination, public profile presentation fields, and a conversation link when the caller is already a participant; unavailable causes are intentionally indistinguishable.';

commit;
