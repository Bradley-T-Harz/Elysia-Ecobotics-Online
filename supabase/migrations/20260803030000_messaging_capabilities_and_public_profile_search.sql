-- Separate outbound messaging capability from inbound request opt-in and add
-- one service-only, bounded public-profile discovery projection.
begin;

-- Keep the established preference keys for compatibility while exposing the
-- four distinct capabilities the client needs to explain ordinary messaging
-- without conflating outbound initiation with inbound request opt-in.
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
  v_broad_eligible boolean := false;
  v_public_handle text;
begin
  if v_actor is null then
    raise exception using
      errcode = '42501',
      message = 'account_messaging_authentication_required';
  end if;

  select preference.*
  into v_preference
  from public.account_messaging_preferences as preference
  where preference.user_id = v_actor;

  v_broad_eligible := private.account_private_messaging_allowed(v_actor);

  select card.handle
  into v_public_handle
  from private.community_safe_online_public_profile_cards as card
  where card.user_id = v_actor
  limit 1;

  return pg_catalog.jsonb_build_object(
    'preferenceVersion', coalesce(v_preference.preference_version, 0),
    'receiveDirectRequests', coalesce(v_preference.receive_direct_requests, false),
    'receiveOptionalAnnouncements', coalesce(v_preference.receive_optional_announcements, false),
    'allowSourceLinkedMessages', coalesce(v_preference.allow_source_linked_messages, true),
    'ordinaryMessagingEligible', v_broad_eligible,
    'broadMessagingEligibility', v_broad_eligible,
    'canInitiateDirectConversation', v_broad_eligible,
    'acceptsIncomingDirectRequests', coalesce(v_preference.receive_direct_requests, false),
    'canUseExistingConversations', v_broad_eligible,
    'currentPublicHandle', v_public_handle,
    'storedInSupabase', true,
    'endToEndEncrypted', false
  );
end;
$$;

alter function public.current_user_messaging_preferences() owner to postgres;
revoke all privileges on function public.current_user_messaging_preferences()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_messaging_preferences()
  to authenticated, service_role;

comment on function public.current_user_messaging_preferences() is
  'Returns versioned messaging preferences plus separate broad eligibility, outbound-initiation, inbound-opt-in, and existing-conversation capability fields. The legacy ordinaryMessagingEligible key remains as a compatibility alias and does not include inbound opt-in.';

-- This service-only projection is called by the authenticated Identity Worker.
-- The Worker supplies the already-verified actor, applies the per-user edge
-- rate limit, and never exposes this explicit actor parameter to the browser.
-- The function itself performs no write and returns only public presentation
-- fields from the canonical Online public-profile projection.
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
     or not private.account_private_messaging_allowed(p_actor_user_id) then
    return pg_catalog.jsonb_build_object(
      'items', v_items,
      'minimumQueryLength', 3,
      'resultLimit', v_limit
    );
  end if;

  v_query := pg_catalog.lower(pg_catalog.ltrim(v_query, '@'));
  if pg_catalog.char_length(v_query) < 3
     or v_query ~ '[[:cntrl:]]' then
    return pg_catalog.jsonb_build_object(
      'items', v_items,
      'minimumQueryLength', 3,
      'resultLimit', v_limit
    );
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'handle', result.handle,
        'displayName', result.display_name,
        'avatarUrl', result.avatar_url,
        'shortPublicBio', result.short_public_bio
      )
      order by result.rank_order, result.handle
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      card.handle,
      card.display_name,
      card.avatar_url,
      card.short_public_bio,
      case
        when pg_catalog.lower(card.handle) = v_query then 0
        when pg_catalog.strpos(pg_catalog.lower(card.handle), v_query) = 1 then 1
        when card.display_name is not null
          and pg_catalog.strpos(pg_catalog.lower(card.display_name), v_query) = 1 then 2
        when pg_catalog.strpos(pg_catalog.lower(card.handle), v_query) > 0 then 3
        else 4
      end as rank_order
    from private.community_safe_online_public_profile_cards as card
    where card.user_id <> p_actor_user_id
      and (
        pg_catalog.strpos(pg_catalog.lower(card.handle), v_query) > 0
        or (
          card.display_name is not null
          and pg_catalog.strpos(pg_catalog.lower(card.display_name), v_query) > 0
        )
      )
    order by rank_order, card.handle
    limit v_limit
  ) as result;

  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'minimumQueryLength', 3,
    'resultLimit', v_limit
  );
end;
$$;

alter function public.search_public_commons_message_profiles_for_actor(uuid, text, integer)
  owner to postgres;
revoke all privileges on function
  public.search_public_commons_message_profiles_for_actor(uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function
  public.search_public_commons_message_profiles_for_actor(uuid, text, integer)
  to service_role;

comment on function public.search_public_commons_message_profiles_for_actor(uuid, text, integer) is
  'Service-only bounded search over published Online Commons Profiles for the authenticated messaging-discovery Worker. Returns no identifiers or private availability state, excludes the actor, caps results at eight, and performs no write.';

commit;
