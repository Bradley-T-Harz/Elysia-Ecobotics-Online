-- Repair the Commune moderation soft-delete RPC after production exposed a
-- deferred undefined-column failure. Sidecar updates are scoped to the parent
-- post type so deleting a Community Voting Room post cannot plan unrelated
-- sidecar statements. Existing content and audit/governance rows are preserved.

create or replace function public.soft_delete_commune_post(target_post_id uuid, moderation_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_target_post_id uuid := target_post_id;
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_post record;
  v_post_type text;
  v_saved_rows integer := 0;
  v_legacy_saved_rows integer := 0;
  v_notification_rows integer := 0;
  v_followed_rows integer := 0;
  v_reaction_rows integer := 0;
  v_comment_rows integer := 0;
  v_media_rows integer := 0;
  v_upload_rows integer := 0;
  v_code_proposal_rows integer := 0;
  v_troubleshooting_rows integer := 0;
  v_research_rows integer := 0;
  v_job_rows integer := 0;
  v_repository_rows integer := 0;
  v_iteration_rows integer := 0;
  v_official_rows integer := 0;
  v_official_code_rows integer := 0;
  v_vote_rows integer := 0;
begin
  if v_actor is null then
    raise exception 'Sign in before deleting Commune posts.' using errcode = '28000';
  end if;

  if not public.current_user_can_review_domain('commune'::public.review_domain) then
    raise exception 'Commune soft-delete cleanup requires a Commune moderator/admin role.' using errcode = '42501';
  end if;

  select p.id, p.status, p.post_type
    into v_post
    from public.commune_posts p
    where p.id = v_target_post_id
    for update;

  if not found then
    raise exception 'Commune post % was not found for soft-delete cleanup.', v_target_post_id using errcode = 'P0002';
  end if;

  v_post_type := v_post.post_type::text;

  update public.commune_posts
     set status = 'removed_by_moderator',
         visibility = 'private_draft',
         visibility_state = 'removed',
         moderation_status = 'soft_deleted_by_moderator',
         moderation_reason = moderation_note,
         hidden_at = coalesce(hidden_at, v_now),
         hidden_by = v_actor,
         removed_at = coalesce(removed_at, v_now),
         updated_at = v_now,
         last_activity_at = v_now
   where id = v_target_post_id;

  delete from public.user_saved_commune_posts
   where post_id = v_target_post_id;
  get diagnostics v_saved_rows = row_count;

  delete from public.commune_saved_posts
   where post_id = v_target_post_id;
  get diagnostics v_legacy_saved_rows = row_count;

  delete from public.user_followed_commune_threads followed
  using public.commune_threads thread
   where followed.thread_id = thread.id
     and thread.post_id = v_target_post_id;
  get diagnostics v_followed_rows = row_count;

  delete from public.commune_content_reactions reaction
   where (reaction.target_type = 'post' and reaction.target_id = v_target_post_id)
      or (
        reaction.target_type = 'comment'
        and exists (
          select 1
          from public.commune_comments comment
          where comment.id = reaction.target_id
            and comment.post_id = v_target_post_id
        )
      );
  get diagnostics v_reaction_rows = row_count;

  update public.commune_comments
     set status = case when status in ('removed_by_moderator', 'deleted_by_user', 'archived') then status else 'removed_by_moderator' end,
         visibility_state = 'removed',
         hidden_at = coalesce(hidden_at, v_now),
         hidden_by = v_actor,
         removed_at = coalesce(removed_at, v_now),
         updated_at = v_now,
         moderation_reason = coalesce(moderation_reason, moderation_note)
   where post_id = v_target_post_id
     and (visibility_state is distinct from 'removed' or status not in ('removed_by_moderator', 'deleted_by_user', 'archived'));
  get diagnostics v_comment_rows = row_count;

  update public.commune_media
     set visibility_state = 'removed',
         updated_at = v_now
   where post_id = v_target_post_id
     and visibility_state in ('submitted', 'published', 'flagged', 'hidden');
  get diagnostics v_media_rows = row_count;

  update public.commune_uploads
     set status = 'removed_by_moderator',
         hidden_at = coalesce(hidden_at, v_now),
         hidden_by = v_actor,
         moderation_reason = coalesce(moderation_reason, moderation_note)
   where post_id = v_target_post_id
     and status in ('pending_review', 'approved', 'published', 'hidden', 'archived');
  get diagnostics v_upload_rows = row_count;

  if v_post_type in ('code_sharing', 'troubleshooting') then
    update public.commune_code_revision_proposals
       set proposal_status = 'hidden_by_moderation',
           hidden_at = coalesce(hidden_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and proposal_status <> 'hidden_by_moderation';
    get diagnostics v_code_proposal_rows = row_count;
  end if;

  if v_post_type = 'troubleshooting' then
    update public.commune_troubleshooting_posts
       set troubleshooting_status = 'archived',
           archived_at = coalesce(archived_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and troubleshooting_status <> 'archived';
    get diagnostics v_troubleshooting_rows = row_count;
  end if;

  if v_post_type = 'research_note' then
    update public.commune_research_notes
       set review_status = 'archived',
           archived_at = coalesce(archived_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and review_status <> 'archived';
    get diagnostics v_research_rows = row_count;
  end if;

  if v_post_type = 'job_post' then
    update public.commune_job_posts
       set application_status = 'archived',
           anti_scam_review_status = 'removed',
           archived_at = coalesce(archived_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and (application_status <> 'archived' or anti_scam_review_status <> 'removed');
    get diagnostics v_job_rows = row_count;
  end if;

  if v_post_type = 'repository_showcase' then
    -- status and updated_at are the canonical repository-sidecar columns.
    update public.commune_repository_showcases
       set status = 'rejected',
           updated_at = v_now
     where post_id = v_target_post_id;
    get diagnostics v_repository_rows = row_count;
  end if;

  if v_post_type = 'elysia_iteration_showcase' then
    update public.commune_iteration_showcases
       set status = 'rejected',
           sandbox_review_status = case when sandbox_review_status is null or sandbox_review_status = 'not_requested' then sandbox_review_status else 'archived' end,
           updated_at = v_now
     where post_id = v_target_post_id;
    get diagnostics v_iteration_rows = row_count;
  end if;

  if v_post_type = 'official_update' then
    update public.commune_official_updates
       set official_status = 'archived',
           correction_status = 'retracted',
           archived_at = coalesce(archived_at, v_now),
           retracted_at = coalesce(retracted_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id;
    get diagnostics v_official_rows = row_count;

    update public.commune_official_update_code_snippets
       set public_visible = false,
           edited_by = v_actor,
           edited_at = coalesce(edited_at, v_now),
           updated_at = v_now
     where post_id = v_target_post_id
       and public_visible = true;
    get diagnostics v_official_code_rows = row_count;
  end if;

  if v_post_type = 'community_vote' then
    update public.commune_vote_posts
       set vote_status = 'archived',
           updated_at = v_now
     where post_id = v_target_post_id
       and vote_status <> 'archived';
    get diagnostics v_vote_rows = row_count;
  end if;

  delete from public.user_notifications notification
   where notification.action_url like '%/commune/posts/' || v_target_post_id::text || '%'
      or (
        notification.source_id = v_target_post_id
        and lower(coalesce(notification.source_type, '')) in (
          'commune_post',
          'commune_posts',
          'post',
          'community_vote',
          'commune_vote_post',
          'commune_vote_posts'
        )
      )
      or (
        exists (select 1 from public.commune_comments comment where comment.id = notification.source_id and comment.post_id = v_target_post_id)
        and lower(coalesce(notification.source_type, '')) in ('commune_comment', 'commune_comments', 'comment')
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_troubleshooting_post', 'commune_troubleshooting_posts', 'troubleshooting', 'troubleshooting_grove')
        and exists (select 1 from public.commune_troubleshooting_posts sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_research_note', 'commune_research_notes', 'research_note', 'research_notes')
        and exists (select 1 from public.commune_research_notes sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_job_post', 'commune_job_posts', 'job_post', 'job_posts')
        and exists (select 1 from public.commune_job_posts sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_repository_showcase', 'commune_repository_showcases', 'repository_showcase')
        and exists (select 1 from public.commune_repository_showcases sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_iteration_showcase', 'commune_iteration_showcases', 'elysia_iteration_showcase')
        and exists (select 1 from public.commune_iteration_showcases sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_official_update', 'commune_official_updates', 'official_update')
        and exists (select 1 from public.commune_official_updates sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      )
      or (
        lower(coalesce(notification.source_type, '')) in ('commune_code_revision_proposal', 'commune_code_revision_proposals', 'code_revision_proposal')
        and exists (select 1 from public.commune_code_revision_proposals sidecar where sidecar.id = notification.source_id and sidecar.post_id = v_target_post_id)
      );
  get diagnostics v_notification_rows = row_count;

  insert into public.commune_moderation_events (
    actor_id,
    target_type,
    target_id,
    action,
    from_status,
    to_status,
    reason,
    metadata
  )
  values (
    v_actor,
    'post',
    v_target_post_id,
    'soft_delete_from_public',
    v_post.status::text,
    'removed_by_moderator',
    moderation_note,
    jsonb_build_object(
      'source', 'soft_delete_commune_post',
      'public_content_removed', true,
      'hard_delete', false,
      'post_type', v_post_type,
      'saved_rows_deleted', v_saved_rows,
      'legacy_saved_rows_deleted', v_legacy_saved_rows,
      'notifications_deleted', v_notification_rows,
      'followed_thread_rows_deleted', v_followed_rows,
      'reaction_rows_deleted', v_reaction_rows,
      'comment_rows_removed', v_comment_rows,
      'media_rows_removed', v_media_rows,
      'upload_rows_removed', v_upload_rows,
      'code_proposal_rows_hidden', v_code_proposal_rows,
      'troubleshooting_rows_archived', v_troubleshooting_rows,
      'research_rows_archived', v_research_rows,
      'job_rows_archived', v_job_rows,
      'repository_rows_rejected', v_repository_rows,
      'iteration_rows_rejected', v_iteration_rows,
      'official_rows_archived', v_official_rows,
      'official_code_rows_hidden', v_official_code_rows,
      'vote_rows_archived', v_vote_rows,
      'audit_preserved', jsonb_build_array('commune_reports', 'commune_abuse_reports', 'commune_moderation_events', 'review_items', 'review_events', 'commune_vote_options', 'commune_vote_ballots', 'commune_vote_events')
    )
  );

  return jsonb_build_object(
    'ok', true,
    'post_id', v_target_post_id,
    'status', 'removed_by_moderator',
    'saved_rows_deleted', v_saved_rows,
    'legacy_saved_rows_deleted', v_legacy_saved_rows,
    'notifications_deleted', v_notification_rows,
    'followed_thread_rows_deleted', v_followed_rows,
    'reaction_rows_deleted', v_reaction_rows,
    'comment_rows_removed', v_comment_rows,
    'media_rows_removed', v_media_rows,
    'upload_rows_removed', v_upload_rows,
    'code_proposal_rows_hidden', v_code_proposal_rows,
    'sidecars_removed_from_public', jsonb_build_object(
      'troubleshooting', v_troubleshooting_rows,
      'research_notes', v_research_rows,
      'job_posts', v_job_rows,
      'repository_showcase', v_repository_rows,
      'elysia_iteration_showcase', v_iteration_rows,
      'official_update', v_official_rows,
      'community_vote', v_vote_rows
    )
  );
end;
$$;

revoke all on function public.soft_delete_commune_post(uuid, text) from public;
revoke all on function public.soft_delete_commune_post(uuid, text) from anon;
grant execute on function public.soft_delete_commune_post(uuid, text) to authenticated;

comment on function public.soft_delete_commune_post(uuid, text) is
  'Atomically soft-deletes one Commune parent post, scopes sidecar suppression to that post type, removes normal user-facing pointers, and preserves moderation and vote audit history.';
