-- Reconcile pre-event open code proposals and legacy notification rows after
-- the governed account-communications foundation is present. Source records
-- remain authoritative; this migration creates safe, idempotent projections
-- only and never changes proposal or published-snapshot state.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

do $release_account_communication_reconciliation$
declare
  v_proposal record;
  v_event_id uuid;
  v_event_type text;
  v_title text;
  v_preview text;
  v_path text;
  v_backend_role text := 'service' || '_role';
  v_reconciliation jsonb;
  v_batch_count integer := 0;
begin
  for v_proposal in
    select
      proposal.id,
      proposal.client_request_id,
      proposal.proposer_user_id,
      proposal.original_author_user_id,
      post.post_type::text as post_type
    from public.commune_code_revision_proposals as proposal
    join public.commune_code_snippets as snippet
      on snippet.id = proposal.code_snippet_id
     and snippet.post_id = proposal.post_id
    join public.commune_posts as post
      on post.id = proposal.post_id
     and post.user_id = proposal.original_author_user_id
    where proposal.proposal_status = 'submitted'
    order by proposal.id
    for update of proposal
  loop
    v_path := case when v_proposal.post_type = 'troubleshooting'
      then '/commune/troubleshooting-grove/review?proposal=' || v_proposal.id::text
      else '/commune/coding-cornucopia/review?proposal=' || v_proposal.id::text
    end;
    v_event_type := case when v_proposal.post_type = 'troubleshooting'
      then 'commune.troubleshooting_fix_submitted'
      else 'commune.code_revision_proposal_submitted'
    end;
    v_title := case when v_proposal.post_type = 'troubleshooting'
      then 'A proposed fix is ready for review'
      else 'A code revision proposal is ready for review'
    end;
    v_preview := case when v_proposal.post_type = 'troubleshooting'
      then 'The public reproduction remains unchanged unless you accept the proposed fix.'
      else 'The public code remains unchanged unless you accept the proposed revision.'
    end;

    v_event_id := private.record_account_event(
      v_event_type,
      1,
      'commune',
      'code_revision_proposal',
      v_proposal.id,
      v_proposal.proposer_user_id,
      'user',
      'code-proposal:' || v_proposal.id::text || ':submitted:v1',
      'suppressible',
      'work_reviews',
      v_title,
      v_preview,
      pg_catalog.jsonb_build_object(
        'proposalKind', case when v_proposal.post_type = 'troubleshooting'
          then 'troubleshooting_fix' else 'code_revision' end,
        'status', 'submitted'
      ),
      v_path,
      'source_lifecycle',
      v_proposal.client_request_id
    );

    if v_proposal.original_author_user_id <> v_proposal.proposer_user_id then
      perform private.project_account_event(
        v_event_id,
        v_proposal.original_author_user_id,
        'action',
        'review_code_proposal',
        75,
        'information',
        false
      );
    end if;
  end loop;

  -- This is the same governed service-only reconciliation exercised by the
  -- disposable RLS suite. It creates safe generic summaries, preserves legacy
  -- read state, rejects external links, and reuses source-matched projections.
  perform pg_catalog.set_config('request.jwt.claim.role', v_backend_role, true);
  loop
    v_reconciliation := public.reconcile_legacy_account_notifications(2000);
    exit when (v_reconciliation ->> 'remaining')::bigint = 0;
    v_batch_count := v_batch_count + 1;
    if v_batch_count >= 50 then
      raise exception using
        errcode = '55000',
        message = 'account_notification_reconciliation_did_not_converge';
    end if;
  end loop;

  if exists (
    select 1
    from public.commune_code_revision_proposals as proposal
    where proposal.proposal_status = 'submitted'
      and not exists (
        select 1
        from private.account_events as event
        where event.source_domain = 'commune'
          and event.source_type = 'code_revision_proposal'
          and event.source_record_id = proposal.id
          and event.idempotency_key =
            'code-proposal:' || proposal.id::text || ':submitted:v1'
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'open_code_proposal_event_reconciliation_incomplete';
  end if;

  if exists (
    select 1
    from public.commune_code_revision_proposals as proposal
    where proposal.proposal_status = 'submitted'
      and proposal.original_author_user_id <> proposal.proposer_user_id
      and not exists (
        select 1
        from public.account_inbox_items as inbox_item
        where inbox_item.recipient_user_id = proposal.original_author_user_id
          and inbox_item.source_domain = 'commune'
          and inbox_item.source_type = 'code_revision_proposal'
          and inbox_item.source_record_id = proposal.id
          and inbox_item.action_kind = 'review_code_proposal'
          and inbox_item.completed_at is null
          and inbox_item.superseded_at is null
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'open_code_proposal_inbox_reconciliation_incomplete';
  end if;
end;
$release_account_communication_reconciliation$;

commit;
