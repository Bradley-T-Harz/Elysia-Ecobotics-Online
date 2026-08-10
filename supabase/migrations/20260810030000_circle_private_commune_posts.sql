-- Explicit Circle ACLs for private, room-native Commune posts.
-- Circle membership controls who may be added. This table controls ongoing access.
begin;

alter table public.commune_posts
  add column if not exists audience text not null default 'public',
  add column if not exists circle_privacy_acknowledged boolean not null default false;

alter table public.commune_posts
  drop constraint if exists commune_posts_audience_check;
alter table public.commune_posts
  add constraint commune_posts_audience_check
  check (audience in ('public', 'circle'));

alter table public.commune_vote_posts
  drop constraint if exists commune_vote_posts_visibility_check;
alter table public.commune_vote_posts
  add constraint commune_vote_posts_visibility_check
  check (visibility in ('public', 'circle'));

create index if not exists commune_posts_audience_activity_idx
  on public.commune_posts(audience, post_type, published_at desc);

create table public.commune_post_circle_participants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.commune_posts(id) on delete cascade,
  participant_user_id uuid not null references auth.users(id) on delete cascade,
  circle_relationship_id uuid not null references public.commons_circle_relationships(id) on delete restrict,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  constraint commune_post_circle_participant_not_author_check
    check (participant_user_id <> added_by)
);

create unique index commune_post_circle_participants_active_unique
  on public.commune_post_circle_participants(post_id, participant_user_id)
  where removed_at is null;
create index commune_post_circle_participants_user_idx
  on public.commune_post_circle_participants(participant_user_id, created_at desc)
  where removed_at is null;
create index commune_post_circle_participants_post_idx
  on public.commune_post_circle_participants(post_id, created_at)
  where removed_at is null;

alter table public.commune_post_circle_participants owner to postgres;
alter table public.commune_post_circle_participants enable row level security;
revoke all privileges on table public.commune_post_circle_participants
  from public, anon, authenticated, service_role;

create or replace function private.commune_circle_post_member(
  p_post_id uuid,
  p_actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor is not null and exists (
    select 1
    from public.commune_posts as post
    where post.id = p_post_id
      and post.audience = 'circle'
      and (
        post.user_id = p_actor
        or exists (
          select 1
          from public.commune_post_circle_participants as access
          where access.post_id = post.id
            and access.participant_user_id = p_actor
            and access.removed_at is null
        )
      )
  );
$$;

create or replace function private.commune_post_boundary_allows(
  p_post_id uuid,
  p_actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when post.audience <> 'circle' then true
      else private.commune_circle_post_member(post.id, p_actor)
    end
    from public.commune_posts as post
    where post.id = p_post_id
  ), false);
$$;

create or replace function private.commune_post_is_circle(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select post.audience = 'circle'
    from public.commune_posts as post
    where post.id = p_post_id
  ), false);
$$;

create or replace function private.commune_circle_post_owner(
  p_post_id uuid,
  p_actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor is not null and exists (
    select 1 from public.commune_posts as post
    where post.id = p_post_id
      and post.audience = 'circle'
      and post.user_id = p_actor
  );
$$;

create or replace function public.current_user_can_access_commune_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when post.audience = 'circle' then private.commune_circle_post_member(post.id, auth.uid())
      when post.user_id = auth.uid() then true
      when post.status = 'published'
        and post.visibility = 'public'
        and coalesce(post.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
        and post.hidden_at is null
        and post.removed_at is null
        and post.archived_at is null then true
      else public.current_user_can_review_domain('commune'::public.review_domain)
    end
    from public.commune_posts as post
    where post.id = p_post_id
  ), false);
$$;

create or replace function private.commune_reaction_target_post_id(
  p_target_type text,
  p_target_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_target_type = 'post' then p_target_id
    when p_target_type = 'comment' then (
      select comment.post_id
      from public.commune_comments as comment
      where comment.id = p_target_id
    )
    else null
  end;
$$;

create or replace function private.commune_code_document_post_id(p_document_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select document.linked_commune_post_id
  from public.commune_code_documents as document
  where document.id = p_document_id;
$$;

create or replace function private.commune_code_annotation_post_id(p_annotation_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select document.linked_commune_post_id
  from public.commune_code_annotations as annotation
  join public.commune_code_documents as document on document.id = annotation.document_id
  where annotation.id = p_annotation_id;
$$;

create or replace function private.sandbox_handoff_post_id(p_request_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select request.post_id
  from public.commune_sandbox_review_requests as request
  where request.id = p_request_id;
$$;

create or replace function private.commune_storage_object_boundary_allows(
  p_bucket text,
  p_name text,
  p_actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_bucket not in ('commune-media', 'commune-uploads') then true
    when exists (
      select 1
      from public.commune_media as media
      join public.commune_posts as post on post.id = media.post_id
      where media.storage_bucket = p_bucket
        and media.storage_path = p_name
        and post.audience = 'circle'
    ) then exists (
      select 1
      from public.commune_media as media
      where media.storage_bucket = p_bucket
        and media.storage_path = p_name
        and private.commune_circle_post_member(media.post_id, p_actor)
    )
    when exists (
      select 1
      from public.commune_uploads as upload
      join public.commune_posts as post on post.id = upload.post_id
      where upload.bucket = p_bucket
        and upload.storage_path = p_name
        and post.audience = 'circle'
    ) then exists (
      select 1
      from public.commune_uploads as upload
      where upload.bucket = p_bucket
        and upload.storage_path = p_name
        and private.commune_circle_post_member(upload.post_id, p_actor)
    )
    else true
  end;
$$;

create or replace function private.enforce_commune_post_audience_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.audience is distinct from new.audience then
    raise exception using errcode = '23514', message = 'commune_post_audience_is_immutable';
  end if;
  if old.audience = 'circle' and old.visibility is distinct from new.visibility then
    raise exception using errcode = '23514', message = 'circle_private_visibility_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_commune_post_audience_immutability on public.commune_posts;
create trigger enforce_commune_post_audience_immutability
before update of audience, visibility on public.commune_posts
for each row execute function private.enforce_commune_post_audience_immutability();

create policy "owners create Circle-private Commune posts"
  on public.commune_posts for insert to authenticated
  with check (
    user_id = auth.uid()
    and audience = 'circle'
    and visibility = 'private_draft'
    and status = 'published'
    and moderation_status = 'circle_private'
    and circle_privacy_acknowledged = true
    and (
      post_type not in ('official_update', 'community_vote')
      or public.current_user_is_admin()
    )
  );
create policy "Circle-private Commune post insert boundary"
  on public.commune_posts as restrictive for insert to authenticated
  with check (
    audience <> 'circle'
    or (
      user_id = auth.uid()
      and visibility = 'private_draft'
      and status = 'published'
      and moderation_status = 'circle_private'
      and circle_privacy_acknowledged = true
      and (
        post_type not in ('official_update', 'community_vote')
        or public.current_user_is_admin()
      )
    )
  );

create policy "Circle members read explicitly shared Commune posts"
  on public.commune_posts for select to authenticated
  using (private.commune_circle_post_member(id, auth.uid()));
create policy "Circle-private Commune post boundary"
  on public.commune_posts as restrictive for select to anon, authenticated
  using (audience <> 'circle' or private.commune_circle_post_member(id, auth.uid()));
create policy "Circle-private Commune post update boundary"
  on public.commune_posts as restrictive for update to authenticated
  using (audience <> 'circle' or private.commune_circle_post_owner(id, auth.uid()))
  with check (audience <> 'circle' or private.commune_circle_post_owner(id, auth.uid()));
create policy "Circle-private Commune post delete boundary"
  on public.commune_posts as restrictive for delete to authenticated
  using (audience <> 'circle' or private.commune_circle_post_owner(id, auth.uid()));

create policy "authorized users read Circle post participants"
  on public.commune_post_circle_participants for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
grant select on table public.commune_post_circle_participants to authenticated;

create or replace function public.add_commune_post_circle_participants(
  p_post_id uuid,
  p_circle_relationship_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_post public.commune_posts%rowtype;
  v_relationship public.commons_circle_relationships%rowtype;
  v_participant uuid;
  v_access_id uuid;
  v_added integer := 0;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'circle_private_post_authentication_required';
  end if;
  select post.* into v_post
  from public.commune_posts as post
  where post.id = p_post_id
  for update;
  if not found or v_post.user_id <> v_actor or v_post.audience <> 'circle' then
    raise exception using errcode = '42501', message = 'circle_private_post_owner_required';
  end if;

  for v_relationship in
    select relationship.*
    from public.commons_circle_relationships as relationship
    where relationship.id = any(coalesce(p_circle_relationship_ids, '{}'::uuid[]))
    order by relationship.id
    for update
  loop
    if v_relationship.status <> 'accepted'
       or v_actor not in (v_relationship.user_low_id, v_relationship.user_high_id) then
      raise exception using errcode = '42501', message = 'accepted_circle_relationship_required';
    end if;
    v_participant := case
      when v_relationship.user_low_id = v_actor then v_relationship.user_high_id
      else v_relationship.user_low_id
    end;
    if not private.community_account_is_recoverable(v_participant) then
      raise exception using errcode = '42501', message = 'circle_participant_account_unavailable';
    end if;

    select access.id into v_access_id
    from public.commune_post_circle_participants as access
    where access.post_id = p_post_id
      and access.participant_user_id = v_participant
      and access.removed_at is null;
    if not found then
      insert into public.commune_post_circle_participants (
        post_id, participant_user_id, circle_relationship_id, added_by
      ) values (
        p_post_id, v_participant, v_relationship.id, v_actor
      ) returning id into v_access_id;
      v_added := v_added + 1;
      perform private.emit_account_notification_event(
        'commune.circle_private_post_added',
        'commune',
        'commune_post',
        p_post_id,
        v_actor,
        'user',
        v_participant,
        'commune-private-post:' || p_post_id::text || ':' || v_participant::text,
        'suppressible',
        'community_circle',
        'Added to a private Commune post',
        'A mutual Circle member shared a private room post with you.',
        '/commune/posts/' || p_post_id::text,
        'outcome'
      );
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('postId', p_post_id, 'added', v_added);
end;
$$;

create or replace function public.remove_commune_post_circle_participant(p_access_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_access public.commune_post_circle_participants%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'circle_private_post_authentication_required';
  end if;
  select access.* into v_access
  from public.commune_post_circle_participants as access
  join public.commune_posts as post on post.id = access.post_id
  where access.id = p_access_id
    and access.removed_at is null
    and post.user_id = v_actor
    and post.audience = 'circle'
  for update of access;
  if not found then
    raise exception using errcode = '42501', message = 'circle_private_post_owner_required';
  end if;
  update public.commune_post_circle_participants
  set removed_at = now(), removed_by = v_actor
  where id = v_access.id;
  return pg_catalog.jsonb_build_object('postId', v_access.post_id, 'removed', true);
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
      'addedAt', access.created_at
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

revoke all on function private.commune_circle_post_member(uuid, uuid) from public;
revoke all on function private.commune_post_boundary_allows(uuid, uuid) from public;
revoke all on function private.commune_post_is_circle(uuid) from public;
revoke all on function private.commune_circle_post_owner(uuid, uuid) from public;
revoke all on function private.commune_reaction_target_post_id(text, uuid) from public;
revoke all on function private.commune_code_document_post_id(uuid) from public;
revoke all on function private.commune_code_annotation_post_id(uuid) from public;
revoke all on function private.sandbox_handoff_post_id(uuid) from public;
revoke all on function private.commune_storage_object_boundary_allows(text, text, uuid) from public;
revoke all on function public.current_user_can_access_commune_post(uuid) from public;
revoke all on function public.add_commune_post_circle_participants(uuid, uuid[]) from public;
revoke all on function public.remove_commune_post_circle_participant(uuid) from public;
revoke all on function public.commune_post_circle_participant_cards(uuid) from public;
grant execute on function private.commune_circle_post_member(uuid, uuid) to anon, authenticated;
grant execute on function private.commune_post_boundary_allows(uuid, uuid) to anon, authenticated;
grant execute on function private.commune_post_is_circle(uuid) to anon, authenticated;
grant execute on function private.commune_circle_post_owner(uuid, uuid) to anon, authenticated;
grant execute on function private.commune_reaction_target_post_id(text, uuid) to anon, authenticated;
grant execute on function private.commune_code_document_post_id(uuid) to anon, authenticated;
grant execute on function private.commune_code_annotation_post_id(uuid) to anon, authenticated;
grant execute on function private.sandbox_handoff_post_id(uuid) to anon, authenticated;
grant execute on function private.commune_storage_object_boundary_allows(text, text, uuid) to anon, authenticated;
grant execute on function public.current_user_can_access_commune_post(uuid) to anon, authenticated;
grant execute on function public.add_commune_post_circle_participants(uuid, uuid[]) to authenticated;
grant execute on function public.remove_commune_post_circle_participant(uuid) to authenticated;
grant execute on function public.commune_post_circle_participant_cards(uuid) to authenticated;

-- Parent threads and comments inherit the post ACL. Review roles do not override it.
create policy "Circle members read private Commune threads"
  on public.commune_threads for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private Commune thread boundary"
  on public.commune_threads as restrictive for select to anon, authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "owners create Circle-private Commune threads"
  on public.commune_threads for insert to authenticated
  with check (
    created_by = auth.uid()
    and visibility = 'circle'
    and post_id is not null
    and exists (
      select 1 from public.commune_posts as post
      where post.id = commune_threads.post_id
        and post.user_id = auth.uid()
        and post.audience = 'circle'
    )
  );

create policy "Circle members read private Commune comments"
  on public.commune_comments for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private Commune comment boundary"
  on public.commune_comments as restrictive for select to anon, authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private Commune comment insert boundary"
  on public.commune_comments as restrictive for insert to authenticated
  with check (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private Commune comment update boundary"
  on public.commune_comments as restrictive for update to authenticated
  using (
    post_id is null
    or not private.commune_post_is_circle(post_id)
    or (private.commune_circle_post_member(post_id, auth.uid()) and user_id = auth.uid())
  )
  with check (
    post_id is null
    or not private.commune_post_is_circle(post_id)
    or (private.commune_circle_post_member(post_id, auth.uid()) and user_id = auth.uid())
  );
create policy "Circle-private Commune comment delete boundary"
  on public.commune_comments as restrictive for delete to authenticated
  using (
    post_id is null
    or not private.commune_post_is_circle(post_id)
    or (private.commune_circle_post_member(post_id, auth.uid()) and user_id = auth.uid())
  );
create policy "Circle members create private Commune comments"
  on public.commune_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'published'
    and post_id is not null
    and private.commune_circle_post_member(post_id, auth.uid())
    and exists (
      select 1 from public.commune_threads as thread
      where thread.id = thread_id
        and thread.post_id = commune_comments.post_id
        and thread.visibility = 'circle'
        and thread.status = 'open'
    )
    and not exists (
      select 1 from public.commune_official_updates as update
      where update.post_id = commune_comments.post_id and update.comments_enabled = false
    )
    and not exists (
      select 1 from public.commune_vote_posts as vote
      where vote.post_id = commune_comments.post_id and vote.allow_comments = false
    )
  );

-- Reporting is the deliberate narrow escalation path. A reporter must be able to
-- read the targeted post/comment, but authorized reviewers receive only the
-- report row; these policies do not grant access to the private source content.
create policy "Circle-private unified report insert boundary"
  on public.commune_reports as restrictive for insert to anon, authenticated
  with check (
    target_type not in ('post', 'comment')
    or private.commune_post_boundary_allows(
      private.commune_reaction_target_post_id(target_type, target_id), auth.uid()
    )
  );
create policy "Circle-private legacy report insert boundary"
  on public.commune_abuse_reports as restrictive for insert to authenticated
  with check (
    (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()))
    and (
      comment_id is null
      or private.commune_post_boundary_allows(
        private.commune_reaction_target_post_id('comment', comment_id), auth.uid()
      )
    )
  );

-- Structured room sidecars: participant read plus a restrictive parent boundary.
create policy "Circle members read private troubleshooting metadata"
  on public.commune_troubleshooting_posts for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private troubleshooting boundary"
  on public.commune_troubleshooting_posts as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private troubleshooting update boundary"
  on public.commune_troubleshooting_posts as restrictive for update to authenticated
  using (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));

create policy "Circle members read private repository metadata"
  on public.commune_repository_showcases for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private repository metadata boundary"
  on public.commune_repository_showcases as restrictive for select to anon, authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private repository metadata update boundary"
  on public.commune_repository_showcases as restrictive for update to authenticated
  using (post_id is null or not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (post_id is null or not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));

create policy "Circle members read private research metadata"
  on public.commune_research_notes for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private research metadata boundary"
  on public.commune_research_notes as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private research metadata update boundary"
  on public.commune_research_notes as restrictive for update to authenticated
  using (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));

create policy "Circle members read private Job Post metadata"
  on public.commune_job_posts for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private Job Post boundary"
  on public.commune_job_posts as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private Job Post update boundary"
  on public.commune_job_posts as restrictive for update to authenticated
  using (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));
create policy "owners create private Job Post metadata"
  on public.commune_job_posts for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.commune_posts as post
      where post.id = post_id
        and post.user_id = auth.uid()
        and post.post_type = 'job_post'
        and post.audience = 'circle'
    )
  );

create policy "Circle members read private iteration metadata"
  on public.commune_iteration_showcases for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private iteration metadata boundary"
  on public.commune_iteration_showcases as restrictive for select to anon, authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private iteration metadata update boundary"
  on public.commune_iteration_showcases as restrictive for update to authenticated
  using (post_id is null or not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (post_id is null or not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));

create policy "Circle members read private Official Update metadata"
  on public.commune_official_updates for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private Official Update metadata boundary"
  on public.commune_official_updates as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private Official Update metadata update boundary"
  on public.commune_official_updates as restrictive for update to authenticated
  using (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));

create policy "Circle members read private Official Update code"
  on public.commune_official_update_code_snippets for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private Official Update code boundary"
  on public.commune_official_update_code_snippets as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private Official Update code update boundary"
  on public.commune_official_update_code_snippets as restrictive for update to authenticated
  using (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));

create policy "Circle members read private Official Update events"
  on public.commune_official_update_events for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private Official Update event boundary"
  on public.commune_official_update_events as restrictive for select to anon, authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));

-- Voting remains aggregate-only, but private options/results/ballots are ACL scoped.
create policy "Circle members read private vote metadata"
  on public.commune_vote_posts for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private vote metadata boundary"
  on public.commune_vote_posts as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private vote metadata update boundary"
  on public.commune_vote_posts as restrictive for update to authenticated
  using (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));

create policy "Circle members read private vote options"
  on public.commune_vote_options for select to authenticated
  using (private.commune_circle_post_member(vote_post_id, auth.uid()));
create policy "Circle-private vote option boundary"
  on public.commune_vote_options as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(vote_post_id, auth.uid()));
create policy "Circle-private vote option update boundary"
  on public.commune_vote_options as restrictive for update to authenticated
  using (not private.commune_post_is_circle(vote_post_id) or private.commune_circle_post_owner(vote_post_id, auth.uid()))
  with check (not private.commune_post_is_circle(vote_post_id) or private.commune_circle_post_owner(vote_post_id, auth.uid()));

create policy "Circle members read own private vote ballots"
  on public.commune_vote_ballots for select to authenticated
  using (voter_user_id = auth.uid() and private.commune_circle_post_member(vote_post_id, auth.uid()));
create policy "Circle-private vote ballot boundary"
  on public.commune_vote_ballots as restrictive for select to authenticated
  using (private.commune_post_boundary_allows(vote_post_id, auth.uid()));
create policy "Circle members cast private vote ballots"
  on public.commune_vote_ballots for insert to authenticated
  with check (
    voter_user_id = auth.uid()
    and private.commune_circle_post_member(vote_post_id, auth.uid())
    and exists (
      select 1
      from public.commune_vote_posts as vote
      join public.commune_vote_options as option
        on option.vote_post_id = vote.post_id and option.id = commune_vote_ballots.option_id
      where vote.post_id = commune_vote_ballots.vote_post_id
        and vote.vote_status = 'open'
        and (vote.opens_at is null or now() >= vote.opens_at)
        and (vote.closes_at is null or now() <= vote.closes_at)
    )
  );
create policy "Circle members update own private vote ballots"
  on public.commune_vote_ballots for update to authenticated
  using (voter_user_id = auth.uid() and private.commune_circle_post_member(vote_post_id, auth.uid()))
  with check (
    voter_user_id = auth.uid()
    and private.commune_circle_post_member(vote_post_id, auth.uid())
    and exists (
      select 1
      from public.commune_vote_posts as vote
      join public.commune_vote_options as option
        on option.vote_post_id = vote.post_id and option.id = commune_vote_ballots.option_id
      where vote.post_id = commune_vote_ballots.vote_post_id
        and vote.vote_status = 'open'
        and (vote.opens_at is null or now() >= vote.opens_at)
        and (vote.closes_at is null or now() <= vote.closes_at)
    )
  );

create policy "Circle members read private vote events"
  on public.commune_vote_events for select to authenticated
  using (event_visibility = 'public' and private.commune_circle_post_member(vote_post_id, auth.uid()));
create policy "Circle-private vote event boundary"
  on public.commune_vote_events as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(vote_post_id, auth.uid()));

-- Media and legacy upload metadata follow the same post ACL.
create policy "Circle members read private Commune media"
  on public.commune_media for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private Commune media boundary"
  on public.commune_media as restrictive for select to anon, authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "owners insert published Circle-private media metadata"
  on public.commune_media for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and visibility_state = 'published'
    and post_id is not null
    and private.commune_circle_post_owner(post_id, auth.uid())
  );
create policy "Circle-private Commune media insert boundary"
  on public.commune_media as restrictive for insert to authenticated
  with check (
    post_id is null
    or not private.commune_post_is_circle(post_id)
    or private.commune_circle_post_owner(post_id, auth.uid())
  );
create policy "Circle-private Commune media update boundary"
  on public.commune_media as restrictive for update to authenticated
  using (post_id is null or not private.commune_post_is_circle(post_id) or owner_user_id = auth.uid())
  with check (post_id is null or not private.commune_post_is_circle(post_id) or owner_user_id = auth.uid());

create policy "Circle members read private legacy Commune uploads"
  on public.commune_uploads for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private legacy Commune upload boundary"
  on public.commune_uploads as restrictive for select to authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private legacy Commune upload insert boundary"
  on public.commune_uploads as restrictive for insert to authenticated
  with check (
    post_id is null
    or not private.commune_post_is_circle(post_id)
    or private.commune_circle_post_owner(post_id, auth.uid())
  );
create policy "Circle-private legacy Commune upload update boundary"
  on public.commune_uploads as restrictive for update to authenticated
  using (post_id is null or not private.commune_post_is_circle(post_id) or user_id = auth.uid())
  with check (post_id is null or not private.commune_post_is_circle(post_id) or user_id = auth.uid());

create policy "Circle members read private Commune code snippets"
  on public.commune_code_snippets for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private Commune code snippet boundary"
  on public.commune_code_snippets as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private Commune code snippet insert boundary"
  on public.commune_code_snippets as restrictive for insert to authenticated
  with check (
    not private.commune_post_is_circle(post_id)
    or private.commune_circle_post_owner(post_id, auth.uid())
  );
create policy "Circle-private Commune code snippet update boundary"
  on public.commune_code_snippets as restrictive for update to authenticated
  using (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()))
  with check (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));
create policy "Circle-private Commune code snippet delete boundary"
  on public.commune_code_snippets as restrictive for delete to authenticated
  using (not private.commune_post_is_circle(post_id) or private.commune_circle_post_owner(post_id, auth.uid()));

-- Reactions, saves, and follows cannot become existence or mutation side channels.
create policy "Circle-private Commune reaction boundary"
  on public.commune_content_reactions as restrictive for select to authenticated
  using (private.commune_post_boundary_allows(
    private.commune_reaction_target_post_id(target_type, target_id), auth.uid()
  ));
create policy "Circle-private Commune reaction insert boundary"
  on public.commune_content_reactions as restrictive for insert to authenticated
  with check (private.commune_post_boundary_allows(
    private.commune_reaction_target_post_id(target_type, target_id), auth.uid()
  ));
create policy "Circle-private Commune reaction update boundary"
  on public.commune_content_reactions as restrictive for update to authenticated
  using (private.commune_post_boundary_allows(
    private.commune_reaction_target_post_id(target_type, target_id), auth.uid()
  ))
  with check (private.commune_post_boundary_allows(
    private.commune_reaction_target_post_id(target_type, target_id), auth.uid()
  ));
create policy "Circle-private Commune reaction delete boundary"
  on public.commune_content_reactions as restrictive for delete to authenticated
  using (private.commune_post_boundary_allows(
    private.commune_reaction_target_post_id(target_type, target_id), auth.uid()
  ));

create policy "Circle-private reaction totals boundary"
  on public.commune_content_reaction_totals as restrictive for select to anon, authenticated
  using (private.commune_post_boundary_allows(
    private.commune_reaction_target_post_id(target_type, target_id), auth.uid()
  ));

create policy "Circle-private saved post insert boundary"
  on public.user_saved_commune_posts as restrictive for insert to authenticated
  with check (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle members save private Commune posts"
  on public.user_saved_commune_posts for insert to authenticated
  with check (
    user_id = auth.uid()
    and post_id is not null
    and private.commune_circle_post_member(post_id, auth.uid())
  );
create policy "Circle-private saved post select boundary"
  on public.user_saved_commune_posts as restrictive for select to authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle members read own private Commune saves"
  on public.user_saved_commune_posts for select to authenticated
  using (
    user_id = auth.uid()
    and post_id is not null
    and private.commune_circle_post_member(post_id, auth.uid())
  );
create policy "Circle-private saved post update boundary"
  on public.user_saved_commune_posts as restrictive for update to authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()))
  with check (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle members update own private Commune saves"
  on public.user_saved_commune_posts for update to authenticated
  using (
    user_id = auth.uid()
    and post_id is not null
    and private.commune_circle_post_member(post_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    and post_id is not null
    and private.commune_circle_post_member(post_id, auth.uid())
  );
create policy "Circle-private saved post delete boundary"
  on public.user_saved_commune_posts as restrictive for delete to authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));

create policy "Circle-private followed thread insert boundary"
  on public.user_followed_commune_threads as restrictive for insert to authenticated
  with check (
    exists (
      select 1 from public.commune_threads as thread
      where thread.id = thread_id
        and (thread.post_id is null or private.commune_post_boundary_allows(thread.post_id, auth.uid()))
    )
  );
create policy "Circle-private followed thread select boundary"
  on public.user_followed_commune_threads as restrictive for select to authenticated
  using (
    exists (
      select 1 from public.commune_threads as thread
      where thread.id = thread_id
        and (thread.post_id is null or private.commune_post_boundary_allows(thread.post_id, auth.uid()))
    )
  );
create policy "Circle-private followed thread update boundary"
  on public.user_followed_commune_threads as restrictive for update to authenticated
  using (
    exists (
      select 1 from public.commune_threads as thread
      where thread.id = thread_id
        and (thread.post_id is null or private.commune_post_boundary_allows(thread.post_id, auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.commune_threads as thread
      where thread.id = thread_id
        and (thread.post_id is null or private.commune_post_boundary_allows(thread.post_id, auth.uid()))
    )
  );
create policy "Circle-private followed thread delete boundary"
  on public.user_followed_commune_threads as restrictive for delete to authenticated
  using (
    exists (
      select 1 from public.commune_threads as thread
      where thread.id = thread_id
        and (thread.post_id is null or private.commune_post_boundary_allows(thread.post_id, auth.uid()))
    )
  );

-- Coding workbench and sandbox records inherit linked post access.
create policy "Circle members read private linked code documents"
  on public.commune_code_documents for select to authenticated
  using (
    linked_commune_post_id is not null
    and private.commune_circle_post_member(linked_commune_post_id, auth.uid())
  );
create policy "Circle-private linked code document boundary"
  on public.commune_code_documents as restrictive for select to anon, authenticated
  using (
    linked_commune_post_id is null
    or private.commune_post_boundary_allows(linked_commune_post_id, auth.uid())
  );
create policy "Circle-private linked code document insert boundary"
  on public.commune_code_documents as restrictive for insert to authenticated
  with check (
    linked_commune_post_id is null
    or not private.commune_post_is_circle(linked_commune_post_id)
    or private.commune_circle_post_owner(linked_commune_post_id, auth.uid())
  );
create policy "Circle-private linked code document update boundary"
  on public.commune_code_documents as restrictive for update to authenticated
  using (
    linked_commune_post_id is null
    or not private.commune_post_is_circle(linked_commune_post_id)
    or private.commune_circle_post_owner(linked_commune_post_id, auth.uid())
  )
  with check (
    linked_commune_post_id is null
    or not private.commune_post_is_circle(linked_commune_post_id)
    or private.commune_circle_post_owner(linked_commune_post_id, auth.uid())
  );

create policy "Circle members read private linked code versions"
  on public.commune_code_document_versions for select to authenticated
  using (private.commune_circle_post_member(
    private.commune_code_document_post_id(document_id), auth.uid()
  ));
create policy "Circle-private linked code version boundary"
  on public.commune_code_document_versions as restrictive for select to anon, authenticated
  using (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );
create policy "Circle-private linked code version insert boundary"
  on public.commune_code_document_versions as restrictive for insert to authenticated
  with check (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_circle_post_owner(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );

create policy "Circle members read private linked code annotations"
  on public.commune_code_annotations for select to authenticated
  using (private.commune_circle_post_member(
    private.commune_code_document_post_id(document_id), auth.uid()
  ));
create policy "Circle-private linked code annotation boundary"
  on public.commune_code_annotations as restrictive for select to anon, authenticated
  using (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );
create policy "Circle members annotate private linked code"
  on public.commune_code_annotations for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and private.commune_circle_post_member(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );
create policy "Circle-private linked code annotation insert boundary"
  on public.commune_code_annotations as restrictive for insert to authenticated
  with check (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );
create policy "Circle-private linked code annotation update boundary"
  on public.commune_code_annotations as restrictive for update to authenticated
  using (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  )
  with check (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );

create policy "Circle members read private linked code sessions"
  on public.commune_code_sessions for select to authenticated
  using (private.commune_circle_post_member(
    private.commune_code_document_post_id(document_id), auth.uid()
  ));
create policy "Circle-private linked code session boundary"
  on public.commune_code_sessions as restrictive for select to authenticated
  using (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );
create policy "Circle members create private linked code sessions"
  on public.commune_code_sessions for insert to authenticated
  with check (private.commune_circle_post_member(
    private.commune_code_document_post_id(document_id), auth.uid()
  ));
create policy "Circle-private linked code session insert boundary"
  on public.commune_code_sessions as restrictive for insert to authenticated
  with check (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );
create policy "Circle-private linked code session update boundary"
  on public.commune_code_sessions as restrictive for update to authenticated
  using (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  )
  with check (
    private.commune_code_document_post_id(document_id) is null
    or private.commune_post_boundary_allows(
      private.commune_code_document_post_id(document_id), auth.uid()
    )
  );

create policy "Circle-private linked code report insert boundary"
  on public.commune_code_reports as restrictive for insert to authenticated
  with check (
    coalesce(
      private.commune_code_document_post_id(document_id),
      private.commune_code_annotation_post_id(annotation_id)
    ) is null
    or private.commune_post_boundary_allows(
        coalesce(
          private.commune_code_document_post_id(document_id),
          private.commune_code_annotation_post_id(annotation_id)
        ),
        auth.uid()
      )
  );

create policy "Circle-private linked code moderation event boundary"
  on public.commune_code_moderation_events as restrictive for select to authenticated
  using (
    coalesce(
      private.commune_code_document_post_id(document_id),
      private.commune_code_annotation_post_id(annotation_id)
    ) is null
    or private.commune_post_boundary_allows(
        coalesce(
          private.commune_code_document_post_id(document_id),
          private.commune_code_annotation_post_id(annotation_id)
        ),
        auth.uid()
      )
  );
create policy "Circle-private linked code moderation event insert boundary"
  on public.commune_code_moderation_events as restrictive for insert to authenticated
  with check (
    coalesce(
      private.commune_code_document_post_id(document_id),
      private.commune_code_annotation_post_id(annotation_id)
    ) is null
    or private.commune_post_boundary_allows(
        coalesce(
          private.commune_code_document_post_id(document_id),
          private.commune_code_annotation_post_id(annotation_id)
        ),
        auth.uid()
      )
  );

create policy "Circle members read private code proposals"
  on public.commune_code_revision_proposals for select to authenticated
  using (private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private code proposal boundary"
  on public.commune_code_revision_proposals as restrictive for select to authenticated
  using (private.commune_post_boundary_allows(post_id, auth.uid()));

create policy "Circle members read private sandbox handoffs"
  on public.commune_sandbox_review_requests for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private sandbox handoff boundary"
  on public.commune_sandbox_review_requests as restrictive for select to authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private sandbox handoff insert boundary"
  on public.commune_sandbox_review_requests as restrictive for insert to authenticated
  with check (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private sandbox handoff update boundary"
  on public.commune_sandbox_review_requests as restrictive for update to authenticated
  using (
    post_id is null
    or not private.commune_post_is_circle(post_id)
    or coalesce(submitted_by, user_id) = auth.uid()
  )
  with check (
    post_id is null
    or not private.commune_post_is_circle(post_id)
    or coalesce(submitted_by, user_id) = auth.uid()
  );

create policy "Circle members read private sandbox runs"
  on public.commune_sandbox_runs for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private sandbox run boundary"
  on public.commune_sandbox_runs as restrictive for select to authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));
create policy "Circle-private sandbox run insert boundary"
  on public.commune_sandbox_runs as restrictive for insert to authenticated
  with check (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));

create policy "Circle members read private sandbox diagnostics"
  on public.commune_code_diagnostics for select to authenticated
  using (post_id is not null and private.commune_circle_post_member(post_id, auth.uid()));
create policy "Circle-private sandbox diagnostic boundary"
  on public.commune_code_diagnostics as restrictive for select to authenticated
  using (post_id is null or private.commune_post_boundary_allows(post_id, auth.uid()));

create policy "Circle members read private sandbox handoff events"
  on public.sandbox_handoff_events for select to authenticated
  using (private.commune_circle_post_member(
    private.sandbox_handoff_post_id(sandbox_request_id), auth.uid()
  ));
create policy "Circle-private sandbox handoff event boundary"
  on public.sandbox_handoff_events as restrictive for select to authenticated
  using (
    private.sandbox_handoff_post_id(sandbox_request_id) is null
    or private.commune_post_boundary_allows(
      private.sandbox_handoff_post_id(sandbox_request_id), auth.uid()
    )
  );
create policy "Circle-private sandbox handoff event insert boundary"
  on public.sandbox_handoff_events as restrictive for insert to authenticated
  with check (
    private.sandbox_handoff_post_id(sandbox_request_id) is null
    or private.commune_post_boundary_allows(
      private.sandbox_handoff_post_id(sandbox_request_id), auth.uid()
    )
  );

create or replace function public.submit_circle_code_revision_proposal_v2(
  p_client_request_id uuid,
  p_post_id uuid,
  p_code_snippet_id uuid,
  p_proposed_code_text text,
  p_language text,
  p_file_name text,
  p_change_summary text,
  p_explanation text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_existing public.commune_code_revision_proposals%rowtype;
  v_proposal_id uuid;
  v_language text;
  v_file_name text;
  v_summary text := pg_catalog.btrim(coalesce(p_change_summary, ''));
  v_explanation text := nullif(pg_catalog.btrim(coalesce(p_explanation, '')), '');
  v_is_troubleshooting boolean := false;
  v_review_path text := '/commune/coding-cornucopia/review';
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'circle_code_proposal_authentication_required';
  end if;
  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'circle_code_proposal_client_request_id_required';
  end if;
  if not private.community_online_action_allowed(v_actor, 'commune_commenting') then
    raise exception using errcode = '42501', message = 'circle_code_proposal_participation_not_allowed';
  end if;
  if p_post_id is null or p_code_snippet_id is null then
    raise exception using errcode = '22023', message = 'circle_code_proposal_source_required';
  end if;
  if pg_catalog.char_length(coalesce(p_proposed_code_text, '')) > 100000 then
    raise exception using errcode = '22023', message = 'circle_code_proposal_too_large';
  end if;
  if pg_catalog.char_length(v_summary) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'circle_code_proposal_summary_invalid';
  end if;
  if v_explanation is not null and pg_catalog.char_length(v_explanation) > 8000 then
    raise exception using errcode = '22023', message = 'circle_code_proposal_explanation_too_large';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || p_client_request_id::text, 0)
  );

  select
    snippet.code_text,
    snippet.language as current_language,
    snippet.file_name as current_file_name,
    coalesce(snippet.accepted_version_number, 1) as accepted_version_number,
    post.user_id as post_author_id,
    post.title as post_title,
    post.post_type
  into v_row
  from public.commune_code_snippets as snippet
  join public.commune_posts as post on post.id = snippet.post_id
  where snippet.id = p_code_snippet_id
    and snippet.post_id = p_post_id
    and post.audience = 'circle'
    and post.status = 'published'
    and post.visibility = 'private_draft'
    and post.hidden_at is null
    and post.removed_at is null
    and post.archived_at is null
    and private.commune_circle_post_member(post.id, v_actor);

  if not found or v_row.post_author_id is null then
    raise exception using errcode = '42501', message = 'circle_code_proposal_source_unavailable';
  end if;
  if v_row.post_type::text not in ('code_sharing', 'troubleshooting') then
    raise exception using errcode = '22023', message = 'circle_code_proposal_source_type_invalid';
  end if;

  v_language := nullif(pg_catalog.btrim(coalesce(p_language, v_row.current_language, 'text')), '');
  v_file_name := nullif(pg_catalog.btrim(coalesce(p_file_name, v_row.current_file_name, 'snippet')), '');
  if coalesce(p_proposed_code_text, '') = coalesce(v_row.code_text, '')
     and coalesce(v_language, '') = coalesce(v_row.current_language, '')
     and coalesce(v_file_name, '') = coalesce(v_row.current_file_name, '') then
    raise exception using errcode = '22023', message = 'circle_code_proposal_meaningful_change_required';
  end if;

  select proposal.* into v_existing
  from public.commune_code_revision_proposals as proposal
  where proposal.proposer_user_id = v_actor
    and proposal.client_request_id = p_client_request_id
  for update;
  if found then
    if v_existing.post_id is distinct from p_post_id
       or v_existing.code_snippet_id is distinct from p_code_snippet_id
       or v_existing.original_author_user_id is distinct from v_row.post_author_id
       or v_existing.proposed_code_text is distinct from p_proposed_code_text
       or v_existing.language is distinct from v_language
       or v_existing.file_name is distinct from v_file_name
       or v_existing.change_summary is distinct from v_summary
       or v_existing.explanation is distinct from v_explanation then
      raise exception using errcode = '23505', message = 'circle_code_proposal_idempotency_conflict';
    end if;
    return v_existing.id;
  end if;

  v_is_troubleshooting := v_row.post_type::text = 'troubleshooting';
  if v_is_troubleshooting then v_review_path := '/commune/troubleshooting-grove/review'; end if;

  insert into public.commune_code_revision_proposals (
    client_request_id, post_id, code_snippet_id, proposer_user_id,
    original_author_user_id, base_code_text, proposed_code_text,
    language, file_name, change_summary, explanation, base_snapshot_label,
    proposal_status
  ) values (
    p_client_request_id, p_post_id, p_code_snippet_id, v_actor,
    v_row.post_author_id, v_row.code_text, p_proposed_code_text,
    v_language, v_file_name, v_summary, v_explanation,
    'current accepted snapshot v' || v_row.accepted_version_number::text,
    'submitted'
  ) returning id into v_proposal_id;

  if v_is_troubleshooting then
    update public.commune_troubleshooting_posts
    set troubleshooting_status = case
          when troubleshooting_status in ('resolved', 'closed', 'archived') then troubleshooting_status
          else 'fix_proposed'
        end,
        updated_at = pg_catalog.now()
    where post_id = p_post_id;
  end if;

  if v_row.post_author_id <> v_actor then
    perform private.emit_account_notification_event(
      case when v_is_troubleshooting
        then 'commune.circle_troubleshooting_fix_proposed'
        else 'commune.circle_code_revision_proposed' end,
      'commune',
      'commune_code_revision_proposal',
      v_proposal_id,
      v_actor,
      'user',
      v_row.post_author_id,
      'circle-code-proposal:' || v_proposal_id::text,
      'suppressible',
      'community_circle',
      case when v_is_troubleshooting
        then 'Private Troubleshooting Grove fix proposed'
        else 'Private Coding Cornucopia revision proposed' end,
      'A selected participant proposed a change inside one of your private Circle posts.',
      v_review_path || '?proposal=' || v_proposal_id::text,
      'outcome'
    );
  end if;

  return v_proposal_id;
end;
$$;

create or replace function private.enforce_circle_code_proposal_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
begin
  if not private.commune_post_is_circle(new.post_id) then return new; end if;
  select post.user_id into v_owner from public.commune_posts as post where post.id = new.post_id;
  if new.proposal_status is distinct from old.proposal_status then
    if new.proposal_status = 'withdrawn' and old.proposer_user_id = v_actor then return new; end if;
    if new.proposal_status in ('accepted', 'rejected', 'needs_changes') and v_owner = v_actor then return new; end if;
    raise exception using errcode = '42501', message = 'circle_code_proposal_transition_forbidden';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_circle_code_proposal_transition
  on public.commune_code_revision_proposals;
create trigger enforce_circle_code_proposal_transition
before update on public.commune_code_revision_proposals
for each row execute function private.enforce_circle_code_proposal_transition();

alter function public.submit_circle_code_revision_proposal_v2(uuid, uuid, uuid, text, text, text, text, text)
  owner to postgres;
revoke all on function public.submit_circle_code_revision_proposal_v2(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_circle_code_revision_proposal_v2(uuid, uuid, uuid, text, text, text, text, text)
  to authenticated, service_role;

-- Sandbox source authorization must honor the linked private-post ACL itself.
-- Reviewer/admin role is never an ambient bypass for Circle content.
create or replace function private.sandbox_source_is_authorized(
  p_actor uuid,
  p_source_type text,
  p_source_id text,
  p_post_id uuid,
  p_code_document_id uuid,
  p_code_version_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_reviewer boolean;
begin
  if p_source_type = 'manual_snapshot' then
    return nullif(trim(coalesce(p_source_id, '')), '') is null
      and p_post_id is null
      and p_code_document_id is null
      and p_code_version_id is null;
  end if;

  if p_actor is null or coalesce(p_source_id, '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  v_source_id := p_source_id::uuid;
  v_reviewer := public.current_user_is_admin()
    or public.current_user_can_review_domain('commune'::public.review_domain);

  if p_source_type = 'commune_post_snippet' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_code_snippets as snippet
        join public.commune_posts as post on post.id = snippet.post_id
        where snippet.id = v_source_id
          and snippet.post_id = p_post_id
          and private.commune_post_boundary_allows(post.id, p_actor)
          and (
            (post.audience = 'public' and post.status = 'published' and post.visibility = 'public')
            or snippet.author_user_id = p_actor
            or private.commune_circle_post_member(post.id, p_actor)
            or (post.audience = 'public' and v_reviewer)
          )
      );
  elsif p_source_type = 'commune_code_document' then
    return p_post_id is null
      and p_code_version_id is null
      and p_code_document_id = v_source_id
      and exists (
        select 1
        from public.commune_code_documents as document
        where document.id = v_source_id
          and (
            (document.linked_commune_post_id is null and (
              document.visibility_state = 'published'
              or document.owner_user_id = p_actor
              or v_reviewer
            ))
            or private.commune_circle_post_member(document.linked_commune_post_id, p_actor)
            or (
              document.linked_commune_post_id is not null
              and not private.commune_post_is_circle(document.linked_commune_post_id)
              and (document.visibility_state = 'published' or document.owner_user_id = p_actor or v_reviewer)
            )
          )
      );
  elsif p_source_type = 'commune_code_version' then
    return p_post_id is null
      and p_code_version_id = v_source_id
      and exists (
        select 1
        from public.commune_code_document_versions as version
        join public.commune_code_documents as document on document.id = version.document_id
        where version.id = v_source_id
          and version.document_id = p_code_document_id
          and (
            (document.linked_commune_post_id is null and (
              document.visibility_state = 'published'
              or document.owner_user_id = p_actor
              or v_reviewer
            ))
            or private.commune_circle_post_member(document.linked_commune_post_id, p_actor)
            or (
              document.linked_commune_post_id is not null
              and not private.commune_post_is_circle(document.linked_commune_post_id)
              and (document.visibility_state = 'published' or document.owner_user_id = p_actor or v_reviewer)
            )
          )
      );
  elsif p_source_type = 'commune_code_revision_proposal' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_code_revision_proposals as proposal
        where proposal.id = v_source_id
          and proposal.post_id = p_post_id
          and private.commune_post_boundary_allows(proposal.post_id, p_actor)
          and (
            proposal.proposer_user_id = p_actor
            or proposal.original_author_user_id = p_actor
            or private.commune_circle_post_member(proposal.post_id, p_actor)
            or (not private.commune_post_is_circle(proposal.post_id) and v_reviewer)
          )
      );
  elsif p_source_type = 'repository_showcase_artifact' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_repository_showcases as showcase
        join public.commune_posts as post on post.id = showcase.post_id
        where showcase.id = v_source_id
          and showcase.post_id = p_post_id
          and private.commune_post_boundary_allows(post.id, p_actor)
          and (
            (post.audience = 'public' and post.post_type = 'repository_showcase' and post.status = 'published' and post.visibility = 'public')
            or showcase.user_id = p_actor
            or private.commune_circle_post_member(post.id, p_actor)
            or (post.audience = 'public' and v_reviewer)
          )
      );
  elsif p_source_type = 'iteration_showcase_artifact' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_iteration_showcases as showcase
        join public.commune_posts as post on post.id = showcase.post_id
        where showcase.id = v_source_id
          and showcase.post_id = p_post_id
          and private.commune_post_boundary_allows(post.id, p_actor)
          and (
            (post.audience = 'public' and post.post_type = 'elysia_iteration_showcase' and post.status = 'published' and post.visibility = 'public')
            or showcase.author_user_id = p_actor
            or private.commune_circle_post_member(post.id, p_actor)
            or (post.audience = 'public' and v_reviewer)
          )
      );
  end if;

  return false;
end;
$$;

alter function private.sandbox_source_is_authorized(uuid, text, text, uuid, uuid, uuid)
  owner to postgres;
revoke all on function private.sandbox_source_is_authorized(uuid, text, text, uuid, uuid, uuid)
  from public, anon, authenticated;

-- Storage is private by bucket and private-post objects also receive a restrictive ACL.
create policy "Circle members read private Commune storage objects"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('commune-media', 'commune-uploads')
    and exists (
      select 1
      from public.commune_media as media
      where media.storage_bucket = bucket_id
        and media.storage_path = name
        and private.commune_circle_post_member(media.post_id, auth.uid())
    )
  );
create policy "Circle-private Commune storage boundary"
  on storage.objects as restrictive for select to anon, authenticated
  using (private.commune_storage_object_boundary_allows(bucket_id, name, auth.uid()));

-- Aggregate vote results stay userless while respecting the parent private ACL.
create or replace function public.commune_vote_result_summary(target_vote_post_ids uuid[] default null)
returns table (vote_post_id uuid, option_id uuid, ballot_count bigint, total_ballots bigint, percentage numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with visible_options as (
    select o.vote_post_id, o.id as option_id
    from public.commune_vote_options o
    join public.commune_vote_posts v on v.post_id = o.vote_post_id
    join public.commune_posts p on p.id = v.post_id
    where (target_vote_post_ids is null or o.vote_post_id = any(target_vote_post_ids))
      and p.post_type = 'community_vote'
      and p.status = 'published'
      and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
      and p.hidden_at is null and p.removed_at is null and p.archived_at is null
      and (
        (p.audience = 'public' and p.visibility = 'public')
        or (p.audience = 'circle' and private.commune_circle_post_member(p.id, auth.uid()))
      )
      and (
        (p.audience = 'public' and (public.current_user_is_admin() or public.current_user_can_review_domain('commune'::public.review_domain)))
        or v.results_visibility = 'always'
        or (v.results_visibility = 'after_close' and v.vote_status in ('closed','accepted','declined','posted_to_official_update','archived'))
        or (v.results_visibility = 'after_vote' and (
          v.vote_status in ('closed','accepted','declined','posted_to_official_update','archived')
          or exists (
            select 1 from public.commune_vote_ballots own_ballot
            where own_ballot.vote_post_id = v.post_id and own_ballot.voter_user_id = auth.uid()
          )
        ))
      )
  ), counts as (
    select vo.vote_post_id, vo.option_id, count(b.id)::bigint as ballot_count
    from visible_options vo
    left join public.commune_vote_ballots b
      on b.vote_post_id = vo.vote_post_id and b.option_id = vo.option_id
    group by vo.vote_post_id, vo.option_id
  )
  select c.vote_post_id, c.option_id, c.ballot_count,
    sum(c.ballot_count) over (partition by c.vote_post_id)::bigint as total_ballots,
    case when sum(c.ballot_count) over (partition by c.vote_post_id) = 0 then 0
      else round((c.ballot_count::numeric / sum(c.ballot_count) over (partition by c.vote_post_id)::numeric) * 100, 2)
    end as percentage
  from counts c
  order by c.vote_post_id, c.option_id;
$$;

revoke all on function public.commune_vote_result_summary(uuid[]) from public;
grant execute on function public.commune_vote_result_summary(uuid[]) to anon, authenticated;

comment on table public.commune_post_circle_participants is
  'Explicit private Commune post ACL. Circle eligibility is checked only when access is added; later Circle removal does not silently rewrite historical post access.';
comment on column public.commune_posts.audience is
  'Immutable post audience. public uses existing moderation/publication paths; circle is account-backed ACL content, not local or end-to-end encrypted.';

commit;
