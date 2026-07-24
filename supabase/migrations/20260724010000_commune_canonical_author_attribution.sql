-- Resolve visible Commune authors through the current canonical Online
-- profile projection without rewriting historical content snapshots.
begin;

create or replace function public.resolve_public_commune_attributions(
  p_post_ids uuid[] default '{}'::uuid[],
  p_comment_ids uuid[] default '{}'::uuid[],
  p_realtime_message_ids uuid[] default '{}'::uuid[]
)
returns table (
  target_type text,
  target_id uuid,
  author_handle text,
  canonical_profile_url text,
  viewer_is_owner boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if pg_catalog.cardinality(coalesce(p_post_ids, '{}'::uuid[])) > 100
     or pg_catalog.cardinality(coalesce(p_comment_ids, '{}'::uuid[])) > 100
     or pg_catalog.cardinality(
       coalesce(p_realtime_message_ids, '{}'::uuid[])
     ) > 100 then
    raise exception using
      errcode = '22023',
      message = 'commune_attribution_request_too_large';
  end if;

  return query
  select
    'post'::text,
    post.id,
    card.handle,
    card.canonical_profile_url,
    coalesce(auth.uid() = post.user_id, false)
  from public.commune_posts as post
  join private.community_safe_online_public_profile_cards as card
    on card.user_id = post.user_id
  where post.id = any(coalesce(p_post_ids, '{}'::uuid[]))
    and post.status::text = 'published'
    and post.visibility::text = 'public'
    and coalesce(post.visibility_state, 'published') not in (
      'flagged', 'hidden', 'removed', 'archived', 'revoked'
    )
    and post.hidden_at is null
    and post.removed_at is null
    and post.archived_at is null
    and post.revoked_at is null

  union all

  select
    'comment'::text,
    comment.id,
    card.handle,
    card.canonical_profile_url,
    coalesce(auth.uid() = comment.user_id, false)
  from public.commune_comments as comment
  join public.commune_threads as thread
    on thread.id = comment.thread_id
  join public.commune_posts as parent_post
    on parent_post.id = coalesce(comment.post_id, thread.post_id)
  join private.community_safe_online_public_profile_cards as card
    on card.user_id = comment.user_id
  where comment.id = any(coalesce(p_comment_ids, '{}'::uuid[]))
    and comment.status = 'published'
    and coalesce(comment.visibility_state, 'published') not in (
      'flagged', 'hidden', 'removed', 'archived', 'revoked'
    )
    and comment.hidden_at is null
    and comment.removed_at is null
    and comment.archived_at is null
    and parent_post.status::text = 'published'
    and parent_post.visibility::text = 'public'
    and coalesce(parent_post.visibility_state, 'published') not in (
      'flagged', 'hidden', 'removed', 'archived', 'revoked'
    )
    and parent_post.hidden_at is null
    and parent_post.removed_at is null
    and parent_post.archived_at is null
    and parent_post.revoked_at is null

  union all

  select
    'realtime_message'::text,
    message.id,
    card.handle,
    card.canonical_profile_url,
    coalesce(auth.uid() = message.author_user_id, false)
  from public.commune_realtime_messages as message
  join public.commune_realtime_rooms as room
    on room.id = message.room_id
  join private.community_safe_online_public_profile_cards as card
    on card.user_id = message.author_user_id
  where message.id = any(
      coalesce(p_realtime_message_ids, '{}'::uuid[])
    )
    and message.visibility_state = 'published'
    and message.hidden_at is null
    and message.removed_at is null
    and room.visibility_state = 'published'

  order by 1, 2;
end;
$$;

alter function public.resolve_public_commune_attributions(
  uuid[], uuid[], uuid[]
) owner to postgres;

revoke all privileges on function
  public.resolve_public_commune_attributions(uuid[], uuid[], uuid[])
  from public, anon, authenticated, service_role;

grant execute on function
  public.resolve_public_commune_attributions(uuid[], uuid[], uuid[])
  to anon, authenticated, service_role;

comment on function public.resolve_public_commune_attributions(
  uuid[], uuid[], uuid[]
) is
  'Bounded current-handle attribution for visible Commune content. Historical snapshot handles and account UUIDs are never returned.';

commit;
