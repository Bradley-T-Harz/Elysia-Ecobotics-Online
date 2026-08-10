-- Owner-controlled review of durable private-post ACLs after Circle removal.
-- Circle controls new invitation eligibility; existing per-post access remains explicit.
begin;

create or replace function public.current_user_circle_access_review()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_members jsonb := '[]'::jsonb;
  v_post_count integer := 0;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'commons_circle_authentication_required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'relationshipId', item.relationship_id,
      'profile', item.profile,
      'privatePostCount', item.private_post_count,
      'posts', item.posts
    ) order by pg_catalog.lower(coalesce(item.profile ->> 'displayName', item.profile ->> 'handle')), item.relationship_id
  ), '[]'::jsonb)
  into v_members
  from (
    select
      relationship.id as relationship_id,
      private.commons_circle_profile_card(access.participant_user_id) as profile,
      pg_catalog.count(*)::integer as private_post_count,
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'accessId', access.id,
          'postId', post.id,
          'title', post.title,
          'postType', post.post_type,
          'postUrl', '/commune/posts/' || post.id::text,
          'sharedAt', access.created_at
        ) order by coalesce(post.last_activity_at, post.published_at, post.created_at, access.created_at) desc, post.id
      ) as posts
    from public.commune_post_circle_participants as access
    join public.commune_posts as post on post.id = access.post_id
    join public.commons_circle_relationships as relationship on relationship.id = access.circle_relationship_id
    where post.user_id = v_actor
      and post.audience = 'circle'
      and access.removed_at is null
      and relationship.status <> 'accepted'
      and v_actor in (relationship.user_low_id, relationship.user_high_id)
      and access.participant_user_id in (relationship.user_low_id, relationship.user_high_id)
      and access.participant_user_id <> v_actor
    group by relationship.id, access.participant_user_id
  ) as item
  where item.profile <> 'null'::jsonb;

  select coalesce(pg_catalog.sum((review_member.value ->> 'privatePostCount')::integer), 0)::integer
  into v_post_count
  from pg_catalog.jsonb_array_elements(v_members) as review_member(value);

  return pg_catalog.jsonb_build_object(
    'counts', pg_catalog.jsonb_build_object(
      'formerMembers', pg_catalog.jsonb_array_length(v_members),
      'privatePosts', v_post_count
    ),
    'members', v_members
  );
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
  v_owned_private_post_count integer := 0;
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

  select pg_catalog.count(distinct access.post_id)::integer
  into v_owned_private_post_count
  from public.commune_post_circle_participants as access
  join public.commune_posts as post on post.id = access.post_id
  where post.user_id = v_actor
    and post.audience = 'circle'
    and access.participant_user_id = v_other
    and access.removed_at is null;

  perform private.commons_circle_emit(v_relationship.id, v_actor, v_other, 'removed', 'Circle connection ended', 'A mutual Circle connection was removed. Existing explicit private-post access is unchanged.');
  return pg_catalog.jsonb_build_object(
    'state', 'removed',
    'relationshipId', v_relationship.id,
    'remainingOwnedPrivatePostCount', v_owned_private_post_count
  );
end;
$$;

create or replace function public.commune_post_circle_participant_cards(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_items jsonb;
begin
  if not private.commune_circle_post_member(p_post_id, v_actor) then
    raise exception using errcode = '42501', message = 'circle_private_post_access_denied';
  end if;
  select post.user_id into v_owner from public.commune_posts as post where post.id = p_post_id;
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'accessId', access.id,
      'relationshipId', access.circle_relationship_id,
      'profile', private.commons_circle_profile_card(access.participant_user_id),
      'addedAt', access.created_at,
      'circleAccepted', case when v_owner = v_actor then exists (
        select 1
        from public.commons_circle_relationships as relationship
        where relationship.id = access.circle_relationship_id
          and relationship.status = 'accepted'
          and v_owner in (relationship.user_low_id, relationship.user_high_id)
          and access.participant_user_id in (relationship.user_low_id, relationship.user_high_id)
      ) else null end
    ) order by access.created_at, access.id
  ), '[]'::jsonb)
  into v_items
  from public.commune_post_circle_participants as access
  where access.post_id = p_post_id and access.removed_at is null;
  return pg_catalog.jsonb_build_object(
    'postId', p_post_id,
    'viewerIsOwner', v_owner = v_actor,
    'participants', v_items
  );
end;
$$;

alter function public.current_user_circle_access_review() owner to postgres;
alter function public.remove_from_commons_circle(uuid) owner to postgres;
alter function public.commune_post_circle_participant_cards(uuid) owner to postgres;

revoke all privileges on function public.current_user_circle_access_review() from public, anon, authenticated;
revoke all privileges on function public.remove_from_commons_circle(uuid) from public, anon, authenticated;
revoke all privileges on function public.commune_post_circle_participant_cards(uuid) from public, anon, authenticated;
grant execute on function public.current_user_circle_access_review() to authenticated;
grant execute on function public.remove_from_commons_circle(uuid) to authenticated;
grant execute on function public.commune_post_circle_participant_cards(uuid) to authenticated;

comment on function public.current_user_circle_access_review() is
  'Returns only the caller-owned private posts whose active participant ACL outlives an accepted Circle relationship. No administrator or reviewer bypass.';
comment on function public.remove_from_commons_circle(uuid) is
  'Ends mutual eligibility for new sharing while preserving explicit historical post ACLs and returning only the actor-owned review count.';

commit;
