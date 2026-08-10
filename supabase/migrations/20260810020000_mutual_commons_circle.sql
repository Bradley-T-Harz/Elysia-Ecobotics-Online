-- Mutual Commons Circle relationships. Membership is private, consent-based, and never grants authority.
begin;

create table public.commons_circle_relationships (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  responded_at timestamptz,
  accepted_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commons_circle_pair_order_check check (user_low_id::text < user_high_id::text),
  constraint commons_circle_requester_check check (requested_by in (user_low_id, user_high_id)),
  constraint commons_circle_status_check check (status in ('pending', 'accepted', 'declined', 'removed')),
  constraint commons_circle_removed_by_check check (removed_by is null or removed_by in (user_low_id, user_high_id)),
  constraint commons_circle_pair_unique unique (user_low_id, user_high_id)
);

create index commons_circle_participant_low_idx
  on public.commons_circle_relationships(user_low_id, status, updated_at desc);
create index commons_circle_participant_high_idx
  on public.commons_circle_relationships(user_high_id, status, updated_at desc);

alter table public.commons_circle_relationships owner to postgres;
alter table public.commons_circle_relationships enable row level security;
revoke all privileges on table public.commons_circle_relationships from public, anon, authenticated, service_role;

create policy "circle participants read their relationships"
  on public.commons_circle_relationships for select to authenticated
  using (auth.uid() in (user_low_id, user_high_id));
grant select on table public.commons_circle_relationships to authenticated;

create or replace function private.commons_circle_profile_card(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when card.user_id is null then null else pg_catalog.jsonb_build_object(
    'handle', card.handle,
    'displayName', card.display_name,
    'avatarUrl', card.avatar_url,
    'shortPublicBio', card.short_public_bio,
    'profileUrl', '/commons-circle/@' || card.handle
  ) end
  from (select p_user_id as user_id) as requested
  left join private.community_safe_online_public_profile_cards as card
    on card.user_id = requested.user_id;
$$;

create or replace function private.commons_circle_emit(
  p_relationship_id uuid,
  p_actor uuid,
  p_recipient uuid,
  p_event text,
  p_title text,
  p_preview text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.emit_account_notification_event(
    'commons_circle.' || p_event,
    'commons_circle',
    'circle_relationship',
    p_relationship_id,
    p_actor,
    'user',
    p_recipient,
    'commons-circle:' || p_relationship_id::text || ':' || p_event,
    'suppressible',
    'community_circle',
    p_title,
    p_preview,
    '/commons-circle/signals/circle',
    'outcome'
  );
end;
$$;

create or replace function public.current_user_circle()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_accepted jsonb := '[]'::jsonb;
  v_incoming jsonb := '[]'::jsonb;
  v_sent jsonb := '[]'::jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'commons_circle_authentication_required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(item.payload order by item.sort_at desc, item.relationship_id), '[]'::jsonb)
  into v_accepted
  from (
    select relationship.id as relationship_id,
      coalesce(relationship.accepted_at, relationship.updated_at) as sort_at,
      pg_catalog.jsonb_build_object(
        'relationshipId', relationship.id,
        'status', relationship.status,
        'acceptedAt', relationship.accepted_at,
        'profile', private.commons_circle_profile_card(
          case when relationship.user_low_id = v_actor then relationship.user_high_id else relationship.user_low_id end
        )
      ) as payload
    from public.commons_circle_relationships as relationship
    where relationship.status = 'accepted'
      and v_actor in (relationship.user_low_id, relationship.user_high_id)
  ) as item
  where item.payload -> 'profile' <> 'null'::jsonb;

  select coalesce(pg_catalog.jsonb_agg(item.payload order by item.sort_at desc, item.relationship_id), '[]'::jsonb)
  into v_incoming
  from (
    select relationship.id as relationship_id, relationship.created_at as sort_at,
      pg_catalog.jsonb_build_object(
        'relationshipId', relationship.id,
        'status', relationship.status,
        'createdAt', relationship.created_at,
        'profile', private.commons_circle_profile_card(relationship.requested_by)
      ) as payload
    from public.commons_circle_relationships as relationship
    where relationship.status = 'pending'
      and v_actor in (relationship.user_low_id, relationship.user_high_id)
      and relationship.requested_by <> v_actor
  ) as item
  where item.payload -> 'profile' <> 'null'::jsonb;

  select coalesce(pg_catalog.jsonb_agg(item.payload order by item.sort_at desc, item.relationship_id), '[]'::jsonb)
  into v_sent
  from (
    select relationship.id as relationship_id, relationship.created_at as sort_at,
      pg_catalog.jsonb_build_object(
        'relationshipId', relationship.id,
        'status', relationship.status,
        'createdAt', relationship.created_at,
        'profile', private.commons_circle_profile_card(
          case when relationship.user_low_id = v_actor then relationship.user_high_id else relationship.user_low_id end
        )
      ) as payload
    from public.commons_circle_relationships as relationship
    where relationship.status = 'pending'
      and relationship.requested_by = v_actor
  ) as item
  where item.payload -> 'profile' <> 'null'::jsonb;

  return pg_catalog.jsonb_build_object(
    'accepted', v_accepted,
    'incoming', v_incoming,
    'sent', v_sent,
    'counts', pg_catalog.jsonb_build_object(
      'accepted', pg_catalog.jsonb_array_length(v_accepted),
      'incoming', pg_catalog.jsonb_array_length(v_incoming),
      'sent', pg_catalog.jsonb_array_length(v_sent)
    )
  );
end;
$$;

create or replace function public.commons_circle_state_for_handle(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_handle text := pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_handle, '')), '@'));
  v_target uuid;
  v_relationship public.commons_circle_relationships%rowtype;
  v_state text := 'unavailable';
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'commons_circle_authentication_required';
  end if;
  if v_handle !~ '^[a-z0-9][a-z0-9._-]{1,79}$' then
    return pg_catalog.jsonb_build_object('state', 'unavailable');
  end if;
  select card.user_id into v_target
  from private.community_safe_online_public_profile_cards as card
  where card.handle = v_handle limit 1;
  if v_target is null then return pg_catalog.jsonb_build_object('state', 'unavailable'); end if;
  if v_target = v_actor then return pg_catalog.jsonb_build_object('state', 'self'); end if;

  select relationship.* into v_relationship
  from public.commons_circle_relationships as relationship
  where relationship.user_low_id = least(v_actor::text, v_target::text)::uuid
    and relationship.user_high_id = greatest(v_actor::text, v_target::text)::uuid;
  if found then
    v_state := case
      when v_relationship.status = 'accepted' then 'accepted'
      when v_relationship.status = 'pending' and v_relationship.requested_by = v_actor then 'sent'
      when v_relationship.status = 'pending' then 'incoming'
      else 'can_invite'
    end;
  else
    v_state := 'can_invite';
  end if;
  return pg_catalog.jsonb_build_object(
    'state', v_state,
    'relationshipId', case when found then v_relationship.id else null end
  );
end;
$$;

create or replace function public.invite_to_commons_circle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_handle text := pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(coalesce(p_handle, '')), '@'));
  v_target uuid;
  v_low uuid;
  v_high uuid;
  v_relationship public.commons_circle_relationships%rowtype;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'commons_circle_authentication_required'; end if;
  select card.user_id into v_target from private.community_safe_online_public_profile_cards as card where card.handle = v_handle limit 1;
  if v_target is null then raise exception using errcode = 'P0002', message = 'commons_circle_profile_unavailable'; end if;
  if v_target = v_actor then raise exception using errcode = '22023', message = 'commons_circle_self_invitation_forbidden'; end if;
  if not private.community_account_is_recoverable(v_actor)
     or not private.community_account_is_recoverable(v_target) then
    raise exception using errcode = '42501', message = 'commons_circle_account_unavailable';
  end if;
  v_low := least(v_actor::text, v_target::text)::uuid;
  v_high := greatest(v_actor::text, v_target::text)::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('commons-circle:' || v_low::text || ':' || v_high::text, 0));
  select relationship.* into v_relationship from public.commons_circle_relationships as relationship
  where relationship.user_low_id = v_low and relationship.user_high_id = v_high for update;

  if found and v_relationship.status = 'accepted' then
    return pg_catalog.jsonb_build_object('state', 'accepted', 'relationshipId', v_relationship.id);
  end if;
  if found and v_relationship.status = 'pending' and v_relationship.requested_by = v_actor then
    return pg_catalog.jsonb_build_object('state', 'sent', 'relationshipId', v_relationship.id);
  end if;
  if found and v_relationship.status = 'pending' and v_relationship.requested_by = v_target then
    update public.commons_circle_relationships set status = 'accepted', responded_at = now(), accepted_at = now(), updated_at = now()
    where id = v_relationship.id returning * into v_relationship;
    perform private.commons_circle_emit(v_relationship.id, v_actor, v_target, 'accepted', 'Circle invitation accepted', 'You are now mutual Circle members.');
    return pg_catalog.jsonb_build_object('state', 'accepted', 'relationshipId', v_relationship.id);
  end if;

  insert into public.commons_circle_relationships(user_low_id, user_high_id, requested_by, status)
  values (v_low, v_high, v_actor, 'pending')
  on conflict (user_low_id, user_high_id) do update set
    requested_by = excluded.requested_by, status = 'pending', responded_at = null,
    accepted_at = null, removed_at = null, removed_by = null, created_at = now(), updated_at = now()
  returning * into v_relationship;
  perform private.commons_circle_emit(v_relationship.id, v_actor, v_target, 'invited', 'New Circle invitation', 'A Commons member invited you to become mutual Circle members.');
  return pg_catalog.jsonb_build_object('state', 'sent', 'relationshipId', v_relationship.id);
end;
$$;

create or replace function public.respond_to_commons_circle_invitation(p_relationship_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_relationship public.commons_circle_relationships%rowtype;
  v_requester uuid;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'commons_circle_authentication_required'; end if;
  select relationship.* into v_relationship from public.commons_circle_relationships as relationship
  where relationship.id = p_relationship_id for update;
  if not found or v_relationship.status <> 'pending' or v_relationship.requested_by = v_actor
     or v_actor not in (v_relationship.user_low_id, v_relationship.user_high_id) then
    raise exception using errcode = '42501', message = 'commons_circle_invitation_response_forbidden';
  end if;
  v_requester := v_relationship.requested_by;
  update public.commons_circle_relationships set
    status = case when p_accept then 'accepted' else 'declined' end,
    responded_at = now(), accepted_at = case when p_accept then now() else null end,
    updated_at = now()
  where id = p_relationship_id returning * into v_relationship;
  perform private.commons_circle_emit(
    v_relationship.id, v_actor, v_requester,
    case when p_accept then 'accepted' else 'declined' end,
    case when p_accept then 'Circle invitation accepted' else 'Circle invitation declined' end,
    case when p_accept then 'You are now mutual Circle members.' else 'Your Circle invitation was declined.' end
  );
  return pg_catalog.jsonb_build_object('state', v_relationship.status, 'relationshipId', v_relationship.id);
end;
$$;

create or replace function public.remove_from_commons_circle(p_relationship_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_relationship public.commons_circle_relationships%rowtype;
  v_other uuid;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'commons_circle_authentication_required'; end if;
  select relationship.* into v_relationship from public.commons_circle_relationships as relationship
  where relationship.id = p_relationship_id for update;
  if not found or v_relationship.status <> 'accepted'
     or v_actor not in (v_relationship.user_low_id, v_relationship.user_high_id) then
    raise exception using errcode = '42501', message = 'commons_circle_remove_forbidden';
  end if;
  v_other := case when v_relationship.user_low_id = v_actor then v_relationship.user_high_id else v_relationship.user_low_id end;
  update public.commons_circle_relationships set status = 'removed', removed_at = now(), removed_by = v_actor, updated_at = now()
  where id = p_relationship_id;
  perform private.commons_circle_emit(v_relationship.id, v_actor, v_other, 'removed', 'Circle connection ended', 'A mutual Circle connection was removed. Existing explicit private-post access is unchanged.');
  return pg_catalog.jsonb_build_object('state', 'removed', 'relationshipId', v_relationship.id);
end;
$$;

alter function private.commons_circle_profile_card(uuid) owner to postgres;
alter function private.commons_circle_emit(uuid, uuid, uuid, text, text, text) owner to postgres;
alter function public.current_user_circle() owner to postgres;
alter function public.commons_circle_state_for_handle(text) owner to postgres;
alter function public.invite_to_commons_circle(text) owner to postgres;
alter function public.respond_to_commons_circle_invitation(uuid, boolean) owner to postgres;
alter function public.remove_from_commons_circle(uuid) owner to postgres;

revoke all privileges on function private.commons_circle_profile_card(uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.commons_circle_emit(uuid, uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all privileges on function public.current_user_circle() from public, anon, authenticated, service_role;
revoke all privileges on function public.commons_circle_state_for_handle(text) from public, anon, authenticated, service_role;
revoke all privileges on function public.invite_to_commons_circle(text) from public, anon, authenticated, service_role;
revoke all privileges on function public.respond_to_commons_circle_invitation(uuid, boolean) from public, anon, authenticated, service_role;
revoke all privileges on function public.remove_from_commons_circle(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_circle() to authenticated;
grant execute on function public.commons_circle_state_for_handle(text) to authenticated;
grant execute on function public.invite_to_commons_circle(text) to authenticated;
grant execute on function public.respond_to_commons_circle_invitation(uuid, boolean) to authenticated;
grant execute on function public.remove_from_commons_circle(uuid) to authenticated;

comment on table public.commons_circle_relationships is
  'Private mutual Circle consent records. Participants only; administrators receive no ambient access.';
comment on function public.current_user_circle() is
  'Returns only the caller''s accepted, incoming, and sent Circle relationships with safe public profile cards.';

commit;
