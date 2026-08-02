-- Project governed Coding Cornucopia and Troubleshooting Grove proposal facts
-- into the Commons event foundation. Proposal rows remain authoritative and
-- legacy user_notifications remain intact during compatibility observation.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create or replace function private.project_code_proposal_account_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post record;
  v_event_id uuid;
  v_status text;
  v_event_type text;
  v_title text;
  v_preview text;
  v_path text;
  v_category text := 'work_reviews';
  v_delivery_class text := 'suppressible';
  v_notification_kind text := 'outcome';
  v_actor uuid;
  v_actor_kind text := 'user';
  v_recipient uuid;
begin
  select post.post_type, post.user_id as author_user_id
  into v_post
  from public.commune_posts as post
  join public.commune_code_snippets as snippet
    on snippet.post_id = post.id
   and snippet.id = new.code_snippet_id
  where post.id = new.post_id;
  if not found or v_post.author_user_id is distinct from new.original_author_user_id then
    raise exception using errcode = '55000', message = 'code_proposal_event_source_inconsistent';
  end if;
  v_path := case when v_post.post_type = 'troubleshooting'::public.commune_post_type
    then '/commune/troubleshooting-grove/review?proposal=' || new.id::text
    else '/commune/coding-cornucopia/review?proposal=' || new.id::text
  end;

  if tg_op = 'INSERT' then
    if new.proposal_status <> 'submitted' then
      raise exception using errcode = '55000', message = 'code_proposal_initial_event_state_invalid';
    end if;
    v_event_type := case when v_post.post_type = 'troubleshooting'::public.commune_post_type
      then 'commune.troubleshooting_fix_submitted'
      else 'commune.code_revision_proposal_submitted'
    end;
    v_title := case when v_post.post_type = 'troubleshooting'::public.commune_post_type
      then 'A proposed fix is ready for review'
      else 'A code revision proposal is ready for review'
    end;
    v_preview := case when v_post.post_type = 'troubleshooting'::public.commune_post_type
      then 'The public reproduction remains unchanged unless you accept the proposed fix.'
      else 'The public code remains unchanged unless you accept the proposed revision.'
    end;
    v_event_id := private.record_account_event(
      v_event_type, 1, 'commune', 'code_revision_proposal', new.id,
      new.proposer_user_id, 'user',
      'code-proposal:' || new.id::text || ':submitted:v1',
      'suppressible', 'work_reviews', v_title, v_preview,
      pg_catalog.jsonb_build_object(
        'proposalKind', case when v_post.post_type = 'troubleshooting'::public.commune_post_type
          then 'troubleshooting_fix' else 'code_revision' end,
        'status', 'submitted'
      ),
      v_path, 'source_lifecycle', new.client_request_id
    );
    if new.original_author_user_id <> new.proposer_user_id then
      perform private.project_account_event(
        v_event_id, new.original_author_user_id,
        'action', 'review_code_proposal', 75, 'information', false
      );
    end if;
    return new;
  end if;

  if old.proposal_status is not distinct from new.proposal_status then
    return new;
  end if;
  v_status := new.proposal_status;
  if v_status not in (
    'accepted', 'rejected', 'needs_changes', 'withdrawn', 'hidden_by_moderation'
  ) then
    return new;
  end if;

  perform private.resolve_account_inbox_items(
    'commune', 'code_revision_proposal', new.id,
    new.original_author_user_id,
    case when v_status in ('withdrawn', 'hidden_by_moderation')
      then 'superseded' else 'completed' end
  );

  if v_status = 'withdrawn' then
    v_event_type := 'commune.code_revision_proposal_withdrawn';
    v_title := case when v_post.post_type = 'troubleshooting'::public.commune_post_type
      then 'A proposed fix was withdrawn'
      else 'A code revision proposal was withdrawn'
    end;
    v_preview := case when v_post.post_type = 'troubleshooting'::public.commune_post_type
      then 'The proposer withdrew the proposed fix. The public reproduction remains unchanged.'
      else 'The proposer withdrew the revision proposal. The public code remains unchanged.'
    end;
    v_actor := new.proposer_user_id;
    v_recipient := new.original_author_user_id;
  else
    v_event_type := 'commune.code_revision_proposal_' || v_status;
    v_actor := new.decision_by;
    v_recipient := new.proposer_user_id;
    if v_status = 'accepted' then
      v_title := case when v_post.post_type = 'troubleshooting'::public.commune_post_type
        then 'Your proposed fix was accepted'
        else 'Your code revision was accepted'
      end;
      v_preview := case when v_post.post_type = 'troubleshooting'::public.commune_post_type
        then 'The original author accepted your fix and published the accepted snapshot.'
        else 'The original author accepted your revision and published the accepted snapshot.'
      end;
    elsif v_status = 'needs_changes' then
      v_title := 'Changes were requested on your proposal';
      v_preview := 'The original author requested changes. The published snapshot remains unchanged.';
    elsif v_status = 'hidden_by_moderation' then
      v_title := 'Your proposal was hidden for moderation review';
      v_preview := 'A moderator hid the proposal. The published snapshot remains unchanged.';
      v_category := 'moderation';
      v_delivery_class := 'mandatory';
      v_notification_kind := 'mandatory_notice';
      v_actor_kind := 'staff';
    else
      v_title := 'Your code revision proposal was not accepted';
      v_preview := 'The original author declined the proposal. The published snapshot remains unchanged.';
    end if;
  end if;

  v_event_id := private.record_account_event(
    v_event_type, 1, 'commune', 'code_revision_proposal', new.id,
    v_actor, v_actor_kind,
    'code-proposal:' || new.id::text || ':' || v_status || ':v1',
    v_delivery_class, v_category, v_title, v_preview,
    pg_catalog.jsonb_build_object(
      'proposalKind', case when v_post.post_type = 'troubleshooting'::public.commune_post_type
        then 'troubleshooting_fix' else 'code_revision' end,
      'status', v_status
    ),
    v_path,
    case when v_status = 'hidden_by_moderation' then 'audit' else 'source_lifecycle' end,
    new.client_request_id
  );
  if v_recipient is not null and v_recipient is distinct from v_actor then
    perform private.project_account_event(
      v_event_id, v_recipient, null, null, 50, v_notification_kind, false
    );
  end if;

  -- Withdrawal did not have a legacy producer. Keep Signals compatibility
  -- complete while new and legacy projections run side by side.
  if v_status = 'withdrawn'
     and new.original_author_user_id <> new.proposer_user_id then
    insert into public.user_notifications(
      user_id, notification_type, source_type, source_id,
      title, body, action_url
    ) values (
      new.original_author_user_id,
      case when v_post.post_type = 'troubleshooting'::public.commune_post_type
        then 'commune_troubleshooting_fix_withdrawn'
        else 'commune_code_revision_withdrawn' end,
      'commune_code_revision_proposal', new.id, v_title, v_preview, v_path
    );
  end if;
  return new;
end;
$$;

alter function private.project_code_proposal_account_event() owner to postgres;
revoke all privileges on function private.project_code_proposal_account_event()
  from public, anon, authenticated, service_role;

drop trigger if exists project_code_proposal_account_event
  on public.commune_code_revision_proposals;
create trigger project_code_proposal_account_event
after insert or update of proposal_status
on public.commune_code_revision_proposals
for each row execute function private.project_code_proposal_account_event();

comment on function private.project_code_proposal_account_event() is
  'Transactionally emits safe account events from authoritative proposal creation and status transitions. It does not grant proposal access or copy private proposal content.';

commit;
