-- Close direct proposal writes and make proposal creation, decisions, and
-- withdrawal authoritative, cross-checked, and retry-safe.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

alter table public.commune_code_revision_proposals
  add column if not exists client_request_id uuid;

update public.commune_code_revision_proposals
set client_request_id = id
where client_request_id is null;

alter table public.commune_code_revision_proposals
  alter column client_request_id set not null;

create unique index if not exists commune_code_revision_proposer_request_idx
  on public.commune_code_revision_proposals(proposer_user_id, client_request_id);

create unique index if not exists commune_code_snippets_post_id_id_idx
  on public.commune_code_snippets(post_id, id);

alter table public.commune_code_revision_proposals
  drop constraint if exists commune_code_revision_proposals_post_snippet_fk;
alter table public.commune_code_revision_proposals
  add constraint commune_code_revision_proposals_post_snippet_fk
  foreign key (post_id, code_snippet_id)
  references public.commune_code_snippets(post_id, id)
  on delete cascade;

drop policy if exists "signed users propose code revisions"
  on public.commune_code_revision_proposals;
drop policy if exists "proposers withdraw own code proposals"
  on public.commune_code_revision_proposals;
drop policy if exists "moderators manage code proposals"
  on public.commune_code_revision_proposals;
drop policy if exists "code proposal participants read relevant proposals"
  on public.commune_code_revision_proposals;
create policy "code proposal participants read relevant proposals"
  on public.commune_code_revision_proposals
  for select to authenticated
  using (
    proposer_user_id = auth.uid()
    or original_author_user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

revoke insert, update, delete, truncate, references, trigger
  on public.commune_code_revision_proposals from authenticated;
grant select on public.commune_code_revision_proposals to authenticated;

create or replace function public.submit_commune_code_revision_proposal_v2(
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
    raise exception using errcode = '42501', message = 'code_proposal_authentication_required';
  end if;
  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'code_proposal_client_request_id_required';
  end if;
  if not private.community_online_action_allowed(v_actor, 'commune_commenting') then
    raise exception using errcode = '42501', message = 'code_proposal_participation_not_allowed';
  end if;
  if p_post_id is null or p_code_snippet_id is null then
    raise exception using errcode = '22023', message = 'code_proposal_source_required';
  end if;
  if pg_catalog.char_length(coalesce(p_proposed_code_text, '')) > 100000 then
    raise exception using errcode = '22023', message = 'code_proposal_too_large';
  end if;
  if pg_catalog.char_length(v_summary) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'code_proposal_summary_invalid';
  end if;
  if v_explanation is not null and pg_catalog.char_length(v_explanation) > 8000 then
    raise exception using errcode = '22023', message = 'code_proposal_explanation_too_large';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || p_client_request_id::text, 0)
  );

  select
    snippet.id as snippet_id,
    snippet.post_id,
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
    and post.status = 'published'::public.commune_post_status
    and post.visibility = 'public'::public.commune_visibility
    and post.hidden_at is null
    and post.removed_at is null
    and post.archived_at is null;

  if not found or v_row.post_author_id is null then
    raise exception using errcode = '42501', message = 'code_proposal_source_unavailable';
  end if;
  if v_row.post_type not in (
    'code_sharing'::public.commune_post_type,
    'troubleshooting'::public.commune_post_type
  ) then
    raise exception using errcode = '22023', message = 'code_proposal_source_type_invalid';
  end if;

  v_language := nullif(
    pg_catalog.btrim(coalesce(p_language, v_row.current_language, 'text')), ''
  );
  v_file_name := nullif(
    pg_catalog.btrim(coalesce(p_file_name, v_row.current_file_name, 'snippet')), ''
  );

  if coalesce(p_proposed_code_text, '') = coalesce(v_row.code_text, '')
     and coalesce(v_language, '') = coalesce(v_row.current_language, '')
     and coalesce(v_file_name, '') = coalesce(v_row.current_file_name, '') then
    raise exception using errcode = '22023', message = 'code_proposal_meaningful_change_required';
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
      raise exception using errcode = '23505', message = 'code_proposal_idempotency_conflict';
    end if;
    return v_existing.id;
  end if;

  v_is_troubleshooting := v_row.post_type = 'troubleshooting'::public.commune_post_type;
  if v_is_troubleshooting then
    v_review_path := '/commune/troubleshooting-grove/review';
  end if;

  insert into public.commune_code_revision_proposals (
    client_request_id,
    post_id,
    code_snippet_id,
    proposer_user_id,
    original_author_user_id,
    base_code_text,
    proposed_code_text,
    language,
    file_name,
    change_summary,
    explanation,
    base_snapshot_label,
    proposal_status
  ) values (
    p_client_request_id,
    p_post_id,
    p_code_snippet_id,
    v_actor,
    v_row.post_author_id,
    v_row.code_text,
    p_proposed_code_text,
    v_language,
    v_file_name,
    v_summary,
    v_explanation,
    'current accepted snapshot v' || v_row.accepted_version_number::text,
    'submitted'
  )
  returning id into v_proposal_id;

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
    insert into public.user_notifications (
      user_id, notification_type, source_type, source_id, title, body, action_url
    ) values (
      v_row.post_author_id,
      case when v_is_troubleshooting
        then 'commune_troubleshooting_fix_proposed'
        else 'commune_code_revision_proposed' end,
      'commune_code_revision_proposal',
      v_proposal_id,
      case when v_is_troubleshooting
        then 'New Troubleshooting Grove proposed fix'
        else 'New Coding Cornucopia revision proposal' end,
      case when v_is_troubleshooting
        then 'A community member proposed a fix for "' || coalesce(v_row.post_title, 'your Troubleshooting Grove issue') || '". The public reproduction snippet will not change unless you accept it.'
        else 'A community member proposed a revision to "' || coalesce(v_row.post_title, 'your Coding Cornucopia post') || '". The public code will not change unless you accept it.' end,
      v_review_path || '?proposal=' || v_proposal_id::text
    );
  end if;

  return v_proposal_id;
end;
$$;

create or replace function public.submit_commune_code_revision_proposal(
  p_post_id uuid,
  p_code_snippet_id uuid,
  p_proposed_code_text text,
  p_language text,
  p_file_name text,
  p_change_summary text,
  p_explanation text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.submit_commune_code_revision_proposal_v2(
    gen_random_uuid(), p_post_id, p_code_snippet_id, p_proposed_code_text,
    p_language, p_file_name, p_change_summary, p_explanation
  );
$$;

create or replace function public.withdraw_commune_code_revision_proposal(
  p_proposal_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_proposal public.commune_code_revision_proposals%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'code_proposal_authentication_required';
  end if;
  select proposal.* into v_proposal
  from public.commune_code_revision_proposals as proposal
  where proposal.id = p_proposal_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'code_proposal_not_found';
  end if;
  if v_proposal.proposer_user_id <> v_actor then
    raise exception using errcode = '42501', message = 'code_proposal_withdrawal_forbidden';
  end if;
  if v_proposal.proposal_status not in ('submitted', 'needs_changes') then
    raise exception using errcode = '55000', message = 'code_proposal_withdrawal_state_invalid';
  end if;
  update public.commune_code_revision_proposals
  set proposal_status = 'withdrawn',
      withdrawn_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = p_proposal_id;
end;
$$;

create or replace function public.decide_commune_code_revision_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_next_version integer;
  v_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision, '')));
  v_is_troubleshooting boolean := false;
  v_review_path text := '/commune/coding-cornucopia/review';
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'code_proposal_authentication_required';
  end if;
  if v_status not in ('accepted', 'rejected', 'needs_changes', 'hidden_by_moderation') then
    raise exception using errcode = '22023', message = 'code_proposal_decision_invalid';
  end if;
  if p_decision_note is not null and pg_catalog.char_length(p_decision_note) > 4000 then
    raise exception using errcode = '22023', message = 'code_proposal_decision_note_too_large';
  end if;

  select
    proposal.*,
    post.title as post_title,
    post.post_type,
    post.user_id as current_post_author_id,
    snippet.accepted_version_number as current_version
  into v_row
  from public.commune_code_revision_proposals as proposal
  join public.commune_posts as post on post.id = proposal.post_id
  join public.commune_code_snippets as snippet
    on snippet.id = proposal.code_snippet_id
   and snippet.post_id = proposal.post_id
  where proposal.id = p_proposal_id
  for update of proposal, snippet;

  if not found then
    raise exception using errcode = 'P0002', message = 'code_proposal_not_found_or_inconsistent';
  end if;
  if v_row.original_author_user_id is distinct from v_row.current_post_author_id then
    raise exception using errcode = '55000', message = 'code_proposal_author_inconsistent';
  end if;

  v_is_troubleshooting := v_row.post_type = 'troubleshooting'::public.commune_post_type;
  if v_is_troubleshooting then
    v_review_path := '/commune/troubleshooting-grove/review';
  end if;

  if v_status = 'hidden_by_moderation' then
    if not public.current_user_can_review_domain('commune'::public.review_domain) then
      raise exception using errcode = '42501', message = 'code_proposal_moderator_required';
    end if;
  elsif v_row.original_author_user_id <> v_actor then
    raise exception using errcode = '42501', message = 'code_proposal_original_author_required';
  end if;
  if v_row.proposal_status not in ('submitted', 'needs_changes') then
    raise exception using errcode = '55000', message = 'code_proposal_decision_state_invalid';
  end if;

  if v_status = 'accepted' then
    v_next_version := coalesce(v_row.current_version, 1) + 1;
    update public.commune_code_snippets
    set code_text = v_row.proposed_code_text,
        language = v_row.language,
        file_name = v_row.file_name,
        accepted_revision_id = v_row.id,
        accepted_version_number = v_next_version,
        accepted_revision_proposer_user_id = v_row.proposer_user_id,
        accepted_revision_summary = v_row.change_summary,
        accepted_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where id = v_row.code_snippet_id
      and post_id = v_row.post_id;

    update public.commune_code_revision_proposals
    set proposal_status = 'accepted',
        accepted_version_number = v_next_version,
        decision_by = v_actor,
        decision_note = nullif(pg_catalog.btrim(coalesce(p_decision_note, '')), ''),
        decided_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where id = p_proposal_id;

    if v_is_troubleshooting then
      update public.commune_troubleshooting_posts
      set troubleshooting_status = 'resolved',
          accepted_proposal_id = p_proposal_id,
          accepted_resolution_kind = 'proposal',
          accepted_summary = v_row.change_summary,
          accepted_by = v_actor,
          accepted_at = pg_catalog.now(),
          resolved_at = pg_catalog.now(),
          updated_at = pg_catalog.now()
      where post_id = v_row.post_id;
    end if;
  elsif v_status = 'hidden_by_moderation' then
    update public.commune_code_revision_proposals
    set proposal_status = 'hidden_by_moderation',
        decision_by = v_actor,
        decision_note = nullif(pg_catalog.btrim(coalesce(p_decision_note, '')), ''),
        hidden_at = pg_catalog.now(),
        decided_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where id = p_proposal_id;
  else
    update public.commune_code_revision_proposals
    set proposal_status = v_status,
        decision_by = v_actor,
        decision_note = nullif(pg_catalog.btrim(coalesce(p_decision_note, '')), ''),
        decided_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where id = p_proposal_id;

    if v_is_troubleshooting then
      update public.commune_troubleshooting_posts
      set troubleshooting_status = case when v_status = 'needs_changes'
            then 'needs_information' else 'in_progress' end,
          updated_at = pg_catalog.now()
      where post_id = v_row.post_id
        and troubleshooting_status not in ('resolved', 'closed', 'archived');
    end if;
  end if;

  if v_row.proposer_user_id <> v_actor then
    insert into public.user_notifications (
      user_id, notification_type, source_type, source_id, title, body, action_url
    ) values (
      v_row.proposer_user_id,
      case when v_is_troubleshooting
        then 'commune_troubleshooting_fix_' || v_status
        else 'commune_code_revision_' || v_status end,
      'commune_code_revision_proposal',
      p_proposal_id,
      case
        when v_is_troubleshooting and v_status = 'accepted' then 'Your Troubleshooting Grove fix was accepted'
        when v_is_troubleshooting and v_status = 'needs_changes' then 'Changes requested on your Troubleshooting Grove fix'
        when v_is_troubleshooting and v_status = 'hidden_by_moderation' then 'A Troubleshooting Grove proposed fix was hidden by moderation'
        when v_is_troubleshooting then 'Your Troubleshooting Grove fix was rejected'
        when v_status = 'accepted' then 'Your Coding Cornucopia revision was accepted'
        when v_status = 'needs_changes' then 'Changes requested on your Coding Cornucopia revision'
        when v_status = 'hidden_by_moderation' then 'A Coding Cornucopia proposal was hidden by moderation'
        else 'Your Coding Cornucopia revision was rejected' end,
      case
        when v_is_troubleshooting and v_status = 'accepted' then 'The original post author accepted your proposed fix. The public reproduction snippet now points to the accepted snapshot.'
        when v_is_troubleshooting and v_status = 'needs_changes' then 'The original post author asked for changes. The public reproduction snippet remains unchanged.'
        when v_is_troubleshooting and v_status = 'hidden_by_moderation' then 'A moderator hid this proposed fix for safety review. The public reproduction snippet remains unchanged.'
        when v_is_troubleshooting then 'The original post author rejected the proposed fix. The public reproduction snippet remains unchanged.'
        when v_status = 'accepted' then 'The original post author accepted your revision. The public attached code now points to the accepted snapshot.'
        when v_status = 'needs_changes' then 'The original post author asked for changes. The public attached code remains unchanged.'
        when v_status = 'hidden_by_moderation' then 'A moderator hid this proposal for safety review. The public attached code remains unchanged.'
        else 'The original post author rejected the proposal. The public attached code remains unchanged.' end,
      v_review_path || '?proposal=' || p_proposal_id::text
    );
  end if;
end;
$$;

alter function public.submit_commune_code_revision_proposal_v2(uuid, uuid, uuid, text, text, text, text, text) owner to postgres;
alter function public.submit_commune_code_revision_proposal(uuid, uuid, text, text, text, text, text) owner to postgres;
alter function public.withdraw_commune_code_revision_proposal(uuid) owner to postgres;
alter function public.decide_commune_code_revision_proposal(uuid, text, text) owner to postgres;

revoke all privileges on function public.submit_commune_code_revision_proposal_v2(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.submit_commune_code_revision_proposal(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.withdraw_commune_code_revision_proposal(uuid)
  from public, anon, authenticated, service_role;
revoke all privileges on function public.decide_commune_code_revision_proposal(uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.submit_commune_code_revision_proposal_v2(uuid, uuid, uuid, text, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.submit_commune_code_revision_proposal(uuid, uuid, text, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.withdraw_commune_code_revision_proposal(uuid)
  to authenticated, service_role;
grant execute on function public.decide_commune_code_revision_proposal(uuid, text, text)
  to authenticated, service_role;

comment on column public.commune_code_revision_proposals.client_request_id is
  'Persistent proposer-scoped idempotency key. It is metadata, not proposal authority.';
comment on function public.submit_commune_code_revision_proposal_v2(uuid, uuid, uuid, text, text, text, text, text) is
  'Authoritative retry-safe proposal creation. Source IDs, author, proposer, and base snapshot are derived and cross-checked server-side.';
comment on function public.submit_commune_code_revision_proposal(uuid, uuid, text, text, text, text, text) is
  'Temporary legacy client compatibility wrapper. New clients must supply a persistent request ID to the v2 RPC.';
comment on function public.withdraw_commune_code_revision_proposal(uuid) is
  'Authoritative proposer-only withdrawal. It never changes the published snippet.';

commit;
