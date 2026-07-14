-- Commune comment/reply direct-publish policy hardening.
-- Apply manually in Supabase after review. This keeps the public website under RLS:
-- - first-time participants insert pending comments for review
-- - admins/moderators, approved thread participants, and approved post authors may insert published comments
-- - direct-published comments can create admin-only review history without entering the Active queue

create extension if not exists pgcrypto;

insert into public.commune_threads (post_id, title, created_by, visibility, status)
select p.id, p.title, p.user_id, 'public', 'open'
from public.commune_posts p
where p.status = 'published'
  and p.visibility = 'public'
  and not exists (
    select 1 from public.commune_threads t where t.post_id = p.id
  );

insert into public.commune_thread_participant_approvals (
  thread_id,
  post_id,
  user_id,
  approved_by,
  approval_source,
  status,
  reason
)
select
  t.id,
  p.id,
  p.user_id,
  p.user_id,
  'approved_post_author',
  'approved',
  'Approved public post author may participate in their own thread.'
from public.commune_posts p
join public.commune_threads t on t.post_id = p.id
where p.status = 'published'
  and p.visibility = 'public'
  and p.user_id is not null
on conflict (thread_id, user_id) do nothing;

drop policy if exists "users create pending commune comments" on public.commune_comments;
drop policy if exists "users create own commune comments with thread approval" on public.commune_comments;
create policy "users create own commune comments with thread approval"
  on public.commune_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      status in ('draft','pending_review')
      or (
        status = 'published'
        and (
          public.current_user_can_review_domain('commune'::public.review_domain)
          or exists (
            select 1
            from public.commune_thread_participant_approvals approval
            where approval.thread_id = commune_comments.thread_id
              and approval.user_id = auth.uid()
              and approval.status = 'approved'
              and approval.revoked_at is null
          )
          or exists (
            select 1
            from public.commune_posts p
            where p.id = commune_comments.post_id
              and p.user_id = auth.uid()
              and p.status = 'published'
              and p.visibility = 'public'
          )
        )
      )
    )
  );

drop policy if exists "post authors create own thread participation approvals" on public.commune_thread_participant_approvals;
create policy "post authors create own thread participation approvals"
  on public.commune_thread_participant_approvals
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and approved_by = auth.uid()
    and status = 'approved'
    and approval_source = 'approved_post_author'
    and exists (
      select 1
      from public.commune_threads t
      join public.commune_posts p on p.id = coalesce(commune_thread_participant_approvals.post_id, t.post_id)
      where t.id = commune_thread_participant_approvals.thread_id
        and p.user_id = auth.uid()
        and p.status = 'published'
        and p.visibility = 'public'
    )
  );

drop policy if exists "submitters create own direct commune history events" on public.review_events;
create policy "submitters create own direct commune history events"
  on public.review_events
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and event_type in (
      'admin_comment_direct_published',
      'moderator_comment_direct_published',
      'approved_participant_comment_direct_published'
    )
    and coalesce(metadata->>'history_only', 'false') = 'true'
    and exists (
      select 1
      from public.review_items ri
      where ri.id = review_item_id
        and ri.domain = 'commune'::public.review_domain
        and ri.source_table = 'commune_comments'
        and ri.source_id is not null
        and ri.submitted_by = auth.uid()
        and ri.status = 'approved'
    )
  );
